package io.github.halcyonsong.chat.common.config.prompt;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.tool-chat")
public class ToolChatProperties {

    private String system;

    // 最大轮数
    private Integer maxRounds;

    // 最大工具调用次数
    private Integer maxToolCalls;

    // 最大执行时长，单位秒
    private Integer maxDurationSeconds;
}