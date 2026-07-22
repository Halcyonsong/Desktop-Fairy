package io.github.halcyonsong.chat.tool.service.support;

import io.github.halcyonsong.chat.common.config.prompt.ToolChatProperties;
import io.github.halcyonsong.chat.common.support.PromptContextSupport;
import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ToolChatPromptSupport {

    private final ToolChatProperties toolChatProperties;
    private final PromptContextSupport promptContextSupport;
    private final SessionFileService sessionFileService;

    public String resolveSystemPrompt(String sessionId, String systemPromptOverride) {
        String basePrompt = StringUtils.hasText(systemPromptOverride)
                ? toolChatProperties.getSystem().trim() + "\n\n" + systemPromptOverride.trim()
                : toolChatProperties.getSystem().trim();

        return promptContextSupport.resolveSystemPrompt(basePrompt, sessionId);
    }

    public String buildRoundUserPrompt(String originalQuestion,
                                       String currentVisibleAnswer,
                                       String latestToolSummary,
                                       int round,
                                       int maxRounds) {
        if (round <= 1) {
            return """
                    用户问题：
                    %s

                    你可以像普通助手一样直接回答。
                    如果需要工具，请直接调用工具。
                    """.formatted(defaultText(originalQuestion));
        }

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

    public String appendSessionFilePrompt(String prompt) {
        return prompt + """

    你可以使用当前会话中已授权的文件和目录工具。

    文件规则：
    1. 只有已授权文件才能读取或处理
    2. 不确定目标文件时先调用 listAuthorizedFiles
    3. 文本、代码和文档优先使用 readAuthorizedFileAsText
    4. 图片需要视觉输入时使用 attachAuthorizedImage(fileReferenceId)，该轮不得直接描述图片内容
    5. 不要假设未读取文件的具体内容

    目录规则：
    6. 不确定可用工作空间时先调用 listAuthorizedFolders
    7. 目录内先列出、搜索或查看元信息，再读取文件
    8. 代码、日志、普通文本优先按行读取；通用大文本可按字符分段读取
    9. 目录内读取使用 folderReferenceId + relativePath
    """;
    }

    public String appendCurrentAttachmentPrompt(String sessionId,
                                                String prompt,
                                                List<String> attachmentFileReferenceIds,
                                                String primaryAttachmentFileReferenceId) {
        if (!StringUtils.hasText(sessionId) || attachmentFileReferenceIds == null || attachmentFileReferenceIds.isEmpty()) {
            return prompt;
        }

        List<SessionFileReferenceVO> attachedFiles = attachmentFileReferenceIds.stream()
                .filter(StringUtils::hasText)
                .distinct()
                .map(fileReferenceId -> sessionFileService.getBySessionIdAndFileReferenceId(sessionId, fileReferenceId))
                .filter(java.util.Objects::nonNull)
                .toList();

        if (attachedFiles.isEmpty()) {
            return prompt;
        }

        StringBuilder builder = new StringBuilder(prompt);
        builder.append("""

        本次用户当前附带了以下文件，如果你判断需要，优先处理这些文件。这些文件确认有授权，你可以直接读取或进一步处理：
        """);

        for (int i = 0; i < attachedFiles.size(); i++) {
            SessionFileReferenceVO file = attachedFiles.get(i);
            builder.append("\n")
                    .append(i + 1)
                    .append(". fileReferenceId=").append(file.getFileReferenceId())
                    .append(", fileName=").append(defaultText(file.getOriginalFileName()))
                    .append(", contentType=").append(defaultText(file.getContentType()))
                    .append(", size=").append(file.getFileSize() == null ? "" : file.getFileSize());
        }

        if (StringUtils.hasText(primaryAttachmentFileReferenceId)) {
            SessionFileReferenceVO primaryFile =
                    sessionFileService.getBySessionIdAndFileReferenceId(sessionId, primaryAttachmentFileReferenceId);

            if (primaryFile != null) {
                builder.append("""

                当前主附件：
                fileReferenceId=%s, fileName=%s, contentType=%s
                """.formatted(
                        primaryFile.getFileReferenceId(),
                        defaultText(primaryFile.getOriginalFileName()),
                        defaultText(primaryFile.getContentType())
                ));
            }
        }

        builder.append("""

        如果用户当前问题是在询问这次上传的附件，请优先处理以上文件，不要先猜测其他已授权文件。
        """);

        return builder.toString();
    }

    public String appendRuntimeConstraintPrompt(String prompt,
                                                int maxRounds,
                                                int maxToolCalls,
                                                int maxDurationSeconds) {
        return prompt + """

        当前执行限制：
        1. 最多 %d 轮
        2. 最多 %d 次工具调用
        3. 最长 %d 秒
        4. 接近限制时优先收敛并结束
        """.formatted(maxRounds, maxToolCalls, maxDurationSeconds);
    }

    private String defaultText(String text) {
        return StringUtils.hasText(text) ? text.trim() : "";
    }

    public String buildRoundSystemPrompt(String baseSystemPrompt, ToolLoopRuntimeState runtimeState) {
        return baseSystemPrompt;
    }
}