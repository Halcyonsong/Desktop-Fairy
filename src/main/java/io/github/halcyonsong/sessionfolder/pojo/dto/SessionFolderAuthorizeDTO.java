package io.github.halcyonsong.sessionfolder.pojo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SessionFolderAuthorizeDTO {

    @NotBlank(message = "sessionId 不能为空")
    private String sessionId;

    @NotBlank(message = "absolutePath 不能为空")
    private String absolutePath;
}