package io.github.halcyonsong.chat.session.pojo.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@TableName("chat_history")
public class ChatHistoryEntity {

    @TableId
    private Long id;

    private String sessionId;

    private String role;

    private String content;

    private String status;

    private LocalDateTime createTime;
}