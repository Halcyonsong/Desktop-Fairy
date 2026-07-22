package io.github.halcyonsong.chat.tool.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
public class FileToolFunctions {

    // 检查文件或目录是否存在
    @Tool(description = "Check whether a file or directory exists at the given path")
    public boolean fileExists(String path) {
        if (!StringUtils.hasText(path)) {
            return false;
        }

        try {
            return Files.exists(Path.of(path).normalize());
        } catch (Exception exception) {
            return false;
        }
    }

    // 获取文件或目录的基本信息
    @Tool(description = "Get basic file or directory information for the given path")
    public String getFileInfo(String path) {
        if (!StringUtils.hasText(path)) {
            return "path is blank";
        }

        try {
            Path targetPath = Path.of(path).normalize();
            if (!Files.exists(targetPath)) {
                return "path does not exist: " + targetPath;
            }

            boolean isDirectory = Files.isDirectory(targetPath);
            boolean isRegularFile = Files.isRegularFile(targetPath);
            long size = isRegularFile ? Files.size(targetPath) : 0L;
            String lastModifiedTime = Files.getLastModifiedTime(targetPath).toString();

            return """
                    path=%s
                    exists=true
                    directory=%s
                    regularFile=%s
                    size=%d
                    lastModifiedTime=%s
                    """.formatted(
                    targetPath.toAbsolutePath(),
                    isDirectory,
                    isRegularFile,
                    size,
                    lastModifiedTime
            ).trim();
        } catch (IOException exception) {
            return "failed to read file info: " + exception.getMessage();
        } catch (Exception exception) {
            return "failed to resolve path: " + exception.getMessage();
        }
    }

    // 列出给定目录下的直接文件和目录
    @Tool(description = "List immediate files and directories under the given directory with a limit of items,default 100")
    public String listDirectory(String directory, int limit) {
        if (!StringUtils.hasText(directory)) {
            return "directory is blank";
        }

        try {
            Path rootPath = Path.of(directory).normalize();
            if (!Files.exists(rootPath)) {
                return "directory does not exist: " + rootPath;
            }
            if (!Files.isDirectory(rootPath)) {
                return "path is not a directory: " + rootPath;
            }

            List<String> results = new ArrayList<>();

            try (var pathStream = Files.list(rootPath)) {
                pathStream
                        .sorted(Comparator.comparing(path -> path.getFileName().toString().toLowerCase()))
                        .limit(limit <= 0 ? 100 : limit)
                        .forEach(path -> {
                            String name = path.getFileName().toString();
                            if (Files.isDirectory(path)) {
                                results.add("[DIR] " + name);
                            } else if (Files.isRegularFile(path)) {
                                results.add("[FILE] " + name);
                            } else {
                                results.add("[OTHER] " + name);
                            }
                        });
            }

            if (results.isEmpty()) {
                return "directory is empty: " + rootPath;
            }

            return String.join("\n", results);
        } catch (Exception exception) {
            return "failed to list directory: " + exception.getMessage();
        }
    }

    // 列出应用数据目录下的所有文件路径
    @Tool(description = "List all file paths under application data directory recursively")
    public String listApplicationDataFiles() {
        try {
            Path appDataDirectory = resolveApplicationDataDirectory();
            if (!Files.exists(appDataDirectory)) {
                return "application data directory does not exist: " + appDataDirectory;
            }
            if (!Files.isDirectory(appDataDirectory)) {
                return "application data path is not a directory: " + appDataDirectory;
            }

            List<String> results = new ArrayList<>();

            try (var pathStream = Files.walk(appDataDirectory, 8)) {
                pathStream
                        .filter(Files::isRegularFile)
                        .limit(200)
                        .forEach(path -> results.add(appDataDirectory.relativize(path).toString()));
            }

            if (results.isEmpty()) {
                return "application data directory is empty: " + appDataDirectory;
            }

            return String.join("\n", results);
        } catch (Exception exception) {
            return "failed to list application data files: " + exception.getMessage();
        }
    }
    // 辅助方法：解析应用数据目录路径
    private Path resolveApplicationDataDirectory() {
        String userHome = System.getProperty("user.home", "");
        return Path.of(userHome, "AppData", "Local", "DesktopFairy").normalize();
    }

    // 获取应用数据目录路径
    @Tool(description = "Get application data directory path")
    public String getApplicationDataDirectory() {
        return resolveApplicationDataDirectory().toAbsolutePath().toString();
    }

}
