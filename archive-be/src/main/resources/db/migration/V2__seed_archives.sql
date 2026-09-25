INSERT INTO archives (title, description, transcript_text, status, recorded_at)
VALUES
 ('Archive system introduction', 'Example seeded archive record.', 'This is sample transcript text for local development.', 'PUBLISHED', now() - interval '2 days'),
 ('Unpublished interview draft', 'Example draft record. Remove or replace this migration before production.', 'Draft transcript content.', 'DRAFT', now() - interval '1 day');
