package io.github.halcyonsong.modelsource.pojo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceCreateDTO {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "provider 不能为空")
    private String provider;

    @NotBlank(message = "baseUrl 不能为空")
    private String baseUrl;

    @NotBlank(message = "apiKey 不能为空")
    private String apiKey;

    @Valid
    @NotEmpty(message = "models 不能为空")
    private List<ModelSourceModelDTO> models;
}