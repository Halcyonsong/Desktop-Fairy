package io.github.halcyonsong.fairy.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@Data
@ConfigurationProperties(prefix = "fairy.chat")
public class FairyChatProperties {

    private String chatSystemPrompt;

    private String chatUserPrompt;
}
