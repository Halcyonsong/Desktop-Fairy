package io.github.halcyonsong.chat.tool.service.support;

import io.github.halcyonsong.chat.common.enums.ChatEventTypeEnum;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamEventSupport;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamState;
import io.github.halcyonsong.chat.tool.constants.ToolChatDirectiveConstants;
import io.github.halcyonsong.chat.tool.enums.ToolChatStageEnum;
import io.github.halcyonsong.chat.tool.enums.ToolRoundDirectiveEnum;
import io.github.halcyonsong.chat.tool.pojo.vo.ToolStatusEventVO;
import io.github.halcyonsong.chat.tool.tool.ToolFunctionRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class ToolStreamingLoopSupport {

    private final ToolFunctionRegistry toolFunctionRegistry;
    private final ChatStreamEventSupport chatStreamEventSupport;
    private final ToolChatPromptSupport toolChatPromptSupport;

    // 流式递归调用
    public Flux<ChatEventVO> streamLoop(ChatClient chatClient,
                                        String systemPrompt,
                                        String originalQuestion,
                                        String sessionId,
                                        ChatStreamState streamState,
                                        ToolLoopRuntimeState runtimeState,
                                        int round) {
        // 判断是否继续递归调用
        ChatEventVO limitEvent = resolveLimitEvent(runtimeState, round);
        if (limitEvent != null) {
            return Flux.just(limitEvent);
        }
        // 每轮新建临时状态记录
        ToolRoundState roundState = new ToolRoundState(round);
        // 构建本轮用户提示
        String roundUserPrompt = toolChatPromptSupport.buildRoundUserPrompt(
                originalQuestion,
                streamState.getOutputBuilder().toString(),
                runtimeState.getLatestToolSummary(),
                round,
                runtimeState.getMaxRounds()
        );
        // 构建轮次开始事件
        Flux<ChatEventVO> startFlux = Flux.just(
                buildToolStatusEvent(round, ToolChatStageEnum.ROUND_START.getCode(), "第 " + round + " 轮开始")
        );
        String roundSystemPrompt = toolChatPromptSupport.buildRoundSystemPrompt(systemPrompt, runtimeState);
        // 构建本轮正式调用方法
        Flux<ChatEventVO> roundFlux = chatClient.prompt()
                .system(roundSystemPrompt)
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, sessionId))
                .user(roundUserPrompt)
                .tools(toolFunctionRegistry.getToolFunctions())
                .stream()
                .chatResponse()
                .concatMap(chatResponse -> handleRoundChunk(chatResponse, streamState, roundState, runtimeState));

        return  buildLoopHeaderFlux(streamState, round)
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

    // 判断并添加调用头
    private Flux<ChatEventVO> buildLoopHeaderFlux(ChatStreamState streamState, int round) {
        if (round != 1) {
            return Flux.empty();
        }
        String loopHeader = ToolChatDirectiveConstants.LOOP + "\n";
        streamState.getOutputBuilder().append(loopHeader);
        return Flux.just(ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.DATA.getValue())
                .eventData(loopHeader)
                .build());
    }

    // 检查是否超过限制
    private ChatEventVO resolveLimitEvent(ToolLoopRuntimeState runtimeState, int round) {
        if (runtimeState.exceedsRoundLimit(round)) {
            return buildToolStatusEvent(round - 1, ToolChatStageEnum.ROUND_LIMIT.getCode(), "已达到最大轮次限制，停止继续处理。");
        }
        if (runtimeState.exceedsToolCallLimit()) {
            return buildToolStatusEvent(round - 1, ToolChatStageEnum.TOOL_LIMIT.getCode(), "已达到最大工具调用次数限制，停止继续处理。");
        }
        if (runtimeState.exceedsDurationLimit()) {
            return buildToolStatusEvent(round - 1, ToolChatStageEnum.TIME_LIMIT.getCode(), "已达到最大执行时长限制，停止继续处理。");
        }
        if (runtimeState.exceedsMissingDirectiveLimit()) {
            return buildToolStatusEvent(round - 1, ToolChatStageEnum.DIRECTIVE_LIMIT.getCode(), "连续多轮未输出控制标记，停止继续处理。");
        }
        return null;
    }

    // 处理每轮的输出，是否包含工具调用，再包装成事件
    private Flux<ChatEventVO> handleRoundChunk(ChatResponse chatResponse,
                                               ChatStreamState streamState,
                                               ToolRoundState roundState,
                                               ToolLoopRuntimeState runtimeState) {
        // 从响应中提取助手消息
        AssistantMessage assistantMessage = Optional.ofNullable(chatResponse)
                .map(ChatResponse::getResult)
                .map(Generation::getOutput)
                .orElse(null);
        // 构建前缀事件容器
        List<ChatEventVO> prefixEvents = new ArrayList<>();
        // 有工具调用事件的特殊处理
        if (assistantMessage != null && assistantMessage.hasToolCalls()) {
            roundState.markToolCallDetected();
            // 获取工具调用列表
            List<AssistantMessage.ToolCall> toolCalls = assistantMessage.getToolCalls();
            if (!CollectionUtils.isEmpty(toolCalls)) {
                for (AssistantMessage.ToolCall toolCall : toolCalls) {
                    boolean firstSeen = runtimeState.registerToolCall(toolCall.id());
                    if (!firstSeen) {
                        continue;
                    }
                    String toolSummary = summarizeToolCall(toolCall);
                    roundState.addToolSummary(toolSummary);

                    prefixEvents.add(buildToolStatusEvent(
                            roundState.getRound(),
                            ToolChatStageEnum.TOOL_CALL.getCode(),
                            "检测到工具调用: " + toolSummary
                    ));
                }
            } else {
                prefixEvents.add(buildToolStatusEvent(
                        roundState.getRound(),
                        ToolChatStageEnum.TOOL_CALL.getCode(),
                        "检测到工具调用"
                ));
            }
        }

        String text = assistantMessage == null ? null : assistantMessage.getText();
        if (StringUtils.hasText(text)) {
            // 追加输出到本轮输出临时记录容器
            roundState.appendRoundOutput(text);
        }

        Flux<ChatEventVO> prefixFlux = Flux.fromIterable(prefixEvents);
        Flux<ChatEventVO> dataFlux = chatStreamEventSupport.toChatEvents(chatResponse, streamState);

        return prefixFlux.concatWith(dataFlux);
    }

    // 处理每轮结束，判断是否继续下一轮
    private Flux<ChatEventVO> afterRound(ChatClient chatClient,
                                         String systemPrompt,
                                         String originalQuestion,
                                         String sessionId,
                                         ChatStreamState streamState,
                                         ToolLoopRuntimeState runtimeState,
                                         ToolRoundState roundState) {
        // 从一轮记录中取出全部
        String roundOutput = roundState.getRoundOutput();
        ToolRoundDirectiveEnum directive = resolveRoundDirective(roundOutput);

        log.info("tool stream round finished, sessionId={}, round={}, directive={}, toolCallDetected={}, roundOutputLength={}",
                sessionId,
                roundState.getRound(),
                directive,
                roundState.isToolCallDetected(),
                roundOutput.length());
        // 更新最新工具调用事件
        runtimeState.setLatestToolSummary(roundState.getToolSummaryText());

        if (directive == ToolRoundDirectiveEnum.FINISH) {
            return Flux.empty();
        }

        // 统计事件
        List<ChatEventVO> bridgeEvents = new ArrayList<>();

        if (directive == ToolRoundDirectiveEnum.MISSING) {
            runtimeState.increaseMissingDirectiveCount();

            String missingDirectiveText = "\n" + ToolChatDirectiveConstants.MISSING + "\n";
            streamState.getOutputBuilder().append(missingDirectiveText);

            bridgeEvents.add(buildMissingDirectiveDataEvent());
            bridgeEvents.add(buildDirectiveWarningEvent(roundState.getRound()));
            // 标记上一轮缺少标记
            runtimeState.setPreviousDirectiveMissing(true);
            // 超过容错限度强制终止
            if (runtimeState.exceedsMissingDirectiveLimit()) {
                bridgeEvents.add(buildMissingDirectiveLimitEvent(roundState.getRound()));
                return Flux.fromIterable(bridgeEvents);
            }
        }
        if (directive == ToolRoundDirectiveEnum.CONTINUE) {
            runtimeState.setPreviousDirectiveMissing(false);
            runtimeState.resetMissingDirectiveCount();
        }

        if (StringUtils.hasText(roundState.getToolSummaryText())) {
            bridgeEvents.add(ChatEventVO.builder()
                    .eventType(ChatEventTypeEnum.TOOL_RESULT.getValue())
                    .eventData(ToolStatusEventVO.builder()
                            .round(roundState.getRound())
                            .stage(ToolChatStageEnum.TOOL_RESULT.getCode())
                            .message(roundState.getToolSummaryText())
                            .build())
                    .build());
        }

        bridgeEvents.add(buildToolStatusEvent(
                roundState.getRound(),
                ToolChatStageEnum.ROUND_CONTINUE.getCode(),
                directive == ToolRoundDirectiveEnum.CONTINUE
                        ? "模型要求继续进入下一轮。"
                        : "本轮未提供结束标记，系统默认继续进入下一轮。"
        ));

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

    // 包装工具调用事件
    private ChatEventVO buildToolStatusEvent(int round, String stage, String message) {
        ToolStatusEventVO eventVO = ToolStatusEventVO.builder()
                .round(round)
                .stage(stage)
                .message(message)
                .build();

        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.TOOL_STATUS.getValue())
                .eventData(eventVO)
                .build();
    }

    // 判断工具调用类型
    private String summarizeToolCall(AssistantMessage.ToolCall toolCall) {
        if (toolCall == null) {
            return "unknown-tool-call";
        }

        String id = toolCall.id();
        String name = toolCall.name();
        String arguments = toolCall.arguments();

        return "id=%s, name=%s, arguments=%s".formatted(
                id,
                name,
                arguments
        );
    }

    // 判断本轮结束事件
    private ToolRoundDirectiveEnum resolveRoundDirective(String roundOutput) {
        if (!StringUtils.hasText(roundOutput)) {
            return ToolRoundDirectiveEnum.MISSING;
        }
        String normalized = roundOutput.trim();
        if (normalized.endsWith(ToolChatDirectiveConstants.FINISH)) {
            return ToolRoundDirectiveEnum.FINISH;
        }
        if (normalized.endsWith(ToolChatDirectiveConstants.CONTINUE)) {
            return ToolRoundDirectiveEnum.CONTINUE;
        }
        return ToolRoundDirectiveEnum.MISSING;
    }

    private ChatEventVO buildDirectiveWarningEvent(int round) {
        return buildToolStatusEvent(
                round,
                ToolChatStageEnum.DIRECTIVE_WARNING.getCode(),
                "本轮回答末尾未检测到 @Continue 或 @Finish，系统已追加 @Missing，并继续进入下一轮。"
        );
    }

    private ChatEventVO buildMissingDirectiveDataEvent() {
        return ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.DATA.getValue())
                .eventData("\n" + ToolChatDirectiveConstants.MISSING + "\n")
                .build();
    }

    private ChatEventVO buildMissingDirectiveLimitEvent(int round) {
        return buildToolStatusEvent(
                round,
                ToolChatStageEnum.DIRECTIVE_LIMIT.getCode(),
                "连续多轮未输出 @Continue 或 @Finish，系统已强制终止本次处理。"
        );
    }

}