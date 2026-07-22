package io.github.halcyonsong.sessionfile.service;

import io.github.halcyonsong.sessionfile.pojo.dto.SessionFileAuthorizeDTO;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;

import java.util.List;

public interface SessionFileService {

    SessionFileReferenceVO authorize(SessionFileAuthorizeDTO authorizeDTO);

    List<SessionFileReferenceVO> listBySessionId(String sessionId);

    void deleteBySessionIdAndFileReferenceId(String sessionId, String fileReferenceId);

    void deleteBySessionId(String sessionId);

    SessionFileReferenceVO getBySessionIdAndFileReferenceId(String sessionId, String fileReferenceId);

    long countBySessionId(String sessionId);
}