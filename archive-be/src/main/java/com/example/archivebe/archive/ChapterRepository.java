package com.example.archivebe.archive;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface ChapterRepository extends JpaRepository<Chapter, UUID> {
}
