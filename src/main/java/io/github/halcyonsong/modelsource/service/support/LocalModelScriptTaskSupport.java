package io.github.halcyonsong.modelsource.service.support;

import io.github.halcyonsong.common.config.filepath.DesktopFairyPathProperties;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.constants.ModelBatConastants;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceCreateDTO;
import io.github.halcyonsong.modelsource.pojo.dto.ModelSourceModelDTO;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptLaunchVO;
import io.github.halcyonsong.modelsource.pojo.vo.script.LocalModelScriptTaskVO;
import io.github.halcyonsong.modelsource.service.ModelSourceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class LocalModelScriptTaskSupport {

    private static final long PROCESS_TIMEOUT_SECONDS = 2400L;

    private final DesktopFairyPathProperties desktopFairyPathProperties;
    private final ModelSourceService modelSourceService;

    private final Map<String, LocalModelScriptTaskHolder> taskStore = new ConcurrentHashMap<>();

    public LocalModelScriptLaunchVO submit(String scriptName) {
        Path scriptPath = resolveScriptPath(scriptName);
        String taskId = UUID.randomUUID().toString().replace("-", "");

        LocalModelScriptTaskHolder holder = new LocalModelScriptTaskHolder(taskId, scriptName);
        taskStore.put(taskId, holder);

        CompletableFuture.runAsync(() -> execute(scriptPath, holder));

        return LocalModelScriptLaunchVO.builder()
                .taskId(taskId)
                .script(scriptName)
                .status(holder.getStatus().name())
                .build();
    }

    public LocalModelScriptTaskVO getTask(String taskId) {
        LocalModelScriptTaskHolder holder = taskStore.get(taskId);
        if (holder == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "脚本任务不存在: " + taskId);
        }
        return holder.toVO();
    }

    private void execute(Path scriptPath, LocalModelScriptTaskHolder holder) {
        Process process = null;
        try {
            holder.markRunning();

            ProcessBuilder processBuilder = new ProcessBuilder(List.of("cmd.exe", "/c", scriptPath.toString()));
            processBuilder.directory(scriptPath.getParent().toFile());
            processBuilder.redirectErrorStream(false);
            process = processBuilder.start();

            CompletableFuture<Void> stdoutFuture = appendStreamAsync(process.getInputStream(), holder::appendStdout);
            CompletableFuture<Void> stderrFuture = appendStreamAsync(process.getErrorStream(), holder::appendStderr);

            boolean finished = process.waitFor(PROCESS_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                holder.markFailed("本地模型脚本执行超时");
                return;
            }

            stdoutFuture.get();
            stderrFuture.get();

            int exitCode = process.exitValue();
            holder.setExitCode(exitCode);

            if (exitCode != 0) {
                String message = buildFailureMessage(holder.getStdout(), holder.getStderr(), holder.getScript());
                holder.markFailed(message);
                log.warn("执行本地模型脚本失败: taskId={}, script={}, exitCode={}, message={}",
                        holder.getTaskId(), holder.getScript(), exitCode, message);
                return;
            }

            String successMessage = "执行成功";
            if (ModelBatConastants.INSTALL_BAT.equals(holder.getScript())) {
                successMessage = tryCreateLocalModelSource(successMessage, holder);
            }

            holder.markSuccess(successMessage);
            log.info("执行本地模型脚本完成: taskId={}, script={}", holder.getTaskId(), holder.getScript());
        } catch (IOException exception) {
            holder.markFailed("执行本地模型脚本失败: " + exception.getMessage());
            log.error("执行本地模型脚本失败: taskId={}, script={}",
                    holder.getTaskId(), holder.getScript(), exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            holder.markFailed("执行本地模型脚本被中断");
            log.error("执行本地模型脚本被中断: taskId={}, script={}",
                    holder.getTaskId(), holder.getScript(), exception);
        } catch (ExecutionException exception) {
            holder.markFailed("读取本地模型脚本输出失败");
            log.error("读取本地模型脚本输出失败: taskId={}, script={}",
                    holder.getTaskId(), holder.getScript(), exception);
        } finally {
            if (process != null) {
                process.destroy();
            }
        }
    }

    private Path resolveScriptPath(String scriptName) {
        Path scriptPath = Paths.get(desktopFairyPathProperties.getLocalModelScriptDir(), scriptName)
                .toAbsolutePath()
                .normalize();
        if (!Files.exists(scriptPath) || !Files.isRegularFile(scriptPath)) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "本地模型脚本不存在: " + scriptName);
        }
        return scriptPath;
    }

    private CompletableFuture<Void> appendStreamAsync(InputStream inputStream, LineAppender appender) {
        return CompletableFuture.runAsync(() -> {
            Charset charset = Charset.defaultCharset();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, charset))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    appender.append(line + System.lineSeparator());
                }
            } catch (IOException exception) {
                throw new RuntimeException(exception);
            }
        });
    }

    private String buildFailureMessage(String stdout, String stderr, String scriptName) {
        String stderrText = stderr == null ? "" : stderr.trim();
        if (!stderrText.isEmpty()) {
            return stderrText;
        }

        String stdoutText = stdout == null ? "" : stdout.trim();
        if (!stdoutText.isEmpty()) {
            return stdoutText;
        }

        return "本地模型脚本执行失败: " + scriptName;
    }

    @FunctionalInterface
    private interface LineAppender {
        void append(String text);
    }

    private String tryCreateLocalModelSource(String successMessage, LocalModelScriptTaskHolder holder) {
        try {
            ModelSourceCreateDTO createDTO = ModelSourceCreateDTO.builder()
                    .name("Local Qwen3.5 4B")
                    .provider("local-llamacpp")
                    .baseUrl("http://127.0.0.1:18080")
                    .apiKey("local")
                    .models(List.of(
                            ModelSourceModelDTO.builder()
                                    .modelName("Qwen3.5-4B-UD-IQ2_XXS")
                                    .build()
                    ))
                    .build();

            modelSourceService.create(createDTO);
            return successMessage + "，已自动添加本地模型源";
        } catch (BusinessException exception) {
            log.warn("自动添加本地模型源失败: taskId={}, script={}, message={}",
                    holder.getTaskId(), holder.getScript(), exception.getMessage());
            return successMessage + "，但自动添加本地模型源失败：" + exception.getMessage();
        } catch (Exception exception) {
            log.error("自动添加本地模型源异常: taskId={}, script={}",
                    holder.getTaskId(), holder.getScript(), exception);
            return successMessage + "，但自动添加本地模型源失败";
        }
    }

}