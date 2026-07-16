package io.github.halcyonsong.modelsource.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.modelsource.pojo.vo.LocalModelScriptResultVO;
import io.github.halcyonsong.modelsource.service.LocalModelScriptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/model-source/local-test")
@RequiredArgsConstructor
public class LocalModelScriptController {

    private final LocalModelScriptService localModelScriptService;

    @PostMapping("/install")
    public Result<LocalModelScriptResultVO> install() {
        return Result.success(localModelScriptService.installLocalTestModel());
    }

    @PostMapping("/start")
    public Result<LocalModelScriptResultVO> start() {
        return Result.success(localModelScriptService.startLocalTestModel());
    }

    @PostMapping("/stop")
    public Result<LocalModelScriptResultVO> stop() {
        return Result.success(localModelScriptService.stopLocalTestModel());
    }
}
