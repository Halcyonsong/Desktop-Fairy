package io.github.halcyonsong.chat.tool.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Component
public class BasicToolFunctions {

    // 获取当前时间
    @Tool(description = "Get current local date and time")
    public String getCurrentTime() {
        return LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    // 获取操作系统信息
    @Tool(description = "Get operating system, architecture, user, timezone, encoding, and processor information")
    public String getSystemInfo() {
        String osName = System.getProperty("os.name", "");
        String osVersion = System.getProperty("os.version", "");
        String osArch = System.getProperty("os.arch", "");
        String userName = System.getProperty("user.name", "");
        String userHome = System.getProperty("user.home", "");
        String fileEncoding = System.getProperty("file.encoding", "");
        String timezone = ZoneId.systemDefault().getId();
        int availableProcessors = Runtime.getRuntime().availableProcessors();

        return """
                osName=%s
                osVersion=%s
                osArch=%s
                userName=%s
                userHome=%s
                timezone=%s
                fileEncoding=%s
                availableProcessors=%d
                """.formatted(
                osName,
                osVersion,
                osArch,
                userName,
                userHome,
                timezone,
                fileEncoding,
                availableProcessors
        ).trim();
    }

    // 获取当前工作目录
    @Tool(description = "Get current working directory of the backend process")
    public String getCurrentWorkingDirectory() {
        return Path.of("").toAbsolutePath().normalize().toString();
    }

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

}