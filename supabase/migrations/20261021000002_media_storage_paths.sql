CREATE FUNCTION public.is_archive_asset_path(path text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT path ~ '^(chapters|archives)/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$'
        OR path ~* '^media/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$';
$$;

-- Public object downloads use the public bucket; listing requires an admin session.
CREATE POLICY "Archive admins can list assets"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
);

ALTER POLICY "Archive admins can upload assets"
ON storage.objects
WITH CHECK (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
    AND public.is_archive_asset_path(name)
);

ALTER POLICY "Archive admins can update assets"
ON storage.objects
WITH CHECK (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
    AND public.is_archive_asset_path(name)
);
