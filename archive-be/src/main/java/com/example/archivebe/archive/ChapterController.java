package com.example.archivebe.archive;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chapters")
public class ChapterController {
    private final ChapterRepository repository;

    public ChapterController(ChapterRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Chapter> list() {
        return repository.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Chapter create(@Valid @RequestBody ChapterRequest request) {
        return repository.save(from(request, new Chapter()));
    }

    @PutMapping("/{id}")
    public Chapter update(@PathVariable UUID id, @Valid @RequestBody ChapterRequest request) {
        return repository.save(
                from(request, repository.findById(id).orElseThrow(() -> new RuntimeException("Chapter not found"))));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        if (!repository.existsById(id))
            throw new RuntimeException("Chapter not found");
        repository.deleteById(id);
    }

    private Chapter from(ChapterRequest request, Chapter chapter) {
        chapter.setName(request.name());
        chapter.setBackgroundImage(request.backgroundImage());
        chapter.setCategory(request.category());
        return chapter;
    }
}
