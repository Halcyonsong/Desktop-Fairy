package io.github.halcyonsong.chat.tool.service.support;

import io.github.halcyonsong.chat.common.enums.ChatEventTypeEnum;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamEventSupport;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamState;
import io.github.halcyonsong.chat.tool.enums.ToolChatStageEnum;
import io.github.halcyonsong.chat.tool.enums.ToolLoopDecisionEnum;
import io.github.halcyonsong.chat.tool.pojo.PendingMediaAttachment;
import io.github.halcyonsong.chat.tool.pojo.vo.PermissionRequestEventVO;
import io.github.halcyonsong.chat.tool.pojo.vo.ToolStatusEventVO;
import io.github.halcyonsong.chat.tool.service.support.status.PermissionRequestState;
import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import io.github.halcyonsong.chat.tool.service.support.status.ToolRoundState;
import io.github.halcyonsong.chat.tool.tool.ToolFunctionFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class ToolStreamingLoopSupport {

    private final ToolFunctionFactory toolFunctionFactory;
    private final ChatStreamEventSupport chatStreamEventSupport;
    private final ToolChatPromptSupport toolChatPromptSupport;

    // 递归轮次调用
    public Flux<ChatEventVO> streamLoop(ChatClient chatClient,
                                        String systemPrompt,
                                        String originalQuestion,
                                        String sessionId,
                                        ChatStreamState streamState,
                                        ToolLoopRuntimeState runtimeState,
                                        int round) {
        ChatEventVO limitEvent = resolveLimitEvent(runtimeState, round);
        if (limitEvent != null) {
            return Flux.just(limitEvent);
        }
        // 重置当前轮次决策
        runtimeState.resetCurrentRoundDecision();
        // 新建当前轮次状态记录
        ToolRoundState roundState = new ToolRoundState(round);
        // 构建当前轮次用户提示
        String roundUserPrompt = toolChatPromptSupport.buildRoundUserPrompt(
                originalQuestion,
                streamState.getOutputBuilder().toString(),
                runtimeState.getLatestToolSummary(),
                round,
                runtimeState.getMaxRounds()
        );
        // 发起轮次开始事件
        Flux<ChatEventVO> startFlux = Flux.just(
                buildNullToolStatusEvent(round, ToolChatStageEnum.ROUND_START.getCode(), "第 " + round + " 轮开始")
        );
        // 构建当前轮次系统提示
        String roundSystemPrompt = toolChatPromptSupport.buildRoundSystemPrompt(systemPrompt, runtimeState);
        // 构建当前轮次请求基础客户端
        ChatClient.ChatClientRequestSpec requestSpec = chatClient.prompt()
                .system(roundSystemPrompt)
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, sessionId))
                .tools(toolFunctionFactory.createToolFunctions(sessionId, runtimeState));
        // 构建当前轮次事件流
        Flux<ChatEventVO> roundFlux;
        // 校验当前轮次是否有待处理的媒体附件
        if (runtimeState.hasPendingMediaAttachments()) {
            roundFlux = Flux.defer(() -> {
                        applyRoundUserInput(requestSpec, roundUserPrompt, runtimeState);
                        // 发起媒体请求开始事件
                        return Flux.just(buildNullToolStatusEvent(
                                round,
                                ToolChatStageEnum.MEDIA_REQUEST_START.getCode(),
                                ToolChatStageEnum.MEDIA_REQUEST_START.getDesc()
                        ));
                    })
                    .concatWith(Flux.defer(() -> requestSpec.stream()
                            .chatResponse()
                            .concatMap(chatResponse -> handleRoundChunk(chatResponse, streamState, roundState, runtimeState))));
        } else {
            applyRoundUserInput(requestSpec, roundUserPrompt, runtimeState);
            // 无媒体附件，直接发起轮次请求
            roundFlux = requestSpec.stream()
                    .chatResponse()
                    .concatMap(chatResponse -> handleRoundChunk(chatResponse, streamState, roundState, runtimeState));
        }
        // 正式发起请求
        return buildLoopHeaderFlux(round)
                .concatWith(startFlux)
                .concatWith(roundFlux)
                .concatWith(Flux.defer(() -> afterRound(
                        chatClient,
                        systemPrompt,
                        originalQuestion,
                        sessionId,
                        streamState,
                        runtimeState,
                        roundState
                )));
    }

    // 应用当前轮次用户提示词
    private void applyRoundUserInput(ChatClient.ChatClientRequestSpec requestSpec,
                                     String roundUserPrompt,
                                     ToolLoopRuntimeState runtimeState) {
        if (!runtimeState.hasPendingMediaAttachments()) {
            requestSpec.user(roundUserPrompt);
            return;
        }
        // 消费当前轮次待处理的媒体附件
        List<PendingMediaAttachment> attachments = runtimeState.consumePendingMediaAttachments();

        requestSpec.user(userSpec -> {
            userSpec.text(roundUserPrompt);

            for (PendingMediaAttachment attachment : attachments) {
                MimeType mimeType = resolveMimeType(attachment.getContentType());
                FileSystemResource resource = new FileSystemResource(attachment.getPath());
                userSpec.media(mimeType, resource);
            }
        });
    }

    // 解析当前轮次媒体附件类型
    private MimeType resolveMimeType(String contentType) {
        if (StringUtils.hasText(contentType)) {
            return MimeType.valueOf(contentType.trim());
        }
        return MimeTypeUtils.APPLICATION_OCTET_STREAM;
    }

    // 构建当前轮次循环头事件
    private Flux<ChatEventVO> buildLoopHeaderFlux(int round) {
        if (round != 1) {
            return Flux.empty();
        }
        return Flux.just(buildDecisionEvent(
                round,
                ToolChatStageEnum.LOOP_START.getCode(),
                ToolChatStageEnum.LOOP_START.getDesc()
        ));
    }

    // 解析当前轮次限制事件
       private ChatEventVO resolveLimitEvent(ToolLoopRuntimeState runtimeState, int round) {
        if (runtimeState.exceedsRoundLimit(round)) {
            return buildNullToolStatusEvent(round - 1, ToolChatStageEnum.ROUND_LIMIT.getCode(), "已达到最大轮次限制，停止继续处理。");
        }
        if (runtimeState.exceedsToolCallLimit()) {
            return buildNullToolStatusEvent(round - 1, ToolChatStageEnum.TOOL_LIMIT.getCode(), "已达到最大工具调用次数限制，停止继续处理。");
        }
        if (runtimeState.exceedsDurationLimit()) {
            return buildNullToolStatusEvent(round - 1, ToolChatStageEnum.TIME_LIMIT.getCode(), "已达到最大执行时长限制，停止继续处理。");
        }
        return null;
    }

    // 处理当前轮次响应块
    private Flux<ChatEventVO> handleRoundChunk(ChatResponse chatResponse,
                                               ChatStreamState streamState,
                                               ToolRoundState roundState,
                                               ToolLoopRuntimeState runtimeState) {
        AssistantMessage assistantMessage = Optional.ofNullable(chatResponse)
                .map(ChatResponse::getResult)
                .map(Generation::getOutput)
                .orElse(null);

        if (assistantMessage == null) {
            log.info("tool chunk: assistantMessage is null");
        } else {
            log.info("tool chunk: hasToolCalls={}, text={}, metadata={}",
                    assistantMessage.hasToolCalls(),
                    assistantMessage.getText(),
                    assistantMessage.getMetadata());
        }

        List<ChatEventVO> prefixEvents = new ArrayList<>();
        // 处理当前轮次工具调用
        if (assistantMessage != null && assistantMessage.hasToolCalls()) {
            roundState.markToolCallDetected();
            // 解析当前轮次工具调用
            List<AssistantMessage.ToolCall> toolCalls = assistantMessage.getToolCalls();
            if (!CollectionUtils.isEmpty(toolCalls)) {
                for (AssistantMessage.ToolCall toolCall : toolCalls) {
                    String toolCallKey = runtimeState.resolveToolCallKey(roundState.getRound(), toolCall);
                    boolean firstSeen = runtimeState.registerToolCall(toolCallKey);
                    if (!firstSeen) {
                        continue;
                    }

                    String toolSummary = summarizeToolCall(toolCall);
                    roundState.addToolSummary(toolSummary);

                    log.info("tool call detected, round={}, id={}, name={}, arguments={}",
                            roundState.getRound(),
                            toolCall.id(),
                            toolCall.name(),
                            toolCall.arguments());

                    prefixEvents.add(buildToolStatusEvent(
                            roundState.getRound(),
                            ToolChatStageEnum.TOOL_CALL.getCode(),
                            "检测到工具调用",
                            toolCall));
                }
            } else {
                prefixEvents.add(buildNullToolStatusEvent(
                        roundState.getRound(),
                        ToolChatStageEnum.TOOL_CALL.getCode(),
                        "检测到工具调用"
                ));
            }
        }

        String text = assistantMessage == null ? null : assistantMessage.getText();
        if (StringUtils.hasText(text)) {
            roundState.appendRoundOutput(text);
        }

        Flux<ChatEventVO> prefixFlux = Flux.fromIterable(prefixEvents);
        Flux<ChatEventVO> dataFlux = chatStreamEventSupport.toChatEvents(chatResponse, streamState);

        return prefixFlux.concatWith(dataFlux);
    }

    // 处理当前轮次结束事件
    private Flux<ChatEventVO> afterRound(ChatClient chatClient,
                                         String systemPrompt,
                                         String originalQuestion,
                                         String sessionId,
                                         ChatStreamState streamState,
                                         ToolLoopRuntimeState runtimeState,
                                         ToolRoundState roundState) {
        String roundOutput = roundState.getRoundOutput();
        ToolLoopDecisionEnum decision = runtimeState.getCurrentRoundDecision();

        log.info("tool stream round finished, sessionId={}, round={}, decision={}, reason={}, toolCallDetected={}, roundOutputLength={}",
                sessionId,
                roundState.getRound(),
                decision,
                runtimeState.getCurrentRoundDecisionReason(),
                roundState.isToolCallDetected(),
                roundOutput.length());

        runtimeState.setLatestToolSummary(roundState.getToolSummaryText());

        List<ChatEventVO> bridgeEvents = new ArrayList<>();

        if (StringUtils.hasText(roundState.getToolSummaryText())) {
            bridgeEvents.add(buildToolResultEvent(
                    roundState.getRound(),
                    roundState.getToolSummaryText()
            ));
        }
        if (runtimeState.hasPendingPermissionRequest()) {
            bridgeEvents.add(buildPermissionRequestEvent(runtimeState.getPendingPermissionRequest()));
            runtimeState.clearPendingPermissionRequest();
            return Flux.fromIterable(bridgeEvents);
        }
        // 判断是否继续下一轮
        if (decision == ToolLoopDecisionEnum.CONTINUE) {
            bridgeEvents.add(buildDecisionEvent(
                    roundState.getRound(),
                    ToolChatStageEnum.ROUND_CONTINUE.getCode(),
                    StringUtils.hasText(runtimeState.getCurrentRoundDecisionReason())
                            ? "模型要求继续进入下一轮：" + runtimeState.getCurrentRoundDecisionReason()
                            : "模型要求继续进入下一轮。"
            ));
            // 补充轮次分隔符
            appendRoundSeparatorIfNeeded(streamState);
            // 继续下一轮
            return Flux.fromIterable(bridgeEvents)
                    .concatWith(streamLoop(
                            chatClient,
                            systemPrompt,
                            originalQuestion,
                            sessionId,
                            streamState,
                            runtimeState,
                            roundState.getRound() + 1
                    ));
        }
        // 结束轮次请求
        if (decision == ToolLoopDecisionEnum.FINISH) {
            bridgeEvents.add(buildDecisionEvent(
                    roundState.getRound(),
                    ToolChatStageEnum.ROUND_FINISH.getCode(),
                    StringUtils.hasText(runtimeState.getCurrentRoundDecisionReason())
                            ? "模型决定结束本次处理：" + runtimeState.getCurrentRoundDecisionReason()
                            : "模型决定结束本次处理。"
            ));
            return Flux.fromIterable(bridgeEvents);
        }
        // 兜底结束
        bridgeEvents.add(buildDecisionEvent(
                roundState.getRound(),
                ToolChatStageEnum.ROUND_FINISH.getCode(),
                "模型未显式要求继续，系统结束本次处理。"
        ));
        return Flux.fromIterable(bridgeEvents);
    }

    private ChatEventVO buildPermissionRequestEvent(PermissionRequestState requestState) {
        PermissionRequestEventVO eventVO = PermissionRequestEventVO.builder()
                .requestType(requestState.getRequestType())
                .absolutePath(requestState.getAbsolutePath())
                .reason(requestState.getReason())
                .build();

        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.PERMISSION_REQUEST.getValue())
                .eventData(eventVO)
                .build();
    }

    // 判断是否需要补充轮次分隔符
    private void appendRoundSeparatorIfNeeded(ChatStreamState streamState) {
        StringBuilder outputBuilder = streamState.getOutputBuilder();
        if (outputBuilder.isEmpty()) {
            return;
        }

        String content = outputBuilder.toString();
        if (content.endsWith("\n\n")) {
            return;
        }

        if (content.endsWith("\n")) {
            outputBuilder.append("\n");
            return;
        }

        outputBuilder.append("\n\n");
    }

    // 构建空工具状态事件
    private ChatEventVO buildNullToolStatusEvent(int round, String stage, String message) {
        ToolStatusEventVO eventVO = ToolStatusEventVO.builder()
                .round(round)
                .stage(stage)
                .message(message)
                .toolCallId(null)
                .toolName(null)
                .toolArguments(null)
                .build();

        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.TOOL_STATUS.getValue())
                .eventData(eventVO)
                .build();
    }

    // 构建工具状态事件
    private ChatEventVO buildToolStatusEvent(int round, String stage, String message, AssistantMessage.ToolCall toolCall) {
        ToolStatusEventVO eventVO = ToolStatusEventVO.builder()
                .round(round)
                .stage(stage)
                .message(message)
                .toolCallId(toolCall.id())
                .toolName(toolCall.name())
                .toolArguments(toolCall.arguments())
                .build();

        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.TOOL_STATUS.getValue())
                .eventData(eventVO)
                .build();
    }

    // 构建工具结果事件
    private ChatEventVO buildToolResultEvent(int round, String message) {
        ToolStatusEventVO eventVO = ToolStatusEventVO.builder()
                .round(round)
                .stage(ToolChatStageEnum.TOOL_RESULT.getCode())
                .message(message)
                .toolCallId(null)
                .toolName(null)
                .toolArguments(null)
                .build();

        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.TOOL_RESULT.getValue())
                .eventData(eventVO)
                .build();
    }

    // 构建决策事件
    private ChatEventVO buildDecisionEvent(int round, String stage, String message) {
        ToolStatusEventVO eventVO = ToolStatusEventVO.builder()
                .round(round)
                .stage(stage)
                .message(message)
                .toolCallId(null)
                .toolName(null)
                .toolArguments(null)
                .build();

        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.TOOL_STATUS.getValue())
                .eventData(eventVO)
                .build();
    }

    // 摘要工具调用
    private String summarizeToolCall(AssistantMessage.ToolCall toolCall) {
        if (toolCall == null) {
            return "unknown-tool-call";
        }

        String id = toolCall.id();
        String name = toolCall.name();
        String arguments = toolCall.arguments();

        return "id=%s, name=%s, arguments=%s".formatted(id, name, arguments);
    }
}