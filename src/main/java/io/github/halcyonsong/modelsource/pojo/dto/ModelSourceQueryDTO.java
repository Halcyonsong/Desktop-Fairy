package io.github.halcyonsong.modelsource.pojo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceQueryDTO {

    private String name;

    private String provider;
}