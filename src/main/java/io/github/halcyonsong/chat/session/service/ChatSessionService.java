package io.github.halcyonsong.chat.session.service;

import io.github.halcyonsong.chat.session.pojo.vo.ChatHistoryPageVO;
import io.github.halcyonsong.chat.session.pojo.vo.ChatSessionVO;

import java.util.List;

public interface ChatSessionService {

    ChatSessionVO createSession();

    List<ChatSessionVO> listSessions();

    ChatSessionVO getSession(String sessionId);

    void touchSession(String sessionId);

    boolean deleteSession(String sessionId);

    ChatSessionVO renameSession(String sessionId, String title);

    ChatHistoryPageVO listHistory(String sessionId, Integer beforeIndex);

    ChatHistoryPageVO rollbackLastRound(String sessionId);

}