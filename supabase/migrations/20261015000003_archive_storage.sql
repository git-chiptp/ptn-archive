INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'archive-assets',
    'archive-assets',
    true,
    10485760,
    ARRAY['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Archive assets are publicly readable"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'archive-assets');

CREATE POLICY "Archive admins can upload assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
);

CREATE POLICY "Archive admins can update assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
)
WITH CHECK (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
);

CREATE POLICY "Archive admins can delete assets"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'archive-assets'
    AND public.is_archive_admin()
);
