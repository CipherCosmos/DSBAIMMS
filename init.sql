-- Create main database
CREATE DATABASE lms_db;
\c lms_db;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table with roles
CREATE TYPE user_role AS ENUM ('admin', 'hod', 'teacher', 'student');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    phone VARCHAR(20),
    address TEXT,
    profile_picture VARCHAR(255),
    student_id VARCHAR(20) UNIQUE,
    employee_id VARCHAR(20) UNIQUE,
    department_id INTEGER,
    class_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Departments table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT,
    hod_id INTEGER,
    duration_years INTEGER DEFAULT 4,
    academic_year VARCHAR(9) NOT NULL,
    semester_count INTEGER DEFAULT 8,
    current_semester INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classes table
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    section VARCHAR(2) NOT NULL,
    department_id INTEGER NOT NULL,
    class_teacher_id INTEGER,
    cr_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (class_teacher_id) REFERENCES users(id),
    FOREIGN KEY (cr_id) REFERENCES users(id)
);

-- Subjects table
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    credits INTEGER DEFAULT 3,
    theory_marks INTEGER DEFAULT 100,
    practical_marks INTEGER DEFAULT 0,
    department_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Program Outcomes (POs)
CREATE TABLE pos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Course Outcomes (COs)
CREATE TABLE cos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- CO-PO Mapping
CREATE TABLE co_po_mappings (
    id SERIAL PRIMARY KEY,
    co_id INTEGER NOT NULL,
    po_id INTEGER NOT NULL,
    mapping_strength DECIMAL(3,1) DEFAULT 1.0 CHECK (mapping_strength BETWEEN 0 AND 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (co_id) REFERENCES cos(id),
    FOREIGN KEY (po_id) REFERENCES pos(id),
    UNIQUE(co_id, po_id)
);

-- Exams
CREATE TYPE exam_type AS ENUM ('internal', 'external', 'assignment', 'quiz', 'project');
CREATE TYPE exam_status AS ENUM ('draft', 'published', 'completed', 'archived');

CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    exam_type exam_type DEFAULT 'internal',
    status exam_status DEFAULT 'draft',
    total_marks INTEGER NOT NULL,
    duration_minutes INTEGER DEFAULT 180,
    exam_date TIMESTAMP WITH TIME ZONE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Exam Sections
CREATE TABLE exam_sections (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL,
    name VARCHAR(20) NOT NULL,
    instructions TEXT,
    total_marks INTEGER NOT NULL,
    total_questions INTEGER,
    questions_to_attempt INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (exam_id) REFERENCES exams(id)
);

-- Questions
CREATE TYPE bloom_level AS ENUM ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    marks DECIMAL(5,2) NOT NULL,
    bloom_level bloom_level NOT NULL,
    difficulty_level difficulty_level DEFAULT 'medium',
    section_id INTEGER NOT NULL,
    co_id INTEGER NOT NULL,
    parent_question_id INTEGER,
    question_number VARCHAR(10),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (section_id) REFERENCES exam_sections(id),
    FOREIGN KEY (co_id) REFERENCES cos(id),
    FOREIGN KEY (parent_question_id) REFERENCES questions(id)
);

-- Marks
CREATE TABLE marks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    marks_obtained DECIMAL(5,2) DEFAULT 0.0,
    max_marks DECIMAL(5,2) NOT NULL,
    remarks TEXT,
    graded_by INTEGER,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (graded_by) REFERENCES users(id),
    UNIQUE(student_id, exam_id, question_id)
);

-- Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add foreign key constraints
ALTER TABLE users ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES departments(id);
ALTER TABLE users ADD CONSTRAINT fk_user_class FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE departments ADD CONSTRAINT fk_department_hod FOREIGN KEY (hod_id) REFERENCES users(id);

-- Create indexes for performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_class ON users(class_id);
CREATE INDEX idx_classes_department ON classes(department_id);
CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_subjects_class ON subjects(class_id);
CREATE INDEX idx_subjects_teacher ON subjects(teacher_id);
CREATE INDEX idx_exams_subject ON exams(subject_id);
CREATE INDEX idx_exams_class ON exams(class_id);
CREATE INDEX idx_marks_student ON marks(student_id);
CREATE INDEX idx_marks_exam ON marks(exam_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Insert sample data
INSERT INTO departments (name, code, description) VALUES 
('Computer Science and Engineering', 'CSE', 'Department of Computer Science and Engineering'),
('Electronics and Communication Engineering', 'ECE', 'Department of Electronics and Communication Engineering'),
('Mechanical Engineering', 'MECH', 'Department of Mechanical Engineering');

-- Insert admin user
INSERT INTO users (username, email, full_name, hashed_password, role, employee_id) VALUES
('admin', 'admin@lms.edu', 'System Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewtsNcLKPZ0hLsZm', 'admin', 'ADM001');

-- Insert sample HOD
INSERT INTO users (username, email, full_name, hashed_password, role, department_id, employee_id) VALUES
('hod_cse', 'hod.cse@lms.edu', 'Dr. John Smith', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewtsNcLKPZ0hLsZm', 'hod', 1, 'HOD001');

-- Update department HOD
UPDATE departments SET hod_id = 2 WHERE id = 1;

-- Insert sample teacher
INSERT INTO users (username, email, full_name, hashed_password, role, department_id, employee_id) VALUES
('teacher1', 'teacher1@lms.edu', 'Prof. Jane Doe', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewtsNcLKPZ0hLsZm', 'teacher', 1, 'TEA001');

-- Insert sample class
INSERT INTO classes (name, year, semester, section, department_id, class_teacher_id) VALUES
('CSE-A-2024', 2024, 1, 'A', 1, 3);

-- Insert sample student
INSERT INTO users (username, email, full_name, hashed_password, role, department_id, class_id, student_id) VALUES
('student1', 'student1@lms.edu', 'Alice Johnson', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewtsNcLKPZ0hLsZm', 'student', 1, 1, 'CSE2024001');

-- Insert sample subject
INSERT INTO subjects (name, code, department_id, class_id, teacher_id) VALUES
('Data Structures and Algorithms', 'CS201', 1, 1, 3);

-- Insert sample POs
INSERT INTO pos (name, description, department_id) VALUES
('PO1', 'Engineering knowledge: Apply the knowledge of mathematics, science, engineering fundamentals', 1),
('PO2', 'Problem analysis: Identify, formulate, review research literature, and analyze complex engineering problems', 1),
('PO3', 'Design/development of solutions: Design solutions for complex engineering problems', 1);

-- Insert sample COs
INSERT INTO cos (name, description, subject_id, department_id) VALUES
('CO1', 'Understand basic data structures and their operations', 1, 1),
('CO2', 'Analyze time and space complexity of algorithms', 1, 1),
('CO3', 'Design efficient algorithms for problem solving', 1, 1);

-- Insert CO-PO mappings
INSERT INTO co_po_mappings (co_id, po_id, mapping_strength) VALUES
(1, 1, 3.0), (1, 2, 2.0),
(2, 1, 2.0), (2, 2, 3.0),
(3, 2, 3.0), (3, 3, 3.0);

-- Create question_banks table
CREATE TABLE IF NOT EXISTS question_banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    subject_id INTEGER REFERENCES subjects(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create question_bank_items table
CREATE TABLE IF NOT EXISTS question_bank_items (
    id SERIAL PRIMARY KEY,
    question_bank_id INTEGER NOT NULL REFERENCES question_banks(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    added_by INTEGER NOT NULL REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create file_uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    module VARCHAR(100),
    user_id INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_sub_question BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sub_question_text TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sub_question_marks DECIMAL(5,2);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_question_banks_department_id ON question_banks(department_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_subject_id ON question_banks(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_created_by ON question_banks(created_by);
CREATE INDEX IF NOT EXISTS idx_question_bank_items_question_bank_id ON question_bank_items(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_items_question_id ON question_bank_items(question_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_uploads_entity_type_id ON file_uploads(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);