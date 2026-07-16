package io.github.halcyonsong.chat.common.config.prompt;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.merge")
public class SummaryMergeProperties {
    // 摘要合并提示词
    private String summaryMergePrompt;

}
