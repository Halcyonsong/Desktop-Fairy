package io.github.halcyonsong.chat.session.service.impl;

import io.github.halcyonsong.chat.common.constants.ChatHistoryConstants;
import io.github.halcyonsong.chat.session.convertor.ChatHistoryConvertor;
import io.github.halcyonsong.chat.session.convertor.ChatSessionConvertor;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.pojo.entity.ChatSessionEntity;
import io.github.halcyonsong.chat.session.pojo.vo.ChatHistoryMessageVO;
import io.github.halcyonsong.chat.session.pojo.vo.ChatHistoryPageVO;
import io.github.halcyonsong.chat.session.pojo.vo.ChatSessionVO;
import io.github.halcyonsong.chat.session.service.ChatSessionService;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistoryStore;
import io.github.halcyonsong.chat.session.service.support.session.ChatSessionMemorySupport;
import io.github.halcyonsong.chat.session.service.support.session.ChatSessionRollbackSupport;
import io.github.halcyonsong.chat.session.service.support.session.ChatSessionStore;
import io.github.halcyonsong.chat.sum.service.ChatSummaryService;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import io.github.halcyonsong.sessionfolder.service.SessionFolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;


@Service
@RequiredArgsConstructor
public class ChatSessionServiceImpl implements ChatSessionService {

    private static final String DEFAULT_TITLE = "untitled";

    private final ChatSessionStore chatSessionStore;
    private final ChatHistoryStore chatHistoryStore;
    private final ChatSessionRollbackSupport chatSessionRollbackSupport;
    private final ChatSummaryService chatSummaryService;
    private final ChatSessionMemorySupport chatSessionMemorySupport;
    private final ChatSessionConvertor chatSessionConvertor;
    private final ChatHistoryConvertor chatHistoryConvertor;
    private final SessionFileService sessionFileService;
    private final SessionFolderService sessionFolderService;

    @Override // 创建会话方法
    public ChatSessionVO createSession() {
        String sessionId = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();

        ChatSessionEntity entity = ChatSessionEntity.builder()
                .sessionId(sessionId)
                .title(DEFAULT_TITLE)
                .createTime(now)
                .updateTime(now)
                .build();
        // 保存会话信息
        chatSessionStore.saveSession(entity);
        return chatSessionConvertor.toTarget(entity);
    }

    @Override // 获取会话列表方法
    public List<ChatSessionVO> listSessions() {
        List<ChatSessionEntity> entityList = chatSessionStore.listSessions(100L);
        if (entityList == null || entityList.isEmpty()) {
            return List.of();
        }
        return chatSessionConvertor.toTarget(entityList);
    }

    @Override // 获取会话信息方法
    public ChatSessionVO getSession(String sessionId) {
        ChatSessionEntity entity = chatSessionStore.getSession(sessionId);
        if (entity == null) {
            return null;
        }
        return chatSessionConvertor.toTarget(entity);
    }

    @Override // 更新会话活跃时间
    public void touchSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }
        if (chatSessionStore.getSession(sessionId) == null) {
            return;
        }

        chatSessionStore.touchSession(sessionId);
    }

    @Override // 删除会话方法
    public boolean deleteSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return false;
        }

        boolean deleted = chatSessionStore.deleteSession(sessionId);
        sessionRelatedDeleteSupport(sessionId);
        return deleted;
    }

    private void sessionRelatedDeleteSupport(String sessionId) {
        chatSessionMemorySupport.clearMemoryWindow(sessionId);
        chatHistoryStore.deleteHistory(sessionId);
        chatSummaryService.clearSessionSummaries(sessionId);
        sessionFileService.deleteBySessionId(sessionId);
        sessionFolderService.deleteBySessionId(sessionId);
    }

    @Override // 重命名会话方法
    public ChatSessionVO renameSession(String sessionId, String title) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }
        if (!StringUtils.hasText(title)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "title 不能为空");
        }

        ChatSessionVO chatSessionVO = getSession(sessionId);
        if (chatSessionVO == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话不存在: " + sessionId);
        }

        String trimmedTitle = title.trim();
        if (trimmedTitle.length() > 100) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "title 长度不能超过 100");
        }

        chatSessionVO.setTitle(trimmedTitle);
        chatSessionVO.setUpdateTime(LocalDateTime.now());
        chatSessionStore.saveSession(chatSessionConvertor.toSource(chatSessionVO));
        return chatSessionVO;
    }

    @Override
    public ChatHistoryPageVO listHistory(String sessionId, Integer beforeIndex) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        if (beforeIndex != null && beforeIndex < 0) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "beforeIndex 不能小于 0");
        }

        ChatSessionVO chatSessionVO = getSession(sessionId);
        if (chatSessionVO == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话不存在: " + sessionId);
        }

        return chatHistoryStore.listHistory(sessionId, beforeIndex);
    }

    @Override
    public ChatHistoryPageVO rollbackLastRound(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        ChatSessionVO chatSessionVO = getSession(sessionId);
        if (chatSessionVO == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话不存在: " + sessionId);
        }
        // 回滚最近的一轮对话
        List<ChatHistoryEntity> remainingHistoryEntity = chatSessionRollbackSupport.rollbackLastRound(sessionId);
        List<ChatHistoryMessageVO> remainingHistoryVO = chatHistoryConvertor.toTarget(remainingHistoryEntity);
        // 精确回滚摘要，并把游标小幅回退，给下一次摘要重建留空间
        chatSummaryService.realignAfterHistoryShrink(sessionId, remainingHistoryVO.size());
        // 更新会话时间戳
        chatSessionVO.setUpdateTime(LocalDateTime.now());
        chatSessionStore.saveSession(chatSessionConvertor.toSource(chatSessionVO));
        // 更新会话游标
        long total = remainingHistoryVO.size();
        int start = Math.max(0, remainingHistoryVO.size() - ChatHistoryConstants.HISTORY_PAGE_SIZE);
        List<ChatHistoryMessageVO> records = remainingHistoryVO.subList(start, remainingHistoryVO.size());

        Integer nextCursor = start > 0 ? start : null;

        return ChatHistoryPageVO.builder()
                .records(records)
                .nextCursor(nextCursor)
                .hasMore(start > 0)
                .total(total)
                .build();
    }


}