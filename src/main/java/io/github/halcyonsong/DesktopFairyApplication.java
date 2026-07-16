package io.github.halcyonsong;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
public class DesktopFairyApplication {

    public static void main(String[] args) throws Exception {
        createStorageDirectories();
        SpringApplication.run(DesktopFairyApplication.class, args);
    }

    private static void createStorageDirectories() throws Exception {
        Path baseDir = Paths.get(System.getProperty("user.home"), "AppData", "Local", "DesktopFairy");
        Files.createDirectories(baseDir.resolve("data"));
        Files.createDirectories(baseDir.resolve("logs"));
    }
}