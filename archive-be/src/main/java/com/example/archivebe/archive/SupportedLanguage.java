package com.example.archivebe.archive;

import java.util.Arrays;

public enum SupportedLanguage {
    EN("en", "English", "English"), VI("vi", "Vietnamese", "Tiếng Việt");

    private final String code, label, nativeLabel;

    SupportedLanguage(String code, String label, String nativeLabel) {
        this.code = code;
        this.label = label;
        this.nativeLabel = nativeLabel;
    }

    public String code() {
        return code;
    }

    public String label() {
        return label;
    }

    public String nativeLabel() {
        return nativeLabel;
    }

    public static SupportedLanguage fromCode(String code) {
        return Arrays.stream(values()).filter(language -> language.code.equalsIgnoreCase(code)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported language: " + code));
    }
}
