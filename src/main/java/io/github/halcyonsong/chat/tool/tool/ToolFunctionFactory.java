package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.chat.tool.service.support.status.ToolLoopRuntimeState;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import io.github.halcyonsong.sessionfile.service.support.AuthorizedFileReadSupport;
import io.github.halcyonsong.sessionfolder.service.support.AuthorizedFolderReadSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ToolFunctionFactory {

    private final BasicToolFunctions basicToolFunctions;
    private final FileToolFunctions fileToolFunctions;
    private final SessionFileService sessionFileService;
    private final AuthorizedFileReadSupport authorizedFileReadSupport;
    private final AuthorizedFolderReadSupport authorizedFolderReadSupport;

    public Object[] createToolFunctions(String sessionId, ToolLoopRuntimeState runtimeState) {
        return new Object[]{
                basicToolFunctions,
                fileToolFunctions,
                new ToolLoopControlFunctions(runtimeState),
                new SessionFileToolRuntimeFunctions(sessionFileService, authorizedFileReadSupport, sessionId, runtimeState),
                new SessionFolderToolRuntimeFunctions(authorizedFolderReadSupport, sessionId)
        };
    }



}