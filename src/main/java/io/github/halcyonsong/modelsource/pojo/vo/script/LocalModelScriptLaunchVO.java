package io.github.halcyonsong.modelsource.pojo.vo.script;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LocalModelScriptLaunchVO {

    private String taskId;

    private String script;

    private String status;
}