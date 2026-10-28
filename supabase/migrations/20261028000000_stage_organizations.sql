CREATE TABLE public.stage_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category varchar(30) NOT NULL,
    parent_id varchar(255) NOT NULL,
    parent_label varchar(255) NOT NULL,
    edges jsonb NOT NULL DEFAULT '[]'::jsonb,
    stage_order jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stage_organizations_parent_unique UNIQUE (category, parent_id, parent_label)
);

CREATE INDEX idx_stage_organizations_category_parent
    ON public.stage_organizations(category, parent_id);

ALTER TABLE public.stage_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stage organizations are readable"
ON public.stage_organizations FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated users can insert stage organizations"
ON public.stage_organizations FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update stage organizations"
ON public.stage_organizations FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete stage organizations"
ON public.stage_organizations FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
