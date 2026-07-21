package io.github.halcyonsong.chat.tool.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ToolChatStageEnum {

    ROUND_START("ROUND_START", "轮次开始"),
    TOOL_CALL("TOOL_CALL", "工具调用"),
    TOOL_RESULT("TOOL_RESULT", "工具结果"),
    ROUND_CONTINUE("ROUND_CONTINUE", "继续下一轮"),
    DIRECTIVE_WARNING("DIRECTIVE_WARNING", "控制标记缺失警告"),
    DIRECTIVE_LIMIT("DIRECTIVE_LIMIT", "控制标记缺失超限"),
    ROUND_LIMIT("ROUND_LIMIT", "轮次超限"),
    TOOL_LIMIT("TOOL_LIMIT", "工具调用次数超限"),
    TIME_LIMIT("TIME_LIMIT", "执行时长超限");

    private final String code;
    private final String desc;
}