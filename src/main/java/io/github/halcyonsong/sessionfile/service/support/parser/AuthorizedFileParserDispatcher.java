package io.github.halcyonsong.sessionfile.service.support.parser;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
public class AuthorizedFileParserDispatcher {

    private final List<AuthorizedFileParser> parsers;

    public AuthorizedFileParserDispatcher(List<AuthorizedFileParser> parsers) {
        this.parsers = parsers;
    }

    public AuthorizedFileParser resolve(String extension) {
        if (!StringUtils.hasText(extension)) {
            return null;
        }

        for (AuthorizedFileParser parser : parsers) {
            if (parser.supports(extension)) {
                return parser;
            }
        }
        return null;
    }
}