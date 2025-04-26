-- Interactive Learning Quizzes Enhancement Migration

-- Add new columns to il_quizzes table
ALTER TABLE il_quizzes 
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_adaptive BOOLEAN NOT NULL DEFAULT true;

-- Add a new column to content table to indicate if a handout has a quiz
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS has_quiz BOOLEAN NOT NULL DEFAULT false;

-- Create an index for quiz attempts to ensure one-time attempts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON il_quiz_attempts(quiz_id, student_id);

-- Add indexes for quiz filtering by enabled/published status
CREATE INDEX IF NOT EXISTS idx_il_quizzes_enabled_published ON il_quizzes(is_enabled, is_published);

-- Add an index for content with quizzes
CREATE INDEX IF NOT EXISTS idx_content_has_quiz ON content(has_quiz);