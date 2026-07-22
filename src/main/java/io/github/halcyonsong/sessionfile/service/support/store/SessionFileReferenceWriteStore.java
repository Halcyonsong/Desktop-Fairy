package io.github.halcyonsong.sessionfile.service.support.store;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.sessionfile.mapper.SessionFileReferenceMapper;
import io.github.halcyonsong.sessionfile.pojo.entity.SessionFileReferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SessionFileReferenceWriteStore {

    private final SessionFileReferenceMapper sessionFileReferenceMapper;

    public void save(SessionFileReferenceEntity entity) {
        sessionFileReferenceMapper.insert(entity);
    }

    public void deleteBySessionIdAndFileReferenceId(String sessionId, String fileReferenceId) {
        sessionFileReferenceMapper.delete(
                new LambdaQueryWrapper<SessionFileReferenceEntity>()
                        .eq(SessionFileReferenceEntity::getSessionId, sessionId)
                        .eq(SessionFileReferenceEntity::getFileReferenceId, fileReferenceId)
        );
    }

    public void deleteBySessionId(String sessionId) {
        sessionFileReferenceMapper.delete(
                new LambdaQueryWrapper<SessionFileReferenceEntity>()
                        .eq(SessionFileReferenceEntity::getSessionId, sessionId)
        );
    }
}