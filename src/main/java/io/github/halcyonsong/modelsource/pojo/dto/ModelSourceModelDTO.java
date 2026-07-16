package io.github.halcyonsong.modelsource.pojo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceModelDTO {

    @NotBlank(message = "modelName 不能为空")
    private String modelName;
}