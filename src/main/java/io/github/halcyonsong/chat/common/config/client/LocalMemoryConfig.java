package io.github.halcyonsong.chat.common.config.client;

import io.github.halcyonsong.chat.common.constants.ChatMemoryConstants;
import io.github.halcyonsong.chat.common.memory.InMemoryChatMemoryStore;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LocalMemoryConfig {

    @Bean // 自定义消息窗口，内存存储
    public MessageWindowChatMemory messageWindowChatMemory(InMemoryChatMemoryStore inMemoryChatMemoryStore) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(inMemoryChatMemoryStore)
                .maxMessages(ChatMemoryConstants.MEMORY_MAX_MESSAGES)
                .build();
    }
}