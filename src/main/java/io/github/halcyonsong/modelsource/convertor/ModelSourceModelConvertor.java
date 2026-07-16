package io.github.halcyonsong.modelsource.convertor;

import io.github.halcyonsong.common.converter.BaseConvertor;
import io.github.halcyonsong.modelsource.pojo.entity.ModelSourceModelEntity;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceModelVO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ModelSourceModelConvertor extends BaseConvertor<ModelSourceModelEntity, ModelSourceModelVO> {
}