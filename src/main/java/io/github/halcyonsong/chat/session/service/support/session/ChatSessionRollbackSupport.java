package io.github.halcyonsong.chat.session.service.support.session;

import io.github.halcyonsong.chat.common.enums.ChatRoleEnum;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistoryStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ChatSessionRollbackSupport {

    private final ChatHistoryStore chatHistoryStore;
    private final ChatSessionMemorySupport chatSessionMemorySupport;

    // 回滚最近一轮对话
    public List<ChatHistoryEntity> rollbackLastRound(String sessionId) {
        // 先获取对话所有历史消息
        List<ChatHistoryEntity> fullHistory = chatHistoryStore.listAllHistory(sessionId);
        if (CollectionUtils.isEmpty(fullHistory)) {
            return fullHistory;
        }
        // 找到最近一轮对话的结束索引，及最后一个assistant消息索引
        int roundEndIndex = findLastRoundEnd(fullHistory);
        if (roundEndIndex < 0) {
            return fullHistory;
        }
        // 根据assistant消息索引，找到最近一轮对话的开始索引，及往前最近的一个user消息索引
        int roundStartIndex = findLastRoundStart(fullHistory, roundEndIndex);
        if (roundStartIndex < 0) {
            return fullHistory;
        }
        // 获取最近一轮对话开始的详细消息内容
        ChatHistoryEntity roundStartMessage = fullHistory.get(roundStartIndex);
        if (roundStartMessage == null || roundStartMessage.getId() == null) {
            return fullHistory;
        }
        // 删除最近一轮对话开始的详细消息内容及之后的历史消息
        chatHistoryStore.deleteHistoryFromMessageId(sessionId, roundStartMessage.getId());
        // 重新构建对话内存窗口
        List<ChatHistoryEntity> remainingHistory = new ArrayList<>(fullHistory.subList(0, roundStartIndex));
        chatSessionMemorySupport.rebuildMemoryWindow(sessionId, remainingHistory);

        return remainingHistory;
    }

    private int findLastRoundEnd(List<ChatHistoryEntity> historyList) {
        for (int index = historyList.size() - 1; index >= 0; index--) {
            ChatHistoryEntity entity = historyList.get(index);
            if (ChatRoleEnum.ASSISTANT.getValue().equals(entity.getRole())) {
                return index;
            }
        }

        for (int index = historyList.size() - 1; index >= 0; index--) {
            ChatHistoryEntity entity = historyList.get(index);
            if (ChatRoleEnum.USER.getValue().equals(entity.getRole())) {
                return index;
            }
        }

        return -1;
    }

    private int findLastRoundStart(List<ChatHistoryEntity> historyList, int roundEndIndex) {
        for (int index = roundEndIndex; index >= 0; index--) {
            ChatHistoryEntity entity = historyList.get(index);
            if (ChatRoleEnum.USER.getValue().equals(entity.getRole())) {
                return index;
            }
        }
        return -1;
    }
}