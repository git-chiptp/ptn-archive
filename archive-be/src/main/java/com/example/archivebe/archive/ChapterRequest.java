package com.example.archivebe.archive;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChapterRequest(@NotBlank @Size(max = 255) String name, @Size(max = 5_000_000) String backgroundImage,
        ArchiveCategory category) {
}
