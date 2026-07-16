package io.github.halcyonsong.modelsource.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceTestDTO;
import io.github.halcyonsong.modelsource.pojo.vo.ModelSourceTestVO;
import io.github.halcyonsong.modelsource.service.ModelSourceTestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/model-source/test")
@RequiredArgsConstructor
public class ModelSourceTestController {

    private final ModelSourceTestService modelSourceTestService;

    @PostMapping
    public Result<ModelSourceTestVO> testConnection(@Valid @RequestBody ModelSourceTestDTO testDTO) {
        return Result.success(modelSourceTestService.testConnection(testDTO));
    }
}