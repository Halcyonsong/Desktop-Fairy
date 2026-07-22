package io.github.halcyonsong.sessionfile.service.support.parser;

import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class PptxAuthorizedFileParser implements AuthorizedFileParser {

    @Override
    public boolean supports(String extension) {
        return "pptx".equals(extension);
    }

    @Override
    public String parse(Path path, int maxChars) throws Exception {
        StringBuilder builder = new StringBuilder();

        try (InputStream inputStream = Files.newInputStream(path);
             XMLSlideShow slideShow = new XMLSlideShow(inputStream)) {

            int slideIndex = 1;
            for (XSLFSlide slide : slideShow.getSlides()) {
                builder.append("[Slide ").append(slideIndex++).append("]\n");

                for (XSLFShape shape : slide.getShapes()) {
                    if (shape instanceof XSLFTextShape textShape) {
                        String text = textShape.getText();
                        if (text != null && !text.isBlank()) {
                            builder.append(text).append("\n");
                        }
                    }

                    if (builder.length() >= maxChars) {
                        return builder.substring(0, maxChars)
                                + "\n\n[system note] pptx content truncated to "
                                + maxChars
                                + " characters.";
                    }
                }

                builder.append("\n");
            }
        }

        return builder.toString();
    }
}