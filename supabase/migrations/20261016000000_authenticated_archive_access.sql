-- Trial policy: every authenticated Supabase user has the same archive
-- permissions as the former admin role. Anonymous users remain read-only.
CREATE OR REPLACE FUNCTION public.is_archive_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;
