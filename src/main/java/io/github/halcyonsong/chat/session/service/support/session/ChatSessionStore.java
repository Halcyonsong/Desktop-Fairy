package io.github.halcyonsong.chat.session.service.support.session;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import io.github.halcyonsong.chat.session.mapper.ChatSessionMapper;
import io.github.halcyonsong.chat.session.pojo.entity.ChatSessionEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ChatSessionStore {

    private final ChatSessionMapper chatSessionMapper;

    // 保存会话信息
    public void saveSession(ChatSessionEntity sessionEntity) {
        validateSessionEntity(sessionEntity);

        ChatSessionEntity existing = findBySessionId(sessionEntity.getSessionId());
        if (existing == null) {
            chatSessionMapper.insert(sessionEntity);
            return;
        }

        sessionEntity.setId(existing.getId());
        chatSessionMapper.updateById(sessionEntity);
    }

    // 查询会话信息
    public ChatSessionEntity getSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return null;
        }

        return findBySessionId(sessionId);
    }

    // 查询会话列表
    public List<ChatSessionEntity> listSessions(long limit) {
        if (limit <= 0) {
            return Collections.emptyList();
        }

        LambdaQueryWrapper<ChatSessionEntity> queryWrapper = new LambdaQueryWrapper<ChatSessionEntity>()
                .orderByDesc(ChatSessionEntity::getUpdateTime)
                .last("limit " + limit);

        List<ChatSessionEntity> entityList = chatSessionMapper.selectList(queryWrapper);
        if (entityList == null || entityList.isEmpty()) {
            return Collections.emptyList();
        }

        return entityList;
    }

    // 刷新会话更新时间
    public void touchSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }

        LambdaUpdateWrapper<ChatSessionEntity> updateWrapper = new LambdaUpdateWrapper<ChatSessionEntity>()
                .eq(ChatSessionEntity::getSessionId, sessionId)
                .set(ChatSessionEntity::getUpdateTime, LocalDateTime.now());

        chatSessionMapper.update(null, updateWrapper);
    }

    // 删除会话
    public boolean deleteSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return false;
        }

        return chatSessionMapper.delete(buildSessionIdQuery(sessionId)) > 0;
    }

    // 按会话ID查询会话信息
    private ChatSessionEntity findBySessionId(String sessionId) {
        return chatSessionMapper.selectOne(buildSessionIdQuery(sessionId).last("limit 1"));
    }

    // 查询条件构建器
    private LambdaQueryWrapper<ChatSessionEntity> buildSessionIdQuery(String sessionId) {
        return new LambdaQueryWrapper<ChatSessionEntity>()
                .eq(ChatSessionEntity::getSessionId, sessionId);
    }

    // 校验参数
    private void validateSessionEntity(ChatSessionEntity sessionEntity) {
        if (sessionEntity == null) {
            throw new IllegalArgumentException("参数不能为空");
        }
        if (!StringUtils.hasText(sessionEntity.getSessionId())) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
    }
}