package io.github.halcyonsong.chat.common.support;

import io.github.halcyonsong.chat.sum.pojo.vo.ChatSummaryVO;
import io.github.halcyonsong.chat.sum.service.support.summary.ChatSummaryStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
@RequiredArgsConstructor
public class PromptContextSupport {

    private final ChatSummaryStore chatSummaryStore;

    // 共用解析拼接系统提示词方法，拼接历史摘要上下文
    public String resolveSystemPrompt(String basePrompt, String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return basePrompt;
        }

        List<ChatSummaryVO> summaryList = chatSummaryStore.listSummaries(sessionId);
        if (CollectionUtils.isEmpty(summaryList)) {
            return basePrompt;
        }

        String summaryContext = buildSummaryContext(summaryList);
        if (!StringUtils.hasText(summaryContext)) {
            return basePrompt;
        }

        return basePrompt + "\n\n" + summaryContext;
    }

    public String buildSummaryContext(List<ChatSummaryVO> summaryList) {
        StringBuilder summaryBuilder = new StringBuilder();
        summaryBuilder.append("以下是当前会话已整理的历史摘要，请在回答时继承这些上下文，避免重复收集已确认信息：\n");

        int displayIndex = 1;
        for (ChatSummaryVO summary : summaryList) {
            if (summary == null || !StringUtils.hasText(summary.getContent())) {
                continue;
            }

            summaryBuilder.append(displayIndex++)
                    .append(". ")
                    .append(summary.getContent().trim())
                    .append("\n");
        }

        return displayIndex == 1 ? "" : summaryBuilder.toString().trim();
    }
}