-- Create faculty_content_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS faculty_content_permissions (
  id SERIAL PRIMARY KEY,
  faculty_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  review_notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Update audit_logs table if affected_user_id column doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'affected_user_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN affected_user_id INTEGER REFERENCES users(id);
  END IF;
END $$;

-- Update audit_logs table if ip_address column doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;
  END IF;
END $$;