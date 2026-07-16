package io.github.halcyonsong.chat.sum.pojo.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("chat_summary_cursor")
public class ChatSummaryCursorEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sessionId;

    private Integer compressedCursor;
}