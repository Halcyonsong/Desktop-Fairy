package io.github.halcyonsong.chat.session.service.support.session;

import io.github.halcyonsong.chat.common.constants.ChatMemoryConstants;
import io.github.halcyonsong.chat.common.enums.ChatRoleEnum;
import io.github.halcyonsong.chat.common.memory.InMemoryChatMemoryStore;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistoryStore;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ChatSessionMemorySupport {

    private final InMemoryChatMemoryStore inMemoryChatMemoryStore;
    private final ChatHistoryStore chatHistoryStore;

    // 校验并初始化会话窗口
    public void ensureMemoryWindowInitialized(String sessionId) {
        validateSessionId(sessionId);

        List<Message> existingMessages = inMemoryChatMemoryStore.findByConversationId(sessionId);
        if (!CollectionUtils.isEmpty(existingMessages)) {
            return;
        }

        initializeMemoryWindow(sessionId);
    }

    // 初始化方法
    public void initializeMemoryWindow(String sessionId) {
        validateSessionId(sessionId);

        List<ChatHistoryEntity> fullHistory = chatHistoryStore.listAllHistory(sessionId);
        rebuildMemoryWindow(sessionId, fullHistory);
    }

    // 重建构建会话内存窗口
    public void rebuildMemoryWindow(String sessionId, List<ChatHistoryEntity> historyList) {
        validateSessionId(sessionId);
        // 先清理一次兜底防止残留数据
        inMemoryChatMemoryStore.clear(sessionId);

        if (CollectionUtils.isEmpty(historyList)) {
            return;
        }

        int startIndex = Math.max(0, historyList.size() - ChatMemoryConstants.MEMORY_MAX_MESSAGES);
        List<ChatHistoryEntity> memorySource = historyList.subList(startIndex, historyList.size());

        List<Message> rebuiltMessages = new ArrayList<>(memorySource.size());
        for (ChatHistoryEntity historyMessage : memorySource) {
            if (historyMessage == null || !StringUtils.hasText(historyMessage.getContent())) {
                continue;
            }

            if (ChatRoleEnum.USER.getValue().equals(historyMessage.getRole())) {
                rebuiltMessages.add(new UserMessage(historyMessage.getContent()));
            } else if (ChatRoleEnum.ASSISTANT.getValue().equals(historyMessage.getRole())) {
                rebuiltMessages.add(new AssistantMessage(historyMessage.getContent()));
            }
        }

        if (!rebuiltMessages.isEmpty()) {
            inMemoryChatMemoryStore.appendAll(sessionId, rebuiltMessages);
        }
    }

    // 清空会话窗口
    public void clearMemoryWindow(String sessionId) {
        validateSessionId(sessionId);
        inMemoryChatMemoryStore.clear(sessionId);
    }

    // 校验会话ID
    private void validateSessionId(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
    }
}