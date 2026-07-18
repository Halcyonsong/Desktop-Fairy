package io.github.halcyonsong.modelsource.service.impl;

import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.convertor.ModelSourceConvertor;
import io.github.halcyonsong.modelsource.convertor.ModelSourceModelConvertor;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceCreateDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceQueryDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceUpdateDTO;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceEntity;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceModelEntity;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceDetailVO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceModelVO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceVO;
import io.github.halcyonsong.modelsource.service.ModelSourceService;
import io.github.halcyonsong.modelsource.service.store.ModelSourceReadStore;
import io.github.halcyonsong.modelsource.service.store.ModelSourceWriteStore;
import io.github.halcyonsong.modelsource.service.support.ModelSourceValidateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ModelSourceServiceImpl implements ModelSourceService {

    private final ModelSourceReadStore modelSourceReadStore;
    private final ModelSourceWriteStore modelSourceWriteStore;
    private final ModelSourceValidateSupport modelSourceValidateSupport;
    private final ModelSourceConvertor modelSourceConvertor;
    private final ModelSourceModelConvertor modelSourceModelConvertor;

    @Override // 创建模型源
    @Transactional(rollbackFor = Exception.class)
    public String create(ModelSourceCreateDTO createDTO) {
        modelSourceValidateSupport.validateCreateDTO(createDTO);

        String name = modelSourceValidateSupport.normalize(createDTO.getName());
        String provider = modelSourceValidateSupport.normalize(createDTO.getProvider());
        String baseUrl = modelSourceValidateSupport.normalizeBaseUrl(createDTO.getBaseUrl());
        String apiKey = modelSourceValidateSupport.normalize(createDTO.getApiKey());
        List<String> modelNames = modelSourceValidateSupport.normalizeModelNames(createDTO.getModels());

        modelSourceValidateSupport.assertNameNotDuplicated(name, null);

        LocalDateTime now = LocalDateTime.now();
        String sourceCode = UUID.randomUUID().toString().replace("-", "");

        ModelSourceEntity sourceEntity = ModelSourceEntity.builder()
                .sourceCode(sourceCode)
                .name(name)
                .provider(provider)
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .createTime(now)
                .updateTime(now)
                .build();

        modelSourceWriteStore.saveSource(sourceEntity);
        modelSourceWriteStore.saveSourceModels(sourceEntity.getId(), modelNames, now);

        return sourceCode;
    }

    @Override // 更新模型源
    @Transactional(rollbackFor = Exception.class)
    public void update(ModelSourceUpdateDTO updateDTO) {
        modelSourceValidateSupport.validateUpdateDTO(updateDTO);

        String sourceCode = modelSourceValidateSupport.normalize(updateDTO.getSourceCode());
        String name = modelSourceValidateSupport.normalize(updateDTO.getName());
        String provider = modelSourceValidateSupport.normalize(updateDTO.getProvider());
        String baseUrl = modelSourceValidateSupport.normalizeBaseUrl(updateDTO.getBaseUrl());
        String apiKey = modelSourceValidateSupport.normalize(updateDTO.getApiKey());
        List<String> modelNames = modelSourceValidateSupport.normalizeModelNames(updateDTO.getModels());

        ModelSourceEntity existingSource = modelSourceReadStore.getSourceByCode(sourceCode);
        modelSourceValidateSupport.assertNameNotDuplicated(name, existingSource.getId());

        LocalDateTime now = LocalDateTime.now();

        ModelSourceEntity updateEntity = ModelSourceEntity.builder()
                .id(existingSource.getId())
                .sourceCode(existingSource.getSourceCode())
                .name(name)
                .provider(provider)
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .createTime(existingSource.getCreateTime())
                .updateTime(now)
                .build();

        modelSourceWriteStore.updateSource(updateEntity);
        modelSourceWriteStore.deleteSourceModels(existingSource.getId());
        modelSourceWriteStore.saveSourceModels(existingSource.getId(), modelNames, now);
    }

    @Override // 删除模型源
    @Transactional(rollbackFor = Exception.class)
    public void deleteBySourceCode(String sourceCode) {
        String normalizedSourceCode = modelSourceValidateSupport.normalize(sourceCode);
        if (!StringUtils.hasText(normalizedSourceCode)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sourceCode 不能为空");
        }

        ModelSourceEntity sourceEntity = modelSourceReadStore.getSourceByCode(normalizedSourceCode);

        modelSourceWriteStore.deleteSourceModels(sourceEntity.getId());
        modelSourceWriteStore.deleteSourceById(sourceEntity.getId());
    }

    @Override // 删除模型源下的单条模型配置
    @Transactional(rollbackFor = Exception.class)
    public void deleteSourceModel(String sourceCode, String modelName) {
        String normalizedSourceCode = modelSourceValidateSupport.normalize(sourceCode);
        String normalizedModelName = modelSourceValidateSupport.normalize(modelName);

        if (!StringUtils.hasText(normalizedSourceCode)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sourceCode 不能为空");
        }
        if (!StringUtils.hasText(normalizedModelName)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "modelName 不能为空");
        }

        ModelSourceEntity sourceEntity = modelSourceReadStore.getSourceByCode(normalizedSourceCode);
        modelSourceReadStore.getSourceModel(sourceEntity.getId(), normalizedModelName);

        Long modelCount = modelSourceReadStore.countSourceModels(sourceEntity.getId());
        if (modelCount != null && modelCount <= 1) {
            modelSourceWriteStore.deleteSourceModel(sourceEntity.getId(), normalizedModelName);
            modelSourceWriteStore.deleteSourceById(sourceEntity.getId());
            return;
        }

        modelSourceWriteStore.deleteSourceModel(sourceEntity.getId(), normalizedModelName);
    }

    @Override // 查询模型源列表
    public List<ModelSourceVO> list(ModelSourceQueryDTO queryDTO) {
        String name = null;
        String provider = null;

        if (queryDTO != null) {
            name = modelSourceValidateSupport.normalize(queryDTO.getName());
            provider = modelSourceValidateSupport.normalize(queryDTO.getProvider());
        }

        return modelSourceConvertor.toTarget(
                modelSourceReadStore.listSources(name, provider)
        );
    }

    @Override // 查询模型源详情
    public ModelSourceDetailVO getDetail(String sourceCode) {
        String normalizedSourceCode = modelSourceValidateSupport.normalize(sourceCode);
        if (!StringUtils.hasText(normalizedSourceCode)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sourceCode 不能为空");
        }

        ModelSourceEntity sourceEntity = modelSourceReadStore.getSourceByCode(normalizedSourceCode);
        List<ModelSourceModelEntity> modelEntities = modelSourceReadStore.listSourceModels(sourceEntity.getId());
        List<ModelSourceModelVO> modelVOList = modelSourceModelConvertor.toTarget(modelEntities);

        return ModelSourceDetailVO.builder()
                .sourceCode(sourceEntity.getSourceCode())
                .name(sourceEntity.getName())
                .provider(sourceEntity.getProvider())
                .baseUrl(sourceEntity.getBaseUrl())
                .apiKey(sourceEntity.getApiKey())
                .models(modelVOList)
                .createTime(sourceEntity.getCreateTime())
                .updateTime(sourceEntity.getUpdateTime())
                .build();
    }

    @Override // 查询模型源下的模型配置
    public ModelConfig resolveModelConfig(String sourceCode, String modelName) {
        String normalizedSourceCode = modelSourceValidateSupport.normalize(sourceCode);
        String normalizedModelName = modelSourceValidateSupport.normalize(modelName);

        if (!StringUtils.hasText(normalizedSourceCode)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sourceCode 不能为空");
        }
        if (!StringUtils.hasText(normalizedModelName)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "modelName 不能为空");
        }

        ModelSourceEntity sourceEntity = modelSourceReadStore.getSourceByCode(normalizedSourceCode);
        ModelSourceModelEntity sourceModelEntity =
                modelSourceReadStore.getSourceModel(sourceEntity.getId(), normalizedModelName);

        return ModelConfig.builder()
                .baseUrl(sourceEntity.getBaseUrl())
                .apiKey(sourceEntity.getApiKey())
                .model(sourceModelEntity.getModelName())
                .build();
    }
}