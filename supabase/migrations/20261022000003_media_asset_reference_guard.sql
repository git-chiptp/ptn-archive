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
            '$.** ? (@.sprite == $ref || @.src == $ref)',
            jsonb_build_object('ref', 'media:' || asset_id::text)
        )
    )
    OR EXISTS (
        SELECT 1
        FROM public.archive_translations AS t
        WHERE jsonb_path_exists(
            coalesce(t.transcript_text, '[]'::jsonb),
            '$.** ? (@.sprite == $ref || @.src == $ref)',
            jsonb_build_object('ref', 'media:' || asset_id::text)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.prevent_referenced_media_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF public.media_asset_is_referenced(OLD.id) THEN
        RAISE EXCEPTION 'Media asset % is still referenced.', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER media_assets_reference_guard
BEFORE DELETE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.prevent_referenced_media_delete();
