CREATE OR REPLACE FUNCTION public.is_archive_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin',
    false
  );
$$;
CREATE POLICY "Admins can read archives"
ON public.archives FOR SELECT TO authenticated
USING (public.is_archive_admin());
CREATE POLICY "Admins can insert archives"
ON public.archives FOR INSERT TO authenticated
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can update archives"
ON public.archives FOR UPDATE TO authenticated
USING (public.is_archive_admin())
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can delete archives"
ON public.archives FOR DELETE TO authenticated
USING (public.is_archive_admin());
CREATE POLICY "Admins can read translations"
ON public.archive_translations FOR SELECT TO authenticated
USING (public.is_archive_admin());
CREATE POLICY "Admins can insert translations"
ON public.archive_translations FOR INSERT TO authenticated
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can update translations"
ON public.archive_translations FOR UPDATE TO authenticated
USING (public.is_archive_admin())
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can delete translations"
ON public.archive_translations FOR DELETE TO authenticated
USING (public.is_archive_admin());
CREATE POLICY "Admins can read chapters"
ON public.chapters FOR SELECT TO authenticated
USING (public.is_archive_admin());
CREATE POLICY "Admins can insert chapters"
ON public.chapters FOR INSERT TO authenticated
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can update chapters"
ON public.chapters FOR UPDATE TO authenticated
USING (public.is_archive_admin())
WITH CHECK (public.is_archive_admin());
CREATE POLICY "Admins can delete chapters"
ON public.chapters FOR DELETE TO authenticated
USING (public.is_archive_admin());
