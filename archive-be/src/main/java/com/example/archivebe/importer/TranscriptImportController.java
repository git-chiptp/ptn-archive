package com.example.archivebe.importer;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFRichTextString;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/transcripts")
public class TranscriptImportController {
    private final DataFormatter formatter = new DataFormatter();

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<ImportedLine> importWorkbook(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty())
            throw new IllegalArgumentException("The XLSX file is empty.");
        if (file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".xlsx")) {
            throw new IllegalArgumentException("Only XLSX files are supported.");
        }
        try (XSSFWorkbook workbook = new XSSFWorkbook(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0)
                return List.of();
            XSSFSheet sheet = workbook.getSheetAt(0);
            List<ImportedLine> rows = new ArrayList<>();
            boolean first = true;
            for (Row row : sheet) {
                if (first && "speaker".equalsIgnoreCase(text(row.getCell(0)).trim())) {
                    first = false;
                    continue;
                }
                first = false;
                ImportedLine line = parseRow(row, workbook);
                if (!line.speaker().isBlank() || !line.text().isBlank() || !line.prompt().isBlank()
                        || !line.option().isBlank())
                    rows.add(line);
            }
            return rows;
        }
    }

    private ImportedLine parseRow(Row row, XSSFWorkbook workbook) {
        String speaker = text(row.getCell(0));
        int firstContent = 1;
        while (firstContent <= row.getLastCellNum() && text(row.getCell(firstContent)).isBlank())
            firstContent++;
        String raw = firstContent <= row.getLastCellNum() ? richText(row.getCell(firstContent), workbook) : "";
        String markerText = decodeEntities(raw);
        String plain = stripTags(markerText).trim();
        int depth = Math.max(0, firstContent - 1);
        if (plain.startsWith(">>"))
            return new ImportedLine("", "", "option", "", markerText.replaceFirst("^\\s*>>\\s*", ""), depth);
        if (plain.startsWith(">"))
            return new ImportedLine("", "", "choice", markerText.replaceFirst("^\\s*>\\s*", ""), "", depth);
        return new ImportedLine(speaker, raw, depth > 0 ? "option-line" : "line", "", "", depth);
    }

    private String text(Cell cell) {
        return cell == null ? "" : formatter.formatCellValue(cell);
    }

    private String richText(Cell cell, XSSFWorkbook workbook) {
        if (!(cell instanceof XSSFCell xcell))
            return escape(text(cell));
        XSSFRichTextString value = xcell.getRichStringCellValue();
        StringBuilder html = new StringBuilder();
        for (int i = 0; i < value.numFormattingRuns(); i++) {
            int start = value.getIndexOfFormattingRun(i);
            int end = i + 1 < value.numFormattingRuns() ? value.getIndexOfFormattingRun(i + 1) : value.length();
            String content = escape(value.getString().substring(start, end));
            var font = value.getFontAtIndex(start);
            List<String> styles = new ArrayList<>();
            if (font != null) {
                if (font.getBold())
                    styles.add("font-weight:bold");
                if (font.getItalic())
                    styles.add("font-style:italic");
                if (font.getXSSFColor() != null && font.getXSSFColor().getRGB() != null)
                    styles.add("color:#" + hex(font.getXSSFColor().getRGB()));
            }
            html.append(styles.isEmpty() ? content
                    : "<span style=\"" + String.join(";", styles) + "\">" + content + "</span>");
        }
        if (html.length() > 0)
            return html.toString();
        var cellStyle = xcell.getCellStyle();
        var cellFont = workbook.getFontAt(cellStyle.getFontIndex());
        return styled(escape(value.getString()), cellFont);
    }

    private String styled(String content, org.apache.poi.xssf.usermodel.XSSFFont font) {
        if (font == null)
            return content;
        List<String> styles = new ArrayList<>();
        if (font.getBold())
            styles.add("font-weight:bold");
        if (font.getItalic())
            styles.add("font-style:italic");
        if (font.getXSSFColor() != null && font.getXSSFColor().getRGB() != null)
            styles.add("color:#" + hex(font.getXSSFColor().getRGB()));
        return styles.isEmpty() ? content : "<span style=\"" + String.join(";", styles) + "\">" + content + "</span>";
    }

    private String decodeEntities(String value) {
        return value.replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&").replace("&quot;", "\"");
    }

    private String stripTags(String value) {
        return value.replaceAll("<[^>]+>", " ").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&")
                .replaceAll("\\s+", " ").trim();
    }

    private String hex(byte[] rgb) {
        StringBuilder result = new StringBuilder();
        for (byte b : rgb)
            result.append(String.format("%02X", b));
        return result.toString();
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    public record ImportedLine(String speaker, String text, String type, String prompt, String option, int depth) {
    }
}
