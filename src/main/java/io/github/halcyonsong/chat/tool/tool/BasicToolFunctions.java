package io.github.halcyonsong.chat.tool.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

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

}