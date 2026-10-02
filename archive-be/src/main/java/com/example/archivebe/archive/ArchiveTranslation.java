package com.example.archivebe.archive;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "archive_translations", uniqueConstraints = @UniqueConstraint(name = "archive_translation_language_unique", columnNames = {
        "archive_id", "language_code" }))
public class ArchiveTranslation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "archive_id", nullable = false)
    private Archive archive;

    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "parent_label", length = 255)
    private String parentLabel;

    @Column(name = "stage_label", length = 255)
    private String stageLabel;

    @Column(name = "transcript_text", columnDefinition = "text")
    private String transcriptText;

    @Column(name = "translation_status", nullable = false, length = 20)
    private String translationStatus = "DRAFT";

    @Column(name = "translation_source", nullable = false, length = 20)
    private String translationSource = "HUMAN";

    @Column(name = "translated_by", length = 255)
    private String translatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    @JsonIgnore
    public Archive getArchive() {
        return archive;
    }

    public void setArchive(Archive archive) {
        this.archive = archive;
    }

    public String getLanguageCode() {
        return languageCode;
    }

    public void setLanguageCode(String languageCode) {
        this.languageCode = languageCode;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public String getParentLabel() {
        return parentLabel;
    }

    public void setParentLabel(String value) {
        parentLabel = value;
    }

    public String getStageLabel() {
        return stageLabel;
    }

    public void setStageLabel(String value) {
        stageLabel = value;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTranscriptText() {
        return transcriptText;
    }

    public void setTranscriptText(String transcriptText) {
        this.transcriptText = transcriptText;
    }

    public String getTranslationStatus() {
        return translationStatus;
    }

    public void setTranslationStatus(String value) {
        translationStatus = value;
    }

    public String getTranslationSource() {
        return translationSource;
    }

    public void setTranslationSource(String value) {
        translationSource = value;
    }

    public String getTranslatedBy() {
        return translatedBy;
    }

    public void setTranslatedBy(String value) {
        translatedBy = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
