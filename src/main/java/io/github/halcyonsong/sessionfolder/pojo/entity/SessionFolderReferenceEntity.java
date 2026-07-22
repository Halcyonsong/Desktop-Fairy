package io.github.halcyonsong.sessionfolder.pojo.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@TableName("session_folder_reference")
public class SessionFolderReferenceEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String folderReferenceId;

    private String sessionId;

    private String absolutePath;

    private String folderName;

    private String status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}