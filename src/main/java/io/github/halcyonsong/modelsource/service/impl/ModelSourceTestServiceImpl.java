package io.github.halcyonsong.modelsource.service.impl;

import io.github.halcyonsong.chat.common.factory.OpenAiCompatibleChatClientFactory;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.pojo.dto.ModelFetchDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceTestDTO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceTestVO;
import io.github.halcyonsong.modelsource.service.ModelSourceTestService;
import io.github.halcyonsong.modelsource.service.support.ModelSourceValidateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModelSourceTestServiceImpl implements ModelSourceTestService {

    private static final String TEST_PROMPT = "hi";

    private final OpenAiCompatibleChatClientFactory chatClientFactory;
    private final ModelSourceValidateSupport modelSourceValidateSupport;

    @Override
    public ModelSourceTestVO testConnection(ModelSourceTestDTO testDTO) {
        if (testDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "testDTO 不能为空");
        }

        String provider = modelSourceValidateSupport.normalize(testDTO.getProvider());
        String baseUrl = modelSourceValidateSupport.normalizeBaseUrl(testDTO.getBaseUrl());
        String apiKey = modelSourceValidateSupport.normalize(testDTO.getApiKey());
        String modelName = modelSourceValidateSupport.normalize(testDTO.getModelName());

        if (!StringUtils.hasText(provider)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "provider 不能为空");
        }
        if (!StringUtils.hasText(baseUrl)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "baseUrl 不能为空");
        }
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "apiKey 不能为空");
        }
        if (!StringUtils.hasText(modelName)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "modelName 不能为空");
        }

        ModelConfig modelConfig = ModelConfig.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .model(modelName)
                .build();

        String content;
        try {
            content = chatClientFactory.create(modelConfig)
                    .prompt()
                    .user(TEST_PROMPT)
                    .call()
                    .content();
        } catch (Exception exception) {
            throw new BusinessException(
                    ResultCodeEnum.SYSTEM_ERROR.getCode(),
                    resolveProviderErrorMessage(exception, "模型连接测试失败")
            );
        }

        if (!StringUtils.hasText(content)) {
            throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "模型测试失败，未返回有效内容");
        }

        return ModelSourceTestVO.builder()
                .success(Boolean.TRUE)
                .message("连接成功")
                .build();
    }

    @Override
    public List<String> fetchModels(ModelFetchDTO fetchDTO) {
        if (fetchDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "fetchDTO 不能为空");
        }

        String baseUrl = modelSourceValidateSupport.normalizeBaseUrl(fetchDTO.getBaseUrl());
        String apiKey = modelSourceValidateSupport.normalize(fetchDTO.getApiKey());

        if (!StringUtils.hasText(baseUrl)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "baseUrl 不能为空");
        }
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "apiKey 不能为空");
        }

        String modelsUrl = buildModelsUrl(baseUrl);

        try {
            RestClient restClient = RestClient.builder()
                    .baseUrl(modelsUrl)
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .build();

            Map<String, Object> response = restClient.get()
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !(response.get("data") instanceof List<?> dataList)) {
                throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "模型列表响应格式无法识别");
            }

            return dataList.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(item -> item.get("id"))
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .filter(StringUtils::hasText)
                    .distinct()
                    .collect(Collectors.toList());
        } catch (Exception exception) {
            throw new BusinessException(
                    ResultCodeEnum.SYSTEM_ERROR.getCode(),
                    resolveProviderErrorMessage(exception, "拉取模型列表失败")
            );
        }
    }

    private String buildModelsUrl(String baseUrl) {
        String normalized = baseUrl.trim();
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        if (normalized.endsWith("/v1")) {
            return normalized + "/models";
        }
        return normalized + "/v1/models";
    }

    private String resolveProviderErrorMessage(Throwable throwable, String fallbackPrefix) {
        String rawMessage = extractThrowableMessage(throwable).toLowerCase();

        if (containsAny(rawMessage, "401", "unauthorized")) {
            return "鉴权失败，请检查 API Key 是否有效、是否过期，或供应商鉴权配置是否正确";
        }

        if (containsAny(rawMessage, "403", "forbidden")) {
            return "供应商拒绝访问，请检查当前账号或模型权限";
        }

        if (containsAny(rawMessage, "404", "not found")) {
            return "请求地址不可用，请检查 baseUrl 或接口路径是否正确";
        }

        if (containsAny(rawMessage, "429", "too many requests")) {
            return "请求过于频繁，或当前额度不足，请稍后重试";
        }

        if (containsAny(rawMessage, "500", "502", "503", "504")) {
            return "供应商服务暂时不可用，请稍后重试";
        }

        if (containsAny(rawMessage,
                "timed out",
                "timeout",
                "readtimeoutexception",
                "sockettimeoutexception",
                "connecttimeoutexception")) {
            return "请求超时，请检查网络或稍后重试";
        }

        if (containsAny(rawMessage,
                "connection refused",
                "connectexception",
                "unknownhost",
                "failed to connect",
                "nodetoroutehostexception")) {
            return "无法连接到供应商服务，请检查请求地址和网络连接";
        }

        if (containsAny(rawMessage, "ssl", "certificate", "handshake")) {
            return "SSL 连接失败，请检查请求地址、证书或网络代理配置";
        }

        return fallbackPrefix + "，请检查请求地址、API Key 或供应商服务状态";
    }

    private String extractThrowableMessage(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        Throwable current = throwable;

        while (current != null) {
            if (StringUtils.hasText(current.getMessage())) {
                builder.append(current.getMessage()).append(" | ");
            }
            current = current.getCause();
        }

        return builder.toString();
    }

    private boolean containsAny(String text, String... keywords) {
        if (!StringUtils.hasText(text) || keywords == null) {
            return false;
        }

        for (String keyword : keywords) {
            if (StringUtils.hasText(keyword) && text.contains(keyword.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

}