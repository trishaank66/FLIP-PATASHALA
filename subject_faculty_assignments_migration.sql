-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  department_id INTEGER REFERENCES departments(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create subject_faculty_assignments table
CREATE TABLE IF NOT EXISTS subject_faculty_assignments (
  id SERIAL PRIMARY KEY,
  faculty_id INTEGER NOT NULL REFERENCES users(id),
  subject_name VARCHAR(255) NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(faculty_id, subject_name, department_id)
);