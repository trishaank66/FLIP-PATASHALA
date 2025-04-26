-- Polls Module Migration

-- Create the polls table if it doesn't exist
CREATE TABLE IF NOT EXISTS il_polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  content_id INTEGER REFERENCES content(id),
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  timer_duration INTEGER NOT NULL DEFAULT 30,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create the poll votes table to track individual votes
CREATE TABLE IF NOT EXISTS il_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES il_polls(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_il_polls_subject ON il_polls(subject);
CREATE INDEX IF NOT EXISTS idx_il_polls_created_by ON il_polls(created_by);
CREATE INDEX IF NOT EXISTS idx_il_polls_department_id ON il_polls(department_id);
CREATE INDEX IF NOT EXISTS idx_il_polls_is_active ON il_polls(is_active);
CREATE INDEX IF NOT EXISTS idx_il_poll_votes_poll_id ON il_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_il_poll_votes_user_id ON il_poll_votes(user_id);