package io.github.halcyonsong.sessionfile.pojo.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SessionFileReferenceVO {

    private String fileReferenceId;

    private String sessionId;

    private String absolutePath;

    private String originalFileName;

    private String contentType;

    private Long fileSize;

    private LocalDateTime lastKnownModifiedTime;

    private String status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}