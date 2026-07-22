package io.github.halcyonsong.sessionfolder.service.support;

import io.github.halcyonsong.sessionfile.service.support.parser.AuthorizedFileParser;
import io.github.halcyonsong.sessionfile.service.support.parser.AuthorizedFileParserDispatcher;
import io.github.halcyonsong.sessionfolder.pojo.vo.SessionFolderReferenceVO;
import io.github.halcyonsong.sessionfolder.service.SessionFolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

@Component
@RequiredArgsConstructor
public class AuthorizedFolderReadSupport {

    private static final int DEFAULT_MAX_RESULTS = 20;
    private static final int MAX_MAX_RESULTS = 100;
    private static final int DEFAULT_MAX_CHARS = 12000;
    private static final int MAX_MAX_CHARS = 30000;
    private static final int DEFAULT_MAX_LINES = 200;
    private static final int MAX_MAX_LINES = 1000;
    private static final int DEFAULT_SEGMENT_MAX_CHARS = 4000;
    private static final int MAX_SEGMENT_MAX_CHARS = 12000;

    private final SessionFolderService sessionFolderService;
    private final AuthorizedFileParserDispatcher authorizedFileParserDispatcher;

    public String listAuthorizedFolders(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return "current session is unavailable";
        }

        List<SessionFolderReferenceVO> folders = sessionFolderService.listBySessionId(sessionId);
        if (folders == null || folders.isEmpty()) {
            return "no authorized folders in current session";
        }

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < folders.size(); i++) {
            SessionFolderReferenceVO folder = folders.get(i);
            builder.append(i + 1).append(". ")
                    .append("folderReferenceId=").append(folder.getFolderReferenceId()).append(", ")
                    .append("folderName=").append(folder.getFolderName()).append(", ")
                    .append("absolutePath=").append(folder.getAbsolutePath()).append(", ")
                    .append("status=").append(folder.getStatus())
                    .append("\n");
        }
        return builder.toString().trim();
    }

    public String listFolderEntries(String sessionId, String folderReferenceId, String relativePath) {
        SessionFolderReferenceVO folder = getAuthorizedFolder(sessionId, folderReferenceId);
        if (folder == null) {
            return "authorized folder not found: " + folderReferenceId;
        }

        try {
            Path root = resolveAuthorizedRoot(folder);
            Path target = resolveAuthorizedChildPath(root, relativePath);

            if (!Files.exists(target)) {
                return "target path does not exist: " + safeRelativePath(root, target);
            }
            if (!Files.isDirectory(target)) {
                return "target path is not a directory: " + safeRelativePath(root, target);
            }

            try (Stream<Path> stream = Files.list(target)) {
                List<Path> entries = stream
                        .sorted(directoryFirstComparator())
                        .limit(MAX_MAX_RESULTS)
                        .toList();

                if (entries.isEmpty()) {
                    return "directory is empty";
                }

                StringBuilder builder = new StringBuilder();
                builder.append("folderReferenceId=").append(folderReferenceId).append("\n")
                        .append("directoryRelativePath=").append(safeRelativePath(root, target)).append("\n")
                        .append("directoryAbsolutePath=").append(target).append("\n\n");

                for (int i = 0; i < entries.size(); i++) {
                    Path entry = entries.get(i);
                    boolean isDirectory = Files.isDirectory(entry);

                    builder.append(i + 1).append(". ")
                            .append("name=").append(entry.getFileName()).append(", ")
                            .append("type=").append(isDirectory ? "DIRECTORY" : "FILE").append(", ")
                            .append("relativePath=").append(safeRelativePath(root, entry)).append(", ")
                            .append("absolutePath=").append(entry.toAbsolutePath().normalize());

                    if (!isDirectory) {
                        try {
                            builder.append(", size=").append(Files.size(entry));
                        } catch (IOException ignored) {
                        }
                    }
                    builder.append("\n");
                }

                return builder.toString().trim();
            }
        } catch (Exception exception) {
            return "failed to list folder entries: " + exception.getMessage();
        }
    }

    public String searchFilesInFolder(String sessionId, String folderReferenceId, String keyword, Integer maxResults) {
        SessionFolderReferenceVO folder = getAuthorizedFolder(sessionId, folderReferenceId);
        if (folder == null) {
            return "authorized folder not found: " + folderReferenceId;
        }
        if (!StringUtils.hasText(keyword)) {
            return "keyword is blank";
        }

        int finalMaxResults = normalizeMaxResults(maxResults);

        try {
            Path root = resolveAuthorizedRoot(folder);
            String normalizedKeyword = keyword.trim().toLowerCase(Locale.ROOT);

            try (Stream<Path> stream = Files.walk(root)) {
                List<Path> matches = stream
                        .filter(Files::isRegularFile)
                        .filter(path -> path.getFileName() != null
                                && path.getFileName().toString().toLowerCase(Locale.ROOT).contains(normalizedKeyword))
                        .sorted()
                        .limit(finalMaxResults)
                        .toList();

                if (matches.isEmpty()) {
                    return "no file matched keyword: " + keyword;
                }

                StringBuilder builder = new StringBuilder();
                builder.append("folderReferenceId=").append(folderReferenceId).append("\n")
                        .append("keyword=").append(keyword).append("\n\n");

                for (int i = 0; i < matches.size(); i++) {
                    Path match = matches.get(i);
                    builder.append(i + 1).append(". ")
                            .append("fileName=").append(match.getFileName()).append(", ")
                            .append("relativePath=").append(safeRelativePath(root, match)).append(", ")
                            .append("absolutePath=").append(match.toAbsolutePath().normalize());

                    try {
                        builder.append(", size=").append(Files.size(match));
                    } catch (IOException ignored) {
                    }

                    builder.append("\n");
                }

                return builder.toString().trim();
            }
        } catch (Exception exception) {
            return "failed to search files in folder: " + exception.getMessage();
        }
    }

    public String readFileInFolderAsText(String sessionId,
                                         String folderReferenceId,
                                         String relativePath,
                                         Integer maxChars) {
        SessionFolderReferenceVO folder = getAuthorizedFolder(sessionId, folderReferenceId);
        if (folder == null) {
            return "authorized folder not found: " + folderReferenceId;
        }
        if (!StringUtils.hasText(relativePath)) {
            return "relativePath is blank";
        }

        try {
            Path root = resolveAuthorizedRoot(folder);
            Path target = resolveAuthorizedChildPath(root, relativePath);

            if (!Files.exists(target)) {
                return "target file does not exist: " + relativePath;
            }
            if (!Files.isRegularFile(target)) {
                return "target path is not a regular file: " + relativePath;
            }

            String extension = extractExtension(target.getFileName() == null ? "" : target.getFileName().toString());
            AuthorizedFileParser parser = authorizedFileParserDispatcher.resolve(extension);
            if (parser == null) {
                return "unsupported file type for folder text reading: " + extension;
            }

            int finalMaxChars = normalizeMaxChars(maxChars);
            return parser.parse(target, finalMaxChars);
        } catch (Exception exception) {
            return "failed to read file in folder: " + exception.getMessage();
        }
    }

    public String getFileMetadataInFolder(String sessionId, String folderReferenceId, String relativePath) {
        SessionFolderReferenceVO folder = getAuthorizedFolder(sessionId, folderReferenceId);
        if (folder == null) {
            return "authorized folder not found: " + folderReferenceId;
        }
        if (!StringUtils.hasText(relativePath)) {
            return "relativePath is blank";
        }

        try {
            Path root = resolveAuthorizedRoot(folder);
            Path target = resolveAuthorizedChildPath(root, relativePath);

            if (!Files.exists(target)) {
                return "target path does not exist: " + relativePath;
            }

            boolean isDirectory = Files.isDirectory(target);
            Long size = null;
            if (!isDirectory) {
                try {
                    size = Files.size(target);
                } catch (IOException ignored) {
                }
            }

            FileTime lastModifiedTime = null;
            try {
                lastModifiedTime = Files.getLastModifiedTime(target);
            } catch (IOException ignored) {
            }

            String fileName = target.getFileName() == null ? target.toString() : target.getFileName().toString();
            String extension = isDirectory ? "" : extractExtension(fileName);

            return """
                    fileName=%s
                    relativePath=%s
                    absolutePath=%s
                    type=%s
                    extension=%s
                    size=%s
                    lastModifiedTime=%s
                    """.formatted(
                    fileName,
                    safeRelativePath(root, target),
                    target.toAbsolutePath().normalize(),
                    isDirectory ? "DIRECTORY" : "FILE",
                    extension,
                    size == null ? "" : size,
                    lastModifiedTime == null
                            ? ""
                            : lastModifiedTime.toInstant().atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ).trim();
        } catch (Exception exception) {
            return "failed to get file metadata in folder: " + exception.getMessage();
        }
    }

    private SessionFolderReferenceVO getAuthorizedFolder(String sessionId, String folderReferenceId) {
        if (!StringUtils.hasText(sessionId) || !StringUtils.hasText(folderReferenceId)) {
            return null;
        }
        return sessionFolderService.getBySessionIdAndFolderReferenceId(sessionId, folderReferenceId);
    }

    private Path resolveAuthorizedRoot(SessionFolderReferenceVO folder) {
        if (folder == null || !StringUtils.hasText(folder.getAbsolutePath())) {
            throw new IllegalArgumentException("authorized folder path is blank");
        }

        Path root = Path.of(folder.getAbsolutePath()).toAbsolutePath().normalize();
        if (!Files.exists(root)) {
            throw new IllegalStateException("authorized folder no longer exists: " + root);
        }
        if (!Files.isDirectory(root)) {
            throw new IllegalStateException("authorized root is not a directory: " + root);
        }
        return root;
    }

    private Path resolveAuthorizedChildPath(Path root, String relativePath) {
        String normalizedRelativePath = StringUtils.hasText(relativePath) ? relativePath.trim() : "";
        Path target = StringUtils.hasText(normalizedRelativePath)
                ? root.resolve(normalizedRelativePath).normalize()
                : root;

        if (!target.startsWith(root)) {
            throw new IllegalStateException("target path escapes authorized folder");
        }
        return target;
    }

    private String safeRelativePath(Path root, Path target) {
        if (root.equals(target)) {
            return ".";
        }
        return root.relativize(target).toString().replace('\\', '/');
    }

    private int normalizeMaxResults(Integer maxResults) {
        if (maxResults == null || maxResults <= 0) {
            return DEFAULT_MAX_RESULTS;
        }
        return Math.min(maxResults, MAX_MAX_RESULTS);
    }

    private int normalizeMaxChars(Integer maxChars) {
        if (maxChars == null || maxChars <= 0) {
            return DEFAULT_MAX_CHARS;
        }
        return Math.min(maxChars, MAX_MAX_CHARS);
    }

    private String extractExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "";
        }

        int index = fileName.lastIndexOf('.');
        if (index < 0 || index == fileName.length() - 1) {
            return "";
        }

        return fileName.substring(index + 1).toLowerCase(Locale.ROOT);
    }

    private Comparator<Path> directoryFirstComparator() {
        return (left, right) -> {
            boolean leftDirectory = Files.isDirectory(left);
            boolean rightDirectory = Files.isDirectory(right);

            if (leftDirectory != rightDirectory) {
                return leftDirectory ? -1 : 1;
            }
            return left.getFileName().toString().compareToIgnoreCase(right.getFileName().toString());
        };
    }

    public String readFileLinesInFolderAsText(String sessionId,
                                              String folderReferenceId,
                                              String relativePath,
                                              Integer startLine,
                                              Integer maxLines) {
        SessionFolderReferenceVO folder = getAuthorizedFolder(sessionId, folderReferenceId);
        if (folder == null) {
            return "authorized folder not found: " + folderReferenceId;
        }
        if (!StringUtils.hasText(relativePath)) {
            return "relativePath is blank";
        }

        try {
            Path root = resolveAuthorizedRoot(folder);
            Path target = resolveAuthorizedChildPath(root, relativePath);

            if (!Files.exists(target)) {
                return "target file does not exist: " + relativePath;
            }
            if (!Files.isRegularFile(target)) {
                return "target path is not a regular file: " + relativePath;
            }

            String extension = extractExtension(target.getFileName() == null ? "" : target.getFileName().toString());
            AuthorizedFileParser parser = authorizedFileParserDispatcher.resolve(extension);
            if (parser == null) {
                return "unsupported file type for folder line reading: " + extension;
            }

            String fullText = parser.parse(target, MAX_MAX_CHARS);
            String[] lines = splitLines(fullText);

            int totalLines = lines.length;
            int finalStartLine = normalizeStartLine(startLine);
            int finalMaxLines = normalizeMaxLines(maxLines);

            if (totalLines == 0) {
                return """
                    fileName=%s
                    relativePath=%s
                    totalLines=0
                    startLine=1
                    endLine=0

                    [CONTENT]
                    """.formatted(
                        target.getFileName(),
                        safeRelativePath(root, target)
                ).trim();
            }

            if (finalStartLine > totalLines) {
                return """
                    fileName=%s
                    relativePath=%s
                    totalLines=%s
                    startLine=%s
                    endLine=%s

                    requested startLine is beyond file end.
                    """.formatted(
                        target.getFileName(),
                        safeRelativePath(root, target),
                        totalLines,
                        finalStartLine,
                        totalLines
                ).trim();
            }

            int fromIndex = finalStartLine - 1;
            int toIndexExclusive = Math.min(fromIndex + finalMaxLines, totalLines);
            int finalEndLine = toIndexExclusive;

            String content = String.join("\n", Arrays.copyOfRange(lines, fromIndex, toIndexExclusive));

            return """
                fileName=%s
                relativePath=%s
                totalLines=%s
                startLine=%s
                endLine=%s

                [CONTENT]
                %s
                """.formatted(
                    target.getFileName(),
                    safeRelativePath(root, target),
                    totalLines,
                    finalStartLine,
                    finalEndLine,
                    content
            ).trim();
        } catch (Exception exception) {
            return "failed to read file lines in folder: " + exception.getMessage();
        }
    }

    public String readFileSegmentInFolderAsText(String sessionId,
                                                String folderReferenceId,
                                                String relativePath,
                                                Integer startChar,
                                                Integer maxChars) {
        SessionFolderReferenceVO folder = getAuthorizedFolder(sessionId, folderReferenceId);
        if (folder == null) {
            return "authorized folder not found: " + folderReferenceId;
        }
        if (!StringUtils.hasText(relativePath)) {
            return "relativePath is blank";
        }

        try {
            Path root = resolveAuthorizedRoot(folder);
            Path target = resolveAuthorizedChildPath(root, relativePath);

            if (!Files.exists(target)) {
                return "target file does not exist: " + relativePath;
            }
            if (!Files.isRegularFile(target)) {
                return "target path is not a regular file: " + relativePath;
            }

            String extension = extractExtension(target.getFileName() == null ? "" : target.getFileName().toString());
            AuthorizedFileParser parser = authorizedFileParserDispatcher.resolve(extension);
            if (parser == null) {
                return "unsupported file type for folder segment reading: " + extension;
            }

            String fullText = parser.parse(target, MAX_MAX_CHARS);
            int totalChars = fullText.length();
            int finalStartChar = normalizeStartChar(startChar);
            int finalMaxChars = normalizeSegmentMaxChars(maxChars);

            if (finalStartChar >= totalChars) {
                return """
                    fileName=%s
                    relativePath=%s
                    totalChars=%s
                    startChar=%s
                    endChar=%s

                    requested startChar is beyond file end.
                    """.formatted(
                        target.getFileName(),
                        safeRelativePath(root, target),
                        totalChars,
                        finalStartChar,
                        totalChars
                ).trim();
            }

            int endCharExclusive = Math.min(finalStartChar + finalMaxChars, totalChars);
            String content = fullText.substring(finalStartChar, endCharExclusive);

            return """
                fileName=%s
                relativePath=%s
                totalChars=%s
                startChar=%s
                endChar=%s

                [CONTENT]
                %s
                """.formatted(
                    target.getFileName(),
                    safeRelativePath(root, target),
                    totalChars,
                    finalStartChar,
                    endCharExclusive,
                    content
            ).trim();
        } catch (Exception exception) {
            return "failed to read file segment in folder: " + exception.getMessage();
        }
    }

    private String[] splitLines(String fullText) {
        if (fullText == null || fullText.isEmpty()) {
            return new String[0];
        }
        return fullText.replace("\r\n", "\n").replace('\r', '\n').split("\n", -1);
    }

    private int normalizeStartLine(Integer startLine) {
        if (startLine == null || startLine <= 0) {
            return 1;
        }
        return startLine;
    }

    private int normalizeMaxLines(Integer maxLines) {
        if (maxLines == null || maxLines <= 0) {
            return DEFAULT_MAX_LINES;
        }
        return Math.min(maxLines, MAX_MAX_LINES);
    }

    private int normalizeStartChar(Integer startChar) {
        if (startChar == null || startChar < 0) {
            return 0;
        }
        return startChar;
    }

    private int normalizeSegmentMaxChars(Integer maxChars) {
        if (maxChars == null || maxChars <= 0) {
            return DEFAULT_SEGMENT_MAX_CHARS;
        }
        return Math.min(maxChars, MAX_SEGMENT_MAX_CHARS);
    }
}