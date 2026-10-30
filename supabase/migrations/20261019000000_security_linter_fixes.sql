ALTER FUNCTION public.is_archive_admin()
SET search_path = '';
ALTER FUNCTION public.transcript_search_text(jsonb)
SET search_path = '';
ALTER FUNCTION public.transcript_search_vector(jsonb)
SET search_path = '';
ALTER FUNCTION public.search_transcripts(text, integer)
SET search_path = '';
DROP POLICY IF EXISTS "Archive assets are publicly readable"
ON storage.objects;
