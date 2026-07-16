package io.github.halcyonsong.chat.common.config.client;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.scheduler.Schedulers;

@Configuration
@RequiredArgsConstructor
public class ChatClientConfig {

    @Bean // 打印日志设置
    public SimpleLoggerAdvisor simpleLoggerAdvisor() {
        return SimpleLoggerAdvisor.builder()
                // advisor 执行顺序，order越小越先执行
                .order(0)
                .build();
    }

    @Bean // 消息窗口
    public MessageChatMemoryAdvisor messageChatMemoryAdvisor(
            MessageWindowChatMemory messageWindowChatMemory) {
        return MessageChatMemoryAdvisor.builder(messageWindowChatMemory)
                // 没有传时兜底
                .conversationId("default")
                .order(100)
                // 用哪个 Reactor 调度器执行这块逻辑
                .scheduler(Schedulers.boundedElastic())
                .build();
    }

    @Bean // 聊天客户端配置
    public ChatClient chatClient(@Qualifier("openAiChatModel") ChatModel chatModel,
                                 SimpleLoggerAdvisor simpleLoggerAdvisor,
                                 MessageChatMemoryAdvisor messageChatMemoryAdvisor) {

        return ChatClient.builder(chatModel)
                .defaultAdvisors(
                        simpleLoggerAdvisor,
                        messageChatMemoryAdvisor
                )
                .build();
    }

}
