package io.github.halcyonsong.chat.tool.pojo.dto;

import io.github.halcyonsong.chat.stream.pojo.dto.ChatRequestDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class ToolChatRequestDTO {

    @Valid
    @NotNull(message = "request 不能为空")
    private ChatRequestDTO request;

    // 本次请求附带的已授权文件引用 id 列表
    private List<String> attachmentFileReferenceIds;

    // 当前主附件，可选
    private String primaryAttachmentFileReferenceId;
}