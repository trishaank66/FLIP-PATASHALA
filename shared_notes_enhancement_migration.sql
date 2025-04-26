-- Migration to enhance shared notes functionality
-- Adding sketch support and tagging capabilities

-- Modify il_shared_notes table to better support sessions
ALTER TABLE il_shared_notes 
ADD COLUMN is_active_session BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN ends_at TIMESTAMP NULL;

-- Modify il_note_contributions table to support different types of contributions
ALTER TABLE il_note_contributions 
ADD COLUMN content_type VARCHAR(10) NOT NULL DEFAULT 'text',  -- 'text' or 'sketch'
ADD COLUMN sketch_data TEXT NULL,  -- Base64 encoded image data
ADD COLUMN tags TEXT[] NULL,  -- Array of auto-generated tags
ADD COLUMN ai_processed BOOLEAN NOT NULL DEFAULT false;  -- Flag for AI processing status

-- Create index to improve query performance
CREATE INDEX idx_note_contributions_note_id ON il_note_contributions(note_id);
CREATE INDEX idx_note_contributions_user_id ON il_note_contributions(user_id);
CREATE INDEX idx_shared_notes_subject ON il_shared_notes(subject);
CREATE INDEX idx_shared_notes_active_session ON il_shared_notes(is_active_session);