package io.github.halcyonsong.chat.tool.service.support;

import lombok.Getter;
import lombok.Setter;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

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
    // 记录工具id
    private final Set<String> seenToolCallIds = new HashSet<>();
    // 缺少标记计数
    private int missingDirectiveCount = 0;
    // 上一轮是否缺少标记
    @Setter
    private boolean previousDirectiveMissing = false;

    // 构造调用限制
    public ToolLoopRuntimeState(int maxRounds, int maxToolCalls, int maxDurationSeconds) {
        this.maxRounds = maxRounds;
        this.maxToolCalls = maxToolCalls;
        this.maxDurationSeconds = maxDurationSeconds;
    }
    // 工具调用计数加一，防止切块导致重复计数
    public boolean registerToolCall(String toolCallId) {
        if (!StringUtils.hasText(toolCallId)) {
            return false;
        }

        boolean added = seenToolCallIds.add(toolCallId);
        if (added) {
            toolCallCount++;
        }
        return added;
    }
    // 缺少标记计数加一
    public void increaseMissingDirectiveCount() {
        missingDirectiveCount++;
    }
    // 重置缺少标记计数
    public void resetMissingDirectiveCount() {
        missingDirectiveCount = 0;
    }
    // 判断轮次是否超过限制
    public boolean exceedsRoundLimit(int round) {
        return round > maxRounds;
    }
    // 判断工具调用次数是否超过限制
    public boolean exceedsToolCallLimit() {
        return toolCallCount >= maxToolCalls;
    }
    // 更新最新工具调用摘要
    public void setLatestToolSummary(String latestToolSummary) {
        this.latestToolSummary = latestToolSummary == null ? "" : latestToolSummary;
    }
    // 判断持续时间是否超过限制
    public boolean exceedsDurationLimit() {
        long elapsedSeconds = Duration.between(startedAt, Instant.now()).getSeconds();
        return elapsedSeconds >= maxDurationSeconds;
    }
    // 判断缺少标记计数是否超过限制
    public boolean exceedsMissingDirectiveLimit() {
        return missingDirectiveCount >= 3;
    }

}