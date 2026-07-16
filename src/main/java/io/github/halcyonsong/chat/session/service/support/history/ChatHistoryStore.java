package io.github.halcyonsong.chat.session.service.support.history;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.github.halcyonsong.chat.common.constants.ChatHistoryConstants;
import io.github.halcyonsong.chat.session.convertor.ChatHistoryConvertor;
import io.github.halcyonsong.chat.session.mapper.ChatHistoryMapper;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.pojo.vo.ChatHistoryPageVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ChatHistoryStore {

    private final ChatHistoryMapper chatHistoryMapper;
    private final ChatHistoryConvertor chatHistoryConvertor;

    // 追加历史对话信息
    public void appendMessage(String sessionId, ChatHistoryEntity entityMessage) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
        if (entityMessage == null) {
            throw new IllegalArgumentException("message 不能为空");
        }

        entityMessage.setSessionId(sessionId);
        chatHistoryMapper.insert(entityMessage);
    }

    // 删除历史对话信息
    public void deleteHistory(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }

        LambdaQueryWrapper<ChatHistoryEntity> queryWrapper = new LambdaQueryWrapper<ChatHistoryEntity>()
                .eq(ChatHistoryEntity::getSessionId, sessionId);

        chatHistoryMapper.delete(queryWrapper);
    }

    // 获取全部后游标切分
    public ChatHistoryPageVO listHistory(String sessionId, Integer beforeIndex) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }

        List<ChatHistoryEntity> fullHistory = listAllHistory(sessionId);
        if (fullHistory.isEmpty()) {
            return ChatHistoryPageVO.builder()
                    .records(List.of())
                    .nextCursor(null)
                    .hasMore(false)
                    .total(0L)
                    .build();
        }

        int total = fullHistory.size();

        int end;
        if (beforeIndex == null) {
            end = total - 1;
        } else {
            end = Math.min(beforeIndex - 1, total - 1);
        }

        if (end < 0) {
            return ChatHistoryPageVO.builder()
                    .records(List.of())
                    .nextCursor(null)
                    .hasMore(false)
                    .total(total)
                    .build();
        }

        int start = Math.max(0, end - ChatHistoryConstants.HISTORY_PAGE_SIZE + 1);
        List<ChatHistoryEntity> records = new ArrayList<>(fullHistory.subList(start, end + 1));

        boolean hasMore = start > 0;
        Integer nextCursor = hasMore ? start : null;

        return ChatHistoryPageVO.builder()
                .records(chatHistoryConvertor.toTarget(records))
                .nextCursor(nextCursor)
                .hasMore(hasMore)
                .total(total)
                .build();
    }

    // 获取对话所有历史消息
    public List<ChatHistoryEntity> listAllHistory(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }

        LambdaQueryWrapper<ChatHistoryEntity> queryWrapper = new LambdaQueryWrapper<ChatHistoryEntity>()
                .eq(ChatHistoryEntity::getSessionId, sessionId)
                .orderByAsc(ChatHistoryEntity::getId);

        List<ChatHistoryEntity> entityList = chatHistoryMapper.selectList(queryWrapper);
        if (entityList == null || entityList.isEmpty()) {
            return List.of();
        }

        return entityList;
    }

    // 替换全部历史消息
    public void replaceHistory(String sessionId, List<ChatHistoryEntity> historyList) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
        if (historyList == null) {
            throw new IllegalArgumentException("historyList 不能为空");
        }

        deleteHistory(sessionId);
        if (historyList.isEmpty()) {
            return;
        }

        for (ChatHistoryEntity entity : historyList) {
            entity.setId(null);
            entity.setSessionId(sessionId);
            chatHistoryMapper.insert(entity);
        }
    }

    // 删除fromMessageId及之后的历史消息
    public void deleteHistoryFromMessageId(String sessionId, Long fromMessageId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new IllegalArgumentException("sessionId 不能为空");
        }
        if (fromMessageId == null) {
            throw new IllegalArgumentException("fromMessageId 不能为空");
        }

        LambdaQueryWrapper<ChatHistoryEntity> queryWrapper = new LambdaQueryWrapper<ChatHistoryEntity>()
                .eq(ChatHistoryEntity::getSessionId, sessionId)
                .ge(ChatHistoryEntity::getId, fromMessageId);

        chatHistoryMapper.delete(queryWrapper);
    }

}