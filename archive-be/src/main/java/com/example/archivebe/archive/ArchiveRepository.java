package com.example.archivebe.archive;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface ArchiveRepository extends JpaRepository<Archive, UUID> {
    java.util.List<Archive> findByStatusOrderByRecordedAtDesc(ArchiveStatus status);
}
