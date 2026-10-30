CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE TABLE public.media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
    object_key text NOT NULL CHECK (length(btrim(object_key)) > 0),
    provider text NOT NULL CHECK (provider IN ('supabase', 'r2')),
    mime_type text NOT NULL,
    byte_size bigint NOT NULL CHECK (byte_size > 0),
    original_url text,
    attribution text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT media_assets_object_key_unique UNIQUE (object_key)
);
CREATE INDEX media_assets_display_name_search_idx
ON public.media_assets USING gin (display_name extensions.gin_trgm_ops);
CREATE INDEX media_assets_created_at_idx
ON public.media_assets (created_at DESC, id);
CREATE FUNCTION public.set_media_assets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
CREATE TRIGGER media_assets_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.set_media_assets_updated_at();
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
