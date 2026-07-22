package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import io.github.halcyonsong.sessionfile.service.support.AuthorizedFileReadSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ToolFunctionFactory {

    private final BasicToolFunctions basicToolFunctions;
    private final FileToolFunctions fileToolFunctions;
    private final SessionFileService sessionFileService;
    private final AuthorizedFileReadSupport authorizedFileReadSupport;

    public Object[] createToolFunctions(String sessionId, ToolLoopRuntimeState runtimeState) {
        return new Object[]{
                basicToolFunctions,
                fileToolFunctions,
                new SessionFileToolRuntimeFunctions(
                        sessionFileService,
                        authorizedFileReadSupport,
                        sessionId,
                        runtimeState
                )
        };
    }

}