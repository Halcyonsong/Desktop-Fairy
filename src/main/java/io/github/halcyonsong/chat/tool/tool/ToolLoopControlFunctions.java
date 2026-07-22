package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;

@RequiredArgsConstructor
public class ToolLoopControlFunctions {

    private final ToolLoopRuntimeState runtimeState;

    @Tool(description = "Call this tool when another round is still required to continue the current task. " +
                        "The reason should briefly explain why the next round is needed")
    public String markContinue(String reason) {
        runtimeState.markContinue(reason);
        return "loop decision marked as CONTINUE. You can end this round now and then automatically enter the next round.";
    }

    @Tool(description = "Call this tool when the current task can be finished in this round." +
                        " The reason should briefly explain why the task is ready to end")
    public String markFinish(String reason) {
        runtimeState.markFinish(reason);
        return "loop decision marked as FINISH. You can end the loop now if the task is ready to end.";
    }

}