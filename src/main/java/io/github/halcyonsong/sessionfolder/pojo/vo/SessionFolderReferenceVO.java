package io.github.halcyonsong.sessionfolder.pojo.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SessionFolderReferenceVO {

    private String folderReferenceId;

    private String sessionId;

    private String absolutePath;

    private String folderName;

    private String status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}