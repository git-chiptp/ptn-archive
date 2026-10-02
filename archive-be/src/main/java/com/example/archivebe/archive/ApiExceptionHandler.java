package com.example.archivebe.archive;

import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, IOException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, String> badRequest(Exception e) { return Map.of("error", e.getMessage() == null ? "Invalid request." : e.getMessage()); }

    @ExceptionHandler(ArchiveNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    Map<String, String> notFound(ArchiveNotFoundException e) { return Map.of("error", e.getMessage()); }
}
