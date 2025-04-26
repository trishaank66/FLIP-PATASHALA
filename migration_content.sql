-- Content Management Module - Part 1
-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(255) NOT NULL,
  faculty VARCHAR(255),
  type VARCHAR(255) NOT NULL, -- video, note, slideshow, application/pdf, etc
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  dept_id INTEGER REFERENCES departments(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample content for testing, linked to existing departments
INSERT INTO content (title, subject, faculty, type, filename, url, uploaded_by, dept_id)
VALUES 
('Introduction to Algorithms', 'Algorithms', 'Prof. Smith', 'video', 'algo_intro.mp4', '/content/algo_intro.mp4', 40, 1),
('Data Structures Overview', 'Data Structures', 'Prof. Johnson', 'notes', 'ds_overview.pdf', '/content/ds_overview.pdf', 40, 1),
('Database Systems Fundamentals', 'Database Systems', 'Prof. Wilson', 'slideshow', 'db_fundamentals.pptx', '/content/db_fundamentals.pptx', 40, 2),
('Machine Learning Basics', 'AI & ML', 'Prof. Garcia', 'video', 'ml_basics.mp4', '/content/ml_basics.mp4', 40, 3),
('Network Security Principles', 'Cyber Security', 'Prof. Chen', 'notes', 'security_principles.pdf', '/content/security_principles.pdf', 40, 4);