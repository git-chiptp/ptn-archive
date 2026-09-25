package com.example.archivebe.archive;

import java.util.UUID;
public class ArchiveNotFoundException extends RuntimeException {
    public ArchiveNotFoundException(UUID id) { super("Archive not found: " + id); }
}
