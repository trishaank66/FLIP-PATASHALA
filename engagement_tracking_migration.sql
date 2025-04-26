-- Engagement Tracking System Migration

-- User Engagement table - tracks interaction counts and stars
CREATE TABLE IF NOT EXISTS user_engagement (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  count INTEGER DEFAULT 0,
  stars_earned INTEGER DEFAULT 0,
  previous_week_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Engagement History table - tracks individual interaction events
CREATE TABLE IF NOT EXISTS engagement_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  interaction_type TEXT NOT NULL,  -- 'quiz', 'forum_post', 'poll_vote'
  content_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_engagement_user_id ON user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_user_id ON engagement_history(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_created_at ON engagement_history(created_at);