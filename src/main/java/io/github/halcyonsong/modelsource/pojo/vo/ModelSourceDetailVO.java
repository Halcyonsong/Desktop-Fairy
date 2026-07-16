package io.github.halcyonsong.modelsource.pojo.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelSourceDetailVO {

    private String sourceCode;

    private String name;

    private String provider;

    private String baseUrl;

    private String apiKey;

    private List<ModelSourceModelVO> models;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}