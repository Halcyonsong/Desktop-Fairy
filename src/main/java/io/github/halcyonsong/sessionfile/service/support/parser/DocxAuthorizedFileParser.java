package io.github.halcyonsong.sessionfile.service.support.parser;

import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class DocxAuthorizedFileParser implements AuthorizedFileParser {

    @Override
    public boolean supports(String extension) {
        return "docx".equals(extension);
    }

    @Override
    public String parse(Path path, int maxChars) throws Exception {
        try (InputStream inputStream = Files.newInputStream(path);
             XWPFDocument document = new XWPFDocument(inputStream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {

            String content = extractor.getText();
            if (content == null) {
                return "";
            }

            if (content.length() <= maxChars) {
                return content;
            }

            return content.substring(0, maxChars)
                    + "\n\n[system note] docx content truncated to "
                    + maxChars
                    + " characters.";
        }
    }
}