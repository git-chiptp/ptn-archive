DROP POLICY IF EXISTS "Admins can read archives" ON public.archives;
DROP POLICY IF EXISTS "Admins can insert archives" ON public.archives;
DROP POLICY IF EXISTS "Admins can update archives" ON public.archives;
DROP POLICY IF EXISTS "Admins can delete archives" ON public.archives;
DROP POLICY IF EXISTS "Admins can read translations" ON public.archive_translations;
DROP POLICY IF EXISTS "Admins can insert translations" ON public.archive_translations;
DROP POLICY IF EXISTS "Admins can update translations" ON public.archive_translations;
DROP POLICY IF EXISTS "Admins can delete translations" ON public.archive_translations;
DROP POLICY IF EXISTS "Admins can read chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins can insert chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins can update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins can delete chapters" ON public.chapters;
CREATE POLICY "Authenticated users can read archives"
ON public.archives FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert archives"
ON public.archives FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update archives"
ON public.archives FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete archives"
ON public.archives FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read translations"
ON public.archive_translations FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert translations"
ON public.archive_translations FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update translations"
ON public.archive_translations FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete translations"
ON public.archive_translations FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read chapters"
ON public.chapters FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert chapters"
ON public.chapters FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update chapters"
ON public.chapters FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete chapters"
ON public.chapters FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can read all media" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can insert media" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can update media" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can delete media" ON public.media_assets;
CREATE POLICY "Authenticated users can update media"
ON public.media_assets FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete media"
ON public.media_assets FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can insert media folders" ON public.media_folders;
DROP POLICY IF EXISTS "Admins can update media folders" ON public.media_folders;
DROP POLICY IF EXISTS "Admins can delete media folders" ON public.media_folders;
CREATE POLICY "Authenticated users can insert media folders"
ON public.media_folders FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update media folders"
ON public.media_folders FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete media folders"
ON public.media_folders FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Archive admins can list assets" ON storage.objects;
DROP POLICY IF EXISTS "Archive admins can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Archive admins can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Archive admins can delete assets" ON storage.objects;
CREATE POLICY "Authenticated users can list assets"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'archive-assets'
    AND auth.uid() IS NOT NULL
);
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'archive-assets'
    AND auth.uid() IS NOT NULL
    AND public.is_archive_asset_path(name)
);
CREATE POLICY "Authenticated users can update assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'archive-assets'
    AND auth.uid() IS NOT NULL
    AND public.is_archive_asset_path(name)
)
WITH CHECK (
    bucket_id = 'archive-assets'
    AND auth.uid() IS NOT NULL
    AND public.is_archive_asset_path(name)
);
CREATE POLICY "Authenticated users can delete assets"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'archive-assets'
    AND auth.uid() IS NOT NULL
    AND public.is_archive_asset_path(name)
);
DROP FUNCTION IF EXISTS public.is_archive_admin();
