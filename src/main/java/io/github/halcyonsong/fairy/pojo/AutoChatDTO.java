package io.github.halcyonsong.fairy.pojo;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutoChatDTO {

    @NotBlank(message = "sessionId 不能为空")
    private String sessionId;

    private String question;

    @NotBlank(message = "baseUrl 不能为空")
    private String baseUrl;

    @NotBlank(message = "apiKey 不能为空")
    private String apiKey;

    @NotBlank(message = "model 不能为空")
    private String model;

}
