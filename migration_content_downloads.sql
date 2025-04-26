-- Create content_downloads table for tracking user downloads
CREATE TABLE IF NOT EXISTS content_downloads (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  downloaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_downloads_content_id ON content_downloads(content_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON content_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON content_downloads(downloaded_at DESC);

-- Create a unique index on content_id and user_id for the first download (for statistics)
-- Note: We still allow multiple downloads per user per content item in the table
-- But this helps us efficiently query if a user has downloaded something before
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_first_download 
ON content_downloads(content_id, user_id, (downloaded_at::DATE))
WHERE downloaded_at = (
  SELECT MIN(downloaded_at) 
  FROM content_downloads cd2 
  WHERE 
    cd2.content_id = content_downloads.content_id AND 
    cd2.user_id = content_downloads.user_id
);