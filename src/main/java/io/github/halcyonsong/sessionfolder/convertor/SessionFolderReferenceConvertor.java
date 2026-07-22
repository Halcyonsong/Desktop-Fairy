package io.github.halcyonsong.sessionfolder.convertor;

import io.github.halcyonsong.common.converter.BaseConvertor;
import io.github.halcyonsong.sessionfolder.pojo.entity.SessionFolderReferenceEntity;
import io.github.halcyonsong.sessionfolder.pojo.vo.SessionFolderReferenceVO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SessionFolderReferenceConvertor extends BaseConvertor<SessionFolderReferenceEntity, SessionFolderReferenceVO> {
}