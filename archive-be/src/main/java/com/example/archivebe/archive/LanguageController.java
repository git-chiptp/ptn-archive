package com.example.archivebe.archive;

import org.springframework.web.bind.annotation.*;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/languages")
public class LanguageController {
    @GetMapping
    public List<LanguageOption> list() {
        return Arrays.stream(SupportedLanguage.values())
                .map(language -> new LanguageOption(language.code(), language.label(), language.nativeLabel()))
                .toList();
    }

    public record LanguageOption(String code, String label, String nativeLabel) {
    }
}
