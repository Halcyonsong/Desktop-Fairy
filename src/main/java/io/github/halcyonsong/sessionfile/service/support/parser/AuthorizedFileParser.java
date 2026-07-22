package io.github.halcyonsong.sessionfile.service.support.parser;

import java.nio.file.Path;

public interface AuthorizedFileParser {

    boolean supports(String extension);

    String parse(Path path, int maxChars) throws Exception;
}