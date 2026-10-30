DROP POLICY IF EXISTS "Admins can read all media"
ON public.media_assets;
CREATE POLICY "Authenticated users can read all media"
ON public.media_assets FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can insert media"
ON public.media_assets;
CREATE POLICY "Authenticated users can insert media"
ON public.media_assets FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can upload media assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'archive-assets'
    AND auth.uid() IS NOT NULL
    AND name ~* '^media/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$'
);
