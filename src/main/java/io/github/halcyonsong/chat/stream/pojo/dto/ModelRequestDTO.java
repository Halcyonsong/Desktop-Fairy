package io.github.halcyonsong.chat.stream.pojo.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelRequestDTO {

    @NotBlank(message = "baseUrl 不能为空")
    private String baseUrl;

    @NotBlank(message = "apiKey 不能为空")
    private String apiKey;

    @NotBlank(message = "model 不能为空")
    private String model;

    @DecimalMin(value = "0.0", message = "temperature 不能小于 0")
    @DecimalMax(value = "2.0", message = "temperature 不能大于 2")
    private Double temperature;

    @Positive(message = "maxTokens 必须大于 0")
    private Integer maxTokens;
}