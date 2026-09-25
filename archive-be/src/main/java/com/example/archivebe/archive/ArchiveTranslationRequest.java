package com.example.archivebe.archive;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ArchiveTranslationRequest(@NotBlank @Size(max = 10) String languageCode,
                                        @NotBlank @Size(max = 255) String title,
                                        @Size(max = 10000) String description,
                                        String transcriptText, String translationStatus,
                                        String translationSource, @Size(max = 255) String translatedBy) {}
