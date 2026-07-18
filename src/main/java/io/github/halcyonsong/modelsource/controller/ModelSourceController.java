package io.github.halcyonsong.modelsource.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceCreateDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceQueryDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceUpdateDTO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceDetailVO;
import io.github.halcyonsong.modelsource.pojo.vo.models.ModelSourceVO;
import io.github.halcyonsong.modelsource.service.ModelSourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/model-source")
@RequiredArgsConstructor
public class ModelSourceController {

    private final ModelSourceService modelSourceService;

    @PostMapping
    public Result<String> create(@Valid @RequestBody ModelSourceCreateDTO createDTO) {
        return Result.success(modelSourceService.create(createDTO));
    }

    @PutMapping
    public Result<Void> update(@Valid @RequestBody ModelSourceUpdateDTO updateDTO) {
        modelSourceService.update(updateDTO);
        return Result.success();
    }

    @DeleteMapping("/{sourceCode}")
    public Result<Void> deleteBySourceCode(@PathVariable("sourceCode") String sourceCode) {
        modelSourceService.deleteBySourceCode(sourceCode);
        return Result.success();
    }

    @DeleteMapping("/{sourceCode}/models")
    public Result<Void> deleteSourceModel(@PathVariable("sourceCode") String sourceCode,
                                          @RequestParam("modelName") String modelName) {
        modelSourceService.deleteSourceModel(sourceCode, modelName);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<List<ModelSourceVO>> list(ModelSourceQueryDTO queryDTO) {
        return Result.success(modelSourceService.list(queryDTO));
    }

    @GetMapping("/{sourceCode}")
    public Result<ModelSourceDetailVO> getDetail(@PathVariable("sourceCode") String sourceCode) {
        return Result.success(modelSourceService.getDetail(sourceCode));
    }
}