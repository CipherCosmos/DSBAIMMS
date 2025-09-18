from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from shared.models import UserRole, ExamType, ExamStatus, BloomLevel, DifficultyLevel

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str  # Changed from UserRole to str
    phone: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[int] = None
    class_id: Optional[int] = None
    student_id: Optional[str] = None
    employee_id: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    subject_ids: Optional[List[int]] = None  # For teacher subject assignments
    specializations: Optional[List[str]] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr]      = None
    username: Optional[str]      = None
    full_name: Optional[str]      = None
    first_name: Optional[str]      = None
    last_name: Optional[str]      = None
    phone: Optional[str]      = None
    address: Optional[str]      = None
    department_id: Optional[int]      = None
    class_id: Optional[int]      = None
    student_id: Optional[str]      = None
    employee_id: Optional[str]      = None
    date_of_birth: Optional[datetime]      = None
    gender: Optional[str]      = None
    qualification: Optional[str]      = None
    experience_years: Optional[int]      = None
    subject_ids: Optional[List[int]]      = None  # Changed from subjects to subject_ids
    specializations: Optional[List[str]]      = None
    is_active: Optional[bool]      = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]      = None
    last_login: Optional[datetime]      = None
    department_name: Optional[str]      = None
    class_name: Optional[str]      = None
    subjects: Optional[List[dict]] = None  # Subject details

    class Config:
        from_attributes = True

# Subject Schemas
class SubjectBase(BaseModel):
    name: str
    code: str
    department_id: int
    description: Optional[str]      = None
    credits: Optional[int]      = 3
    theory_marks: Optional[int]      = 100
    practical_marks: Optional[int] = 0

class SubjectCreate(SubjectBase):
    class_id: Optional[int]      = None
    teacher_id: Optional[int] = None

class SubjectUpdate(BaseModel):
    name: Optional[str]      = None
    code: Optional[str]      = None
    department_id: Optional[int]      = None
    description: Optional[str]      = None
    credits: Optional[int]      = None
    theory_marks: Optional[int]      = None
    practical_marks: Optional[int]      = None
    class_id: Optional[int]      = None
    teacher_id: Optional[int]      = None
    is_active: Optional[bool] = None

class SubjectResponse(SubjectBase):
    id: int
    class_id: Optional[int]      = None
    teacher_id: Optional[int]      = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]      = None
    department_name: str
    class_name: Optional[str]      = None
    teacher_name: Optional[str] = None

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str    = "bearer"
    user: UserResponse

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    code: str
    description: Optional[str]      = None
    duration_years: int    = 4
    academic_year: str
    semester_count: int    = 8
    current_semester: int      = 1
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    hod_id: Optional[int] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str]      = None
    code: Optional[str]      = None
    description: Optional[str]      = None
    hod_id: Optional[int]      = None
    duration_years: Optional[int]      = None
    academic_year: Optional[str]      = None
    semester_count: Optional[int]      = None
    current_semester: Optional[int]      = None
    is_active: Optional[bool] = None

class DepartmentResponse(DepartmentBase):
    id: int
    hod_id: Optional[int]      = None
    created_at: datetime
    updated_at: Optional[datetime]      = None
    hod_name: Optional[str] = None

    class Config:
        from_attributes = True

# Class Schemas
class ClassCreate(BaseModel):
    name: str
    year: int
    semester: int
    section: str
    department_id: int
    class_teacher_id: Optional[int]      = None
    cr_id: Optional[int] = None

class ClassUpdate(BaseModel):
    name: Optional[str]      = None
    year: Optional[int]      = None
    semester: Optional[int]      = None
    section: Optional[str]      = None
    class_teacher_id: Optional[int]      = None
    cr_id: Optional[int] = None

class ClassResponse(BaseModel):
    id: int
    name: str
    year: int
    semester: int
    section: str
    department_id: int
    class_teacher_id: Optional[int]      = None
    cr_id: Optional[int]      = None
    department_name: str
    class_teacher_name: Optional[str]      = None
    cr_name: Optional[str]      = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Remove duplicate Subject schemas - already defined above

# PO Schemas
class POCreate(BaseModel):
    name: str
    description: str
    department_id: int

class POUpdate(BaseModel):
    name: Optional[str]      = None
    description: Optional[str] = None

class POResponse(BaseModel):
    id: int
    name: str
    description: str
    department_id: int
    department_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# CO Schemas
class COCreate(BaseModel):
    name: str
    description: str
    subject_id: int
    department_id: int

class COUpdate(BaseModel):
    name: Optional[str]      = None
    description: Optional[str] = None

class COResponse(BaseModel):
    id: int
    name: str
    description: str
    subject_id: int
    department_id: int
    subject_name: str
    subject_code: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# CO-PO Mapping Schemas
class COPOMappingCreate(BaseModel):
    co_id: int
    po_id: int
    mapping_strength: float = 1.0

class COPOMappingUpdate(BaseModel):
    mapping_strength: Optional[float] = None

class COPOMappingResponse(BaseModel):
    id: int
    co_id: int
    po_id: int
    mapping_strength: float
    co_name: str
    po_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Exam Schemas
class ExamSectionCreate(BaseModel):
    name: str
    instructions: Optional[str]      = None
    total_marks: int
    total_questions: Optional[int]      = None
    questions_to_attempt: Optional[int] = None

class ExamCreate(BaseModel):
    title: str
    description: Optional[str]      = None
    subject_id: int
    class_id: int
    exam_type: str    = "internal"  # Changed from ExamType to str
    total_marks: int
    duration_minutes: int    = 180
    exam_date: Optional[datetime]      = None
    sections: List[ExamSectionCreate] = []

class ExamUpdate(BaseModel):
    title: Optional[str]      = None
    description: Optional[str]      = None
    exam_type: Optional[str]      = None  # Changed from ExamType to str
    total_marks: Optional[int]      = None
    duration_minutes: Optional[int]      = None
    exam_date: Optional[datetime]      = None
    status: Optional[str] = None  # Changed from ExamStatus to str

class ExamResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]      = None
    subject_id: int
    class_id: int
    exam_type: str
    status: str
    total_marks: int
    duration_minutes: int
    exam_date: Optional[datetime]      = None
    subject_name: str
    class_name: str
    sections_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Question Schemas
class QuestionCreate(BaseModel):
    question_text: str
    marks: float
    bloom_level: str  # Changed from BloomLevel to str
    difficulty_level: str    = "medium"  # Changed from DifficultyLevel to str
    section_id: int
    co_id: int
    parent_question_id: Optional[int]      = None
    question_number: Optional[str]      = None
    order_index: int = 0

class QuestionUpdate(BaseModel):
    question_text: Optional[str]      = None
    marks: Optional[float]      = None
    bloom_level: Optional[str]      = None  # Changed from BloomLevel to str
    difficulty_level: Optional[str]      = None  # Changed from DifficultyLevel to str
    question_number: Optional[str]      = None
    order_index: Optional[int] = None

class QuestionResponse(BaseModel):
    id: int
    question_text: str
    marks: float
    bloom_level: str
    difficulty_level: str
    section_id: int
    co_id: int
    parent_question_id: Optional[int]      = None
    question_number: Optional[str]      = None
    order_index: int
    co_name: str
    section_name: str
    sub_questions_count: int    = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Mark Schemas
class MarkCreate(BaseModel):
    student_id: int
    exam_id: int
    question_id: int
    marks_obtained: float
    max_marks: float
    remarks: Optional[str] = None

class MarkUpdate(BaseModel):
    marks_obtained: float
    remarks: Optional[str] = None

class MarkResponse(BaseModel):
    id: int
    student_id: int
    exam_id: int
    question_id: int
    marks_obtained: float
    max_marks: float
    remarks: Optional[str]      = None
    student_name: str
    exam_title: str
    question_number: Optional[str]      = None
    question_text: str
    graded_by: Optional[int]      = None
    graded_at: Optional[datetime]      = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Bulk Operation Schemas
class BulkOperationResult(BaseModel):
    success: bool
    processed_count: int
    error_count: int
    errors: List[str]
    created_ids: List[int] = []

class ValidationResult(BaseModel):
    valid: bool
    errors: List[str]
    warnings: List[str]
    preview: List[dict]

# Analytics Schemas
class COAttainmentResponse(BaseModel):
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

class POAttainmentResponse(BaseModel):
    po_id: int
    po_name: str
    po_description: str
    department_name: str
    weighted_attainment: float
    attainment_level: str
    contributing_cos: int
    subjects_involved: List[str]

class StudentPerformanceResponse(BaseModel):
    student_id: int
    student_name: str
    student_number: str
    class_name: str
    overall_percentage: float
    co_attainments: List[dict]
    weak_areas: List[str]
    recommendations: List[str]

class QuestionAnalyticsResponse(BaseModel):
    question_id: int
    question_number: str
    question_text: str
    bloom_level: str
    difficulty_level: str
    co_name: str
    max_marks: float
    avg_marks: float
    difficulty_index: float
    discrimination_index: float
    attempts_count: int

class ExamAnalyticsResponse(BaseModel):
    exam_id: int
    exam_title: str
    subject_name: str
    class_name: str
    total_students: int
    average_score: float
    pass_rate: float
    reliability_coefficient: float
    bloom_distribution: dict
    difficulty_distribution: dict

class DashboardStats(BaseModel):
    total_users: Optional[int]      = None
    department_users: Optional[int]      = None
    my_subjects: Optional[int]      = None
    exams_taken: Optional[int]      = None
    overall_percentage: Optional[float]      = None
    avg_co_attainment: Optional[float]      = None
    avg_department_attainment: Optional[float]      = None
    avg_class_performance: Optional[float] = None

# Question Bank Schemas
class QuestionBankCreate(BaseModel):
    name: str
    description: Optional[str]      = None
    department_id: int
    subject_id: Optional[int]      = None
    is_public: bool = False

class QuestionBankUpdate(BaseModel):
    name: Optional[str]      = None
    description: Optional[str]      = None
    is_public: Optional[bool] = None

class QuestionBankResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]      = None
    department_id: int
    subject_id: Optional[int]      = None
    created_by: int
    is_public: bool
    department_name: str
    subject_name: Optional[str]      = None
    created_by_name: str
    questions_count: int    = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class QuestionBankItemCreate(BaseModel):
    question_bank_id: int
    question_id: int

class QuestionBankItemResponse(BaseModel):
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

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationCreate(BaseModel):
    user_id: int
    title: str
    message: str
    type: str    = "info"
    action_url: Optional[str] = None

class NotificationUpdate(BaseModel):
    is_read: bool

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    action_url: Optional[str]      = None
    created_at: datetime

    class Config:
        from_attributes = True

# File Upload Schemas
class FileUploadCreate(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    entity_type: Optional[str]      = None
    entity_id: Optional[int]      = None
    is_public: bool = False

class FileUploadResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    uploaded_by: int
    entity_type: Optional[str]      = None
    entity_id: Optional[int]      = None
    is_public: bool
    uploaded_by_name: str
    created_at: datetime

    class Config:
        from_attributes = True

# System Log Schemas
class SystemLogResponse(BaseModel):
    id: int
    level: str
    message: str
    module: Optional[str]      = None
    user_id: Optional[int]      = None
    ip_address: Optional[str]      = None
    user_agent: Optional[str]      = None
    created_at: datetime

    class Config:
        from_attributes = True

# Enhanced Question Schemas
class SubQuestionCreate(BaseModel):
    sub_question_text: str
    sub_question_marks: float

class QuestionCreateEnhanced(QuestionCreate):
    is_optional: bool    = False
    is_sub_question: bool      = False
    sub_question_text: Optional[str]      = None
    sub_question_marks: Optional[float]      = None
    sub_questions: List[SubQuestionCreate] = []

class QuestionResponseEnhanced(QuestionResponse):
    is_optional: bool
    is_sub_question: bool
    sub_question_text: Optional[str]      = None
    sub_question_marks: Optional[float]      = None
    sub_questions: List[dict] = []

# Real-time Analytics Schemas

class PredictiveAnalytics(BaseModel):
    student_id: int
    predicted_performance: float
    confidence_score: float
    risk_factors: List[str]
    recommendations: List[str]
    next_exam_prediction: Optional[float] = None

# Mobile Response Schemas
class MobileDashboardStats(BaseModel):
    user_role: str
    quick_actions: List[dict]
    recent_activities: List[dict]
    notifications_count: int
    pending_tasks: int

# System Monitoring Schemas (merged RealtimeStats definition)
class RealtimeStats(BaseModel):
    timestamp: datetime
    active_users: int
    system_load: float
    memory_usage: float
    database_connections: int
    api_requests_per_minute: int
    cpu_usage: float
    disk_usage: float
    response_time: float

class SystemLogResponse(BaseModel):
    id: int
    level: str
    message: str
    source: str
    details: Optional[dict]      = None
    timestamp: datetime
    
    class Config:
        from_attributes = True

# Exam Section Schemas
class ExamSectionCreate(BaseModel):
    exam_id: int
    name: str
    instructions: Optional[str]      = None
    total_marks: int
    total_questions: Optional[int]      = None
    questions_to_attempt: Optional[int] = None

class ExamSectionUpdate(BaseModel):
    name: Optional[str]      = None
    instructions: Optional[str]      = None
    total_marks: Optional[int]      = None
    total_questions: Optional[int]      = None
    questions_to_attempt: Optional[int] = None

class ExamSectionResponse(BaseModel):
    id: int
    exam_id: int
    name: str
    instructions: Optional[str]      = None
    total_marks: int
    total_questions: Optional[int]      = None
    questions_to_attempt: Optional[int]      = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Bulk Mark Entry Schema
class BulkMarkEntry(BaseModel):
    exam_id: int
    marks_data: List[dict]

# Export Request Schema
class ExportRequest(BaseModel):
    export_type: str  # "pdf", "excel", "csv"
    data_type: str   # "marks", "students", "exams", "analytics"
    filters: Optional[dict]      = None
    date_range: Optional[dict]      = None
    format_options: Optional[dict] = None