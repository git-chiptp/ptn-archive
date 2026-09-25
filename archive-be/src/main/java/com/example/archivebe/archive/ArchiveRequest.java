package com.example.archivebe.archive;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record ArchiveRequest(@NotBlank @Size(max = 255) String title,
                             @Size(max = 10000) String description,
                             String transcriptText,
                             ArchiveStatus status,
                             @Size(max = 1000) String sourceUrl,
                             Instant recordedAt, ArchiveCategory category) {}
