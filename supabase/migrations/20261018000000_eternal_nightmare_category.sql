ALTER TABLE public.archives
    DROP CONSTRAINT archives_category_check;
ALTER TABLE public.archives
    ADD CONSTRAINT archives_category_check
    CHECK (category IN ('MAIN_STORY', 'ETERNAL_NIGHTMARE', 'EVENT_STORY', 'INTERROGATION', 'PERSPECTRA'));
