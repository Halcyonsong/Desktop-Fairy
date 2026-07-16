package io.github.halcyonsong.modelsource.service;

import io.github.halcyonsong.chat.stream.pojo.config.ModelConfig;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceCreateDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceQueryDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceUpdateDTO;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceDetailVO;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceVO;

import java.util.List;

public interface ModelSourceService {

    String create(ModelSourceCreateDTO createDTO);

    void update(ModelSourceUpdateDTO updateDTO);

    void deleteBySourceCode(String sourceCode);

    void deleteSourceModel(String sourceCode, String modelName);

    List<ModelSourceVO> list(ModelSourceQueryDTO queryDTO);

    ModelSourceDetailVO getDetail(String sourceCode);

    ModelConfig resolveModelConfig(String sourceCode, String modelName);
}