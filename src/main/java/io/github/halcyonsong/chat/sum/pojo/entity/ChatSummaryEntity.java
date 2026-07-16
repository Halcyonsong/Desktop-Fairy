package io.github.halcyonsong.chat.sum.pojo.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("chat_summary")
public class ChatSummaryEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private String content;

    private Integer startIndex;

    private Integer endIndex;

    private Integer messageCount;

    private LocalDateTime createTime;
}