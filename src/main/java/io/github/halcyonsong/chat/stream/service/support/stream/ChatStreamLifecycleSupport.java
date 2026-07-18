package io.github.halcyonsong.chat.stream.service.support.stream;

import io.github.halcyonsong.chat.common.enums.ChatEventTypeEnum;
import io.github.halcyonsong.chat.common.enums.ChatHistoryStatusEnum;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistorySupport;
import io.github.halcyonsong.chat.session.service.support.session.ChatSessionRollbackSupport;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.sum.service.ChatSummaryService;
import io.github.halcyonsong.chat.sum.service.support.summary.ChatSummaryCompressLockSupport;
import jakarta.annotation.Resource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.concurrent.Executor;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatStreamLifecycleSupport {

    private final MessageWindowChatMemory messageWindowChatMemory;
    private final ChatHistorySupport chatHistorySupport;
    private final ChatSessionRollbackSupport chatSessionRollbackSupport;
    private final ChatSummaryService chatSummaryService;
    private final ChatSummaryCompressLockSupport chatSummaryCompressLockSupport;

    @Resource(name = "chatSummaryExecutor")
    private Executor chatSummaryExecutor;

    public Flux<ChatEventVO> resumeOnError(ChatStreamState state, Throwable throwable) {
        if (state.getInterrupted().get()) {
            log.info("chat stream cancelled after interrupt, sessionId={}, outputLength={}, message={}",
                    state.getSessionId(),
                    state.getOutputBuilder().length(),
                    throwable.getMessage());
            return Flux.empty();
        }

        log.error("chat stream failed, sessionId={}, outputLength={}",
                state.getSessionId(),
                state.getOutputBuilder().length(),
                throwable);

        state.getFailed().set(true);

        String errorTip = resolveServiceErrorMessage(throwable);
        String memoryText;
        if (state.getOutputBuilder().isEmpty()) {
            memoryText = errorTip;
        } else {
            memoryText = state.getOutputBuilder() + "\n\n[系统提示] " + errorTip + " 以上内容可能不完整。";
        }

        state.getErrorMessage().set(memoryText);

        messageWindowChatMemory.add(
                state.getSessionId(),
                List.of(new AssistantMessage(memoryText))
        );

        chatHistorySupport.appendAssistantHistory(
                state.getSessionId(),
                memoryText,
                ChatHistoryStatusEnum.ERROR.getValue()
        );

        return Flux.empty();
    }

    public Flux<ChatEventVO> buildTerminalEvents(ChatStreamState state, ModelConfig modelConfig) {
        if (state.getFailed().get()) {
            log.warn("chat finished with error, sessionId={}, outputLength={}",
                    state.getSessionId(),
                    state.getOutputBuilder().length());

            return Flux.just(ChatEventVO.builder()
                    .eventType(ChatEventTypeEnum.ERROR.getValue())
                    .eventData(state.getErrorMessage().get())
                    .build());
        }

        if (state.getInterrupted().get()) {
            log.info("chat finished by interrupt, sessionId={}, outputLength={}, assistantOutputStarted={}",
                    state.getSessionId(),
                    state.getOutputBuilder().length(),
                    state.getAssistantOutputStarted().get());

            if (!state.getAssistantOutputStarted().get()) {
                rollbackInterruptedRound(state);

                return Flux.just(ChatEventVO.builder()
                        .eventType(ChatEventTypeEnum.INTERRUPTED.getValue())
                        .eventData("")
                        .build());
            }

            String interruptedContent = state.getOutputBuilder().toString();
            if (StringUtils.hasText(interruptedContent)) {
                messageWindowChatMemory.add(
                        state.getSessionId(),
                        List.of(new AssistantMessage(interruptedContent))
                );

                chatHistorySupport.appendAssistantHistory(
                        state.getSessionId(),
                        interruptedContent,
                        ChatHistoryStatusEnum.INTERRUPTED.getValue()
                );
            }

            return Flux.just(ChatEventVO.builder()
                    .eventType(ChatEventTypeEnum.INTERRUPTED.getValue())
                    .eventData("")
                    .build());
        }

        log.info("chat finished normally, sessionId={}, outputLength={}",
                state.getSessionId(),
                state.getOutputBuilder().length());

        chatHistorySupport.appendAssistantHistory(
                state.getSessionId(),
                state.getOutputBuilder().toString(),
                ChatHistoryStatusEnum.COMPLETED.getValue()
        );
        // 触发异步压缩
        triggerSummaryCompressionAsync(state.getSessionId(), modelConfig);

        return Flux.just(ChatEventVO.builder()
                .eventType(ChatEventTypeEnum.STOP.getValue())
                .eventData("")
                .build());
    }

    private void rollbackInterruptedRound(ChatStreamState state) {
        try {
            List<ChatHistoryEntity> remainingHistory =
                    chatSessionRollbackSupport.rollbackLastRound(state.getSessionId());

            log.info("rollback last round after pre-first-token interrupt, sessionId={}, remainingHistorySize={}",
                    state.getSessionId(),
                    remainingHistory.size());
        } catch (Exception exception) {
            log.error("rollback last round failed after pre-first-token interrupt, sessionId={}",
                    state.getSessionId(),
                    exception);
        }
    }

    private String resolveServiceErrorMessage(Throwable throwable) {
        String rawMessage = extractThrowableMessage(throwable).toLowerCase();

        if (rawMessage.contains("401") || rawMessage.contains("unauthorized")) {
            return "模型服务认证失败，请检查 API Key 是否有效、是否过期，或供应商鉴权配置是否正确。";
        }

        if (rawMessage.contains("403") || rawMessage.contains("forbidden")) {
            return "模型服务拒绝访问，请检查当前账号或模型权限。";
        }

        if (rawMessage.contains("404") || rawMessage.contains("not found")) {
            return "模型服务地址不可用，请检查请求地址或接口路径是否正确。";
        }

        if (rawMessage.contains("429") || rawMessage.contains("too many requests")) {
            return "模型服务请求过于频繁，或当前额度不足，请稍后重试。";
        }

        if (rawMessage.contains("500")
                || rawMessage.contains("502")
                || rawMessage.contains("503")
                || rawMessage.contains("504")) {
            return "模型服务暂时不可用，请稍后重试。";
        }

        if (rawMessage.contains("timed out")
                || rawMessage.contains("timeout")
                || rawMessage.contains("readtimeoutexception")
                || rawMessage.contains("sockettimeoutexception")) {
            return "模型服务响应超时，请稍后重试。";
        }

        if (rawMessage.contains("connection refused")
                || rawMessage.contains("connectexception")
                || rawMessage.contains("unknownhost")
                || rawMessage.contains("failed to connect")) {
            return "无法连接到模型服务，请检查请求地址和网络连接。";
        }

        return "模型服务调用失败，请稍后重试。";
    }

    private String extractThrowableMessage(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        Throwable current = throwable;

        while (current != null) {
            if (current.getMessage() != null) {
                builder.append(current.getMessage()).append(" | ");
            }
            current = current.getCause();
        }

        return builder.toString();
    }

    // 异步压缩会话历史消息
    private void triggerSummaryCompressionAsync(String sessionId, ModelConfig modelConfig) {
        if (!chatSummaryCompressLockSupport.tryLock(sessionId)) {
            log.debug("skip summary compression because another task is running, sessionId={}", sessionId);
            return;
        }

        chatSummaryExecutor.execute(() -> {
            try {
                chatSummaryService.compressPendingHistory(sessionId, modelConfig);
            } catch (Exception exception) {
                log.error("async summary compression failed, sessionId={}", sessionId, exception);
            } finally {
                chatSummaryCompressLockSupport.unlock(sessionId);
            }
        });
    }


}