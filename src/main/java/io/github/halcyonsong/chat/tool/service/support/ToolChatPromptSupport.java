package io.github.halcyonsong.chat.tool.service.support;

import io.github.halcyonsong.chat.common.config.prompt.ToolChatProperties;
import io.github.halcyonsong.chat.common.support.PromptContextSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class ToolChatPromptSupport {

    private final ToolChatProperties toolChatProperties;
    private final PromptContextSupport promptContextSupport;

    // 拼接基础系统提示词，自定义系统提示词和历史摘要上下文
    public String resolveSystemPrompt(String sessionId, String systemPromptOverride) {
        String basePrompt = StringUtils.hasText(systemPromptOverride)
                ? toolChatProperties.getSystem().trim() + "\n\n" + systemPromptOverride.trim()
                : toolChatProperties.getSystem().trim();

        return promptContextSupport.resolveSystemPrompt(basePrompt, sessionId);
    }

    // 拼接轮次用户提示词
    public String buildRoundUserPrompt(String originalQuestion,
                                       String currentVisibleAnswer,
                                       String latestToolSummary,
                                       int round,
                                       int maxRounds) {
        // 第一轮
        if (round <= 1) {
            return """
                    用户问题：
                    %s

                    你可以像普通助手一样直接回答。
                    如果需要工具，请直接调用工具。
                    """.formatted(defaultText(originalQuestion));
        }
        // 后续提示词
        return """
                原始问题：
                %s

                到目前为止你已经输出给用户的内容：
                %s

                最近一轮相关工具调用信息：
                %s

                当前是第 %d 轮，最大允许 %d 轮。
                如果问题仍未完成，你可以继续调用工具或继续补充回答；
                如果已经可以完整回答，请直接继续输出最终内容，不要重复前文。
                """.formatted(
                defaultText(originalQuestion),
                defaultText(currentVisibleAnswer),
                defaultText(latestToolSummary),
                round,
                maxRounds
        );
    }

    // 拼接运行时约束提示词
    public String appendRuntimeConstraintPrompt(String prompt,
                                                int maxRounds,
                                                int maxToolCalls,
                                                int maxDurationSeconds) {
        // 追加轮次提示词
        return prompt + """

            当前执行限制：
            1. 最多允许 %d 轮处理
            2. 最多允许 %d 次工具调用
            3. 最长允许执行 %d 秒
            4. 如果接近限制，请优先基于现有信息收敛，并输出 @Finish@
            5. 如果需要继续下一轮，请在最后一行输出 @Continue@
            6. 如果当前可以结束，请在最后一行输出 @Finish@
            7. 除 @Continue@ 和 @Finish@ 外，不要输出其他控制标记
            """.formatted(maxRounds, maxToolCalls, maxDurationSeconds);
    }

    // 检查文本是否有效
    private String defaultText(String text) {
        return StringUtils.hasText(text) ? text.trim() : "";
    }

    public String buildRoundSystemPrompt(String baseSystemPrompt, ToolLoopRuntimeState runtimeState) {
        if (!runtimeState.isPreviousDirectiveMissing()) {
            return baseSystemPrompt;
        }

        return baseSystemPrompt + """

            警告：
            你上一轮没有按要求在最后一行输出控制标记，导致系统只能追加 @Missing@ 继续处理，如果继续违反规则，系统可能强制终止。
            从这一轮开始，你必须严格遵守以下规则：
            1. 在回答最后一行输出且只能输出一个控制标记
            2. 控制标记只能是 @Continue@ 或 @Finish@
            3. 标记后不要再追加任何正文内容
            """;
    }

}