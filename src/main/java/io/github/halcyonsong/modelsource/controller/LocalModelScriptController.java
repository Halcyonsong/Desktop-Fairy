package io.github.halcyonsong.modelsource.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptLaunchVO;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptTaskVO;
import io.github.halcyonsong.modelsource.service.LocalModelScriptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/model-source/local-test")
@RequiredArgsConstructor
public class LocalModelScriptController {

    private final LocalModelScriptService localModelScriptService;

    @PostMapping("/install")
    public Result<LocalModelScriptLaunchVO> install() {
        return Result.success(localModelScriptService.installLocalTestModel());
    }

    @PostMapping("/start")
    public Result<LocalModelScriptLaunchVO> start() {
        return Result.success(localModelScriptService.startLocalTestModel());
    }

    @PostMapping("/stop")
    public Result<LocalModelScriptLaunchVO> stop() {
        return Result.success(localModelScriptService.stopLocalTestModel());
    }

    @GetMapping("/tasks/{taskId}")
    public Result<LocalModelScriptTaskVO> getTask(@PathVariable("taskId") String taskId) {
        return Result.success(localModelScriptService.getTask(taskId));
    }
}