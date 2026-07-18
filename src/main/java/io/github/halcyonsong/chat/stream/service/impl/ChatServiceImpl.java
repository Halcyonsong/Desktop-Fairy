package io.github.halcyonsong.chat.stream.service.impl;

import io.github.halcyonsong.chat.common.factory.OpenAiCompatibleChatClientFactory;
import io.github.halcyonsong.chat.session.service.ChatSessionService;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistorySupport;
import io.github.halcyonsong.chat.session.service.support.session.ChatSessionMemorySupport;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.chat.stream.pojo.dto.ChatDTO;
import io.github.halcyonsong.chat.stream.pojo.dto.ChatRequestDTO;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.stream.service.ChatService;
import io.github.halcyonsong.chat.stream.service.support.options.ChatRequestOptionsSupport;
import io.github.halcyonsong.chat.stream.service.support.options.ModelConfigResolver;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatInterruptSupport;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamEventSupport;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamLifecycleSupport;
import io.github.halcyonsong.chat.stream.service.support.stream.ChatStreamState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final OpenAiCompatibleChatClientFactory chatClientFactory;
    private final ChatSessionService chatSessionService;
    private final ChatRequestOptionsSupport chatRequestOptionsSupport;
    private final ChatHistorySupport chatHistorySupport;
    private final ChatInterruptSupport chatInterruptSupport;
    private final ChatStreamLifecycleSupport chatStreamLifecycleSupport;
    private final ChatStreamEventSupport chatStreamEventSupport;
    private final ChatSessionMemorySupport chatSessionMemorySupport;
    private final ModelConfigResolver modelConfigResolver;

    @Override
    public Flux<ChatEventVO> chat(ChatRequestDTO chatRequestDTO) {
        // 获取会话请求参数
        ChatDTO chatDTO = chatRequestDTO.getChat();
        // 解析模型配置
        ModelConfig modelConfig = modelConfigResolver.resolve(chatRequestDTO.getModel());

        String question = chatDTO.getQuestion();
        String sessionId = chatDTO.getSessionId();

        log.info("chat start, sessionId={}, questionLength={}, model={}, baseUrl={}",
                sessionId,
                question.length(),
                modelConfig.getModel(),
                modelConfig.getBaseUrl());
        // 更新会话活跃时间
        chatSessionService.touchSession(sessionId);
        chatSessionMemorySupport.ensureMemoryWindowInitialized(sessionId);
        // 动态创建 ChatClient
        ChatClient chatClient = chatClientFactory.create(modelConfig);

        ChatStreamState state = new ChatStreamState(sessionId);
        Sinks.One<Void> stopSignal = chatInterruptSupport.register(sessionId, state);

        ChatClientRequestSpec requestSpec = chatClient.prompt()
                .system(chatRequestOptionsSupport.resolveSystemPrompt(sessionId, chatRequestDTO.getSystemPrompt()))
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, sessionId))
                .user(question);

        chatHistorySupport.appendUserHistory(sessionId, question);

        return requestSpec
                .stream()
                .chatResponse()
                .takeUntilOther(stopSignal.asMono())
                .flatMap(chatResponse -> chatStreamEventSupport.toChatEvents(chatResponse, state))
                .onErrorResume(throwable -> chatStreamLifecycleSupport.resumeOnError(state, throwable))
                .concatWith(Flux.defer(() -> chatStreamLifecycleSupport.buildTerminalEvents(state, modelConfig)))
                .doFinally(signalType -> {
                    log.debug("chat stream finally, sessionId={}, signalType={}", sessionId, signalType);
                    chatInterruptSupport.cleanup(sessionId, stopSignal);
                });
    }

    @Override
    public void interrupt(String sessionId) {
        chatInterruptSupport.interrupt(sessionId);
    }
}