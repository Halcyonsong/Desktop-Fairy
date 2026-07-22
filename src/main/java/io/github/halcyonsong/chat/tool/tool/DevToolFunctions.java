package io.github.halcyonsong.chat.tool.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Component
public class DevToolFunctions {

    private static final int MAX_SEARCH_RESULTS = 50;
    private static final int MAX_SEARCH_DEPTH = 5;
    private static final int COMMAND_TIMEOUT_SECONDS = 10;

    // 搜索目录下的文件名包含关键词的文件
    @Tool(description = "Search files by file name keyword under a directory")
    public String searchFileName(String directory, String keyword) {
        if (!StringUtils.hasText(directory)) {
            return "directory is blank";
        }
        if (!StringUtils.hasText(keyword)) {
            return "keyword is blank";
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
            String lowerKeyword = keyword.trim().toLowerCase();

            try (var pathStream = Files.walk(rootPath, MAX_SEARCH_DEPTH)) {
                pathStream
                        .filter(Files::isRegularFile)
                        .filter(path -> path.getFileName() != null
                                && path.getFileName().toString().toLowerCase().contains(lowerKeyword))
                        .limit(MAX_SEARCH_RESULTS)
                        .forEach(path -> results.add(rootPath.relativize(path).toString()));
            }

            if (results.isEmpty()) {
                return "no file matched keyword: " + keyword;
            }

            return String.join("\n", results);
        } catch (Exception exception) {
            return "failed to search file names: " + exception.getMessage();
        }
    }

    // 读取命令版本
    private String readCommandVersion(List<String> primaryCommand,
                                      List<String> fallbackCommand,
                                      String unavailableMessage) {
        String primaryResult = runVersionCommand(primaryCommand);
        if (StringUtils.hasText(primaryResult)) {
            return primaryResult;
        }

        if (fallbackCommand != null && !fallbackCommand.isEmpty()) {
            String fallbackResult = runVersionCommand(fallbackCommand);
            if (StringUtils.hasText(fallbackResult)) {
                return fallbackResult;
            }
        }

        return unavailableMessage;
    }

    // 运行版本命令
    private String runVersionCommand(List<String> command) {
        try {
            Process process = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .start();

            boolean finished = process.waitFor(COMMAND_TIMEOUT_SECONDS, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return "";
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {

                StringBuilder outputBuilder = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!outputBuilder.isEmpty()) {
                        outputBuilder.append('\n');
                    }
                    outputBuilder.append(line);
                }

                String output = outputBuilder.toString().trim();
                if (!StringUtils.hasText(output)) {
                    return "";
                }

                return output;
            }
        } catch (Exception exception) {
            return "";
        }
    }
}