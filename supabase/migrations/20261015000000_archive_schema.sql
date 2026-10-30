CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.archives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(255) NOT NULL,
    description text,
    transcript_text text,
    status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    source_url varchar(1000),
    recorded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    source_language varchar(10) NOT NULL DEFAULT 'en',
    category varchar(20) NOT NULL DEFAULT 'MAIN_STORY'
        CHECK (category IN ('MAIN_STORY', 'EVENT_STORY', 'INTERROGATION', 'PERSPECTRA')),
    parent_id varchar(255),
    parent_label varchar(255),
    stage_label varchar(255)
);
CREATE INDEX idx_archives_status ON public.archives(status);
CREATE INDEX idx_archives_recorded_at ON public.archives(recorded_at DESC);
CREATE INDEX idx_archives_search ON public.archives USING gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(transcript_text, ''))
);
CREATE TABLE public.archive_translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_id uuid NOT NULL REFERENCES public.archives(id) ON DELETE CASCADE,
    language_code varchar(10) NOT NULL,
    title varchar(255) NOT NULL,
    description text,
    transcript_text text,
    translation_status varchar(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (translation_status IN ('DRAFT', 'REVIEW', 'PUBLISHED')),
    translated_by varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    parent_label varchar(255),
    stage_label varchar(255),
    CONSTRAINT archive_translation_language_unique UNIQUE (archive_id, language_code)
);
CREATE INDEX idx_archive_translations_language ON public.archive_translations(language_code);
CREATE INDEX idx_archive_translations_archive ON public.archive_translations(archive_id);
CREATE TABLE public.chapters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    background_image text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    category varchar(30) NOT NULL DEFAULT 'MAIN_STORY'
);
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published archives are readable"
ON public.archives FOR SELECT TO anon, authenticated
USING (status = 'PUBLISHED');
CREATE POLICY "Published translations are readable"
ON public.archive_translations FOR SELECT TO anon, authenticated
USING (
    translation_status = 'PUBLISHED'
    AND EXISTS (
        SELECT 1 FROM public.archives
        WHERE archives.id = archive_id AND archives.status = 'PUBLISHED'
    )
);
CREATE POLICY "Chapters are readable"
ON public.chapters FOR SELECT TO anon, authenticated
USING (true);
-- No client write policies yet. The Auth/admin migration must add them explicitly.;
