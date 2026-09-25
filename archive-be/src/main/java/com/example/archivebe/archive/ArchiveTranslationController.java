package com.example.archivebe.archive;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/archives/{archiveId}/translations")
public class ArchiveTranslationController {
    private final ArchiveRepository archives;
    private final ArchiveTranslationRepository translations;
    public ArchiveTranslationController(ArchiveRepository archives, ArchiveTranslationRepository translations) { this.archives = archives; this.translations = translations; }
    @GetMapping public List<ArchiveTranslation> list(@PathVariable UUID archiveId) { ensureArchive(archiveId); return translations.findByArchiveIdOrderByLanguageCode(archiveId); }
    @GetMapping("/{languageCode}") public ArchiveTranslation get(@PathVariable UUID archiveId, @PathVariable String languageCode) {
        ensureArchive(archiveId); ensureLanguage(languageCode);
        return translations.findByArchiveIdAndLanguageCode(archiveId, languageCode.toLowerCase()).orElseThrow(() -> new IllegalArgumentException("Translation not found: " + languageCode));
    }
    @PutMapping("/{languageCode}") public ArchiveTranslation save(@PathVariable UUID archiveId, @PathVariable String languageCode, @Valid @RequestBody ArchiveTranslationRequest request) {
        ensureArchive(archiveId); ensureLanguage(languageCode);
        if (!languageCode.equalsIgnoreCase(request.languageCode())) throw new IllegalArgumentException("Language code does not match URL");
        ArchiveTranslation translation = translations.findByArchiveIdAndLanguageCode(archiveId, languageCode.toLowerCase()).orElseGet(ArchiveTranslation::new);
        translation.setArchive(archives.getReferenceById(archiveId)); translation.setLanguageCode(languageCode.toLowerCase()); translation.setTitle(request.title());
        translation.setDescription(request.description()); translation.setTranscriptText(request.transcriptText());
        translation.setTranslationStatus(request.translationStatus() == null ? "DRAFT" : request.translationStatus());
        translation.setTranslationSource(request.translationSource() == null ? "HUMAN" : request.translationSource()); translation.setTranslatedBy(request.translatedBy());
        return translations.save(translation);
    }
    private void ensureArchive(UUID id) { if (!archives.existsById(id)) throw new ArchiveNotFoundException(id); }
    private void ensureLanguage(String code) { SupportedLanguage.fromCode(code); }
}
