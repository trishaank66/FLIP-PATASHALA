
-- Test Users (Students)
INSERT INTO users (email, password, role, role_id, department_id, first_name, last_name, verification_pending, is_active)
VALUES 
('priya.sharma@flippedpatashala.com', '$2b$10$dummyhashforpriya', 'student', 'S001', 1, 'Priya', 'Sharma', false, true),
('arjun.mehta@flippedpatashala.com', '$2b$10$dummyhashforarjun', 'student', 'S002', 2, 'Arjun', 'Mehta', false, true);

-- Test Users (Faculty)
INSERT INTO users (email, password, role, role_id, department_id, first_name, last_name, verification_pending, is_active) 
VALUES
('prof.rao@flippedpatashala.com', '$2b$10$dummyhashforrao', 'faculty', 'F001', 1, 'Professor', 'Rao', false, true),
('dr.meena@flippedpatashala.com', '$2b$10$dummyhashformeena', 'faculty', 'F002', 2, 'Dr', 'Meena', false, true);

-- Test Users (Admin)
INSERT INTO users (email, password, role, role_id, verification_pending, is_active)
VALUES 
('admin.kumar@flippedpatashala.com', '$2b$10$dummyhashforkumar', 'admin', 'A001', false, true),
('admin.lal@flippedpatashala.com', '$2b$10$dummyhashforlal', 'admin', 'A002', false, true);

-- Test Content
INSERT INTO content (title, type, filename, url, uploaded_by, dept_id, tags, views, downloads, likes_percent)
VALUES
('Introduction to Python', 'video', 'Video1.mp4', '/files/video1.mp4', 
 (SELECT id FROM users WHERE role_id = 'F001'), 1, 
 ARRAY['Python', 'Video'], 10, 5, 65),
('Circuit Fundamentals', 'pdf', 'Notes.pdf', '/files/notes.pdf',
 (SELECT id FROM users WHERE role_id = 'F002'), 3,
 ARRAY['Circuits', 'PDF'], 8, 3, 50);
