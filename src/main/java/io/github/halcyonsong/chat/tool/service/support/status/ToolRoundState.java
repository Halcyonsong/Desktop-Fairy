package io.github.halcyonsong.chat.tool.service.support.status;

import lombok.Getter;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;

@Getter
public class ToolRoundState {

    private final int round;
    private boolean toolCallDetected = false;
    private final List<String> toolSummaries = new ArrayList<>();
    private final StringBuilder roundOutputBuilder = new StringBuilder();
    // 记录当前轮次
    public ToolRoundState(int round) {
        this.round = round;
    }
    // 记录工具调用
    public void markToolCallDetected() {
        this.toolCallDetected = true;
    }
    // 添加工具调用摘要
    public void addToolSummary(String summary) {
        if (StringUtils.hasText(summary)) {
            toolSummaries.add(summary.trim());
        }
    }
    // 追加本轮输出
    public void appendRoundOutput(String text) {
        if (StringUtils.hasText(text)) {
            roundOutputBuilder.append(text);
        }
    }
    // 获取本轮输出
    public String getRoundOutput() {
        return roundOutputBuilder.toString();
    }
    // 解析本轮共有哪些工具调用
    public String getToolSummaryText() {
        if (toolSummaries.isEmpty()) {
            return "";
        }
        StringJoiner joiner = new StringJoiner("\n");
        for (String toolSummary : toolSummaries) {
            joiner.add(toolSummary);
        }
        return joiner.toString();
    }
}