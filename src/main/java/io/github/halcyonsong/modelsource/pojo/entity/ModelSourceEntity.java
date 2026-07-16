package io.github.halcyonsong.modelsource.pojo.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("model_source")
public class ModelSourceEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sourceCode;

    private String name;

    private String provider;

    private String baseUrl;

    private String apiKey;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

}