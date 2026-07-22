package io.github.halcyonsong.chat.tool.pojo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PendingMediaAttachment {

    private String fileReferenceId;

    private String fileName;

    private String contentType;

    private String path;
}