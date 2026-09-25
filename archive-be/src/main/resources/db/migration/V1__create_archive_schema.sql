CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE archives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(255) NOT NULL,
    description text,
    transcript_text text,
    status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    source_url varchar(1000),
    recorded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_archives_status ON archives(status);
CREATE INDEX idx_archives_recorded_at ON archives(recorded_at DESC);
CREATE INDEX idx_archives_search ON archives USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(transcript_text, '')));
