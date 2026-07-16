package io.github.halcyonsong.chat.stream.pojo.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatDTO {

    // 用户的问题
    @NotBlank(message = "question 不能为空")
    private String question;
    // 会话id
    @NotBlank(message = "sessionId 不能为空")
    private String sessionId;

}