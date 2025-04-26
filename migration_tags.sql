-- Add tags column to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];