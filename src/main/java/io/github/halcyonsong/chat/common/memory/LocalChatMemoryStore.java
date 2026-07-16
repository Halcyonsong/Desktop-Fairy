package io.github.halcyonsong.chat.common.memory;

import org.springframework.ai.chat.messages.Message;
import org.springframework.lang.NonNull;

import java.util.List;

public interface LocalChatMemoryStore {

    void append(@NonNull String conversationId, @NonNull Message message);

    void appendAll(@NonNull String conversationId, @NonNull List<Message> messages);

    boolean removeLast(@NonNull String conversationId);

    void clear(@NonNull String conversationId);
}