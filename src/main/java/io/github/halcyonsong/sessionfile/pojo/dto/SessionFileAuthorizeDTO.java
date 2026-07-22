package io.github.halcyonsong.sessionfile.pojo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SessionFileAuthorizeDTO {

    @NotBlank(message = "sessionId 不能为空")
    private String sessionId;

    @NotBlank(message = "absolutePath 不能为空")
    private String absolutePath;
}