-- Add subject_faculty_assignment_id column to content table
ALTER TABLE content ADD COLUMN subject_faculty_assignment_id INTEGER REFERENCES subject_faculty_assignments(id);

-- Create an index on subject_faculty_assignment_id for better query performance
CREATE INDEX idx_content_subject_faculty_assignment ON content(subject_faculty_assignment_id);