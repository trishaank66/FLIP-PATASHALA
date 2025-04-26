-- Add downloads column to the content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS downloads INTEGER NOT NULL DEFAULT 0;