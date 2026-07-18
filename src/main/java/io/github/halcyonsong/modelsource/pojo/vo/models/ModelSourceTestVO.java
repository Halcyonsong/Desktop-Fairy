package io.github.halcyonsong.modelsource.pojo.vo.models;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceTestVO {

    private Boolean success;

    private String message;
}