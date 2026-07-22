package io.github.halcyonsong.sessionfolder.service;

import io.github.halcyonsong.sessionfolder.pojo.dto.SessionFolderAuthorizeDTO;
import io.github.halcyonsong.sessionfolder.pojo.vo.SessionFolderReferenceVO;

import java.util.List;

public interface SessionFolderService {

    SessionFolderReferenceVO authorize(SessionFolderAuthorizeDTO authorizeDTO);

    List<SessionFolderReferenceVO> listBySessionId(String sessionId);

    SessionFolderReferenceVO getBySessionIdAndFolderReferenceId(String sessionId, String folderReferenceId);

    void deleteBySessionIdAndFolderReferenceId(String sessionId, String folderReferenceId);

    void deleteBySessionId(String sessionId);

    long countBySessionId(String sessionId);
}