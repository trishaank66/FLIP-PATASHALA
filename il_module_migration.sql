
-- Interactive Learning Module Database Migration

-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS il_ai_tips CASCADE;
DROP TABLE IF EXISTS il_user_interactions CASCADE;
DROP TABLE IF EXISTS il_note_contributions CASCADE;
DROP TABLE IF EXISTS il_shared_notes CASCADE;
DROP TABLE IF EXISTS il_poll_votes CASCADE;
DROP TABLE IF EXISTS il_polls CASCADE;
DROP TABLE IF EXISTS il_forum_replies CASCADE;
DROP TABLE IF EXISTS il_forum_posts CASCADE;
DROP TABLE IF EXISTS il_quiz_attempts CASCADE;
DROP TABLE IF EXISTS il_quizzes CASCADE;

-- Quizzes table for storing adaptive quiz content
CREATE TABLE IF NOT EXISTS il_quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_id INTEGER REFERENCES content(id),
  subject TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_by INTEGER NOT NULL REFERENCES users(id),
  questions JSONB NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  department_id INTEGER REFERENCES departments(id)
);

-- Quiz attempts by students
CREATE TABLE IF NOT EXISTS il_quiz_attempts (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES il_quizzes(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  score DOUBLE PRECISION NOT NULL,
  answers JSONB NOT NULL,
  time_taken INTEGER,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  difficulty_level TEXT NOT NULL
);

-- Discussion Forum Posts
CREATE TABLE IF NOT EXISTS il_forum_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  pinned_by INTEGER REFERENCES users(id),
  content_id INTEGER REFERENCES content(id),
  department_id INTEGER REFERENCES departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Forum Replies
CREATE TABLE IF NOT EXISTS il_forum_replies (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES il_forum_posts(id),
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Polls
CREATE TABLE IF NOT EXISTS il_polls (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  department_id INTEGER REFERENCES departments(id)
);

-- Poll votes
CREATE TABLE IF NOT EXISTS il_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES il_polls(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Shared Notes
CREATE TABLE IF NOT EXISTS il_shared_notes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  department_id INTEGER REFERENCES departments(id),
  content_id INTEGER REFERENCES content(id)
);

-- Note Contributions
CREATE TABLE IF NOT EXISTS il_note_contributions (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES il_shared_notes(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  contributed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Interactions Tracker
CREATE TABLE IF NOT EXISTS il_user_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  interaction_type TEXT NOT NULL,
  interaction_id INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  interaction_details JSONB
);

-- AI Tips
CREATE TABLE IF NOT EXISTS il_ai_tips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_helpful BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_il_quizzes_dept ON il_quizzes(department_id);
CREATE INDEX idx_il_forum_posts_dept ON il_forum_posts(department_id);
CREATE INDEX idx_il_polls_dept ON il_polls(department_id);
CREATE INDEX idx_il_shared_notes_dept ON il_shared_notes(department_id);
CREATE INDEX idx_il_user_interactions_user ON il_user_interactions(user_id);
CREATE INDEX idx_il_ai_tips_user ON il_ai_tips(user_id);
