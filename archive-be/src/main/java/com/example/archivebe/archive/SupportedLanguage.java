package com.example.archivebe.archive;

import java.util.Arrays;

public enum SupportedLanguage {
    EN("en"), VI("vi"), JA("ja"), ZH("zh"), KO("ko");
    private final String code;
    SupportedLanguage(String code) { this.code = code; }
    public String code() { return code; }
    public static SupportedLanguage fromCode(String code) {
        return Arrays.stream(values()).filter(language -> language.code.equalsIgnoreCase(code)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported language: " + code));
    }
}
