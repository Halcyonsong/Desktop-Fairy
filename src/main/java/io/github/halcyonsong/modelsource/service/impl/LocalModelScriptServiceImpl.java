package io.github.halcyonsong.modelsource.service.impl;

import io.github.halcyonsong.common.config.filepath.DesktopFairyPathProperties;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.modelsource.pojo.vo.LocalModelScriptResultVO;
import io.github.halcyonsong.modelsource.service.LocalModelScriptService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@AllArgsConstructor
public class LocalModelScriptServiceImpl implements LocalModelScriptService {

    private static final long PROCESS_TIMEOUT_SECONDS = 1800L;
    private final DesktopFairyPathProperties desktopFairyPathProperties;

    @Override
    public LocalModelScriptResultVO installLocalTestModel() {
        return execute("install-local-test-model.bat");
    }

    @Override
    public LocalModelScriptResultVO startLocalTestModel() {
        return execute("start-local-test-model.bat");
    }

    @Override
    public LocalModelScriptResultVO stopLocalTestModel() {
        return execute("stop-local-test-model.bat");
    }

    private LocalModelScriptResultVO execute(String scriptName) {
        Path scriptPath = resolveScriptPath(scriptName);
        Process process = null;
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(List.of("cmd.exe", "/c", scriptPath.toString()));
            processBuilder.directory(scriptPath.getParent().toFile());
            processBuilder.redirectErrorStream(false);
            process = processBuilder.start();

            CompletableFuture<String> stdoutFuture = readStreamAsync(process.getInputStream());
            CompletableFuture<String> stderrFuture = readStreamAsync(process.getErrorStream());

            boolean finished = process.waitFor(PROCESS_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "本地模型脚本执行超时");
            }

            String stdout = stdoutFuture.get();
            String stderr = stderrFuture.get();
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                String message = buildFailureMessage(scriptName, stdout, stderr);
                log.warn("执行本地模型脚本失败: script={}, exitCode={}, message={}", scriptName, exitCode, message);
                throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), message);
            }

            log.info("执行本地模型脚本完成: script={}, exitCode={}", scriptName, exitCode);
            return LocalModelScriptResultVO.builder()
                    .script(scriptName)
                    .exitCode(exitCode)
                    .stdout(stdout)
                    .stderr(stderr)
                    .build();
        } catch (IOException exception) {
            log.error("执行本地模型脚本失败: script={}", scriptName, exception);
            throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "执行本地模型脚本失败: " + exception.getMessage());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("执行本地模型脚本被中断: script={}", scriptName, exception);
            throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "执行本地模型脚本被中断");
        } catch (ExecutionException exception) {
            log.error("读取本地模型脚本输出失败: script={}", scriptName, exception);
            throw new BusinessException(ResultCodeEnum.SYSTEM_ERROR.getCode(), "读取本地模型脚本输出失败");
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

    private CompletableFuture<String> readStreamAsync(InputStream inputStream) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return readStream(inputStream);
            } catch (IOException exception) {
                throw new RuntimeException(exception);
            }
        });
    }

    private String buildFailureMessage(String scriptName, String stdout, String stderr) {
        String stderrText = stderr == null ? "" : stderr.trim();
        String stdoutText = stdout == null ? "" : stdout.trim();
        if (!stderrText.isEmpty()) {
            return stderrText;
        }
        if (!stdoutText.isEmpty()) {
            return stdoutText;
        }
        return "本地模型脚本执行失败: " + scriptName;
    }

    private String readStream(InputStream inputStream) throws IOException {
        StringBuilder builder = new StringBuilder();
        Charset charset = Charset.defaultCharset();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, charset))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append(System.lineSeparator());
            }
        }
        return builder.toString();
    }
}
