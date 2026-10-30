ALTER TABLE public.chapters
    ADD COLUMN IF NOT EXISTS name_translations jsonb NOT NULL DEFAULT '{}'::jsonb;
