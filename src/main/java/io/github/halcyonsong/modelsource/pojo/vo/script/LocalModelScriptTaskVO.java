package io.github.halcyonsong.modelsource.pojo.vo.script;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LocalModelScriptTaskVO {

    private String taskId;

    private String script;

    private String status;

    private Integer exitCode;

    private String stdout;

    private String stderr;

    private String message;

    private Long startedAt;

    private Long finishedAt;
}