package io.github.halcyonsong.chat.stream.pojo.config;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ModelConfig {

    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final Double temperature;
    private final Integer maxTokens;

    public boolean hasTemperature() {
        return temperature != null;
    }

    public boolean hasMaxTokens() {
        return maxTokens != null;
    }
}