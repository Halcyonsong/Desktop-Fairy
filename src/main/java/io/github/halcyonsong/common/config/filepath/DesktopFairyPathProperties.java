package io.github.halcyonsong.common.config.filepath;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "desktop-fairy.paths")
public class DesktopFairyPathProperties {

    private String localModelScriptDir;
}