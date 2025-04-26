-- Add is_active column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  performed_by INTEGER NOT NULL REFERENCES users(id),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);