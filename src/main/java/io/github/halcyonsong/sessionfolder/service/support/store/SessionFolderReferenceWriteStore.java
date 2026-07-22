package io.github.halcyonsong.sessionfolder.service.support.store;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.sessionfolder.mapper.SessionFolderReferenceMapper;
import io.github.halcyonsong.sessionfolder.pojo.entity.SessionFolderReferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SessionFolderReferenceWriteStore {

    private final SessionFolderReferenceMapper sessionFolderReferenceMapper;

    public void save(SessionFolderReferenceEntity entity) {
        sessionFolderReferenceMapper.insert(entity);
    }

    public void deleteBySessionIdAndFolderReferenceId(String sessionId, String folderReferenceId) {
        sessionFolderReferenceMapper.delete(
                new LambdaQueryWrapper<SessionFolderReferenceEntity>()
                        .eq(SessionFolderReferenceEntity::getSessionId, sessionId)
                        .eq(SessionFolderReferenceEntity::getFolderReferenceId, folderReferenceId)
        );
    }

    public void deleteBySessionId(String sessionId) {
        sessionFolderReferenceMapper.delete(
                new LambdaQueryWrapper<SessionFolderReferenceEntity>()
                        .eq(SessionFolderReferenceEntity::getSessionId, sessionId)
        );
    }
}