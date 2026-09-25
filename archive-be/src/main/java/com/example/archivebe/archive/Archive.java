package com.example.archivebe.archive;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "archives")
public class Archive {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, length = 255) private String title;
    @Column(columnDefinition = "text") private String description;
    @Column(name = "transcript_text", columnDefinition = "text") private String transcriptText;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private ArchiveStatus status = ArchiveStatus.DRAFT;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private ArchiveCategory category = ArchiveCategory.MAIN_STORY;
    @Column(name = "source_url", length = 1000) private String sourceUrl;
    @Column(name = "recorded_at") private Instant recordedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTranscriptText() { return transcriptText; }
    public void setTranscriptText(String transcriptText) { this.transcriptText = transcriptText; }
    public ArchiveStatus getStatus() { return status; }
    public ArchiveCategory getCategory() { return category; }
    public void setCategory(ArchiveCategory category) { this.category = category; }
    public void setStatus(ArchiveStatus status) { this.status = status; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
