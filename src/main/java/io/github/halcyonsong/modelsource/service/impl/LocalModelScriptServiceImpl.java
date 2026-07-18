package io.github.halcyonsong.modelsource.service.impl;

import io.github.halcyonsong.modelsource.constants.ModelBatConastants;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptLaunchVO;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptTaskVO;
import io.github.halcyonsong.modelsource.service.LocalModelScriptService;
import io.github.halcyonsong.modelsource.service.support.LocalModelScriptTaskSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LocalModelScriptServiceImpl implements LocalModelScriptService {

    private final LocalModelScriptTaskSupport localModelScriptTaskSupport;

    @Override
    public LocalModelScriptLaunchVO installLocalTestModel() {
        return localModelScriptTaskSupport.submit(ModelBatConastants.INSTALL_BAT);
    }

    @Override
    public LocalModelScriptLaunchVO startLocalTestModel() {
        return localModelScriptTaskSupport.submit(ModelBatConastants.START_BAT);
    }

    @Override
    public LocalModelScriptLaunchVO stopLocalTestModel() {
        return localModelScriptTaskSupport.submit(ModelBatConastants.STOP_BAT);
    }

    @Override
    public LocalModelScriptTaskVO getTask(String taskId) {
        return localModelScriptTaskSupport.getTask(taskId);
    }
}