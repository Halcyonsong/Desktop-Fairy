package io.github.halcyonsong.chat.stream.service.support.options;

import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.chat.stream.pojo.dto.ModelRequestDTO;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ModelConfigResolver {

    public ModelConfig resolve(ModelRequestDTO requestDTO) {
        if (requestDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "model 不能为空");
        }

        String baseUrl = normalizeBaseUrl(requestDTO.getBaseUrl());
        String apiKey = normalizeText(requestDTO.getApiKey());
        String model = normalizeText(requestDTO.getModel());

        if (!StringUtils.hasText(baseUrl)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "baseUrl 不能为空");
        }
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "apiKey 不能为空");
        }
        if (!StringUtils.hasText(model)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "model 不能为空");
        }

        return ModelConfig.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .model(model)
                .temperature(requestDTO.getTemperature())
                .maxTokens(requestDTO.getMaxTokens())
                .build();
    }

    private String normalizeText(String text) {
        return text == null ? null : text.trim();
    }

    private String normalizeBaseUrl(String baseUrl) {
        String normalized = normalizeText(baseUrl);
        if (!StringUtils.hasText(normalized)) {
            return normalized;
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
    
}