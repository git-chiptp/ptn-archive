INSERT INTO archive_translations (archive_id, language_code, title, description, transcript_text, translation_status, translation_source, translated_by)
SELECT id, 'vi', 'Giới thiệu hệ thống lưu trữ', 'Bản ghi mẫu bằng tiếng Việt cho môi trường phát triển.', 'Đây là nội dung bản ghi mẫu để phát triển cục bộ.', 'PUBLISHED', 'HUMAN', 'archive-demo'
FROM archives WHERE title = 'Archive system introduction'
ON CONFLICT (archive_id, language_code) DO NOTHING;

INSERT INTO archive_translations (archive_id, language_code, title, description, transcript_text, translation_status, translation_source, translated_by)
SELECT id, 'vi', 'Bản nháp cuộc phỏng vấn chưa công bố', 'Bản ghi nháp mẫu bằng tiếng Việt.', 'Nội dung bản ghi nháp.', 'DRAFT', 'HUMAN', 'archive-demo'
FROM archives WHERE title = 'Unpublished interview draft'
ON CONFLICT (archive_id, language_code) DO NOTHING;
