package io.github.halcyonsong.chat.sum.service.support.summary;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.chat.sum.convertor.ChatSummaryConvertor;
import io.github.halcyonsong.chat.sum.mapper.ChatSummaryCursorMapper;
import io.github.halcyonsong.chat.sum.mapper.ChatSummaryMapper;
import io.github.halcyonsong.chat.sum.pojo.entity.ChatSummaryCursorEntity;
import io.github.halcyonsong.chat.sum.pojo.entity.ChatSummaryEntity;
import io.github.halcyonsong.chat.sum.pojo.vo.ChatSummaryVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ChatSummaryStore {

    private final ChatSummaryMapper chatSummaryMapper;
    private final ChatSummaryCursorMapper chatSummaryCursorMapper;
    private final ChatSummaryConvertor chatSummaryConvertor;

    // 追加摘要
    public void appendSummary(String sessionId, ChatSummaryVO summary) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
        if (summary == null) {
            throw new IllegalArgumentException("summary 不能为空");
        }

        ChatSummaryEntity entity = chatSummaryConvertor.toSource(summary);
        // 置空id，防止冲突
        entity.setId(null);
        entity.setSessionId(sessionId);
        chatSummaryMapper.insert(entity);
    }

    // 获取摘要列表
    public List<ChatSummaryVO> listSummaries(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }

        List<ChatSummaryEntity> entityList = chatSummaryMapper.selectList(
                new LambdaQueryWrapper<ChatSummaryEntity>()
                        .eq(ChatSummaryEntity::getSessionId, sessionId)
                        .orderByAsc(ChatSummaryEntity::getId)
        );

        if (entityList == null || entityList.isEmpty()) {
            return List.of();
        }

        return chatSummaryConvertor.toTarget(entityList);
    }

    // 获取压缩游标
    public int getCompressedCursor(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }

        ChatSummaryCursorEntity cursorEntity = findCursorBySessionId(sessionId);
        if (cursorEntity == null || cursorEntity.getCompressedCursor() == null) {
            return 0;
        }

        return Math.max(cursorEntity.getCompressedCursor(), 0);
    }

    // 保存压缩游标
    public void saveCompressedCursor(String sessionId, int cursor) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
        if (cursor < 0) {
            throw new IllegalArgumentException("cursor 不能小于 0");
        }

        ChatSummaryCursorEntity existing = findCursorBySessionId(sessionId);
        if (existing == null) {
            chatSummaryCursorMapper.insert(ChatSummaryCursorEntity.builder()
                    .sessionId(sessionId)
                    .compressedCursor(cursor)
                    .build());
            return;
        }

        existing.setCompressedCursor(cursor);
        chatSummaryCursorMapper.updateById(existing);
    }

    // 按会话id清空会话摘要
    public void clearSessionSummary(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }

        chatSummaryMapper.delete(
                new LambdaQueryWrapper<ChatSummaryEntity>()
                        .eq(ChatSummaryEntity::getSessionId, sessionId)
        );

        chatSummaryCursorMapper.delete(
                new LambdaQueryWrapper<ChatSummaryCursorEntity>()
                        .eq(ChatSummaryCursorEntity::getSessionId, sessionId)
        );
    }

    // 替换会话摘要
    public void replaceSummaries(String sessionId, List<ChatSummaryVO> summaries) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
        if (summaries == null) {
            throw new IllegalArgumentException("summaries 不能为空");
        }

        chatSummaryMapper.delete(
                new LambdaQueryWrapper<ChatSummaryEntity>()
                        .eq(ChatSummaryEntity::getSessionId, sessionId)
        );

        if (summaries.isEmpty()) {
            return;
        }

        for (ChatSummaryVO summary : summaries) {
            ChatSummaryEntity entity = chatSummaryConvertor.toSource(summary);
            entity.setId(null);
            entity.setSessionId(sessionId);
            chatSummaryMapper.insert(entity);
        }
    }

    private ChatSummaryCursorEntity findCursorBySessionId(String sessionId) {
        return chatSummaryCursorMapper.selectOne(
                new LambdaQueryWrapper<ChatSummaryCursorEntity>()
                        .eq(ChatSummaryCursorEntity::getSessionId, sessionId)
                        .last("limit 1")
        );
    }
}