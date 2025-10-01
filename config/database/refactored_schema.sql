-- Refactored LMS Database Schema
-- Following proper normalization principles (1NF, 2NF, 3NF) and specification hierarchy
-- Institution → Departments → Semesters → Classes → Subjects → Exams → Students

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS file_uploads CASCADE;
DROP TABLE IF EXISTS question_bank_items CASCADE;
DROP TABLE IF EXISTS question_banks CASCADE;
DROP TABLE IF EXISTS question_attempts CASCADE;
DROP TABLE IF EXISTS exam_analytics CASCADE;
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS exam_sections CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS co_po_mappings CASCADE;
DROP TABLE IF EXISTS cos CASCADE;
DROP TABLE IF EXISTS pos CASCADE;
DROP TABLE IF EXISTS teacher_subjects CASCADE;
DROP TABLE IF EXISTS student_semester_enrollments CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'hod', 'teacher', 'student')),
    is_active BOOLEAN DEFAULT true,
    phone VARCHAR(20),
    address TEXT,
    profile_picture VARCHAR(255),
    student_id VARCHAR(20) UNIQUE,
    employee_id VARCHAR(20) UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(10),
    qualification VARCHAR(100),
    experience_years INTEGER DEFAULT 0,
    specializations TEXT[], -- Array for better normalization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. DEPARTMENTS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    hod_id INTEGER REFERENCES users(id),
    duration_years INTEGER DEFAULT 4,
    academic_year VARCHAR(10) NOT NULL,
    semester_count INTEGER DEFAULT 8,
    current_semester INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SEMESTERS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE semesters (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    semester_number INTEGER NOT NULL,
    academic_year VARCHAR(10) NOT NULL,
    name VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT false,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(semester_number, department_id, academic_year)
);

-- 4. CLASSES (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    section VARCHAR(2) NOT NULL,
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    class_teacher_id INTEGER REFERENCES users(id),
    cr_id INTEGER REFERENCES users(id),
    max_students INTEGER DEFAULT 60,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, semester_id)
);

-- 5. SUBJECTS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    credits INTEGER NOT NULL DEFAULT 3,
    theory_marks INTEGER NOT NULL DEFAULT 100,
    practical_marks INTEGER NOT NULL DEFAULT 0,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TEACHER_SUBJECTS (Junction table for many-to-many relationship)
CREATE TABLE teacher_subjects (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id),
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(teacher_id, subject_id, class_id)
);

-- 7. STUDENT_SEMESTER_ENROLLMENTS (Junction table for semester context)
CREATE TABLE student_semester_enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped', 'promoted')),
    final_grade VARCHAR(5),
    gpa DECIMAL(3,2) DEFAULT 0.0,
    attendance_percentage DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, semester_id)
);

-- 8. EXAMS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    exam_type VARCHAR(20) NOT NULL CHECK (exam_type IN ('internal', 'external', 'assignment', 'quiz', 'project')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'published', 'completed', 'archived')),
    total_marks INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 180,
    weightage DECIMAL(5,2) DEFAULT 1.0,
    calculation_rules JSONB,
    exam_date DATE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. EXAM_SECTIONS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE exam_sections (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    name VARCHAR(20) NOT NULL,
    instructions TEXT,
    total_marks INTEGER NOT NULL,
    total_questions INTEGER,
    questions_to_attempt INTEGER,
    section_type VARCHAR(20) DEFAULT 'standard',
    optional_questions INTEGER DEFAULT 0,
    mandatory_questions INTEGER DEFAULT 0,
    question_marks DECIMAL(5,2) DEFAULT 0.0,
    is_optional_section BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. QUESTIONS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    marks DECIMAL(5,2) NOT NULL,
    difficulty_level VARCHAR(10) NOT NULL CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    bloom_level VARCHAR(20) NOT NULL CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
    section_id INTEGER NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
    parent_question_id INTEGER REFERENCES questions(id),
    question_number VARCHAR(10),
    order_index INTEGER DEFAULT 0,
    is_optional BOOLEAN DEFAULT false,
    is_sub_question BOOLEAN DEFAULT false,
    sub_question_text TEXT,
    sub_question_marks DECIMAL(5,2),
    co_weight DECIMAL(3,2) DEFAULT 1.0,
    po_auto_mapped BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. COS (Course Outcomes) - 1NF, 2NF, 3NF compliant
CREATE TABLE cos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, subject_id)
);

-- 12. POS (Program Outcomes) - 1NF, 2NF, 3NF compliant
CREATE TABLE pos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, department_id)
);

-- 13. CO_PO_MAPPINGS (Junction table for many-to-many relationship)
CREATE TABLE co_po_mappings (
    id SERIAL PRIMARY KEY,
    co_id INTEGER NOT NULL REFERENCES cos(id) ON DELETE CASCADE,
    po_id INTEGER NOT NULL REFERENCES pos(id) ON DELETE CASCADE,
    mapping_strength DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(co_id, po_id)
);

-- 14. MARKS (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE marks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    exam_id INTEGER NOT NULL REFERENCES exams(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    marks_obtained DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    max_marks DECIMAL(5,2) NOT NULL,
    remarks TEXT,
    graded_by INTEGER REFERENCES users(id),
    graded_at TIMESTAMP WITH TIME ZONE,
    is_attempted BOOLEAN DEFAULT true,
    attempt_number INTEGER DEFAULT 1,
    is_best_attempt BOOLEAN DEFAULT false,
    is_counted_for_total BOOLEAN DEFAULT true,
    co_contribution DECIMAL(5,2) DEFAULT 0.0,
    po_contribution DECIMAL(5,2) DEFAULT 0.0,
    bloom_level VARCHAR(20),
    difficulty_level VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, exam_id, question_id, attempt_number)
);

-- 15. QUESTION_ATTEMPTS (Track multiple attempts for optional questions)
CREATE TABLE question_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    exam_id INTEGER NOT NULL REFERENCES exams(id),
    attempt_number INTEGER DEFAULT 1,
    marks_obtained DECIMAL(5,2) DEFAULT 0.0,
    max_marks DECIMAL(5,2) NOT NULL,
    is_best_attempt BOOLEAN DEFAULT false,
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    graded_by INTEGER REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, question_id, attempt_number)
);

-- 16. ATTENDANCE (1NF - Atomic values, 2NF - No partial dependencies)
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks TEXT,
    marked_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, subject_id, attendance_date)
);

-- 17. EXAM_ANALYTICS (Pre-computed analytics for performance)
CREATE TABLE exam_analytics (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id),
    student_id INTEGER REFERENCES users(id),
    section_id INTEGER REFERENCES exam_sections(id),
    co_id INTEGER REFERENCES cos(id),
    po_id INTEGER REFERENCES pos(id),
    total_marks DECIMAL(5,2) DEFAULT 0.0,
    obtained_marks DECIMAL(5,2) DEFAULT 0.0,
    percentage DECIMAL(5,2) DEFAULT 0.0,
    bloom_level VARCHAR(20),
    difficulty_level VARCHAR(10),
    co_attainment DECIMAL(5,2) DEFAULT 0.0,
    po_attainment DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. QUESTION_BANKS (Question repository)
CREATE TABLE question_banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    subject_id INTEGER REFERENCES subjects(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 19. QUESTION_BANK_ITEMS (Junction table for question banks)
CREATE TABLE question_bank_items (
    id SERIAL PRIMARY KEY,
    question_bank_id INTEGER NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    added_by INTEGER NOT NULL REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_bank_id, question_id)
);

-- 20. NOTIFICATIONS (System notifications)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 21. FILE_UPLOADS (File management)
CREATE TABLE file_uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. SYSTEM_LOGS (System monitoring)
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    module VARCHAR(100),
    user_id INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 23. AUDIT_LOGS (Audit trail)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_departments_hod ON departments(hod_id);
CREATE INDEX idx_semesters_department ON semesters(department_id);
CREATE INDEX idx_semesters_active ON semesters(is_active);
CREATE INDEX idx_classes_semester ON classes(semester_id);
CREATE INDEX idx_classes_department ON classes(department_id);
CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_subjects_semester ON subjects(semester_id);
CREATE INDEX idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX idx_teacher_subjects_subject ON teacher_subjects(subject_id);
CREATE INDEX idx_student_enrollments_student ON student_semester_enrollments(student_id);
CREATE INDEX idx_student_enrollments_semester ON student_semester_enrollments(semester_id);
CREATE INDEX idx_exams_subject ON exams(subject_id);
CREATE INDEX idx_exams_class ON exams(class_id);
CREATE INDEX idx_exams_semester ON exams(semester_id);
CREATE INDEX idx_questions_section ON questions(section_id);
CREATE INDEX idx_questions_parent ON questions(parent_question_id);
CREATE INDEX idx_marks_student ON marks(student_id);
CREATE INDEX idx_marks_exam ON marks(exam_id);
CREATE INDEX idx_marks_question ON marks(question_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_subject ON attendance(subject_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_exam_analytics_exam ON exam_analytics(exam_id);
CREATE INDEX idx_exam_analytics_student ON exam_analytics(student_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Add constraints for data integrity
ALTER TABLE exam_sections 
ADD CONSTRAINT chk_section_questions 
CHECK (mandatory_questions + optional_questions = total_questions);

ALTER TABLE questions 
ADD CONSTRAINT chk_question_marks 
CHECK (marks > 0);

ALTER TABLE question_attempts 
ADD CONSTRAINT chk_attempt_marks 
CHECK (marks_obtained >= 0 AND marks_obtained <= max_marks);

ALTER TABLE marks 
ADD CONSTRAINT chk_marks_range 
CHECK (marks_obtained >= 0 AND marks_obtained <= max_marks);

-- Add comments for documentation
COMMENT ON TABLE departments IS 'Academic departments with HOD assignments';
COMMENT ON TABLE semesters IS 'Academic semesters within departments';
COMMENT ON TABLE classes IS 'Classes within semesters with teacher and CR assignments';
COMMENT ON TABLE subjects IS 'Subjects offered in specific semesters';
COMMENT ON TABLE teacher_subjects IS 'Many-to-many relationship between teachers and subjects';
COMMENT ON TABLE student_semester_enrollments IS 'Student enrollment in semesters and classes';
COMMENT ON TABLE exams IS 'Exams conducted for subjects in specific classes';
COMMENT ON TABLE exam_sections IS 'Sections within exams (A, B, C) with optional question support';
COMMENT ON TABLE questions IS 'Questions with Bloom taxonomy and CO mapping';
COMMENT ON TABLE marks IS 'Student marks for questions with CO/PO contribution tracking';
COMMENT ON TABLE question_attempts IS 'Multiple attempts for optional questions with best attempt selection';
COMMENT ON TABLE attendance IS 'Student attendance tracking per subject';
COMMENT ON TABLE exam_analytics IS 'Pre-computed analytics for performance tracking';
COMMENT ON TABLE co_po_mappings IS 'Mapping between Course Outcomes and Program Outcomes';
