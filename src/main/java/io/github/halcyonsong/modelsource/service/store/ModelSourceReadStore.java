package io.github.halcyonsong.modelsource.service.store;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.mapper.ModelSourceMapper;
import io.github.halcyonsong.modelsource.mapper.ModelSourceModelMapper;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceEntity;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceModelEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ModelSourceReadStore {

    private final ModelSourceMapper modelSourceMapper;
    private final ModelSourceModelMapper modelSourceModelMapper;

    // 根据模型源编码查询模型源实体
    public ModelSourceEntity getSourceByCode(String sourceCode) {
        if (!StringUtils.hasText(sourceCode)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sourceCode 不能为空");
        }

        ModelSourceEntity sourceEntity = modelSourceMapper.selectOne(
                new LambdaQueryWrapper<ModelSourceEntity>()
                        .eq(ModelSourceEntity::getSourceCode, sourceCode)
        );

        if (sourceEntity == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "模型源不存在: " + sourceCode);
        }

        return sourceEntity;
    }

    // 查询模型源列表
    public List<ModelSourceEntity> listSources(String name, String provider) {
        LambdaQueryWrapper<ModelSourceEntity> queryWrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(name)) {
            queryWrapper.like(ModelSourceEntity::getName, name);
        }
        if (StringUtils.hasText(provider)) {
            queryWrapper.eq(ModelSourceEntity::getProvider, provider);
        }

        queryWrapper.orderByDesc(ModelSourceEntity::getUpdateTime)
                .orderByDesc(ModelSourceEntity::getId);

        return modelSourceMapper.selectList(queryWrapper);
    }

    // 查询模型源下的所有模型
    public List<ModelSourceModelEntity> listSourceModels(Long sourceId) {
        return modelSourceModelMapper.selectList(
                new LambdaQueryWrapper<ModelSourceModelEntity>()
                        .eq(ModelSourceModelEntity::getSourceId, sourceId)
                        .orderByAsc(ModelSourceModelEntity::getId)
        );
    }

    // 查询模型源下的指定模型配置
    public ModelSourceModelEntity getSourceModel(Long sourceId, String modelName) {
        ModelSourceModelEntity sourceModelEntity = modelSourceModelMapper.selectOne(
                new LambdaQueryWrapper<ModelSourceModelEntity>()
                        .eq(ModelSourceModelEntity::getSourceId, sourceId)
                        .eq(ModelSourceModelEntity::getModelName, modelName)
        );

        if (sourceModelEntity == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "模型不存在: " + modelName);
        }

        return sourceModelEntity;
    }

    // 查询模型源名称数量
    public Long countByName(String name, Long excludeId) {
        LambdaQueryWrapper<ModelSourceEntity> queryWrapper = new LambdaQueryWrapper<ModelSourceEntity>()
                .eq(ModelSourceEntity::getName, name);

        if (excludeId != null) {
            queryWrapper.ne(ModelSourceEntity::getId, excludeId);
        }

        return modelSourceMapper.selectCount(queryWrapper);
    }

    // 查询模型源下的模型数量
    public Long countSourceModels(Long sourceId) {
        return modelSourceModelMapper.selectCount(
                new LambdaQueryWrapper<ModelSourceModelEntity>()
                        .eq(ModelSourceModelEntity::getSourceId, sourceId)
        );
    }
}