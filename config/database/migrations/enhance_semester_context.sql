-- Enhanced Semester Context and Missing Features Migration
-- This migration adds semester context throughout the system and implements missing features

-- Add semester_id to subjects table for better semester context
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS semester_id INTEGER;
ALTER TABLE subjects ADD CONSTRAINT fk_subjects_semester 
    FOREIGN KEY (semester_id) REFERENCES semesters(id);

-- Add semester_id to exams table for better semester context
ALTER TABLE exams ADD COLUMN IF NOT EXISTS semester_id INTEGER;
ALTER TABLE exams ADD CONSTRAINT fk_exams_semester 
    FOREIGN KEY (semester_id) REFERENCES semesters(id);

-- Add optional question support to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS parent_question_id INTEGER;
ALTER TABLE questions ADD CONSTRAINT fk_questions_parent 
    FOREIGN KEY (parent_question_id) REFERENCES questions(id);

-- Add exam weightage and calculation rules
ALTER TABLE exams ADD COLUMN IF NOT EXISTS weightage DECIMAL(5,2) DEFAULT 1.0;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS calculation_rules JSONB;

-- Add attendance tracking
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks TEXT,
    marked_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    FOREIGN KEY (marked_by) REFERENCES users(id),
    UNIQUE(student_id, subject_id, date)
);

-- Add student performance tracking
CREATE TABLE IF NOT EXISTS student_performance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    total_marks DECIMAL(5,2) DEFAULT 0.0,
    obtained_marks DECIMAL(5,2) DEFAULT 0.0,
    percentage DECIMAL(5,2) DEFAULT 0.0,
    grade VARCHAR(5),
    gpa DECIMAL(3,2) DEFAULT 0.0,
    attendance_percentage DECIMAL(5,2) DEFAULT 0.0,
    co_attainment JSONB,
    po_attainment JSONB,
    bloom_attainment JSONB,
    difficulty_mastery JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    UNIQUE(student_id, semester_id, subject_id)
);

-- Add CO/PO attainment tracking
CREATE TABLE IF NOT EXISTS co_attainment (
    id SERIAL PRIMARY KEY,
    co_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    attainment_percentage DECIMAL(5,2) DEFAULT 0.0,
    target_percentage DECIMAL(5,2) DEFAULT 70.0,
    student_count INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0.0,
    bloom_distribution JSONB,
    difficulty_distribution JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (co_id) REFERENCES cos(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    UNIQUE(co_id, semester_id, class_id, subject_id)
);

-- Add PO attainment tracking
CREATE TABLE IF NOT EXISTS po_attainment (
    id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    attainment_percentage DECIMAL(5,2) DEFAULT 0.0,
    target_percentage DECIMAL(5,2) DEFAULT 70.0,
    student_count INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0.0,
    co_contributions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (po_id) REFERENCES pos(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    UNIQUE(po_id, semester_id, class_id, department_id)
);

-- Add system monitoring tables
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Add user activity tracking
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    activity_description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    subject VARCHAR(200),
    body TEXT NOT NULL,
    variables JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add file management
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    file_type VARCHAR(50),
    uploaded_by INTEGER NOT NULL,
    department_id INTEGER,
    class_id INTEGER,
    subject_id INTEGER,
    semester_id INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_exams_semester ON exams(semester_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_student_performance_student_semester ON student_performance(student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_co_attainment_co_semester ON co_attainment(co_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_po_attainment_po_semester ON po_attainment(po_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_created ON user_activities(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- Update existing data to have proper semester context
UPDATE subjects SET semester_id = (
    SELECT s.id FROM semesters s 
    JOIN classes c ON c.semester_id = s.id 
    WHERE c.id = subjects.class_id 
    LIMIT 1
) WHERE semester_id IS NULL;

UPDATE exams SET semester_id = (
    SELECT s.id FROM semesters s 
    JOIN classes c ON c.semester_id = s.id 
    WHERE c.id = exams.class_id 
    LIMIT 1
) WHERE semester_id IS NULL;
