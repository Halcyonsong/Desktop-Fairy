package io.github.halcyonsong.chat.stream.pojo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequestDTO {

    @Valid
    @NotNull(message = "chat 不能为空")
    private ChatDTO chat;

    @Valid
    @NotNull(message = "model 不能为空")
    private ModelRequestDTO model;
}