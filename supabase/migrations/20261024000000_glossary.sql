CREATE TABLE public.glossary_terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    english text NOT NULL CHECK (length(btrim(english)) > 0),
    chinese text NOT NULL CHECK (length(btrim(chinese)) > 0),
    vietnamese text NOT NULL CHECK (length(btrim(vietnamese)) > 0),
    detail text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_glossary_terms_english ON public.glossary_terms(english);
ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.glossary_terms TO anon, authenticated;
GRANT INSERT ON public.glossary_terms TO authenticated;
CREATE POLICY "Glossary terms are readable"
ON public.glossary_terms FOR SELECT TO anon, authenticated
USING (true);
CREATE POLICY "Authenticated users can add glossary terms"
ON public.glossary_terms FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
