package io.github.halcyonsong.fairy.service.impl;

import io.github.halcyonsong.chat.common.factory.OpenAiCompatibleChatClientFactory;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.fairy.pojo.AutoChatDTO;
import io.github.halcyonsong.fairy.properties.FairyChatProperties;
import io.github.halcyonsong.fairy.service.FairyChatService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@AllArgsConstructor
@Service
@Slf4j
public class FairyChatServiceImpl implements FairyChatService {

    private final OpenAiCompatibleChatClientFactory chatClientFactory;
    private final FairyChatProperties fairyChatProperties;

    @Override
    public String autoReply(AutoChatDTO autoChatDTO) {
        // 解析模型配置
        ModelConfig modelConfig =
                ModelConfig.builder()
                .baseUrl(autoChatDTO.getBaseUrl())
                .apiKey(autoChatDTO.getApiKey())
                .model(autoChatDTO.getModel())
                .build();

        String sessionId = autoChatDTO.getSessionId();
        String question = autoChatDTO.getQuestion();

        log.info("chat start, sessionId={}, model={}, baseUrl={}, question={}",
                sessionId,
                modelConfig.getModel(),
                modelConfig.getBaseUrl(),
                question);
        // 动态创建 ChatClient
        ChatClient chatClient = chatClientFactory.create(modelConfig);

        ChatClient.ChatClientRequestSpec requestSpec = chatClient.prompt()
                .system(fairyChatProperties.getChatSystemPrompt())
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, sessionId))
                .user(resolveUserPrompt(question));

        String response = requestSpec
                .call()
                .content();
        return response;
    }

    public String resolveUserPrompt(String question) {
        return StringUtils.hasText(question) ? question : fairyChatProperties.getChatUserPrompt();
    }

}
