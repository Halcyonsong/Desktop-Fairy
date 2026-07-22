package io.github.halcyonsong.sessionfile.pojo.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@TableName("session_file_reference")
public class SessionFileReferenceEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

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