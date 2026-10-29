CREATE TABLE public.glossary_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX glossary_tags_name_lower_unique
    ON public.glossary_tags (lower(btrim(name)));

CREATE TABLE public.glossary_term_tags (
    glossary_term_id uuid NOT NULL REFERENCES public.glossary_terms(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.glossary_tags(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (glossary_term_id, tag_id)
);

CREATE INDEX idx_glossary_term_tags_tag_id
    ON public.glossary_term_tags(tag_id);

ALTER TABLE public.glossary_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossary_term_tags ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.glossary_tags, public.glossary_term_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.glossary_tags, public.glossary_term_tags TO authenticated;

CREATE POLICY "Glossary tags are readable"
ON public.glossary_tags FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated users can add glossary tags"
ON public.glossary_tags FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update glossary tags"
ON public.glossary_tags FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete glossary tags"
ON public.glossary_tags FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Glossary term tags are readable"
ON public.glossary_term_tags FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated users can add glossary term tags"
ON public.glossary_term_tags FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete glossary term tags"
ON public.glossary_term_tags FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
