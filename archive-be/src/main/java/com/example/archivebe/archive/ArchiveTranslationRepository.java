package com.example.archivebe.archive;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ArchiveTranslationRepository extends JpaRepository<ArchiveTranslation, UUID> {
    List<ArchiveTranslation> findByArchiveIdOrderByLanguageCode(UUID archiveId);
    Optional<ArchiveTranslation> findByArchiveIdAndLanguageCode(UUID archiveId, String languageCode);
}
