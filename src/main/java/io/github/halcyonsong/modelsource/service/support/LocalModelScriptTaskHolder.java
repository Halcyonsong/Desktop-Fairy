package io.github.halcyonsong.modelsource.service.support;

import io.github.halcyonsong.modelsource.enums.LocalModelScriptTaskStatusEnum;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptTaskVO;
import lombok.Getter;
import lombok.Setter;

@Getter
public class LocalModelScriptTaskHolder {

    private final String taskId;
    private final String script;

    private volatile LocalModelScriptTaskStatusEnum status;
    @Setter
    private volatile Integer exitCode;
    private volatile String message;
    private volatile Long startedAt;
    private volatile Long finishedAt;

    private final StringBuilder stdoutBuilder = new StringBuilder();
    private final StringBuilder stderrBuilder = new StringBuilder();

    public LocalModelScriptTaskHolder(String taskId, String script) {
        this.taskId = taskId;
        this.script = script;
        this.status = LocalModelScriptTaskStatusEnum.PENDING;
    }

    public synchronized void appendStdout(String text) {
        stdoutBuilder.append(text);
    }

    public synchronized void appendStderr(String text) {
        stderrBuilder.append(text);
    }

    public synchronized String getStdout() {
        return stdoutBuilder.toString();
    }

    public synchronized String getStderr() {
        return stderrBuilder.toString();
    }

    public void markRunning() {
        this.status = LocalModelScriptTaskStatusEnum.RUNNING;
        this.startedAt = System.currentTimeMillis();
        this.message = "脚本开始执行";
    }

    public void markSuccess(String message) {
        this.status = LocalModelScriptTaskStatusEnum.SUCCESS;
        this.message = message;
        this.finishedAt = System.currentTimeMillis();
    }

    public void markFailed(String message) {
        this.status = LocalModelScriptTaskStatusEnum.FAILED;
        this.message = message;
        this.finishedAt = System.currentTimeMillis();
    }

    public LocalModelScriptTaskVO toVO() {
        return LocalModelScriptTaskVO.builder()
                .taskId(taskId)
                .script(script)
                .status(status.name())
                .exitCode(exitCode)
                .stdout(getStdout())
                .stderr(getStderr())
                .message(message)
                .startedAt(startedAt)
                .finishedAt(finishedAt)
                .build();
    }
}