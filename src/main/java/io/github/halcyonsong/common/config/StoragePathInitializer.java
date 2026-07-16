package io.github.halcyonsong.common.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Component
public class StoragePathInitializer {

    @Value("${app.storage.db-path}")
    private String dbPath;

    @Value("${app.storage.log-path}")
    private String logPath;

    @PostConstruct
    public void init() throws Exception {
        createParentDirectories(dbPath);
        createParentDirectories(logPath);
    }

    private void createParentDirectories(String filePath) throws Exception {
        Path path = Paths.get(filePath).toAbsolutePath();
        Path parent = path.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
    }
}