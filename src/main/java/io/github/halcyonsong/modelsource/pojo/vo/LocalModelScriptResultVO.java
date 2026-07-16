package io.github.halcyonsong.modelsource.pojo.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocalModelScriptResultVO {

    private String script;

    private Integer exitCode;

    private String stdout;

    private String stderr;
}
