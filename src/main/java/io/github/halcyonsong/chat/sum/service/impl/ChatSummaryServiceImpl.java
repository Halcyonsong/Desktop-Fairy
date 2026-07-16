package io.github.halcyonsong.chat.sum.service.impl;

import io.github.halcyonsong.chat.common.config.prompt.SummaryProperties;
import io.github.halcyonsong.chat.common.factory.OpenAiCompatibleChatClientFactory;
import io.github.halcyonsong.chat.session.convertor.ChatHistoryConvertor;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.pojo.vo.ChatHistoryMessageVO;
import io.github.halcyonsong.chat.session.service.support.history.ChatHistoryStore;
import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.chat.sum.pojo.vo.ChatSummaryVO;
import io.github.halcyonsong.chat.sum.service.ChatSummaryService;
import io.github.halcyonsong.chat.sum.service.support.merge.ChatSummaryMergeSupport;
import io.github.halcyonsong.chat.sum.service.support.summary.ChatSummaryPromptSupport;
import io.github.halcyonsong.chat.sum.service.support.summary.ChatSummaryStore;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatSummaryServiceImpl implements ChatSummaryService {

    private final ChatHistoryStore chatHistoryStore;
    private final ChatSummaryPromptSupport chatSummaryPromptSupport;
    private final ChatSummaryStore chatSummaryStore;
    private final SummaryProperties summaryProperties;
    private final ChatSummaryMergeSupport chatSummaryMergeSupport;
    private final ChatHistoryConvertor chatHistoryConvertor;
    private final OpenAiCompatibleChatClientFactory chatClientFactory;

    private static final int MAX_ROLLBACK_REWIND = 5;

    @Override // 将一段历史消息压缩为摘要文本
    public String summarizeMessages(List<ChatHistoryMessageVO> historyMessages, ModelConfig modelConfig) {
        if (CollectionUtils.isEmpty(historyMessages)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "historyMessages 不能为空");
        }

        String systemPrompt = chatSummaryPromptSupport.buildSummarySystemPrompt();
        String userPrompt = chatSummaryPromptSupport.buildSummaryUserPrompt(historyMessages);

        log.info("chat summary start, messageCount={}, promptLength={}, model={}, baseUrl={}",
                historyMessages.size(),
                userPrompt.length(),
                modelConfig.getModel(),
                modelConfig.getBaseUrl());

        // 调用模型生成压缩摘要
        String summary = chatClientFactory.create(modelConfig)
                .prompt()
                .system(systemPrompt)
                .user(userPrompt)
                .call()
                .content();

        if (!StringUtils.hasText(summary)) {
            throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "摘要生成失败，模型未返回有效内容");
        }

        String trimmedSummary = summary.trim();
        log.info("chat summary finished, summaryLength={}", trimmedSummary.length());
        return trimmedSummary;
    }

    @Override // 获取历史信息并传入压缩方法
    public String summarizeSessionHistory(String sessionId, ModelConfig modelConfig) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        List<ChatHistoryEntity> historyMessages = chatHistoryStore.listAllHistory(sessionId);
        if (CollectionUtils.isEmpty(historyMessages)) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话历史为空，无法生成摘要");
        }

        return summarizeMessages(chatHistoryConvertor.toTarget(historyMessages), modelConfig);
    }

    @Override
    public Optional<ChatSummaryVO> compressPendingHistory(String sessionId, ModelConfig modelConfig) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        // 获取历史消息记录
        List<ChatHistoryEntity> fullHistory = chatHistoryStore.listAllHistory(sessionId);
        if (CollectionUtils.isEmpty(fullHistory)) {
            log.debug("skip summary compression because history is empty, sessionId={}", sessionId);
            return Optional.empty();
        }
        // 获取压缩游标
        int compressedCursor = chatSummaryStore.getCompressedCursor(sessionId);
        // 校验是否有回滚情况
        if (compressedCursor > fullHistory.size()) {
            log.warn("summary cursor overflow, realign session summaries, sessionId={}, cursor={}, historySize={}",
                    sessionId,
                    compressedCursor,
                    fullHistory.size());

            realignAfterHistoryShrink(sessionId, fullHistory.size());
            compressedCursor = chatSummaryStore.getCompressedCursor(sessionId);
        }
        // 提取待压缩历史消息
        List<ChatHistoryEntity> pendingHistory = fullHistory.subList(compressedCursor, fullHistory.size());
        int compressThreshold = summaryProperties.getCompressThreshold();

        if (pendingHistory.size() < compressThreshold) {
            log.debug("skip summary compression because pending history is below threshold, sessionId={}, pendingCount={}, threshold={}",
                    sessionId,
                    pendingHistory.size(),
                    compressThreshold);
            return Optional.empty();
        }

        String summaryText = this.summarizeMessages(chatHistoryConvertor.toTarget(pendingHistory), modelConfig);

        ChatSummaryVO summaryVO = ChatSummaryVO.builder()
                .content(summaryText)
                .startIndex(compressedCursor)
                .endIndex(fullHistory.size() - 1)
                .messageCount(pendingHistory.size())
                .createTime(LocalDateTime.now())
                .build();

        // 写入摘要
        chatSummaryStore.appendSummary(sessionId, summaryVO);
        // 更新压缩游标
        chatSummaryStore.saveCompressedCursor(sessionId, fullHistory.size());
        // 合并旧摘要校验
        chatSummaryMergeSupport.mergeOldSummariesIfNecessary(sessionId, modelConfig);

        log.info("pending history compressed, sessionId={}, startIndex={}, endIndex={}, messageCount={}",
                sessionId,
                summaryVO.getStartIndex(),
                summaryVO.getEndIndex(),
                summaryVO.getMessageCount());

        return Optional.of(summaryVO);
    }

    @Override // 查询当前会话所有摘要
    public List<ChatSummaryVO> listSummaries(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }
        return chatSummaryStore.listSummaries(sessionId);
    }

    @Override // 清除会话摘要及游标
    public void clearSessionSummaries(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }
        chatSummaryStore.clearSessionSummary(sessionId);
    }

    @Override
    public void realignAfterHistoryShrink(String sessionId, int historySize) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }
        if (historySize < 0) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "historySize 不能小于 0");
        }

        List<ChatSummaryVO> summaryList = chatSummaryStore.listSummaries(sessionId);
        if (CollectionUtils.isEmpty(summaryList)) {
            chatSummaryStore.saveCompressedCursor(sessionId, 0);
            log.info("summary realigned with empty summary list, sessionId={}, historySize={}",
                    sessionId,
                    historySize);
            return;
        }

        // 删掉已经引用越界历史的脏摘要
        List<ChatSummaryVO> validSummaries = new ArrayList<>();
        for (ChatSummaryVO summary : summaryList) {
            if (summary == null || summary.getEndIndex() == null) {
                continue;
            }
            if (summary.getEndIndex() < historySize) {
                // 获取有效摘要
                validSummaries.add(summary);
            }
        }

        int safeCursor = validSummaries.isEmpty() ? 0 : validSummaries.get(validSummaries.size() - 1).getEndIndex() + 1;

        // 小幅回退一段，给后续重压缩留空间
        int rewindCount = MAX_ROLLBACK_REWIND;
        int rewoundCursor = Math.max(0, safeCursor - rewindCount);

        // 删除覆盖到回退游标之后的摘要，保证摘要与游标一致
        List<ChatSummaryVO> finalSummaries = new ArrayList<>();
        for (ChatSummaryVO summary : validSummaries) {
            Integer endIndex = summary.getEndIndex();
            if (endIndex != null && endIndex < rewoundCursor) {
                finalSummaries.add(summary);
            }
        }
        // 替换会话摘要，更新压缩游标
        chatSummaryStore.replaceSummaries(sessionId, finalSummaries);
        chatSummaryStore.saveCompressedCursor(sessionId, rewoundCursor);

        log.info("summary realigned after history shrink, sessionId={}, historySize={}, originalSummaryCount={}, keptSummaryCount={}, safeCursor={}, rewoundCursor={}, rewindCount={}",
                sessionId,
                historySize,
                summaryList.size(),
                finalSummaries.size(),
                safeCursor,
                rewoundCursor,
                rewindCount);
    }

}