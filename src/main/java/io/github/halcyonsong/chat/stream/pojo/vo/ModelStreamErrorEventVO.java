package io.github.halcyonsong.chat.stream.pojo.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ModelStreamErrorEventVO {

    private String errorType;
    private String message;
    private Boolean retryable;
    private Boolean partialOutput;
    private String partialContent;
}