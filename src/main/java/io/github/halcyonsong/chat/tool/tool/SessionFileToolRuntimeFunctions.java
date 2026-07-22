package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.chat.tool.pojo.PendingMediaAttachment;
import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import io.github.halcyonsong.sessionfile.service.support.AuthorizedFileReadSupport;
import lombok.AllArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.util.StringUtils;

import java.util.List;

@AllArgsConstructor
public class SessionFileToolRuntimeFunctions {

    private final SessionFileService sessionFileService;
    private final AuthorizedFileReadSupport authorizedFileReadSupport;
    private final String sessionId;
    private final ToolLoopRuntimeState runtimeState;

    @Tool(description = "List all authorized files available in current session")
    public String listAuthorizedFiles() {
        if (!StringUtils.hasText(sessionId)) {
            return "current session is unavailable";
        }

        List<SessionFileReferenceVO> files = sessionFileService.listBySessionId(sessionId);
        if (files == null || files.isEmpty()) {
            return "no authorized files in current session";
        }

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < files.size(); i++) {
            SessionFileReferenceVO file = files.get(i);
            builder.append(i + 1).append(". ")
                    .append("fileReferenceId=").append(file.getFileReferenceId()).append(", ")
                    .append("path=").append(file.getAbsolutePath()).append(", ")
                    .append("fileName=").append(file.getOriginalFileName()).append(", ")
                    .append("contentType=").append(file.getContentType()).append(", ")
                    .append("size=").append(file.getFileSize()).append(", ")
                    .append("status=").append(file.getStatus())
                    .append("\n");
        }

        return builder.toString().trim();
    }

    @Tool(description = "Read an authorized file as text in current session by fileReferenceId")
    public String readAuthorizedFileAsText(String fileReferenceId, Integer maxChars) {
        return authorizedFileReadSupport.readAuthorizedFileAsText(sessionId, fileReferenceId, maxChars);
    }

    @Tool(description = "Attach an authorized image for next-round visual input by fileReferenceId")
    public String attachAuthorizedImage(String fileReferenceId) {
        if (!StringUtils.hasText(sessionId)) {
            return "current session is unavailable";
        }
        if (runtimeState == null) {
            return "tool runtime state is unavailable";
        }

        PendingMediaAttachment attachment =
                authorizedFileReadSupport.buildPendingImageAttachment(sessionId, fileReferenceId);
        if (attachment == null) {
            return "authorized image file not found or unsupported";
        }

        runtimeState.addPendingMediaAttachment(attachment);
        return """
        image has been prepared for next-round visual input.
        you have not seen the actual image content in this round yet.
        do not describe the image in this round.
        call markContinue("image prepared for next round visual processing") if you still need to analyze it.
        """.trim();
    }

    @Tool(description = "Read an authorized image through parser fallback in current session by fileReferenceId")
    public String readAuthorizedImageAsText(String fileReferenceId) {
        return authorizedFileReadSupport.readAuthorizedImageAsText(sessionId, fileReferenceId);
    }

}