-- Create content_views table for tracking content views by users
CREATE TABLE IF NOT EXISTS content_views (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- Create an index for efficient querying of content views
CREATE INDEX IF NOT EXISTS idx_content_views_content_id ON content_views(content_id);
CREATE INDEX IF NOT EXISTS idx_content_views_user_id ON content_views(user_id);