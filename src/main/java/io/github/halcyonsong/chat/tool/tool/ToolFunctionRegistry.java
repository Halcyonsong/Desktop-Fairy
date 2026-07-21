package io.github.halcyonsong.chat.tool.tool;

import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
public class ToolFunctionRegistry {

    private final Object[] toolFunctions;

    public ToolFunctionRegistry(BasicToolFunctions basicToolFunctions,
                                DevToolFunctions devToolFunctions) {
        this.toolFunctions = new Object[]{
                basicToolFunctions,
                devToolFunctions
        };
    }

}