package io.github.halcyonsong.sessionfile.service.support;

import io.github.halcyonsong.chat.session.service.support.session.ChatSessionStore;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.sessionfile.pojo.entity.SessionFileReferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SessionFileAuthorizeSupport {

    private static final String STATUS_READY = "READY";

    private final ChatSessionStore chatSessionStore;

    public void validateSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "sessionId 不能为空");
        }

        if (chatSessionStore.getSession(sessionId) == null) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "会话不存在: " + sessionId);
        }
    }

    public Path resolveAndValidateFile(String absolutePath) {
        if (!StringUtils.hasText(absolutePath)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "absolutePath 不能为空");
        }

        Path path = Path.of(absolutePath).toAbsolutePath().normalize();

        if (!Files.exists(path)) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "文件不存在: " + path);
        }

        if (!Files.isRegularFile(path)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "目标不是普通文件: " + path);
        }

        return path;
    }

    public String generateFileReferenceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public SessionFileReferenceEntity buildEntity(String sessionId, Path path) {
        LocalDateTime now = LocalDateTime.now();

        return SessionFileReferenceEntity.builder()
                .fileReferenceId(generateFileReferenceId())
                .sessionId(sessionId)
                .absolutePath(path.toString())
                .originalFileName(path.getFileName().toString())
                .contentType(resolveContentType(path))
                .fileSize(resolveFileSize(path))
                .lastKnownModifiedTime(resolveLastModifiedTime(path))
                .status(STATUS_READY)
                .createTime(now)
                .updateTime(now)
                .build();
    }

    private String resolveContentType(Path path) {
        try {
            return Files.probeContentType(path);
        } catch (Exception exception) {
            return null;
        }
    }

    private Long resolveFileSize(Path path) {
        try {
            return Files.size(path);
        } catch (Exception exception) {
            return null;
        }
    }

    private LocalDateTime resolveLastModifiedTime(Path path) {
        try {
            Instant instant = Files.getLastModifiedTime(path).toInstant();
            return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
        } catch (Exception exception) {
            return null;
        }
    }

}