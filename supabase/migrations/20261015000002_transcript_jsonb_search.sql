CREATE OR REPLACE FUNCTION public.transcript_text_to_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    parsed jsonb;
BEGIN
    IF value IS NULL OR btrim(value) = '' THEN
        RETURN '[]'::jsonb;
    END IF;

    parsed := value::jsonb;
    IF jsonb_typeof(parsed) = 'array' THEN
        RETURN parsed;
    END IF;
    RETURN jsonb_build_array(
        jsonb_build_object(
            'type', 'line',
            'id', md5(value),
            'text', value
        )
    );
EXCEPTION WHEN others THEN
    RETURN jsonb_build_array(
        jsonb_build_object(
            'type', 'line',
            'id', md5(value),
            'text', value
        )
    );
END;
$$;
CREATE OR REPLACE FUNCTION public.transcript_search_text(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    WITH RECURSIVE values_to_visit(value) AS (
        VALUES (document)
        UNION ALL
        SELECT child.value
        FROM values_to_visit current_value
        CROSS JOIN LATERAL (
            SELECT array_item.value
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(current_value.value) = 'array' THEN current_value.value
                    ELSE '[]'::jsonb
                END
            ) AS array_item(value)
            UNION ALL
            SELECT object_item.value
            FROM jsonb_each(
                CASE
                    WHEN jsonb_typeof(current_value.value) = 'object' THEN current_value.value
                    ELSE '{}'::jsonb
                END
            ) AS object_item(key, value)
        ) AS child
    ),
    searchable_text(value) AS (
        SELECT field.value #>> '{}'
        FROM values_to_visit current_value
        CROSS JOIN LATERAL jsonb_each(
            CASE
                WHEN jsonb_typeof(current_value.value) = 'object' THEN current_value.value
                ELSE '{}'::jsonb
            END
        ) AS field(key, value)
        WHERE field.key IN ('speaker', 'text', 'description', 'prompt', 'label', 'male', 'female')
          AND jsonb_typeof(field.value) = 'string'
    )
    SELECT coalesce(string_agg(regexp_replace(value, '<[^>]*>', ' ', 'g'), ' '), '')
    FROM searchable_text;
$$;
CREATE OR REPLACE FUNCTION public.transcript_search_vector(document jsonb)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT to_tsvector('simple'::regconfig, public.transcript_search_text(document));
$$;
DROP INDEX IF EXISTS public.idx_archives_search;
ALTER TABLE public.archives
    ALTER COLUMN transcript_text TYPE jsonb
    USING public.transcript_text_to_jsonb(transcript_text);
ALTER TABLE public.archive_translations
    ALTER COLUMN transcript_text TYPE jsonb
    USING public.transcript_text_to_jsonb(transcript_text);
UPDATE public.archives
SET transcript_text = '[]'::jsonb
WHERE transcript_text IS NULL;
UPDATE public.archive_translations
SET transcript_text = '[]'::jsonb
WHERE transcript_text IS NULL;
ALTER TABLE public.archives
    ALTER COLUMN transcript_text SET DEFAULT '[]'::jsonb,
    ALTER COLUMN transcript_text SET NOT NULL;
ALTER TABLE public.archive_translations
    ALTER COLUMN transcript_text SET DEFAULT '[]'::jsonb,
    ALTER COLUMN transcript_text SET NOT NULL;
ALTER TABLE public.archives
    ADD COLUMN transcript_search tsvector
    GENERATED ALWAYS AS (public.transcript_search_vector(transcript_text)) STORED;
ALTER TABLE public.archive_translations
    ADD COLUMN transcript_search tsvector
    GENERATED ALWAYS AS (public.transcript_search_vector(transcript_text)) STORED;
CREATE INDEX idx_archives_transcript_search
ON public.archives USING gin (transcript_search);
CREATE INDEX idx_archive_translations_transcript_search
ON public.archive_translations USING gin (transcript_search);
DROP FUNCTION public.transcript_text_to_jsonb(text);
CREATE OR REPLACE FUNCTION public.search_transcripts(query text, result_limit integer DEFAULT 50)
RETURNS TABLE (
    archive_id uuid,
    language_code varchar(10),
    title varchar(255),
    parent_label varchar(255),
    stage_label varchar(255),
    rank real,
    snippet text
)
LANGUAGE sql
STABLE
AS $$
    WITH search_query AS (
        SELECT websearch_to_tsquery('simple'::regconfig, nullif(btrim(query), '')) AS ts_query
    ),
    candidates AS (
        SELECT
            a.id AS archive_id,
            NULL::varchar(10) AS language_code,
            a.title,
            a.parent_label,
            a.stage_label,
            a.transcript_search,
            public.transcript_search_text(a.transcript_text) AS search_text
        FROM public.archives a
        WHERE a.status = 'PUBLISHED'

        UNION ALL

        SELECT
            a.id AS archive_id,
            t.language_code,
            t.title,
            t.parent_label,
            t.stage_label,
            t.transcript_search,
            public.transcript_search_text(t.transcript_text) AS search_text
        FROM public.archive_translations t
        JOIN public.archives a ON a.id = t.archive_id
        WHERE a.status = 'PUBLISHED'
          AND t.translation_status = 'PUBLISHED'
    )
    SELECT
        candidate.archive_id,
        candidate.language_code,
        candidate.title,
        candidate.parent_label,
        candidate.stage_label,
        ts_rank(candidate.transcript_search, search_query.ts_query) AS rank,
        ts_headline(
            'simple'::regconfig,
            candidate.search_text,
            search_query.ts_query,
            'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=35,MinWords=12'
        ) AS snippet
    FROM candidates AS candidate
    CROSS JOIN search_query
    WHERE search_query.ts_query IS NOT NULL
      AND candidate.transcript_search @@ search_query.ts_query
    ORDER BY rank DESC, candidate.title, candidate.language_code NULLS FIRST
    LIMIT greatest(result_limit, 1);
$$;
GRANT EXECUTE ON FUNCTION public.search_transcripts(text, integer) TO anon, authenticated;
