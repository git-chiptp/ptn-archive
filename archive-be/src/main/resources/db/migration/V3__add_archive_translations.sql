ALTER TABLE archives ADD COLUMN source_language varchar(10) NOT NULL DEFAULT 'en';
CREATE TABLE archive_translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), archive_id uuid NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
    language_code varchar(10) NOT NULL, title varchar(255) NOT NULL, description text, transcript_text text,
    translation_status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (translation_status IN ('DRAFT', 'REVIEW', 'PUBLISHED')),
    translation_source varchar(20) NOT NULL DEFAULT 'HUMAN' CHECK (translation_source IN ('HUMAN', 'MACHINE', 'IMPORTED')),
    translated_by varchar(255), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT archive_translation_language_unique UNIQUE (archive_id, language_code)
);
INSERT INTO archive_translations (archive_id, language_code, title, description, transcript_text, translation_status, translation_source)
SELECT id, 'en', title, description, transcript_text, CASE WHEN status = 'PUBLISHED' THEN 'PUBLISHED' ELSE 'DRAFT' END, 'IMPORTED' FROM archives;
CREATE INDEX idx_archive_translations_language ON archive_translations(language_code);
