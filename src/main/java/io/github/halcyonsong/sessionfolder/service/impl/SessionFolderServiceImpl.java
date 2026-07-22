package io.github.halcyonsong.sessionfolder.service.impl;

import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.sessionfolder.convertor.SessionFolderReferenceConvertor;
import io.github.halcyonsong.sessionfolder.pojo.dto.SessionFolderAuthorizeDTO;
import io.github.halcyonsong.sessionfolder.pojo.entity.SessionFolderReferenceEntity;
import io.github.halcyonsong.sessionfolder.pojo.vo.SessionFolderReferenceVO;
import io.github.halcyonsong.sessionfolder.service.SessionFolderService;
import io.github.halcyonsong.sessionfolder.service.support.SessionFolderAuthorizeSupport;
import io.github.halcyonsong.sessionfolder.service.support.store.SessionFolderReferenceReadStore;
import io.github.halcyonsong.sessionfolder.service.support.store.SessionFolderReferenceWriteStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SessionFolderServiceImpl implements SessionFolderService {

    private static final long MAX_FOLDER_COUNT_PER_SESSION = 3L;

    private final SessionFolderAuthorizeSupport sessionFolderAuthorizeSupport;
    private final SessionFolderReferenceReadStore sessionFolderReferenceReadStore;
    private final SessionFolderReferenceWriteStore sessionFolderReferenceWriteStore;
    private final SessionFolderReferenceConvertor sessionFolderReferenceConvertor;

    @Override
    public SessionFolderReferenceVO authorize(SessionFolderAuthorizeDTO authorizeDTO) {
        if (authorizeDTO == null) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "authorizeDTO 不能为空");
        }

        String sessionId = authorizeDTO.getSessionId();
        sessionFolderAuthorizeSupport.validateSession(sessionId);

        Path path = sessionFolderAuthorizeSupport.resolveAndValidateFolder(authorizeDTO.getAbsolutePath());

        SessionFolderReferenceEntity existed =
                sessionFolderReferenceReadStore.getBySessionIdAndPath(sessionId, path.toString());
        if (existed != null) {
            return sessionFolderReferenceConvertor.toTarget(existed);
        }

        long folderCount = sessionFolderReferenceReadStore.countBySessionId(sessionId);
        if (folderCount >= MAX_FOLDER_COUNT_PER_SESSION) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "当前会话最多允许授权 3 个文件夹");
        }

        SessionFolderReferenceEntity entity = sessionFolderAuthorizeSupport.buildEntity(sessionId, path);
        sessionFolderReferenceWriteStore.save(entity);
        return sessionFolderReferenceConvertor.toTarget(entity);
    }

    @Override
    public List<SessionFolderReferenceVO> listBySessionId(String sessionId) {
        sessionFolderAuthorizeSupport.validateSession(sessionId);
        return sessionFolderReferenceConvertor.toTarget(
                sessionFolderReferenceReadStore.listBySessionId(sessionId)
        );
    }

    @Override
    public SessionFolderReferenceVO getBySessionIdAndFolderReferenceId(String sessionId, String folderReferenceId) {
        sessionFolderAuthorizeSupport.validateSession(sessionId);

        if (!StringUtils.hasText(folderReferenceId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "folderReferenceId 不能为空");
        }

        SessionFolderReferenceEntity entity =
                sessionFolderReferenceReadStore.getBySessionIdAndFolderReferenceId(sessionId, folderReferenceId);
        if (entity == null) {
            return null;
        }

        return sessionFolderReferenceConvertor.toTarget(entity);
    }

    @Override
    public void deleteBySessionIdAndFolderReferenceId(String sessionId, String folderReferenceId) {
        sessionFolderAuthorizeSupport.validateSession(sessionId);

        if (!StringUtils.hasText(folderReferenceId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "folderReferenceId 不能为空");
        }

        SessionFolderReferenceEntity entity =
                sessionFolderReferenceReadStore.getBySessionIdAndFolderReferenceId(sessionId, folderReferenceId);
        if (entity == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话文件夹引用不存在: " + folderReferenceId);
        }

        sessionFolderReferenceWriteStore.deleteBySessionIdAndFolderReferenceId(sessionId, folderReferenceId);
    }

    @Override
    public void deleteBySessionId(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        sessionFolderReferenceWriteStore.deleteBySessionId(sessionId);
    }

    @Override
    public long countBySessionId(String sessionId) {
        sessionFolderAuthorizeSupport.validateSession(sessionId);
        return sessionFolderReferenceReadStore.countBySessionId(sessionId);
    }
}