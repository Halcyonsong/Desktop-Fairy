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
    // 待处理权限申请
    private PermissionRequestState pendingPermissionRequest;

    public ToolLoopRuntimeState(int maxRounds, int maxToolCalls, int maxDurationSeconds) {
        this.maxRounds = maxRounds;
        this.maxToolCalls = maxToolCalls;
        this.maxDurationSeconds = maxDurationSeconds;
    }

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

    public void markContinue(String reason) {
        currentRoundDecision = ToolLoopDecisionEnum.CONTINUE;
        currentRoundDecisionReason = normalizeText(reason);
    }

    public void markFinish(String reason) {
        currentRoundDecision = ToolLoopDecisionEnum.FINISH;
        currentRoundDecisionReason = normalizeText(reason);
    }

    public void resetCurrentRoundDecision() {
        currentRoundDecision = null;
        currentRoundDecisionReason = "";
    }

    public boolean exceedsRoundLimit(int round) {
        return round > maxRounds;
    }

    public boolean exceedsToolCallLimit() {
        return toolCallCount >= maxToolCalls;
    }

    public boolean exceedsDurationLimit() {
        long elapsedSeconds = Duration.between(startedAt, Instant.now()).getSeconds();
        return elapsedSeconds >= maxDurationSeconds;
    }

    public void setLatestToolSummary(String latestToolSummary) {
        this.latestToolSummary = latestToolSummary == null ? "" : latestToolSummary;
    }

    public void addPendingMediaAttachment(PendingMediaAttachment attachment) {
        if (attachment != null) {
            pendingMediaAttachments.add(attachment);
        }
    }

    public boolean hasPendingMediaAttachments() {
        return !pendingMediaAttachments.isEmpty();
    }

    public List<PendingMediaAttachment> getPendingMediaAttachmentsSnapshot() {
        return Collections.unmodifiableList(pendingMediaAttachments);
    }

    public List<PendingMediaAttachment> consumePendingMediaAttachments() {
        List<PendingMediaAttachment> snapshot = new ArrayList<>(pendingMediaAttachments);
        pendingMediaAttachments.clear();
        return snapshot;
    }

    public void requestPermission(String requestType, String absolutePath, String reason) {
        this.pendingPermissionRequest = PermissionRequestState.builder()
                .requestType(normalizeText(requestType))
                .absolutePath(normalizeText(absolutePath))
                .reason(normalizeText(reason))
                .build();
    }

    public boolean hasPendingPermissionRequest() {
        return pendingPermissionRequest != null
                && StringUtils.hasText(pendingPermissionRequest.getRequestType())
                && StringUtils.hasText(pendingPermissionRequest.getAbsolutePath());
    }

    public void clearPendingPermissionRequest() {
        this.pendingPermissionRequest = null;
    }

    private String normalizeText(String text) {
        return StringUtils.hasText(text) ? text.trim() : "";
    }
}