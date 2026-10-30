-- The earlier trial override treated any authenticated user as an admin.
-- Restore the trusted app_metadata check for media and existing archive writes.
CREATE OR REPLACE FUNCTION public.is_archive_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND coalesce(
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR (auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin',
        false
    );
$$;
GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
CREATE POLICY "Published media is readable"
ON public.media_assets FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.chapters AS c
        WHERE c.background_image = 'media:' || media_assets.id::text
    )
    OR EXISTS (
        SELECT 1 FROM public.archives AS a
        WHERE a.status = 'PUBLISHED'
          AND jsonb_path_exists(
              a.transcript_text,
              '$.** ? (@.sprite == $ref || @.src == $ref)',
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
              t.transcript_text,
              '$.** ? (@.sprite == $ref || @.src == $ref)',
              jsonb_build_object('ref', 'media:' || media_assets.id::text)
          )
    )
);
CREATE POLICY "Admins can read all media"
ON public.media_assets FOR SELECT TO authenticated
USING (public.is_archive_admin());
CREATE POLICY "Admins can insert media"
ON public.media_assets FOR INSERT TO authenticated
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can update media"
ON public.media_assets FOR UPDATE TO authenticated
USING (public.is_archive_admin())
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can delete media"
ON public.media_assets FOR DELETE TO authenticated
USING (public.is_archive_admin());
