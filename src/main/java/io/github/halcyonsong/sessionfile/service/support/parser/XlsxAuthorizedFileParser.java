package io.github.halcyonsong.sessionfile.service.support.parser;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class XlsxAuthorizedFileParser implements AuthorizedFileParser {

    @Override
    public boolean supports(String extension) {
        return "xlsx".equals(extension);
    }

    @Override
    public String parse(Path path, int maxChars) throws Exception {
        StringBuilder builder = new StringBuilder();

        try (InputStream inputStream = Files.newInputStream(path);
             Workbook workbook = new XSSFWorkbook(inputStream)) {

            DataFormatter formatter = new DataFormatter();

            for (Sheet sheet : workbook) {
                builder.append("[Sheet] ").append(sheet.getSheetName()).append("\n");

                for (Row row : sheet) {
                    boolean firstCell = true;
                    for (Cell cell : row) {
                        if (!firstCell) {
                            builder.append(" | ");
                        }
                        builder.append(formatter.formatCellValue(cell));
                        firstCell = false;
                    }
                    builder.append("\n");

                    if (builder.length() >= maxChars) {
                        return builder.substring(0, maxChars)
                                + "\n\n[system note] xlsx content truncated to "
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