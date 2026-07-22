package io.github.halcyonsong.chat.tool.service.support.status;

import io.github.halcyonsong.chat.tool.enums.ToolLoopDecisionEnum;
import io.github.halcyonsong.chat.tool.pojo.PendingMediaAttachment;
import lombok.Getter;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Getter
public class ToolLoopRuntimeState {

    // 开始时间
    private final Instant startedAt = Instant.now();
    // 最大轮次
    private final int maxRounds;
    // 最大工具调用次数
    private final int maxToolCalls;
    // 最大持续时间（秒）
    private final int maxDurationSeconds;
    // 工具调用计数
    private int toolCallCount = 0;
    // 最新工具调用摘要
    private String latestToolSummary = "";
    // 记录工具 id，避免切块重复计数
    private final Set<String> seenToolCallIds = new HashSet<>();
    // 当前轮次决策
    private ToolLoopDecisionEnum currentRoundDecision;
    // 当前轮次决策原因
    private String currentRoundDecisionReason = "";
    // 待处理媒体附件
    private final List<PendingMediaAttachment> pendingMediaAttachments = new ArrayList<>();
    // 构造函数
    public ToolLoopRuntimeState(int maxRounds, int maxToolCalls, int maxDurationSeconds) {
        this.maxRounds = maxRounds;
        this.maxToolCalls = maxToolCalls;
        this.maxDurationSeconds = maxDurationSeconds;
    }
    // 工具调用计数加一，防止切块导致重复计数
    public boolean registerToolCall(String toolCallKey) {
        if (!StringUtils.hasText(toolCallKey)) {
            return false;
        }
        boolean added = seenToolCallIds.add(toolCallKey);
        if (added) {
            toolCallCount++;
        }
        return added;
    }
    // 解析工具调用
    public String resolveToolCallKey(int round, AssistantMessage.ToolCall toolCall) {
        if (toolCall == null) {
            return "round-" + round + "-unknown-tool-call";
        }

        if (StringUtils.hasText(toolCall.id())) {
            return toolCall.id().trim();
        }

        String name = StringUtils.hasText(toolCall.name()) ? toolCall.name().trim() : "unknown";
        String arguments = StringUtils.hasText(toolCall.arguments()) ? toolCall.arguments().trim() : "";

        return "round-%d|name=%s|args=%s".formatted(round, name, arguments);
    }
    // 标记继续
    public void markContinue(String reason) {
        currentRoundDecision = ToolLoopDecisionEnum.CONTINUE;
        currentRoundDecisionReason = normalizeReason(reason);
    }
    // 标记完成
    public void markFinish(String reason) {
        currentRoundDecision = ToolLoopDecisionEnum.FINISH;
        currentRoundDecisionReason = normalizeReason(reason);
    }
    // 重置当前轮次决策
    public void resetCurrentRoundDecision() {
        currentRoundDecision = null;
        currentRoundDecisionReason = "";
    }
    // 检查是否超过轮次限制
    public boolean exceedsRoundLimit(int round) {
        return round > maxRounds;
    }
    // 检查是否超过工具调用次数限制
    public boolean exceedsToolCallLimit() {
        return toolCallCount >= maxToolCalls;
    }
    // 检查是否超过持续时间限制
    public boolean exceedsDurationLimit() {
        long elapsedSeconds = Duration.between(startedAt, Instant.now()).getSeconds();
        return elapsedSeconds >= maxDurationSeconds;
    }
    // 设置最新工具调用摘要
    public void setLatestToolSummary(String latestToolSummary) {
        this.latestToolSummary = latestToolSummary == null ? "" : latestToolSummary;
    }
    // 添加待处理媒体附件
    public void addPendingMediaAttachment(PendingMediaAttachment attachment) {
        if (attachment != null) {
            pendingMediaAttachments.add(attachment);
        }
    }
    // 检查是否有待处理媒体附件
    public boolean hasPendingMediaAttachments() {
        return !pendingMediaAttachments.isEmpty();
    }
    // 获取待处理媒体附件快照
    public List<PendingMediaAttachment> getPendingMediaAttachmentsSnapshot() {
        return Collections.unmodifiableList(pendingMediaAttachments);
    }
    // 消费待处理媒体附件
    public List<PendingMediaAttachment> consumePendingMediaAttachments() {
        List<PendingMediaAttachment> snapshot = new ArrayList<>(pendingMediaAttachments);
        pendingMediaAttachments.clear();
        return snapshot;
    }
    // 规范化决策原因
    private String normalizeReason(String reason) {
        return StringUtils.hasText(reason) ? reason.trim() : "";
    }
}