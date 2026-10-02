package com.example.archivebe.archive;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/archives")
public class ArchiveController {
    private final ArchiveRepository repository;

    public ArchiveController(ArchiveRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Archive> list(@RequestParam(required = false) ArchiveStatus status) {
        return status == null ? repository.findAll() : repository.findByStatusOrderByRecordedAtDesc(status);
    }

    @GetMapping("/{id}")
    public Archive get(@PathVariable UUID id) {
        return repository.findById(id).orElseThrow(() -> new ArchiveNotFoundException(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Archive create(@Valid @RequestBody ArchiveRequest request) {
        return repository.save(from(request, new Archive()));
    }

    @PutMapping("/{id}")
    public Archive update(@PathVariable UUID id, @Valid @RequestBody ArchiveRequest request) {
        return repository.save(from(request, get(id)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        if (!repository.existsById(id))
            throw new ArchiveNotFoundException(id);
        repository.deleteById(id);
    }

    private Archive from(ArchiveRequest r, Archive a) {
        a.setTitle(r.title());
        a.setDescription(r.description());
        a.setTranscriptText(r.transcriptText());
        a.setParentId(r.parentId());
        a.setParentLabel(r.parentLabel());
        a.setStageLabel(r.stageLabel());
        a.setSourceLanguage(r.sourceLanguage() == null ? "en" : r.sourceLanguage().toLowerCase());
        a.setStatus(r.status() == null ? ArchiveStatus.DRAFT : r.status());
        a.setCategory(r.category() == null ? ArchiveCategory.MAIN_STORY : r.category());
        a.setSourceUrl(r.sourceUrl());
        a.setRecordedAt(r.recordedAt());
        return a;
    }
}
