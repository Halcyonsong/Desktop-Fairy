package io.github.halcyonsong.chat.session.pojo.entity;
import com.baomidou.mybatisplus.annotation.*;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@TableName("chat_session")
public class ChatSessionEntity {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private String title;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
