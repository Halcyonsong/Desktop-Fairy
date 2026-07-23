package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;

@RequiredArgsConstructor
public class ToolLoopControlFunctions {

    private final ToolLoopRuntimeState runtimeState;

    @Tool(description = "Call this tool at the beginning of the current round when another round will still be needed after this round finishes. After calling it, continue the current round normally.")
    public String markContinue(String reason) {
        runtimeState.markContinue(reason);
        return "loop decision marked as CONTINUE";
    }

    @Tool(description = "Call this tool at the beginning of the current round when this round can be the final round. After calling it, continue the current round normally.")
    public String markFinish(String reason) {
        runtimeState.markFinish(reason);
        return "loop decision marked as FINISH";
    }

}