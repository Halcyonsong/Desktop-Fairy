package io.github.halcyonsong.chat.common.factory;

import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OpenAiCompatibleChatClientFactory {

    private final SimpleLoggerAdvisor simpleLoggerAdvisor;
    private final MessageChatMemoryAdvisor messageChatMemoryAdvisor;

    public ChatClient create(ModelConfig modelConfig) {
        OpenAiApi openAiApi = OpenAiApi.builder()
                .baseUrl(modelConfig.getBaseUrl())
                .apiKey(modelConfig.getApiKey())
                .build();

        OpenAiChatOptions.Builder optionsBuilder = OpenAiChatOptions.builder()
                .model(modelConfig.getModel());

        if (modelConfig.hasTemperature()) {
            optionsBuilder.temperature(modelConfig.getTemperature());
        }
        if (modelConfig.hasMaxTokens()) {
            optionsBuilder.maxTokens(modelConfig.getMaxTokens());
        }

        OpenAiChatModel chatModel = OpenAiChatModel.builder()
                .openAiApi(openAiApi)
                .defaultOptions(optionsBuilder.build())
                .build();

        return ChatClient.builder(chatModel)
                .defaultAdvisors(
                        simpleLoggerAdvisor,
                        messageChatMemoryAdvisor
                )
                .build();
    }
}