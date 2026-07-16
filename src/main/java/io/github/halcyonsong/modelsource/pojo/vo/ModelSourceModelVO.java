package io.github.halcyonsong.modelsource.pojo.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceModelVO {

    private Long id;

    private String modelName;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}