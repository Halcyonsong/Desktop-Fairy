package io.github.halcyonsong.sessionfolder.service.support.store;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.sessionfolder.mapper.SessionFolderReferenceMapper;
import io.github.halcyonsong.sessionfolder.pojo.entity.SessionFolderReferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SessionFolderReferenceReadStore {

    private final SessionFolderReferenceMapper sessionFolderReferenceMapper;

    public SessionFolderReferenceEntity getBySessionIdAndPath(String sessionId, String absolutePath) {
        return sessionFolderReferenceMapper.selectOne(
                new LambdaQueryWrapper<SessionFolderReferenceEntity>()
                        .eq(SessionFolderReferenceEntity::getSessionId, sessionId)
                        .eq(SessionFolderReferenceEntity::getAbsolutePath, absolutePath)
                        .last("limit 1")
        );
    }

    public SessionFolderReferenceEntity getBySessionIdAndFolderReferenceId(String sessionId, String folderReferenceId) {
        return sessionFolderReferenceMapper.selectOne(
                new LambdaQueryWrapper<SessionFolderReferenceEntity>()
                        .eq(SessionFolderReferenceEntity::getSessionId, sessionId)
                        .eq(SessionFolderReferenceEntity::getFolderReferenceId, folderReferenceId)
                        .last("limit 1")
        );
    }

    public List<SessionFolderReferenceEntity> listBySessionId(String sessionId) {
        return sessionFolderReferenceMapper.selectList(
                new LambdaQueryWrapper<SessionFolderReferenceEntity>()
                        .eq(SessionFolderReferenceEntity::getSessionId, sessionId)
                        .orderByDesc(SessionFolderReferenceEntity::getUpdateTime)
                        .orderByDesc(SessionFolderReferenceEntity::getId)
        );
    }

    public long countBySessionId(String sessionId) {
        return sessionFolderReferenceMapper.selectCount(
                new LambdaQueryWrapper<SessionFolderReferenceEntity>()
                        .eq(SessionFolderReferenceEntity::getSessionId, sessionId)
        );
    }
}