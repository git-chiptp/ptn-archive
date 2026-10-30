ALTER TABLE public.media_folders
ADD COLUMN parent_id uuid REFERENCES public.media_folders(id) ON DELETE SET NULL;
CREATE INDEX media_folders_parent_id_name_idx
ON public.media_folders (parent_id, lower(btrim(name)));
DROP INDEX IF EXISTS media_folders_name_unique_idx;
CREATE UNIQUE INDEX media_folders_root_name_unique_idx
ON public.media_folders (lower(btrim(name)))
WHERE parent_id IS NULL;
CREATE UNIQUE INDEX media_folders_sibling_name_unique_idx
ON public.media_folders (parent_id, lower(btrim(name)))
WHERE parent_id IS NOT NULL;
UPDATE public.media_folders
SET parent_id = NULL
WHERE parent_id = id;
CREATE OR REPLACE FUNCTION public.prevent_media_folder_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    ancestor uuid;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'A media folder cannot be its own parent.';
    END IF;

    ancestor := NEW.parent_id;
    WHILE ancestor IS NOT NULL LOOP
        IF ancestor = NEW.id THEN
            RAISE EXCEPTION 'A media folder cannot be moved inside its descendant.';
        END IF;
        SELECT parent_id INTO ancestor
        FROM public.media_folders
        WHERE id = ancestor;
        IF NOT FOUND THEN
            ancestor := NULL;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;
CREATE TRIGGER media_folders_prevent_cycle
BEFORE INSERT OR UPDATE OF parent_id ON public.media_folders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_media_folder_cycle();
