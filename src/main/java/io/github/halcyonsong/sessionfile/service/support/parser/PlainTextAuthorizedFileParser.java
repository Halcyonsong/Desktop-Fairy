package io.github.halcyonsong.sessionfile.service.support.parser;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

@Component
public class PlainTextAuthorizedFileParser implements AuthorizedFileParser {

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            "txt", "md", "json", "csv", "log", "xml", "yml", "yaml",
            "java", "kt", "js", "ts", "html", "css", "properties", "sql"
    );

    @Override
    public boolean supports(String extension) {
        return SUPPORTED_EXTENSIONS.contains(extension);
    }

    @Override
    public String parse(Path path, int maxChars) throws Exception {
        String content = Files.readString(path, StandardCharsets.UTF_8);
        if (content.length() <= maxChars) {
            return content;
        }

        return content.substring(0, maxChars)
                + "\n\n[system note] file content truncated to "
                + maxChars
                + " characters.";
    }
}