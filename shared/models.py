# Refactored LMS Models - Following Specification Hierarchy
# Institution → Departments → Semesters → Classes → Subjects → Exams → Students
# Properly normalized (1NF, 2NF, 3NF) with no circular dependencies

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, UniqueConstraint, JSON
from sqlalchemy.types import DECIMAL as Decimal
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from typing import List, Optional

Base = declarative_base()

# Enums for better type safety
class UserRole(PyEnum):
    ADMIN = "admin"
    HOD = "hod"
    TEACHER = "teacher"
    STUDENT = "student"

class ExamType(PyEnum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    PROJECT = "project"

class ExamStatus(PyEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class BloomLevel(PyEnum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"

class DifficultyLevel(PyEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class AttendanceStatus(PyEnum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"

class EnrollmentStatus(PyEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DROPPED = "dropped"
    PROMOTED = "promoted"

# Core Models following specification hierarchy

class User(Base):
    """Users table - Base entity for all system users"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    phone = Column(String(20))
    address = Column(Text)
    profile_picture = Column(String(255))
    student_id = Column(String(20), unique=True)
    employee_id = Column(String(20), unique=True)
    date_of_birth = Column(DateTime(timezone=True))
    gender = Column(String(10))
    qualification = Column(String(100))
    experience_years = Column(Integer, default=0)
    specializations = Column(JSON)  # Array for better normalization
    department_id = Column(Integer, ForeignKey("departments.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))

    # Relationships - Only direct relationships, no circular dependencies
    department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    department_hod = relationship("Department", foreign_keys="Department.hod_id", back_populates="hod")
    class_ref = relationship("Class", foreign_keys=[class_id], back_populates="students")
    class_teacher = relationship("Class", foreign_keys="Class.class_teacher_id", back_populates="class_teacher_ref")
    class_cr = relationship("Class", foreign_keys="Class.cr_id", back_populates="cr_ref")
    created_questions = relationship("Question", foreign_keys="Question.created_by", back_populates="creator")
    graded_marks = relationship("Mark", foreign_keys="Mark.graded_by", back_populates="grader")
    marked_attendance = relationship("Attendance", foreign_keys="Attendance.marked_by", back_populates="marker")
    uploaded_files = relationship("FileUpload", foreign_keys="FileUpload.uploaded_by", back_populates="uploader")
    created_question_banks = relationship("QuestionBank", foreign_keys="QuestionBank.created_by", back_populates="creator")
    added_question_bank_items = relationship("QuestionBankItem", foreign_keys="QuestionBankItem.added_by", back_populates="adder")
    notifications = relationship("Notification", foreign_keys="Notification.user_id", back_populates="user")
    student_enrollments = relationship("StudentSemesterEnrollment",
        foreign_keys="StudentSemesterEnrollment.student_id",
        back_populates="student")
    teacher_subjects = relationship("TeacherSubject", foreign_keys="TeacherSubject.teacher_id", back_populates="teacher")
    audit_logs = relationship("AuditLog", foreign_keys="AuditLog.user_id", back_populates="user")
    system_logs = relationship("SystemLog", foreign_keys="SystemLog.user_id", back_populates="user")

class Department(Base):
    """Departments table - Top level in hierarchy"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    description = Column(Text)
    hod_id = Column(Integer, ForeignKey("users.id"))
    duration_years = Column(Integer, default=4)
    academic_year = Column(String(10), nullable=False)
    semester_count = Column(Integer, default=8)
    current_semester = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - Direct children only
    hod = relationship("User", foreign_keys=[hod_id], back_populates="department_hod")
    users = relationship("User", foreign_keys="User.department_id", back_populates="department")
    semesters = relationship("Semester", back_populates="department", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="department", cascade="all, delete-orphan")
    pos = relationship("PO", back_populates="department", cascade="all, delete-orphan")
    question_banks = relationship("QuestionBank", back_populates="department", cascade="all, delete-orphan")

class Semester(Base):
    """Semesters table - Second level in hierarchy"""
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    semester_number = Column(Integer, nullable=False)
    academic_year = Column(String(10), nullable=False)
    name = Column(String(50), nullable=False)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    department = relationship("Department", back_populates="semesters")
    classes = relationship("Class", back_populates="semester", cascade="all, delete-orphan")
    enrollments = relationship("StudentSemesterEnrollment", back_populates="semester", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="semester", cascade="all, delete-orphan")

class Class(Base):
    """Classes table - Third level in hierarchy"""
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    section = Column(String(2), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    class_teacher_id = Column(Integer, ForeignKey("users.id"))
    cr_id = Column(Integer, ForeignKey("users.id"))
    max_students = Column(Integer, default=60)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    semester = relationship("Semester", back_populates="classes")
    department = relationship("Department")
    students = relationship("User", foreign_keys="User.class_id", back_populates="class_ref")
    class_teacher_ref = relationship("User", foreign_keys=[class_teacher_id], back_populates="class_teacher")
    cr_ref = relationship("User", foreign_keys=[cr_id], back_populates="class_cr")
    enrollments = relationship("StudentSemesterEnrollment", back_populates="class_ref", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="class_ref", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="class_ref", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="class_ref", cascade="all, delete-orphan")

class Subject(Base):
    """Subjects table - Fourth level in hierarchy"""
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text)
    credits = Column(Integer, default=3)
    theory_marks = Column(Integer, default=100)
    practical_marks = Column(Integer, default=0)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"))
    teacher_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    department = relationship("Department", back_populates="subjects")
    class_ref = relationship("Class", back_populates="subjects")
    teacher = relationship("User", foreign_keys=[teacher_id])
    teacher_subjects = relationship("TeacherSubject", back_populates="subject", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="subject", cascade="all, delete-orphan")
    cos = relationship("CO", back_populates="subject", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="subject", cascade="all, delete-orphan")
    question_banks = relationship("QuestionBank", back_populates="subject", cascade="all, delete-orphan")

class TeacherSubject(Base):
    """Junction table for teacher-subject assignments"""
    __tablename__ = "teacher_subjects"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    teacher = relationship("User")
    subject = relationship("Subject", back_populates="teacher_subjects")

    __table_args__ = (UniqueConstraint('teacher_id', 'subject_id', name='unique_teacher_subject'),)

class StudentSemesterEnrollment(Base):
    """Student enrollment in semesters and classes"""
    __tablename__ = "student_semester_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    enrollment_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), default="active")
    final_grade = Column(String(5))
    gpa = Column(Decimal(3,2), default=0.0)
    attendance_percentage = Column(Decimal(5,2), default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("User")
    semester = relationship("Semester", back_populates="enrollments")
    class_ref = relationship("Class", back_populates="enrollments")

    __table_args__ = (UniqueConstraint('student_id', 'semester_id', name='unique_student_semester'),)

class Exam(Base):
    """Exams table - Fifth level in hierarchy"""
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    exam_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    total_marks = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, default=180)
    exam_date = Column(DateTime(timezone=True))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    subject = relationship("Subject", back_populates="exams")
    class_ref = relationship("Class", back_populates="exams")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan")
    marks = relationship("Mark", back_populates="exam", cascade="all, delete-orphan")
    question_attempts = relationship("QuestionAttempt", back_populates="exam", cascade="all, delete-orphan")
    analytics = relationship("ExamAnalytics", back_populates="exam", cascade="all, delete-orphan")

class ExamSection(Base):
    """Exam sections (A, B, C) with optional question support"""
    __tablename__ = "exam_sections"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(20), nullable=False)
    instructions = Column(Text)
    total_marks = Column(Integer, nullable=False)
    total_questions = Column(Integer)
    questions_to_attempt = Column(Integer)
    section_type = Column(String(20), default="standard")
    optional_questions = Column(Integer, default=0)
    mandatory_questions = Column(Integer, default=0)
    question_marks = Column(Decimal(5,2), default=0.0)
    is_optional_section = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    exam = relationship("Exam", back_populates="sections")
    questions = relationship("Question", back_populates="section", cascade="all, delete-orphan")
    analytics = relationship("ExamAnalytics", back_populates="section", cascade="all, delete-orphan")

class Question(Base):
    """Questions with Bloom taxonomy and CO mapping"""
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    marks = Column(Decimal(5,2), nullable=False)
    difficulty_level = Column(String(10), nullable=False)
    bloom_level = Column(String(20), nullable=False)
    section_id = Column(Integer, ForeignKey("exam_sections.id", ondelete="CASCADE"), nullable=False)
    parent_question_id = Column(Integer, ForeignKey("questions.id"))
    question_number = Column(String(10))
    order_index = Column(Integer, default=0)
    is_optional = Column(Boolean, default=False)
    is_sub_question = Column(Boolean, default=False)
    sub_question_text = Column(Text)
    sub_question_marks = Column(Decimal(5,2))
    co_id = Column(Integer, ForeignKey("cos.id"))
    co_weight = Column(Decimal(3,2), default=1.0)
    po_auto_mapped = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    section = relationship("ExamSection", back_populates="questions")
    parent_question = relationship("Question", remote_side=[id], backref="sub_questions")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_questions")
    co = relationship("CO", foreign_keys=[co_id], back_populates="questions")
    marks = relationship("Mark", back_populates="question", cascade="all, delete-orphan")
    question_attempts = relationship("QuestionAttempt", back_populates="question", cascade="all, delete-orphan")
    question_bank_items = relationship("QuestionBankItem", back_populates="question", cascade="all, delete-orphan")
    analytics = relationship("ExamAnalytics", back_populates="question", cascade="all, delete-orphan")

class CO(Base):
    """Course Outcomes"""
    __tablename__ = "cos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    subject = relationship("Subject", back_populates="cos")
    department = relationship("Department")
    questions = relationship("Question", foreign_keys="Question.co_id", back_populates="co")
    co_po_mappings = relationship("COPOMapping", back_populates="co", cascade="all, delete-orphan")
    analytics = relationship("ExamAnalytics", back_populates="co", cascade="all, delete-orphan")

class PO(Base):
    """Program Outcomes"""
    __tablename__ = "pos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    department = relationship("Department", back_populates="pos")
    co_po_mappings = relationship("COPOMapping", back_populates="po", cascade="all, delete-orphan")
    analytics = relationship("ExamAnalytics", back_populates="po", cascade="all, delete-orphan")

class COPOMapping(Base):
    """CO-PO Mapping with strength"""
    __tablename__ = "co_po_mappings"

    id = Column(Integer, primary_key=True, index=True)
    co_id = Column(Integer, ForeignKey("cos.id", ondelete="CASCADE"), nullable=False)
    po_id = Column(Integer, ForeignKey("pos.id", ondelete="CASCADE"), nullable=False)
    mapping_strength = Column(Decimal(3,2), default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    co = relationship("CO", back_populates="co_po_mappings")
    po = relationship("PO", back_populates="co_po_mappings")

    __table_args__ = (UniqueConstraint('co_id', 'po_id', name='unique_co_po_mapping'),)

class Mark(Base):
    """Student marks with CO/PO contribution tracking"""
    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    marks_obtained = Column(Decimal(5,2), default=0.0)
    max_marks = Column(Decimal(5,2), nullable=False)
    remarks = Column(Text)
    graded_by = Column(Integer, ForeignKey("users.id"))
    graded_at = Column(DateTime(timezone=True))
    is_attempted = Column(Boolean, default=True)
    attempt_number = Column(Integer, default=1)
    is_best_attempt = Column(Boolean, default=False)
    is_counted_for_total = Column(Boolean, default=True)
    co_contribution = Column(Decimal(5,2), default=0.0)
    po_contribution = Column(Decimal(5,2), default=0.0)
    bloom_level = Column(String(20))
    difficulty_level = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    exam = relationship("Exam", back_populates="marks")
    question = relationship("Question", back_populates="marks")
    grader = relationship("User", foreign_keys=[graded_by], back_populates="graded_marks")

    __table_args__ = (UniqueConstraint('student_id',
        'exam_id',
        'question_id',
        'attempt_number',
        name='unique_mark_attempt'),)

class QuestionAttempt(Base):
    """Multiple attempts for optional questions"""
    __tablename__ = "question_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    attempt_number = Column(Integer, default=1)
    marks_obtained = Column(Decimal(5,2), default=0.0)
    max_marks = Column(Decimal(5,2), nullable=False)
    is_best_attempt = Column(Boolean, default=False)
    attempt_time = Column(DateTime(timezone=True), default=func.now())
    graded_by = Column(Integer, ForeignKey("users.id"))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    question = relationship("Question", back_populates="question_attempts")
    exam = relationship("Exam", back_populates="question_attempts")
    grader = relationship("User", foreign_keys=[graded_by])

    __table_args__ = (UniqueConstraint('student_id', 'question_id', 'attempt_number', name='unique_question_attempt'),)

class Attendance(Base):
    """Student attendance tracking"""
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    attendance_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False)
    remarks = Column(Text)
    marked_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    subject = relationship("Subject", back_populates="attendance_records")
    class_ref = relationship("Class", back_populates="attendance_records")
    semester = relationship("Semester", back_populates="attendance_records")
    marker = relationship("User", foreign_keys=[marked_by], back_populates="marked_attendance")

    __table_args__ = (UniqueConstraint('student_id', 'subject_id', 'attendance_date', name='unique_attendance_per_day'),)

class ExamAnalytics(Base):
    """Pre-computed analytics for performance tracking"""
    __tablename__ = "exam_analytics"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"))
    section_id = Column(Integer, ForeignKey("exam_sections.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    co_id = Column(Integer, ForeignKey("cos.id"))
    po_id = Column(Integer, ForeignKey("pos.id"))
    total_marks = Column(Decimal(5,2), default=0.0)
    obtained_marks = Column(Decimal(5,2), default=0.0)
    percentage = Column(Decimal(5,2), default=0.0)
    bloom_level = Column(String(20))
    difficulty_level = Column(String(10))
    co_attainment = Column(Decimal(5,2), default=0.0)
    po_attainment = Column(Decimal(5,2), default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    exam = relationship("Exam", back_populates="analytics")
    student = relationship("User", foreign_keys=[student_id])
    section = relationship("ExamSection", back_populates="analytics")
    question = relationship("Question", back_populates="analytics")
    co = relationship("CO", back_populates="analytics")
    po = relationship("PO", back_populates="analytics")

class QuestionBank(Base):
    """Question repository"""
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    department = relationship("Department", back_populates="question_banks")
    subject = relationship("Subject", back_populates="question_banks")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_question_banks")
    items = relationship("QuestionBankItem", back_populates="question_bank", cascade="all, delete-orphan")

class QuestionBankItem(Base):
    """Junction table for question banks"""
    __tablename__ = "question_bank_items"

    id = Column(Integer, primary_key=True, index=True)
    question_bank_id = Column(Integer, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    question_bank = relationship("QuestionBank", back_populates="items")
    question = relationship("Question", back_populates="question_bank_items")
    adder = relationship("User", foreign_keys=[added_by], back_populates="added_question_bank_items")

    __table_args__ = (UniqueConstraint('question_bank_id', 'question_id', name='unique_question_bank_item'),)

class Notification(Base):
    """System notifications"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info")
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    is_read = Column(Boolean, default=False)
    action_url = Column(String(500))
    sender_id = Column(Integer, ForeignKey("users.id"))
    sender_name = Column(String(100))
    scheduled_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    sender = relationship("User", foreign_keys=[sender_id])

class FileUpload(Base):
    """File management"""
    __tablename__ = "file_uploads"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    uploader = relationship("User", foreign_keys=[uploaded_by], back_populates="uploaded_files")

class SystemLog(Base):
    """System monitoring logs"""
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    module = Column(String(100))
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="system_logs")

class AuditLog(Base):
    """Audit trail"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="audit_logs")
