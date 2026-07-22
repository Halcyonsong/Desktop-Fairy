package io.github.halcyonsong.sessionfile.convertor;

import io.github.halcyonsong.common.converter.BaseConvertor;
import io.github.halcyonsong.sessionfile.pojo.entity.SessionFileReferenceEntity;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SessionFileReferenceConvertor extends BaseConvertor<SessionFileReferenceEntity, SessionFileReferenceVO> {
}