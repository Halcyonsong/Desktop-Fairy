package io.github.halcyonsong.sessionfile.service.support;

import io.github.halcyonsong.chat.tool.pojo.PendingMediaAttachment;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import io.github.halcyonsong.sessionfile.service.support.parser.AuthorizedFileParser;
import io.github.halcyonsong.sessionfile.service.support.parser.AuthorizedFileParserDispatcher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class AuthorizedFileReadSupport {

    private static final Set<String> IMAGE_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "webp", "bmp"
    );

    private final SessionFileService sessionFileService;
    private final AuthorizedFileParserDispatcher authorizedFileParserDispatcher;

    public String readAuthorizedFileAsText(String sessionId, String fileReferenceId, Integer maxChars) {
        SessionFileReferenceVO file = getAuthorizedFile(sessionId, fileReferenceId);
        if (file == null) {
            return "authorized file not found: " + fileReferenceId;
        }

        try {
            Path path = resolveExistingRegularFile(file.getAbsolutePath());
            String extension = extractExtension(file.getOriginalFileName());
            int finalMaxChars = normalizeMaxChars(maxChars);

            if (IMAGE_EXTENSIONS.contains(extension)) {
                return """
                        this file is an image.
                        if the current model can use visual input, prefer attachAuthorizedImage(fileReferenceId).
                        image parser reading is currently unavailable.
                        """.trim();
            }

            AuthorizedFileParser parser = authorizedFileParserDispatcher.resolve(extension);
            if (parser == null) {
                return "unsupported file type for authorized text reading: " + extension;
            }

            return parser.parse(path, finalMaxChars);
        } catch (Exception exception) {
            return "failed to read authorized file: " + exception.getMessage();
        }
    }

    public String readAuthorizedImageAsText(String sessionId, String fileReferenceId) {
        SessionFileReferenceVO file = getAuthorizedFile(sessionId, fileReferenceId);
        if (file == null) {
            return "authorized image file not found: " + fileReferenceId;
        }

        return """
                image parser reading is currently unavailable.
                if the current model can use visual input, prefer attachAuthorizedImage(fileReferenceId).
                current fileReferenceId=%s
                fileName=%s
                path=%s
                """.formatted(
                file.getFileReferenceId(),
                file.getOriginalFileName(),
                file.getAbsolutePath()
        ).trim();
    }

    public PendingMediaAttachment buildPendingImageAttachment(String sessionId, String fileReferenceId) {
        SessionFileReferenceVO file = getAuthorizedFile(sessionId, fileReferenceId);
        if (file == null) {
            return null;
        }

        try {
            Path path = resolveExistingRegularFile(file.getAbsolutePath());
            String extension = extractExtension(file.getOriginalFileName());
            if (!IMAGE_EXTENSIONS.contains(extension)) {
                return null;
            }

            return PendingMediaAttachment.builder()
                    .fileReferenceId(file.getFileReferenceId())
                    .fileName(file.getOriginalFileName())
                    .contentType(defaultText(file.getContentType()))
                    .path(path.toString())
                    .build();
        } catch (Exception exception) {
            return null;
        }
    }

    private SessionFileReferenceVO getAuthorizedFile(String sessionId, String fileReferenceId) {
        if (!StringUtils.hasText(sessionId) || !StringUtils.hasText(fileReferenceId)) {
            return null;
        }
        return sessionFileService.getBySessionIdAndFileReferenceId(sessionId, fileReferenceId);
    }

    private Path resolveExistingRegularFile(String absolutePath) {
        if (!StringUtils.hasText(absolutePath)) {
            throw new IllegalArgumentException("absolutePath is blank");
        }

        Path path = Path.of(absolutePath).toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            throw new IllegalStateException("file no longer exists: " + path);
        }
        if (!Files.isRegularFile(path)) {
            throw new IllegalStateException("target is not a regular file: " + path);
        }
        return path;
    }

    private int normalizeMaxChars(Integer maxChars) {
        if (maxChars == null || maxChars <= 0) {
            return 12000;
        }
        return Math.min(maxChars, 30000);
    }

    private String extractExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "";
        }

        int index = fileName.lastIndexOf('.');
        if (index < 0 || index == fileName.length() - 1) {
            return "";
        }

        return fileName.substring(index + 1).toLowerCase();
    }

    private String defaultText(String text) {
        return StringUtils.hasText(text) ? text.trim() : "";
    }
}