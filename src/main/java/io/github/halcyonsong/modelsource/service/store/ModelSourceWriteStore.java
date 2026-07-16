package io.github.halcyonsong.modelsource.service.store;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.modelsource.mapper.ModelSourceMapper;
import io.github.halcyonsong.modelsource.mapper.ModelSourceModelMapper;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceEntity;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceModelEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ModelSourceWriteStore {

    private final ModelSourceMapper modelSourceMapper;
    private final ModelSourceModelMapper modelSourceModelMapper;

    // 保存模型源
    public void saveSource(ModelSourceEntity sourceEntity) {
        modelSourceMapper.insert(sourceEntity);
    }

    // 更新模型源
    public void updateSource(ModelSourceEntity sourceEntity) {
        modelSourceMapper.updateById(sourceEntity);
    }

    // 删除模型源
    public void deleteSourceById(Long sourceId) {
        modelSourceMapper.deleteById(sourceId);
    }

    // 删除模型源下的所有模型
    public void deleteSourceModels(Long sourceId) {
        modelSourceModelMapper.delete(
                new LambdaQueryWrapper<ModelSourceModelEntity>()
                        .eq(ModelSourceModelEntity::getSourceId, sourceId)
        );
    }

    // 删除模型源下的单条模型配置
    public void deleteSourceModel(Long sourceId, String modelName) {
        modelSourceModelMapper.delete(
                new LambdaQueryWrapper<ModelSourceModelEntity>()
                        .eq(ModelSourceModelEntity::getSourceId, sourceId)
                        .eq(ModelSourceModelEntity::getModelName, modelName)
        );
    }

    // 保存模型源下的所有模型配置
    public void saveSourceModels(Long sourceId, List<String> modelNames, LocalDateTime now) {
        for (String modelName : modelNames) {
            ModelSourceModelEntity modelEntity = ModelSourceModelEntity.builder()
                    .sourceId(sourceId)
                    .modelName(modelName)
                    .createTime(now)
                    .updateTime(now)
                    .build();

            modelSourceModelMapper.insert(modelEntity);
        }
    }
}