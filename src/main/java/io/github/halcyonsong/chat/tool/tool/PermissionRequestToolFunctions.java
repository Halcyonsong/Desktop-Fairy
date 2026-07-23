package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;

@RequiredArgsConstructor
public class PermissionRequestToolFunctions {

    private final ToolLoopRuntimeState runtimeState;

    @Tool(description = "Request user authorization for a file path that is not currently authorized")
    public String requestFilePermission(String absolutePath, String reason) {
        runtimeState.requestPermission("FILE", absolutePath, reason);
        return "file permission request recorded. You should end the response immediately and wait for user's next request.";
    }

    @Tool(description = "Request user authorization for a folder path that is not currently authorized")
    public String requestFolderPermission(String absolutePath, String reason) {
        runtimeState.requestPermission("FOLDER", absolutePath, reason);
        return "folder permission request recorded. You should end the response immediately and wait for user's next request.";
    }
}