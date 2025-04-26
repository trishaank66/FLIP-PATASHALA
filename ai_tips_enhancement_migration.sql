-- Migration to enhance the il_ai_tips table with additional fields for context and source tracking

-- Adding new columns to il_ai_tips
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS source_id INTEGER;
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS relevance_score REAL DEFAULT 0.7;
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS action_link TEXT;
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;
ALTER TABLE il_ai_tips ADD COLUMN IF NOT EXISTS ui_style TEXT DEFAULT 'standard';

-- Add indices for faster querying
CREATE INDEX IF NOT EXISTS il_ai_tips_user_id_idx ON il_ai_tips(user_id);
CREATE INDEX IF NOT EXISTS il_ai_tips_type_idx ON il_ai_tips(type);
CREATE INDEX IF NOT EXISTS il_ai_tips_is_read_idx ON il_ai_tips(is_read);
CREATE INDEX IF NOT EXISTS il_ai_tips_source_type_idx ON il_ai_tips(source_type);