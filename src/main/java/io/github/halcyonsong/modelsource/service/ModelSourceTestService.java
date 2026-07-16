package io.github.halcyonsong.modelsource.service;

import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceTestDTO;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceTestVO;

public interface ModelSourceTestService {

    ModelSourceTestVO testConnection(ModelSourceTestDTO testDTO);
}