-- Add likes_percent column to content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS likes_percent INTEGER DEFAULT 0;

-- Update existing content items with calculated likes_percent
UPDATE content 
SET likes_percent = 
  CASE 
    WHEN views > 0 THEN 
      LEAST(100, GREATEST(0, (downloads * 100) / NULLIF(views, 0)))
    ELSE 0
  END;