package io.github.halcyonsong.modelsource.pojo.vo.models;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceVO {

    private String sourceCode;

    private String name;

    private String provider;

    private String baseUrl;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}