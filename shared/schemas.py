# Refactored LMS Schemas - Following Specification Hierarchy
# Consolidated and properly structured schemas for all entities

from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from decimal import Decimal
from shared.models import UserRole, ExamType, ExamStatus, BloomLevel, DifficultyLevel, AttendanceStatus, EnrollmentStatus

# Base schemas with common fields
class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    class Config:
        from_attributes = True
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }

# Authentication schemas
class UserLogin(BaseSchema):
    """User login request schema"""
    username: str
    password: str

class TokenResponse(BaseSchema):
    """Token response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserResponse(BaseSchema):
    """User response schema for auth"""
    id: int
    username: str
    email: str
    full_name: str
    role: str
    department_id: Optional[int] = None
    class_id: Optional[int] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

# User Schemas
class UserBase(BaseSchema):
    username: str
    email: EmailStr
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    student_id: Optional[str] = None
    employee_id: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = 0
    specializations: Optional[List[str]] = None

class UserCreate(UserBase):
    password: str
    is_active: bool = True
    department_id: Optional[int] = None
    class_id: Optional[int] = None

class UserUpdate(BaseSchema):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    student_id: Optional[str] = None
    employee_id: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    specializations: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

# Role-based user creation schemas
class AdminUserCreate(UserCreate):
    """Admin can create any user with minimal required fields"""
    pass

class HODUserCreate(UserCreate):
    """HOD can only create teachers and students in their department"""
    @validator('role')
    def validate_role(cls, v):
        if v not in ['teacher', 'student']:
            raise ValueError('HOD can only create teachers and students')
        return v

class TeacherUserCreate(UserCreate):
    """Teacher creation with subject assignments"""
    subject_ids: Optional[List[int]] = None

class StudentUserCreate(UserCreate):
    """Student creation with enrollment"""
    class_id: Optional[int] = None
    semester_id: Optional[int] = None

# Department Schemas
class DepartmentBase(BaseSchema):
    name: str
    code: str
    description: Optional[str] = None
    duration_years: int = 4
    academic_year: str
    semester_count: int = 8
    current_semester: int = 1
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    hod_id: Optional[int] = None

class DepartmentUpdate(BaseSchema):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    hod_id: Optional[int] = None
    duration_years: Optional[int] = None
    academic_year: Optional[str] = None
    semester_count: Optional[int] = None
    current_semester: Optional[int] = None
    is_active: Optional[bool] = None

class DepartmentResponse(DepartmentBase):
    id: int
    hod_id: Optional[int] = None
    hod_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    semesters_count: int = 0
    classes_count: int = 0
    subjects_count: int = 0
    students_count: int = 0
    teachers_count: int = 0

# Semester Schemas
class SemesterBase(BaseSchema):
    semester_number: int
    academic_year: str
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = False
    is_completed: bool = False

class SemesterCreate(SemesterBase):
    department_id: int

class SemesterUpdate(BaseSchema):
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None

class SemesterResponse(SemesterBase):
    id: int
    department_id: int
    department_name: str
    classes_count: int = 0
    students_count: int = 0
    subjects_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

# Class Schemas
class ClassBase(BaseSchema):
    name: str
    year: int
    section: str
    max_students: int = 60
    description: Optional[str] = None
    is_active: bool = True

class ClassCreate(ClassBase):
    semester_id: int
    department_id: int
    class_teacher_id: Optional[int] = None
    cr_id: Optional[int] = None

class ClassUpdate(BaseSchema):
    name: Optional[str] = None
    year: Optional[int] = None
    section: Optional[str] = None
    semester_id: Optional[int] = None
    class_teacher_id: Optional[int] = None
    cr_id: Optional[int] = None
    max_students: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ClassResponse(ClassBase):
    id: int
    semester_id: int
    department_id: int
    class_teacher_id: Optional[int] = None
    cr_id: Optional[int] = None
    semester_name: str
    department_name: str
    class_teacher_name: Optional[str] = None
    cr_name: Optional[str] = None
    students_count: int = 0
    subjects_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

# Subject Schemas
class SubjectBase(BaseSchema):
    name: str
    code: str
    description: Optional[str] = None
    credits: int = 3
    theory_marks: int = 100
    practical_marks: int = 0
    is_active: bool = True

class SubjectCreate(SubjectBase):
    department_id: int
    semester_id: int

class SubjectUpdate(BaseSchema):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    credits: Optional[int] = None
    theory_marks: Optional[int] = None
    practical_marks: Optional[int] = None
    is_active: Optional[bool] = None

class SubjectResponse(SubjectBase):
    id: int
    department_id: int
    class_id: Optional[int] = None
    teacher_id: Optional[int] = None
    department_name: str
    semester_name: str
    teachers_count: int = 0
    exams_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

# Teacher Subject Assignment Schemas
class TeacherSubjectBase(BaseSchema):
    is_primary: bool = False

class TeacherSubjectCreate(TeacherSubjectBase):
    teacher_id: int
    subject_id: int
    class_id: Optional[int] = None

class TeacherSubjectUpdate(BaseSchema):
    is_primary: Optional[bool] = None
    class_id: Optional[int] = None

class TeacherSubjectResponse(TeacherSubjectBase):
    id: int
    teacher_id: int
    subject_id: int
    class_id: Optional[int] = None
    teacher_name: str
    subject_name: str
    class_name: Optional[str] = None
    assigned_at: datetime

# Student Semester Enrollment Schemas
class StudentSemesterEnrollmentBase(BaseSchema):
    status: str = "active"
    final_grade: Optional[str] = None
    gpa: float = 0.0
    attendance_percentage: float = 0.0

class StudentSemesterEnrollmentCreate(StudentSemesterEnrollmentBase):
    student_id: int
    semester_id: int
    class_id: int

class StudentSemesterEnrollmentUpdate(BaseSchema):
    status: Optional[str] = None
    final_grade: Optional[str] = None
    gpa: Optional[float] = None
    attendance_percentage: Optional[float] = None

class StudentSemesterEnrollmentResponse(StudentSemesterEnrollmentBase):
    id: int
    student_id: int
    semester_id: int
    class_id: int
    student_name: str
    semester_name: str
    class_name: str
    enrollment_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

# Exam Schemas
class ExamBase(BaseSchema):
    title: str
    description: Optional[str] = None
    exam_type: str
    total_marks: int
    duration_minutes: int = 180
    weightage: float = 1.0
    calculation_rules: Optional[Dict[str, Any]] = None
    exam_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class ExamCreate(ExamBase):
    subject_id: int
    class_id: int
    semester_id: int
    status: str = "draft"

class ExamUpdate(BaseSchema):
    title: Optional[str] = None
    description: Optional[str] = None
    exam_type: Optional[str] = None
    status: Optional[str] = None
    total_marks: Optional[int] = None
    duration_minutes: Optional[int] = None
    weightage: Optional[float] = None
    calculation_rules: Optional[Dict[str, Any]] = None
    exam_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class ExamResponse(ExamBase):
    id: int
    subject_id: int
    class_id: int
    semester_id: int
    status: str
    subject_name: str
    class_name: str
    semester_name: str
    created_by: Optional[int] = None
    creator_name: Optional[str] = None
    sections_count: int = 0
    questions_count: int = 0
    students_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

# Exam Section Schemas
class ExamSectionBase(BaseSchema):
    name: str
    instructions: Optional[str] = None
    total_marks: int
    total_questions: Optional[int] = None
    questions_to_attempt: Optional[int] = None
    section_type: str = "standard"
    optional_questions: int = 0
    mandatory_questions: int = 0
    question_marks: float = 0.0
    is_optional_section: bool = False

class ExamSectionCreate(ExamSectionBase):
    exam_id: int

class ExamSectionUpdate(BaseSchema):
    name: Optional[str] = None
    instructions: Optional[str] = None
    total_marks: Optional[int] = None
    total_questions: Optional[int] = None
    questions_to_attempt: Optional[int] = None
    section_type: Optional[str] = None
    optional_questions: Optional[int] = None
    mandatory_questions: Optional[int] = None
    question_marks: Optional[float] = None
    is_optional_section: Optional[bool] = None

class ExamSectionResponse(ExamSectionBase):
    id: int
    exam_id: int
    exam_title: str
    questions_count: int = 0
    created_at: datetime

# Question Schemas
class QuestionBase(BaseSchema):
    question_text: str
    marks: float
    difficulty_level: str
    bloom_level: str
    question_number: Optional[str] = None
    order_index: int = 0
    is_optional: bool = False
    is_sub_question: bool = False
    sub_question_text: Optional[str] = None
    sub_question_marks: Optional[float] = None
    co_weight: float = 1.0
    po_auto_mapped: bool = False

class QuestionCreate(QuestionBase):
    section_id: int
    parent_question_id: Optional[int] = None

class QuestionUpdate(BaseSchema):
    question_text: Optional[str] = None
    marks: Optional[float] = None
    difficulty_level: Optional[str] = None
    bloom_level: Optional[str] = None
    question_number: Optional[str] = None
    order_index: Optional[int] = None
    is_optional: Optional[bool] = None
    is_sub_question: Optional[bool] = None
    sub_question_text: Optional[str] = None
    sub_question_marks: Optional[float] = None
    co_weight: Optional[float] = None
    po_auto_mapped: Optional[bool] = None

class QuestionResponse(QuestionBase):
    id: int
    section_id: int
    parent_question_id: Optional[int] = None
    section_name: str
    exam_title: str
    sub_questions_count: int = 0
    created_by: Optional[int] = None
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# CO Schemas
class COBase(BaseSchema):
    name: str
    description: str

class COCreate(COBase):
    subject_id: int
    department_id: int

class COUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None

class COResponse(COBase):
    id: int
    subject_id: int
    department_id: int
    subject_name: str
    subject_code: str
    department_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# PO Schemas
class POBase(BaseSchema):
    name: str
    description: str

class POCreate(POBase):
    department_id: int

class POUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None

class POResponse(POBase):
    id: int
    department_id: int
    department_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# CO-PO Mapping Schemas
class COPOMappingBase(BaseSchema):
    mapping_strength: float = 1.0

class COPOMappingCreate(COPOMappingBase):
    co_id: int
    po_id: int

class COPOMappingUpdate(BaseSchema):
    mapping_strength: Optional[float] = None

class COPOMappingResponse(COPOMappingBase):
    id: int
    co_id: int
    po_id: int
    co_name: str
    po_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Mark Schemas
class MarkBase(BaseSchema):
    marks_obtained: float = 0.0
    max_marks: float
    remarks: Optional[str] = None
    is_attempted: bool = True
    attempt_number: int = 1
    is_best_attempt: bool = False
    is_counted_for_total: bool = True
    co_contribution: float = 0.0
    po_contribution: float = 0.0
    bloom_level: Optional[str] = None
    difficulty_level: Optional[str] = None

class MarkCreate(MarkBase):
    student_id: int
    exam_id: int
    question_id: int

class MarkUpdate(BaseSchema):
    marks_obtained: Optional[float] = None
    remarks: Optional[str] = None
    is_attempted: Optional[bool] = None
    is_best_attempt: Optional[bool] = None
    is_counted_for_total: Optional[bool] = None
    co_contribution: Optional[float] = None
    po_contribution: Optional[float] = None

class MarkResponse(MarkBase):
    id: int
    student_id: int
    exam_id: int
    question_id: int
    student_name: str
    exam_title: str
    question_number: Optional[str] = None
    question_text: str
    graded_by: Optional[int] = None
    graded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# Question Attempt Schemas
class QuestionAttemptBase(BaseSchema):
    attempt_number: int = 1
    marks_obtained: float = 0.0
    max_marks: float
    is_best_attempt: bool = False
    remarks: Optional[str] = None

class QuestionAttemptCreate(QuestionAttemptBase):
    student_id: int
    question_id: int
    exam_id: int

class QuestionAttemptResponse(QuestionAttemptBase):
    id: int
    student_id: int
    question_id: int
    exam_id: int
    attempt_time: datetime
    created_at: datetime

# Attendance Schemas
class AttendanceBase(BaseSchema):
    attendance_date: date
    status: str
    remarks: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    student_id: int
    subject_id: int
    class_id: int
    semester_id: int

class AttendanceUpdate(BaseSchema):
    status: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceResponse(AttendanceBase):
    id: int
    student_id: int
    subject_id: int
    class_id: int
    semester_id: int
    student_name: str
    subject_name: str
    class_name: str
    semester_name: str
    marked_by: Optional[int] = None
    marker_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# Analytics Schemas
class ExamAnalyticsResponse(BaseSchema):
    exam_id: int
    exam_title: str
    subject_name: str
    class_name: str
    total_students: int
    attempted_students: int
    average_score: float
    pass_rate: float
    section_analysis: Dict[str, Any]
    co_po_analysis: Dict[str, Any]
    bloom_distribution: Dict[str, int]
    difficulty_analysis: Dict[str, int]
    class_wise_performance: List[Dict[str, Any]]
    individual_performance: List[Dict[str, Any]]

class COAttainmentResponse(BaseSchema):
    co_id: int
    co_name: str
    co_description: str
    subject_name: str
    total_marks_obtained: float
    total_max_marks: float
    attainment_percentage: float
    attainment_level: str
    students_count: int
    students_above_threshold: int

class POAttainmentResponse(BaseSchema):
    po_id: int
    po_name: str
    po_description: str
    department_name: str
    weighted_attainment: float
    attainment_level: str
    contributing_cos: int
    subjects_involved: List[str]

class StudentPerformanceResponse(BaseSchema):
    student_id: int
    student_name: str
    student_number: str
    class_name: str
    overall_percentage: float
    co_attainments: List[Dict[str, Any]]
    weak_areas: List[str]
    recommendations: List[str]

# Dashboard Schemas
class DashboardStats(BaseSchema):
    total_users: Optional[int] = None
    department_users: Optional[int] = None
    my_subjects: Optional[int] = None
    exams_taken: Optional[int] = None
    overall_percentage: Optional[float] = None
    avg_co_attainment: Optional[float] = None
    avg_department_attainment: Optional[float] = None
    avg_class_performance: Optional[float] = None

# Bulk Operation Schemas
class BulkOperationResult(BaseSchema):
    success: bool
    processed_count: int
    error_count: int
    errors: List[str]
    created_ids: List[int] = []

class BulkUserCreate(BaseSchema):
    users: List[Dict[str, Any]]
    department_id: Optional[int] = None
    class_id: Optional[int] = None
    semester_id: Optional[int] = None

class BulkMarksUpload(BaseSchema):
    exam_id: int
    marks_data: List[Dict[str, Any]]

class BulkQuestionsUpload(BaseSchema):
    exam_id: int
    questions_data: List[Dict[str, Any]]

# Authentication Schemas
class UserLogin(BaseSchema):
    username: str
    password: str

class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

# Notification Schemas
class NotificationBase(BaseSchema):
    title: str
    message: str
    type: str = "info"
    priority: str = "medium"
    action_url: Optional[str] = None
    sender_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class NotificationCreate(NotificationBase):
    user_id: int
    target_users: Optional[List[int]] = None
    target_roles: Optional[List[str]] = None
    target_departments: Optional[List[int]] = None
    target_classes: Optional[List[int]] = None

class NotificationUpdate(BaseSchema):
    is_read: bool

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    sender_name: Optional[str] = None

# File Upload Schemas
class FileUploadBase(BaseSchema):
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    is_public: bool = False

class FileUploadCreate(FileUploadBase):
    uploaded_by: int

class FileUploadResponse(FileUploadBase):
    id: int
    uploaded_by: int
    uploaded_by_name: str
    created_at: datetime

# System Log Schemas
class SystemLogResponse(BaseSchema):
    id: int
    level: str
    message: str
    module: Optional[str] = None
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

# Audit Log Schemas
class AuditLogResponse(BaseSchema):
    id: int
    user_id: Optional[int] = None
    action: str
    table_name: str
    record_id: Optional[int] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

# Question Bank Schemas
class QuestionBankBase(BaseSchema):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class QuestionBankCreate(QuestionBankBase):
    department_id: int
    subject_id: Optional[int] = None

class QuestionBankUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class QuestionBankResponse(QuestionBankBase):
    id: int
    department_id: int
    subject_id: Optional[int] = None
    created_by: int
    department_name: str
    subject_name: Optional[str] = None
    created_by_name: str
    questions_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

class QuestionBankItemCreate(BaseSchema):
    question_bank_id: int
    question_id: int

class QuestionBankItemResponse(BaseSchema):
    id: int
    question_bank_id: int
    question_id: int
    added_by: int
    question_text: str
    question_marks: float
    bloom_level: str
    difficulty_level: str
    added_by_name: str
    added_at: datetime

# Export Schemas
class ExportRequest(BaseSchema):
    export_type: str  # "pdf", "excel", "csv"
    data_type: str   # "marks", "students", "exams", "analytics"
    filters: Optional[Dict[str, Any]] = None
    date_range: Optional[Dict[str, Any]] = None
    format_options: Optional[Dict[str, Any]] = None

# Validation Schemas
class ValidationResult(BaseSchema):
    valid: bool
    errors: List[str]
    warnings: List[str]
    preview: List[Dict[str, Any]]

# Smart Marks Calculation Schema
class SmartMarksCalculation(BaseSchema):
    exam_id: int
    student_id: int
    section_id: int
    selected_questions: List[int]  # Question IDs selected by student
    marks_data: List[Dict[str, Any]]  # Marks for each question
