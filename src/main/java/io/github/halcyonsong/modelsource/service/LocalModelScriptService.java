package io.github.halcyonsong.modelsource.service;

import io.github.halcyonsong.modelsource.pojo.vo.LocalModelScriptResultVO;

public interface LocalModelScriptService {

    LocalModelScriptResultVO installLocalTestModel();

    LocalModelScriptResultVO startLocalTestModel();

    LocalModelScriptResultVO stopLocalTestModel();
}
