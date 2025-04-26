-- Forum Module Migration

-- Create the forum posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS il_forum_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_by INTEGER REFERENCES users(id),
  content_id INTEGER REFERENCES content(id),
  department_id INTEGER REFERENCES departments(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create the forum replies table if it doesn't exist
CREATE TABLE IF NOT EXISTS il_forum_replies (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES il_forum_posts(id),
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create the forum insights table if it doesn't exist
CREATE TABLE IF NOT EXISTS il_forum_insights (
  id SERIAL PRIMARY KEY,
  subject_faculty TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_forum_posts_subject ON il_forum_posts(subject);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON il_forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_department ON il_forum_posts(department_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_pinned ON il_forum_posts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON il_forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_user ON il_forum_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_insights_subject ON il_forum_insights(subject_faculty);
CREATE INDEX IF NOT EXISTS idx_forum_insights_read ON il_forum_insights(is_read);