-- Interactive Learning Module Column Fix Migration

-- Fix il_forum_posts column name discrepancy
ALTER TABLE il_forum_posts RENAME COLUMN content_text TO content;

-- Fix il_shared_notes column name discrepancy
ALTER TABLE il_shared_notes RENAME COLUMN note_content TO content;

-- Add any missing indexes
CREATE INDEX IF NOT EXISTS idx_il_quiz_attempts_quiz ON il_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_il_quiz_attempts_student ON il_quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_il_forum_replies_post ON il_forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_il_poll_votes_poll ON il_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_il_note_contributions_note ON il_note_contributions(note_id);