package io.github.halcyonsong.chat.stream.service.support.options;

import io.github.halcyonsong.chat.common.config.prompt.ChatProperties;
import io.github.halcyonsong.chat.common.support.PromptContextSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class ChatRequestOptionsSupport {

    private final ChatProperties chatProperties;
    private final PromptContextSupport promptContextSupport;

    public String resolveSystemPrompt(String sessionId, String systemPromptOverride) {
        String basePrompt = StringUtils.hasText(systemPromptOverride)
                ? systemPromptOverride.trim()
                : chatProperties.getChatSystemPrompt();

        return promptContextSupport.resolveSystemPrompt(basePrompt, sessionId);
    }

}