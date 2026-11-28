ALTER TABLE chat_messages
    ADD COLUMN message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT' AFTER sender,
    ADD COLUMN image_base64 MEDIUMTEXT NULL AFTER content,
    ADD COLUMN image_mime_type VARCHAR(64) NULL AFTER image_base64;
