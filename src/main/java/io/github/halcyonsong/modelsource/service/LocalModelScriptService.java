package io.github.halcyonsong.modelsource.service;

import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptLaunchVO;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptTaskVO;

public interface LocalModelScriptService {

    LocalModelScriptLaunchVO installLocalTestModel();

    LocalModelScriptLaunchVO startLocalTestModel();

    LocalModelScriptLaunchVO stopLocalTestModel();

    LocalModelScriptTaskVO getTask(String taskId);
}