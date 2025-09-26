from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum, UniqueConstraint, JSON
from sqlalchemy.types import DECIMAL as Decimal
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
import enum

Base = declarative_base()

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

class User(Base):
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
    department_id = Column(Integer, ForeignKey("departments.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    date_of_birth = Column(DateTime(timezone=True))
    gender = Column(String(10))
    qualification = Column(String(100))
    experience_years = Column(Integer, default= 0)
    specializations = Column(Text)  # JSON string for specializations array
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    class_assigned = relationship("Class", foreign_keys=[class_id], back_populates="students")
    semester_enrollments = relationship("StudentSemesterEnrollment", foreign_keys="StudentSemesterEnrollment.student_id", back_populates="student", cascade="all, delete-orphan")
    taught_subjects = relationship("TeacherSubject", foreign_keys="TeacherSubject.teacher_id", back_populates="teacher", cascade="all, delete-orphan")
    marks = relationship("Mark", foreign_keys="Mark.student_id", back_populates="student")
    graded_marks = relationship("Mark", foreign_keys="Mark.graded_by", back_populates="grader")
    created_question_banks = relationship("QuestionBank", foreign_keys="QuestionBank.created_by", back_populates="creator")
    added_question_bank_items = relationship("QuestionBankItem", foreign_keys="QuestionBankItem.added_by", back_populates="adder")
    uploaded_files = relationship("FileUpload", foreign_keys="FileUpload.uploaded_by", back_populates="uploaded_by_user")
    attendance_records = relationship("Attendance", foreign_keys="Attendance.student_id", back_populates="student", cascade="all, delete-orphan")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    description = Column(Text)
    hod_id = Column(Integer, ForeignKey("users.id"))
    duration_years = Column(Integer, default=4)
    academic_year = Column(String(9), nullable=False)  # e.g., "2024-2025"
    semester_count = Column(Integer, default= 8)  # Total semesters in the program
    current_semester = Column(Integer, default= 1)  # Current active semester
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    users = relationship("User", foreign_keys="User.department_id", back_populates="department")
    hod = relationship("User", foreign_keys=[hod_id])
    semesters = relationship("Semester", foreign_keys="Semester.department_id", back_populates="department")
    classes = relationship("Class", foreign_keys="Class.department_id", back_populates="department")
    subjects = relationship("Subject", foreign_keys="Subject.department_id", back_populates="department")
    question_banks = relationship("QuestionBank", foreign_keys="QuestionBank.department_id", back_populates="department")
    pos = relationship("PO", foreign_keys="PO.department_id", back_populates="department")
    cos = relationship("CO", foreign_keys="CO.department_id", back_populates="department")

class Semester(Base):
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    semester_number = Column(Integer, nullable=False)
    academic_year = Column(String(9), nullable=False)
    name = Column(String(50), nullable=False)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="semesters")
    classes = relationship("Class", foreign_keys="Class.semester_id", back_populates="semester")
    student_enrollments = relationship("StudentSemesterEnrollment", foreign_keys="StudentSemesterEnrollment.semester_id", back_populates="semester")

class StudentSemesterEnrollment(Base):
    __tablename__ = "student_semester_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    enrollment_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), default="active")  # active, completed, dropped, promoted
    final_grade = Column(String(5))  # A+, A, B+, B, C+, C, D, F
    gpa = Column(Decimal(3, 2))
    attendance_percentage = Column(Decimal(5, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("User", foreign_keys=[student_id], back_populates="semester_enrollments")
    semester = relationship("Semester", foreign_keys=[semester_id], back_populates="student_enrollments")
    class_ref = relationship("Class", foreign_keys=[class_id], back_populates="enrollments")

class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    section = Column(String(2), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    class_teacher_id = Column(Integer, ForeignKey("users.id"))
    cr_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    students = relationship("User", foreign_keys="User.class_id", back_populates="class_assigned")
    department = relationship("Department", foreign_keys=[department_id], back_populates="classes")
    semester = relationship("Semester", foreign_keys=[semester_id], back_populates="classes")
    class_teacher = relationship("User", foreign_keys=[class_teacher_id])
    cr = relationship("User", foreign_keys=[cr_id])
    subjects = relationship("Subject", foreign_keys="Subject.class_id", back_populates="class_ref")
    exams = relationship("Exam", foreign_keys="Exam.class_id", back_populates="class_ref")
    enrollments = relationship("StudentSemesterEnrollment", foreign_keys="StudentSemesterEnrollment.class_id", back_populates="class_ref")
    attendance_records = relationship("Attendance", foreign_keys="Attendance.class_id", back_populates="class_", cascade="all, delete-orphan")

class Subject(Base):
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
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="subjects")
    class_ref = relationship("Class", foreign_keys=[class_id], back_populates="subjects")
    teacher = relationship("User", foreign_keys=[teacher_id])
    teacher_subjects = relationship("TeacherSubject", foreign_keys="TeacherSubject.subject_id", back_populates="subject", cascade="all, delete-orphan")
    question_banks = relationship("QuestionBank", foreign_keys="QuestionBank.subject_id", back_populates="subject")
    exams = relationship("Exam", foreign_keys="Exam.subject_id", back_populates="subject")
    cos = relationship("CO", foreign_keys="CO.subject_id", back_populates="subject")
    attendance_records = relationship("Attendance", foreign_keys="Attendance.subject_id", back_populates="subject", cascade="all, delete-orphan")

class PO(Base):
    __tablename__ = "pos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(10), nullable=False)
    description = Column(Text, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="pos")
    co_po_mappings = relationship("COPOMapping", foreign_keys="COPOMapping.po_id", back_populates="po")

class CO(Base):
    __tablename__ = "cos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(10), nullable=False)
    description = Column(Text, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    subject = relationship("Subject", foreign_keys=[subject_id], back_populates="cos")
    department = relationship("Department", foreign_keys=[department_id], back_populates="cos")
    co_po_mappings = relationship("COPOMapping", foreign_keys="COPOMapping.co_id", back_populates="co")
    questions = relationship("Question", foreign_keys="Question.co_id", back_populates="co")

class COPOMapping(Base):
    __tablename__ = "co_po_mappings"

    id = Column(Integer, primary_key=True, index=True)
    co_id = Column(Integer, ForeignKey("cos.id"), nullable=False)
    po_id = Column(Integer, ForeignKey("pos.id"), nullable=False)
    mapping_strength = Column(Decimal(3, 1), default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    co = relationship("CO", foreign_keys=[co_id], back_populates="co_po_mappings")
    po = relationship("PO", foreign_keys=[po_id], back_populates="co_po_mappings")

class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    exam_type = Column(String(20), default = "internal")  # Changed from Enum to String
    status = Column(String(20), default = "draft")  # Changed from Enum to String
    total_marks = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, default=180)
    exam_date = Column(DateTime(timezone=True))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    subject = relationship("Subject", foreign_keys=[subject_id], back_populates="exams")
    class_ref = relationship("Class", foreign_keys=[class_id], back_populates="exams")
    sections = relationship("ExamSection", foreign_keys="ExamSection.exam_id", back_populates="exam", cascade="all, delete-orphan")
    marks = relationship("Mark", foreign_keys="Mark.exam_id", back_populates="exam")

class ExamSection(Base):
    __tablename__ = "exam_sections"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    name = Column(String(20), nullable=False)
    instructions = Column(Text)
    total_marks = Column(Integer, nullable=False)
    total_questions = Column(Integer)
    questions_to_attempt = Column(Integer)
    section_type = Column(String(20), default="standard")
    optional_questions = Column(Integer, default=0)
    mandatory_questions = Column(Integer, default=0)
    question_marks = Column(Decimal(5, 2), default=0.0)
    is_optional_section = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default = func.now())
    
    # Relationships
    exam = relationship("Exam", foreign_keys=[exam_id], back_populates="sections")
    questions = relationship("Question", foreign_keys="Question.section_id", back_populates="section")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    marks = Column(Decimal(5, 2), nullable=False)
    bloom_level = Column(String(20), nullable=False)  # Changed from Enum to String
    difficulty_level = Column(String(20), default = "medium")  # Changed from Enum to String
    section_id = Column(Integer, ForeignKey("exam_sections.id"), nullable=False)
    co_id = Column(Integer, ForeignKey("cos.id"), nullable=False)
    parent_question_id = Column(Integer, ForeignKey("questions.id"))
    question_number = Column(String(10))
    order_index = Column(Integer, default=0)
    is_optional = Column(Boolean, default=False)
    is_sub_question = Column(Boolean, default=False)
    sub_question_text = Column(Text)
    sub_question_marks = Column(Decimal(5, 2))
    co_weight = Column(Decimal(3, 2), default=1.0)
    po_auto_mapped = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    section = relationship("ExamSection", foreign_keys=[section_id], back_populates="questions")
    co = relationship("CO", foreign_keys=[co_id], back_populates="questions")
    parent_question = relationship("Question", remote_side=[id], backref="sub_questions")
    marks = relationship("Mark", foreign_keys="Mark.question_id", back_populates="question")
    question_bank_items = relationship("QuestionBankItem", foreign_keys="QuestionBankItem.question_id", back_populates="question")
    creator = relationship("User", foreign_keys=[created_by])

class Mark(Base):
    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    marks_obtained = Column(Decimal(5, 2), default=0.0)
    max_marks = Column(Decimal(5, 2), nullable=False)
    remarks = Column(Text)
    graded_by = Column(Integer, ForeignKey("users.id"))
    graded_at = Column(DateTime(timezone=True))
    is_attempted = Column(Boolean, default=True)
    attempt_number = Column(Integer, default=1)
    is_best_attempt = Column(Boolean, default=False)
    is_counted_for_total = Column(Boolean, default=True)  # For optional question auto-calculation
    co_contribution = Column(Decimal(5, 2), default=0.0)
    po_contribution = Column(Decimal(5, 2), default=0.0)
    bloom_level = Column(String(20))
    difficulty_level = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    student = relationship("User", foreign_keys=[student_id], back_populates="marks")
    exam = relationship("Exam", foreign_keys=[exam_id], back_populates="marks")
    question = relationship("Question", foreign_keys=[question_id], back_populates="marks")
    grader = relationship("User", foreign_keys=[graded_by], back_populates="graded_marks")

class QuestionAttempt(Base):
    __tablename__ = "question_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    attempt_number = Column(Integer, default=1)
    marks_obtained = Column(Decimal(5, 2), default=0.0)
    max_marks = Column(Decimal(5, 2), nullable=False)
    is_best_attempt = Column(Boolean, default=False)
    attempt_time = Column(DateTime(timezone=True), default=func.now())
    graded_by = Column(Integer, ForeignKey("users.id"))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    question = relationship("Question", foreign_keys=[question_id])
    exam = relationship("Exam", foreign_keys=[exam_id])
    grader = relationship("User", foreign_keys=[graded_by])

class ExamAnalytics(Base):
    __tablename__ = "exam_analytics"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"))
    section_id = Column(Integer, ForeignKey("exam_sections.id"))
    co_id = Column(Integer, ForeignKey("cos.id"))
    po_id = Column(Integer, ForeignKey("pos.id"))
    total_marks = Column(Decimal(5, 2), default=0.0)
    obtained_marks = Column(Decimal(5, 2), default=0.0)
    percentage = Column(Decimal(5, 2), default=0.0)
    bloom_level = Column(String(20))
    difficulty_level = Column(String(20))
    co_attainment = Column(Decimal(5, 2), default=0.0)
    po_attainment = Column(Decimal(5, 2), default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    exam = relationship("Exam", foreign_keys=[exam_id])
    student = relationship("User", foreign_keys=[student_id])
    section = relationship("ExamSection", foreign_keys=[section_id])
    co = relationship("CO", foreign_keys=[co_id])
    po = relationship("PO", foreign_keys=[po_id])

class QuestionBank(Base):
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="question_banks")
    subject = relationship("Subject", foreign_keys=[subject_id], back_populates="question_banks")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_question_banks")
    items = relationship("QuestionBankItem", foreign_keys="QuestionBankItem.question_bank_id", back_populates="question_bank", cascade="all, delete-orphan")

class QuestionBankItem(Base):
    __tablename__ = "question_bank_items"

    id = Column(Integer, primary_key=True, index=True)
    question_bank_id = Column(Integer, ForeignKey("question_banks.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default = func.now())
    
    # Relationships
    question_bank = relationship("QuestionBank", foreign_keys=[question_bank_id], back_populates="items")
    question = relationship("Question", foreign_keys=[question_id], back_populates="question_bank_items")
    adder = relationship("User", foreign_keys=[added_by], back_populates="added_question_bank_items")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info")  # info, warning, error, success,
    is_read = Column(Boolean, default=False)
    action_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default = func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])

class FileUpload(Base):
    __tablename__ = "file_uploads"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50))  # exam, question, user, etc.
    entity_id = Column(Integer)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default = func.now())
    
    # Relationships
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by], back_populates="uploaded_files")

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), nullable=False)  # DEBUG, INFO, WARNING, ERROR, CRITICAL,
    message = Column(Text, nullable=False)
    module = Column(String(100))
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default = func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])

class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    teacher = relationship("User", foreign_keys=[teacher_id], back_populates="taught_subjects")
    subject = relationship("Subject", foreign_keys=[subject_id], back_populates="teacher_subjects")
    
    __table_args__ = (UniqueConstraint('teacher_id', 'subject_id', name='unique_teacher_subject'),)

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    attendance_date = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False)  # present, absent, late, excused
    remarks = Column(Text)
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default = func.now())
    updated_at = Column(DateTime(timezone=True), onupdate = func.now())
    
    # Relationships
    student = relationship("User", foreign_keys=[student_id], back_populates="attendance_records")
    subject = relationship("Subject", back_populates="attendance_records")
    class_ = relationship("Class", back_populates="attendance_records")
    marked_by_user = relationship("User", foreign_keys=[marked_by])
    
    __table_args__ = (UniqueConstraint('student_id', 'subject_id', 'attendance_date', name='unique_attendance_per_day'),)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer)
    old_values = Column(Text)  # JSON string
    new_values = Column(Text)  # JSON string
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default = func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])