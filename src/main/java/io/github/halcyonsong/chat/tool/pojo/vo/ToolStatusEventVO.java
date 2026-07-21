package io.github.halcyonsong.chat.tool.pojo.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolStatusEventVO {

    private Integer round;

    private String stage;

    private String message;

    private String toolCallId;

    private String toolName;

    private String toolArguments;
}