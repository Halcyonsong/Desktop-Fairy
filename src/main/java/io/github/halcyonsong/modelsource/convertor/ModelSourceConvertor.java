package io.github.halcyonsong.modelsource.convertor;

import io.github.halcyonsong.common.converter.BaseConvertor;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceEntity;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceVO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ModelSourceConvertor extends BaseConvertor<ModelSourceEntity, ModelSourceVO> {
}