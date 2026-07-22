package io.github.halcyonsong.sessionfile.service.support.parser;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

@Component
public class PdfAuthorizedFileParser implements AuthorizedFileParser {

    @Override
    public boolean supports(String extension) {
        return "pdf".equals(extension);
    }

    @Override
    public String parse(Path path, int maxChars) throws Exception {
        try (PDDocument document = Loader.loadPDF(path.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String content = stripper.getText(document);

            if (content == null) {
                return "";
            }

            if (content.length() <= maxChars) {
                return content;
            }

            return content.substring(0, maxChars)
                    + "\n\n[system note] pdf content truncated to "
                    + maxChars
                    + " characters.";
        }
    }
}