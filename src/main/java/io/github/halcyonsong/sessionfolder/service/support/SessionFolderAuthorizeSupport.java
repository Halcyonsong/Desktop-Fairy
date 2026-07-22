package io.github.halcyonsong.sessionfolder.service.support;

import io.github.halcyonsong.chat.session.service.support.session.ChatSessionStore;
import io.github.halcyonsong.common.enums.ResultCodeEnum;
import io.github.halcyonsong.common.exception.BusinessException;
import io.github.halcyonsong.sessionfolder.pojo.entity.SessionFolderReferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SessionFolderAuthorizeSupport {

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

    public Path resolveAndValidateFolder(String absolutePath) {
        if (!StringUtils.hasText(absolutePath)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "absolutePath 不能为空");
        }

        Path path = Path.of(absolutePath).toAbsolutePath().normalize();

        if (!Files.exists(path)) {
            throw new BusinessException(ResultCodeEnum.NOT_FOUND.getCode(), "文件夹不存在: " + path);
        }

        if (!Files.isDirectory(path)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "目标不是文件夹: " + path);
        }

        validateFolderPathAllowed(path);
        return path;
    }

    public String generateFolderReferenceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public SessionFolderReferenceEntity buildEntity(String sessionId, Path path) {
        LocalDateTime now = LocalDateTime.now();

        String folderName = path.getFileName() == null
                ? path.toString()
                : path.getFileName().toString();

        return SessionFolderReferenceEntity.builder()
                .folderReferenceId(generateFolderReferenceId())
                .sessionId(sessionId)
                .absolutePath(path.toString())
                .folderName(folderName)
                .status(STATUS_READY)
                .createTime(now)
                .updateTime(now)
                .build();
    }

    private void validateFolderPathAllowed(Path path) {
        Path normalizedPath = path.toAbsolutePath().normalize();
        Path root = normalizedPath.getRoot();

        if (root != null && normalizedPath.equals(root)) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "不允许直接授权磁盘根目录: " + normalizedPath);
        }

        String normalizedText = normalizedPath.toString().toLowerCase();

        if (normalizedText.equals("c:\\windows")
                || normalizedText.startsWith("c:\\windows\\")
                || normalizedText.equals("c:\\program files")
                || normalizedText.startsWith("c:\\program files\\")
                || normalizedText.equals("c:\\program files (x86)")
                || normalizedText.startsWith("c:\\program files (x86)\\")) {
            throw new BusinessException(ResultCodeEnum.PARAM_ERROR.getCode(), "不允许授权系统敏感目录: " + normalizedPath);
        }
    }
}