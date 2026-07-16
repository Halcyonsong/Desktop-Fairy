package io.github.halcyonsong.chat.common.config.prompt;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.chat")
public class ChatProperties {

    // 聊天系统提示词
    private String chatSystemPrompt;


}