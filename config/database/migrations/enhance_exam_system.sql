-- Enhanced Exam System Migration
-- This migration adds support for optional questions, sub-questions, and enhanced exam structure

-- Add new columns to exam_sections table
ALTER TABLE exam_sections 
ADD COLUMN IF NOT EXISTS section_type VARCHAR(20) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS optional_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mandatory_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS question_marks DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS is_optional_section BOOLEAN DEFAULT FALSE;

-- Add new columns to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sub_question BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sub_question_text TEXT,
ADD COLUMN IF NOT EXISTS sub_question_marks DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS co_weight DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS po_auto_mapped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Add new columns to marks table for enhanced tracking
ALTER TABLE marks 
ADD COLUMN IF NOT EXISTS is_attempted BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_best_attempt BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS co_contribution DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS po_contribution DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS bloom_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20);

-- Create exam_analytics table for storing pre-computed analytics
CREATE TABLE IF NOT EXISTS exam_analytics (
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
    difficulty_level VARCHAR(20),
    co_attainment DECIMAL(5,2) DEFAULT 0.0,
    po_attainment DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create question_attempts table for tracking multiple attempts
CREATE TABLE IF NOT EXISTS question_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    exam_id INTEGER NOT NULL REFERENCES exams(id),
    attempt_number INTEGER DEFAULT 1,
    marks_obtained DECIMAL(5,2) DEFAULT 0.0,
    max_marks DECIMAL(5,2) NOT NULL,
    is_best_attempt BOOLEAN DEFAULT FALSE,
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    graded_by INTEGER REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_optional ON questions(is_optional);
CREATE INDEX IF NOT EXISTS idx_questions_sub_question ON questions(is_sub_question);
CREATE INDEX IF NOT EXISTS idx_questions_co_weight ON questions(co_weight);
CREATE INDEX IF NOT EXISTS idx_marks_attempted ON marks(is_attempted);
CREATE INDEX IF NOT EXISTS idx_marks_best_attempt ON marks(is_best_attempt);
CREATE INDEX IF NOT EXISTS idx_question_attempts_student ON question_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question ON question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_best ON question_attempts(is_best_attempt);
CREATE INDEX IF NOT EXISTS idx_exam_analytics_exam ON exam_analytics(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_analytics_student ON exam_analytics(student_id);

-- Update existing data to set default values
UPDATE exam_sections SET 
    section_type = 'standard',
    optional_questions = 0,
    mandatory_questions = COALESCE(total_questions, 0),
    question_marks = CASE 
        WHEN total_questions > 0 THEN total_marks / total_questions 
        ELSE 0 
    END
WHERE section_type IS NULL;

UPDATE questions SET 
    is_optional = FALSE,
    is_sub_question = FALSE,
    co_weight = 1.0,
    po_auto_mapped = FALSE
WHERE is_optional IS NULL;

UPDATE marks SET 
    is_attempted = TRUE,
    attempt_number = 1,
    is_best_attempt = TRUE
WHERE is_attempted IS NULL;

-- Add constraints
ALTER TABLE exam_sections 
ADD CONSTRAINT chk_section_questions 
CHECK (mandatory_questions + optional_questions = total_questions);

ALTER TABLE questions 
ADD CONSTRAINT chk_question_marks 
CHECK (marks > 0);

ALTER TABLE question_attempts 
ADD CONSTRAINT chk_attempt_marks 
CHECK (marks_obtained >= 0 AND marks_obtained <= max_marks);

-- Add unique constraint for question attempts
ALTER TABLE question_attempts 
ADD CONSTRAINT uq_question_attempt 
UNIQUE (student_id, question_id, attempt_number);

-- Add comments for documentation
COMMENT ON TABLE exam_analytics IS 'Pre-computed analytics for exams, students, and CO/PO attainment';
COMMENT ON TABLE question_attempts IS 'Tracks multiple attempts for questions with best attempt selection';
COMMENT ON COLUMN exam_sections.optional_questions IS 'Number of optional questions in this section';
COMMENT ON COLUMN exam_sections.mandatory_questions IS 'Number of mandatory questions in this section';
COMMENT ON COLUMN questions.is_optional IS 'Whether this question is optional (student can choose to attempt)';
COMMENT ON COLUMN questions.is_sub_question IS 'Whether this is a sub-question of a parent question';
COMMENT ON COLUMN questions.co_weight IS 'Weight of this question towards CO attainment (0.0-1.0)';
COMMENT ON COLUMN marks.is_best_attempt IS 'Whether this is the best attempt for optional questions';
COMMENT ON COLUMN question_attempts.is_best_attempt IS 'Whether this attempt is the best for this question';

