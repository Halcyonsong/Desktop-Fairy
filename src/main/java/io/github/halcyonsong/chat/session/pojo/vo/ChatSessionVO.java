package io.github.halcyonsong.chat.session.pojo.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatSessionVO {

    // 会话ID
    private String sessionId;

    // 会话标题
    private String title;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}