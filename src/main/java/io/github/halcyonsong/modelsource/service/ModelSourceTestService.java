package io.github.halcyonsong.modelsource.service;

import io.github.halcyonsong.modelsource.pojo.dto.ModelFetchDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceTestDTO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceTestVO;

import java.util.List;

public interface ModelSourceTestService {

    ModelSourceTestVO testConnection(ModelSourceTestDTO testDTO);

    List<String> fetchModels(ModelFetchDTO fetchDTO);
}