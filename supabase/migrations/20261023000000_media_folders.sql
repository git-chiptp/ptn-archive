CREATE TABLE public.media_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) > 0 AND length(btrim(name)) <= 100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_folders_name_unique_idx
ON public.media_folders (lower(btrim(name)));

CREATE INDEX media_folders_created_at_idx
ON public.media_folders (created_at ASC, id);

ALTER TABLE public.media_assets
ADD COLUMN folder_id uuid REFERENCES public.media_folders(id) ON DELETE SET NULL;

CREATE INDEX media_assets_folder_id_idx
ON public.media_assets (folder_id, created_at DESC, id);

CREATE FUNCTION public.set_media_folders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER media_folders_updated_at
BEFORE UPDATE ON public.media_folders
FOR EACH ROW
EXECUTE FUNCTION public.set_media_folders_updated_at();

ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.media_folders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_folders TO authenticated;

CREATE POLICY "Authenticated users can read media folders"
ON public.media_folders FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert media folders"
ON public.media_folders FOR INSERT TO authenticated
WITH CHECK (public.is_archive_admin());

CREATE POLICY "Admins can update media folders"
ON public.media_folders FOR UPDATE TO authenticated
USING (public.is_archive_admin())
WITH CHECK (public.is_archive_admin());

CREATE POLICY "Admins can delete media folders"
ON public.media_folders FOR DELETE TO authenticated
USING (public.is_archive_admin());
