package io.github.halcyonsong.modelsource.service.support;

import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceCreateDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceModelDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceUpdateDTO;
import io.github.halcyonsong.modelsource.service.store.ModelSourceReadStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ModelSourceValidateSupport {

    private final ModelSourceReadStore modelSourceReadStore;

    // 校验创建模型源DTO
    public void validateCreateDTO(ModelSourceCreateDTO createDTO) {
        if (createDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "createDTO 不能为空");
        }
    }

    // 校验更新模型源DTO
    public void validateUpdateDTO(ModelSourceUpdateDTO updateDTO) {
        if (updateDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "updateDTO 不能为空");
        }
    }

    // 校验模型源名称是否重复
    public void assertNameNotDuplicated(String name, Long excludeId) {
        Long duplicatedCount = modelSourceReadStore.countByName(name, excludeId);
        if (duplicatedCount != null && duplicatedCount > 0) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "模型源名称已存在: " + name);
        }
    }

    // 解析模型名称列表
    public List<String> normalizeModelNames(List<ModelSourceModelDTO> modelDTOList) {
        if (CollectionUtils.isEmpty(modelDTOList)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "models 不能为空");
        }

        LinkedHashSet<String> modelNameSet = new LinkedHashSet<>();
        for (ModelSourceModelDTO modelDTO : modelDTOList) {
            if (modelDTO == null) {
                continue;
            }

            String modelName = normalize(modelDTO.getModelName());
            if (!StringUtils.hasText(modelName)) {
                throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "modelName 不能为空");
            }

            modelNameSet.add(modelName);
        }

        if (modelNameSet.isEmpty()) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "models 不能为空");
        }

        return new ArrayList<>(modelNameSet);
    }

    // 通用字符串规范化方法
    public String normalize(String value) {
        return value == null ? null : value.trim();
    }

    // 规范化模型请求URL
    public String normalizeBaseUrl(String baseUrl) {
        String normalized = normalize(baseUrl);
        if (!StringUtils.hasText(normalized)) {
            return normalized;
        }

        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}