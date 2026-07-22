package io.github.halcyonsong.sessionfile.service.impl;

import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.sessionfile.convertor.SessionFileReferenceConvertor;
import io.github.halcyonsong.sessionfile.pojo.dto.SessionFileAuthorizeDTO;
import io.github.halcyonsong.sessionfile.pojo.entity.SessionFileReferenceEntity;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import io.github.halcyonsong.sessionfile.service.support.SessionFileAuthorizeSupport;
import io.github.halcyonsong.sessionfile.service.support.store.SessionFileReferenceReadStore;
import io.github.halcyonsong.sessionfile.service.support.store.SessionFileReferenceWriteStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SessionFileServiceImpl implements SessionFileService {

    private final SessionFileAuthorizeSupport sessionFileAuthorizeSupport;
    private final SessionFileReferenceReadStore sessionFileReferenceReadStore;
    private final SessionFileReferenceWriteStore sessionFileReferenceWriteStore;
    private final SessionFileReferenceConvertor sessionFileReferenceConvertor;

    @Override
    public SessionFileReferenceVO authorize(SessionFileAuthorizeDTO authorizeDTO) {
        if (authorizeDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "authorizeDTO 不能为空");
        }

        String sessionId = authorizeDTO.getSessionId();
        sessionFileAuthorizeSupport.validateSession(sessionId);

        Path path = sessionFileAuthorizeSupport.resolveAndValidateFile(authorizeDTO.getAbsolutePath());

        SessionFileReferenceEntity existed =
                sessionFileReferenceReadStore.getBySessionIdAndPath(sessionId, path.toString());
        if (existed != null) {
            return sessionFileReferenceConvertor.toTarget(existed);
        }

        SessionFileReferenceEntity entity = sessionFileAuthorizeSupport.buildEntity(sessionId, path);
        sessionFileReferenceWriteStore.save(entity);
        return sessionFileReferenceConvertor.toTarget(entity);
    }

    @Override
    public List<SessionFileReferenceVO> listBySessionId(String sessionId) {
        sessionFileAuthorizeSupport.validateSession(sessionId);
        return sessionFileReferenceConvertor.toTarget(
                sessionFileReferenceReadStore.listBySessionId(sessionId)
        );
    }

    @Override
    public SessionFileReferenceVO getBySessionIdAndFileReferenceId(String sessionId, String fileReferenceId) {
        sessionFileAuthorizeSupport.validateSession(sessionId);

        if (!StringUtils.hasText(fileReferenceId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "fileReferenceId 不能为空");
        }

        SessionFileReferenceEntity entity =
                sessionFileReferenceReadStore.getBySessionIdAndFileReferenceId(sessionId, fileReferenceId);
        if (entity == null) {
            return null;
        }

        return sessionFileReferenceConvertor.toTarget(entity);
    }

    @Override
    public void deleteBySessionIdAndFileReferenceId(String sessionId, String fileReferenceId) {
        sessionFileAuthorizeSupport.validateSession(sessionId);

        if (!StringUtils.hasText(fileReferenceId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "fileReferenceId 不能为空");
        }

        SessionFileReferenceEntity entity =
                sessionFileReferenceReadStore.getBySessionIdAndFileReferenceId(sessionId, fileReferenceId);
        if (entity == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话文件引用不存在: " + fileReferenceId);
        }

        sessionFileReferenceWriteStore.deleteBySessionIdAndFileReferenceId(sessionId, fileReferenceId);
    }

    @Override
    public void deleteBySessionId(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        sessionFileReferenceWriteStore.deleteBySessionId(sessionId);
    }

    @Override
    public long countBySessionId(String sessionId) {
        sessionFileAuthorizeSupport.validateSession(sessionId);
        return sessionFileReferenceReadStore.countBySessionId(sessionId);
    }
}