package io.github.halcyonsong.sessionfile.service.support.store;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.sessionfile.mapper.SessionFileReferenceMapper;
import io.github.halcyonsong.sessionfile.pojo.entity.SessionFileReferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class SessionFileReferenceReadStore {

    private final SessionFileReferenceMapper sessionFileReferenceMapper;

    public SessionFileReferenceEntity getBySessionIdAndPath(String sessionId, String absolutePath) {
        return sessionFileReferenceMapper.selectOne(
                new LambdaQueryWrapper<SessionFileReferenceEntity>()
                        .eq(SessionFileReferenceEntity::getSessionId, sessionId)
                        .eq(SessionFileReferenceEntity::getAbsolutePath, absolutePath)
                        .last("limit 1")
        );
    }

    public List<SessionFileReferenceEntity> listBySessionId(String sessionId) {
        List<SessionFileReferenceEntity> entityList = sessionFileReferenceMapper.selectList(
                new LambdaQueryWrapper<SessionFileReferenceEntity>()
                        .eq(SessionFileReferenceEntity::getSessionId, sessionId)
                        .orderByDesc(SessionFileReferenceEntity::getUpdateTime)
        );

        if (entityList == null || entityList.isEmpty()) {
            return Collections.emptyList();
        }

        return entityList;
    }

    public SessionFileReferenceEntity getBySessionIdAndFileReferenceId(String sessionId, String fileReferenceId) {
        return sessionFileReferenceMapper.selectOne(
                new LambdaQueryWrapper<SessionFileReferenceEntity>()
                        .eq(SessionFileReferenceEntity::getSessionId, sessionId)
                        .eq(SessionFileReferenceEntity::getFileReferenceId, fileReferenceId)
                        .last("limit 1")
        );
    }

    public long countBySessionId(String sessionId) {
        return sessionFileReferenceMapper.selectCount(
                new LambdaQueryWrapper<SessionFileReferenceEntity>()
                        .eq(SessionFileReferenceEntity::getSessionId, sessionId)
        );
    }

}