DROP POLICY IF EXISTS "Published media is readable" ON public.media_assets;

CREATE POLICY "Published media is readable"
ON public.media_assets FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.chapters AS c
        WHERE c.background_image = 'media:' || media_assets.id::text
    )
    OR EXISTS (
        SELECT 1
        FROM public.archives AS a
        WHERE a.status = 'PUBLISHED'
          AND jsonb_path_exists(
              coalesce(a.transcript_text, '[]'::jsonb),
              '$.** ? (@.sprite == $ref || @.src == $ref || @.variants.male == $ref || @.variants.female == $ref)',
              jsonb_build_object('ref', 'media:' || media_assets.id::text)
          )
    )
    OR EXISTS (
        SELECT 1
        FROM public.archive_translations AS t
        JOIN public.archives AS a ON a.id = t.archive_id
        WHERE a.status = 'PUBLISHED'
          AND t.translation_status = 'PUBLISHED'
          AND jsonb_path_exists(
              coalesce(t.transcript_text, '[]'::jsonb),
              '$.** ? (@.sprite == $ref || @.src == $ref || @.variants.male == $ref || @.variants.female == $ref)',
              jsonb_build_object('ref', 'media:' || media_assets.id::text)
          )
    )
);

CREATE OR REPLACE FUNCTION public.media_asset_is_referenced(asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chapters AS c
        WHERE c.background_image = 'media:' || asset_id::text
    )
    OR EXISTS (
        SELECT 1
        FROM public.archives AS a
        WHERE jsonb_path_exists(
            coalesce(a.transcript_text, '[]'::jsonb),
            '$.** ? (@.sprite == $ref || @.src == $ref || @.variants.male == $ref || @.variants.female == $ref)',
            jsonb_build_object('ref', 'media:' || asset_id::text)
        )
    )
    OR EXISTS (
        SELECT 1
        FROM public.archive_translations AS t
        WHERE jsonb_path_exists(
            coalesce(t.transcript_text, '[]'::jsonb),
            '$.** ? (@.sprite == $ref || @.src == $ref || @.variants.male == $ref || @.variants.female == $ref)',
            jsonb_build_object('ref', 'media:' || asset_id::text)
        )
    );
$$;
