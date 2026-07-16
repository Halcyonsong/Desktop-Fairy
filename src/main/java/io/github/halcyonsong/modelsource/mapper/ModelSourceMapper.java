package io.github.halcyonsong.modelsource.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ModelSourceMapper extends BaseMapper<ModelSourceEntity> {
}