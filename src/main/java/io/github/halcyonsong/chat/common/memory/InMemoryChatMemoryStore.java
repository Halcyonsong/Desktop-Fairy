package io.github.halcyonsong.chat.common.memory;

import io.github.halcyonsong.chat.common.constants.ChatMemoryConstants;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.Message;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryChatMemoryStore implements LocalChatMemoryStore, ChatMemoryRepository {

    private final Map<String, Deque<Message>> conversationStore = new ConcurrentHashMap<>();

    @Override // 由 spring ai 调用，查询所有会话ID
    @NonNull
    public List<String> findConversationIds() {
        return new ArrayList<>(conversationStore.keySet());
    }

    @Override // 由 spring ai 调用，查询指定会话ID的所有窗口消息
    @NonNull
    public List<Message> findByConversationId(@NonNull @NotBlank String conversationId) {
        validateConversationId(conversationId);

        Deque<Message> deque = conversationStore.get(conversationId);
        if (deque == null || deque.isEmpty()) {
            return List.of();
        }

        synchronized (deque) {
            return new ArrayList<>(deque);
        }
    }

    @Override // 由 spring ai 调用，替换传入会话ID的所有窗口消息
    public void saveAll(@NonNull String conversationId, @NonNull @NotNull List<Message> messages) {
        validateConversationId(conversationId);

        Deque<Message> deque = new ArrayDeque<>();
        for (Message message : messages) {
            if (message == null) {
                throw new IllegalArgumentException("messages 不能包含 null 元素");
            }
            deque.addLast(message);
        }

        conversationStore.put(conversationId, deque);
    }

    @Override // 由 spring ai 调用，删除指定会话ID的所有窗口消息
    public void deleteByConversationId(@NonNull String conversationId) {
        clear(conversationId);
    }

    @Override // 自行使用，追加消息一条消息
    public void append(@NonNull String conversationId, @NonNull @NotNull Message message) {
        validateConversationId(conversationId);

        Deque<Message> deque = conversationStore.computeIfAbsent(conversationId, key -> new ArrayDeque<>());
        synchronized (deque) {
            deque.addLast(message);
            trimToMaxMessages(deque);
        }
    }

    @Override // 自行使用，追加消息多条消息
    public void appendAll(@NonNull @NotBlank String conversationId, @NonNull List<Message> messages) {
        validateConversationId(conversationId);
        if (CollectionUtils.isEmpty(messages)) {
            return;
        }

        Deque<Message> deque = conversationStore.computeIfAbsent(conversationId, key -> new ArrayDeque<>());
        synchronized (deque) {
            for (Message message : messages) {
                if (message == null) {
                    continue;
                }
                deque.addLast(message);
            }
            trimToMaxMessages(deque);
        }
    }

    @Override // 自行使用，删除最后一条消息
    public boolean removeLast(@NonNull String conversationId) {
        validateConversationId(conversationId);

        Deque<Message> deque = conversationStore.get(conversationId);
        if (deque == null) {
            return false;
        }

        synchronized (deque) {
            if (deque.isEmpty()) {
                conversationStore.remove(conversationId, deque);
                return false;
            }

            deque.removeLast();

            if (deque.isEmpty()) {
                conversationStore.remove(conversationId, deque);
            }
            return true;
        }
    }

    @Override // 可公共使用，删除指定会话
    public void clear(@NonNull String conversationId) {
        validateConversationId(conversationId);
        conversationStore.remove(conversationId);
    }

    // 辅助方法，用于限制消息最大数量
    private void trimToMaxMessages(Deque<Message> deque) {
        int maxMessages = ChatMemoryConstants.MEMORY_MAX_MESSAGES;
        while (deque.size() > maxMessages) {
            deque.removeFirst();
        }
    }

    // 辅助方法，用于校验会话ID
    private void validateConversationId(String conversationId) {
        if (!StringUtils.hasText(conversationId)) {
            throw new IllegalArgumentException("conversationId 不能为空");
        }
    }
}