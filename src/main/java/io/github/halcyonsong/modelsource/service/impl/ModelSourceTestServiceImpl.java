package io.github.halcyonsong.modelsource.service.impl;

import io.github.halcyonsong.chat.common.factory.OpenAiCompatibleChatClientFactory;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceTestDTO;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceTestVO;
import io.github.halcyonsong.modelsource.service.ModelSourceTestService;
import io.github.halcyonsong.modelsource.service.support.ModelSourceValidateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

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

        String content = chatClientFactory.create(modelConfig)
                .prompt()
                .user(TEST_PROMPT)
                .call()
                .content();

        if (!StringUtils.hasText(content)) {
            throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "模型测试失败，未返回有效内容");
        }

        return ModelSourceTestVO.builder()
                .success(Boolean.TRUE)
                .message("连接成功")
                .build();
    }
}