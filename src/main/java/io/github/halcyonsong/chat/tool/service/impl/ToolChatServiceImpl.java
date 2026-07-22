package io.github.halcyonsong.chat.tool.service.impl;

import io.github.halcyonsong.chat.common.config.prompt.ToolChatProperties;
import io.github.halcyonsong.chat.common.factory.OpenAiCompatibleChatClientFactory;
import io.github.halcyonsong.chat.session.service.ChatSessionService;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistorySupport;
import io.github.halcyonsong.chat.session.service.support.session.ChatSessionMemorySupport;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.chat.stream.pojo.dto.ChatDTO;
import io.github.halcyonsong.chat.stream.pojo.dto.ChatRequestDTO;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.stream.service.support.options.ModelConfigResolver;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamLifecycleSupport;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamState;
import io.github.halcyonsong.chat.tool.service.ToolChatService;
import io.github.halcyonsong.chat.tool.service.support.*;
import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

@Slf4j
@Service
@RequiredArgsConstructor
public class ToolChatServiceImpl implements ToolChatService {

    private final OpenAiCompatibleChatClientFactory chatClientFactory;
    private final ChatSessionService chatSessionService;
    private final ChatHistorySupport chatHistorySupport;
    private final ChatSessionMemorySupport chatSessionMemorySupport;
    private final ModelConfigResolver modelConfigResolver;
    private final ToolChatPromptSupport toolChatPromptSupport;
    private final ToolStreamingLoopSupport toolStreamingLoopSupport;
    private final ChatStreamLifecycleSupport chatStreamLifecycleSupport;
    private final ToolChatProperties toolChatProperties;

    @Override
    public Flux<ChatEventVO> chat(ChatRequestDTO chatRequestDTO) {
        ChatDTO chatDTO = chatRequestDTO.getChat();
        ModelConfig modelConfig = modelConfigResolver.resolve(chatRequestDTO.getModel());

        String question = chatDTO.getQuestion();
        String sessionId = chatDTO.getSessionId();

        log.info("tool chat start, sessionId={}, questionLength={}, model={}, baseUrl={}",
                sessionId,
                question.length(),
                modelConfig.getModel(),
                modelConfig.getBaseUrl());

        chatSessionService.touchSession(sessionId);
        chatSessionMemorySupport.ensureMemoryWindowInitialized(sessionId);

        ChatClient chatClient = chatClientFactory.create(modelConfig);
        ChatStreamState streamState = new ChatStreamState(sessionId);

        chatHistorySupport.appendUserHistory(sessionId, question);
        // 基础系统提示词，系统+用户设定
        String baseSystemPrompt = toolChatPromptSupport.resolveSystemPrompt(sessionId, chatRequestDTO.getSystemPrompt());
        // 拼接会话文件提示词
        String fileAwareSystemPrompt = toolChatPromptSupport.appendSessionFilePrompt(
                sessionId,
                baseSystemPrompt
        );
        // 调用开始前设置调用限制和记录状态工具
        ToolLoopRuntimeState runtimeState = new ToolLoopRuntimeState(
                toolChatProperties.getMaxRounds(),
                toolChatProperties.getMaxToolCalls(),
                toolChatProperties.getMaxDurationSeconds()
        );
        // 拼接运行时约束提示词
        String systemPrompt = toolChatPromptSupport.appendRuntimeConstraintPrompt(
                fileAwareSystemPrompt,
                runtimeState.getMaxRounds(),
                runtimeState.getMaxToolCalls(),
                runtimeState.getMaxDurationSeconds()
        );
        // 发起调用，此处只调用一次，方法内部自行递归调用
        return toolStreamingLoopSupport.streamLoop(
                        chatClient,
                        systemPrompt,
                        question,
                        sessionId,
                        streamState,
                        runtimeState,
                        1
                )
                // 监控每一轮调用状态
                .onErrorResume(throwable -> chatStreamLifecycleSupport.resumeOnError(streamState, throwable))
                // 调用结束后续处理
                .concatWith(Flux.defer(() -> chatStreamLifecycleSupport.buildTerminalEvents(streamState, modelConfig)));
    }
}