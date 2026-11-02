CREATE TABLE public.chronology_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date text NOT NULL DEFAULT '',
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    detail text NOT NULL DEFAULT '',
    icon text NOT NULL DEFAULT 'pi pi-bolt',
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chronology_entries_display_order
    ON public.chronology_entries(display_order, created_at);

CREATE FUNCTION public.set_chronology_entries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER chronology_entries_updated_at
BEFORE UPDATE ON public.chronology_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_chronology_entries_updated_at();

ALTER TABLE public.chronology_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.chronology_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chronology_entries TO authenticated;

CREATE POLICY "Chronology entries are readable"
ON public.chronology_entries FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated users can add chronology entries"
ON public.chronology_entries FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update chronology entries"
ON public.chronology_entries FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete chronology entries"
ON public.chronology_entries FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

INSERT INTO public.chronology_entries (event_date, title, detail, icon, display_order)
VALUES
    ('nf1', 'title 1', 'abc', 'pi pi-bolt', 0),
    ('nf1', 'title 1', 'abc', 'pi pi-bolt', 1),
    ('nf1', 'title 1', 'abc', 'pi pi-bolt', 2),
    ('nf1', 'title 1', 'abc', 'pi pi-bolt', 3),
    ('nf1', 'title 1', 'abc', 'pi pi-bolt', 4),
    ('nf1', 'title 1', 'abc', 'pi pi-bolt', 5);
