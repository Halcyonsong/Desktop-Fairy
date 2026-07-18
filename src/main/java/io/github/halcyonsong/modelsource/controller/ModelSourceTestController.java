package io.github.halcyonsong.modelsource.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.modelsource.pojo.dto.ModelFetchDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceTestDTO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceModelVO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceTestVO;
import io.github.halcyonsong.modelsource.service.ModelSourceTestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/model-source/test")
@RequiredArgsConstructor
public class ModelSourceTestController {

    private final ModelSourceTestService modelSourceTestService;

    @PostMapping
    public Result<ModelSourceTestVO> testConnection(@Valid @RequestBody ModelSourceTestDTO testDTO) {
        return Result.success(modelSourceTestService.testConnection(testDTO));
    }

    @PostMapping("/models")
    public Result<List<String>> fetchModels(@Valid @RequestBody ModelFetchDTO fetchDTO) {
        return Result.success(modelSourceTestService.fetchModels(fetchDTO));
    }

}