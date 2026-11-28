-- New links require the elderly user's consent. Conversation access is opt-in.
ALTER TABLE family_relationships ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE family_relationships ALTER COLUMN can_view_conversations SET DEFAULT FALSE;
UPDATE family_relationships SET can_view_conversations=FALSE;
