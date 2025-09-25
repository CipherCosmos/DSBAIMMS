# Additional schemas for enhanced semester context and missing features
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# Attendance Schemas
class AttendanceBase(BaseModel):
    student_id: int
    subject_id: int
    class_id: int
    semester_id: int
    date: datetime
    status: str  # present, absent, late, excused
    remarks: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceResponse(AttendanceBase):
    id: int
    marked_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Student Performance Schemas
class StudentPerformanceBase(BaseModel):
    student_id: int
    semester_id: int
    subject_id: int
    class_id: int
    total_marks: float = 0.0
    obtained_marks: float = 0.0
    percentage: float = 0.0
    grade: Optional[str] = None
    gpa: float = 0.0
    attendance_percentage: float = 0.0
    co_attainment: Optional[Dict[str, Any]] = None
    po_attainment: Optional[Dict[str, Any]] = None
    bloom_attainment: Optional[Dict[str, Any]] = None
    difficulty_mastery: Optional[Dict[str, Any]] = None

class StudentPerformanceCreate(StudentPerformanceBase):
    pass

class StudentPerformanceUpdate(BaseModel):
    total_marks: Optional[float] = None
    obtained_marks: Optional[float] = None
    percentage: Optional[float] = None
    grade: Optional[str] = None
    gpa: Optional[float] = None
    attendance_percentage: Optional[float] = None
    co_attainment: Optional[Dict[str, Any]] = None
    po_attainment: Optional[Dict[str, Any]] = None
    bloom_attainment: Optional[Dict[str, Any]] = None
    difficulty_mastery: Optional[Dict[str, Any]] = None

class StudentPerformanceResponse(StudentPerformanceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# CO Attainment Schemas
class COAttainmentBase(BaseModel):
    co_id: int
    semester_id: int
    class_id: int
    subject_id: int
    attainment_percentage: float = 0.0
    target_percentage: float = 70.0
    student_count: int = 0
    average_score: float = 0.0
    bloom_distribution: Optional[Dict[str, Any]] = None
    difficulty_distribution: Optional[Dict[str, Any]] = None

class COAttainmentCreate(COAttainmentBase):
    pass

class COAttainmentUpdate(BaseModel):
    attainment_percentage: Optional[float] = None
    target_percentage: Optional[float] = None
    student_count: Optional[int] = None
    average_score: Optional[float] = None
    bloom_distribution: Optional[Dict[str, Any]] = None
    difficulty_distribution: Optional[Dict[str, Any]] = None

class COAttainmentResponse(COAttainmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# PO Attainment Schemas
class POAttainmentBase(BaseModel):
    po_id: int
    semester_id: int
    class_id: int
    department_id: int
    attainment_percentage: float = 0.0
    target_percentage: float = 70.0
    student_count: int = 0
    average_score: float = 0.0
    co_contributions: Optional[Dict[str, Any]] = None

class POAttainmentCreate(POAttainmentBase):
    pass

class POAttainmentUpdate(BaseModel):
    attainment_percentage: Optional[float] = None
    target_percentage: Optional[float] = None
    student_count: Optional[int] = None
    average_score: Optional[float] = None
    co_contributions: Optional[Dict[str, Any]] = None

class POAttainmentResponse(POAttainmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# System Metrics Schemas
class SystemMetricsBase(BaseModel):
    metric_name: str
    metric_value: float
    metric_unit: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SystemMetricsCreate(SystemMetricsBase):
    pass

class SystemMetricsResponse(SystemMetricsBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True

# User Activity Schemas
class UserActivityBase(BaseModel):
    user_id: int
    activity_type: str
    activity_description: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class UserActivityCreate(UserActivityBase):
    pass

class UserActivityResponse(UserActivityBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Notification Template Schemas
class NotificationTemplateBase(BaseModel):
    name: str
    template_type: str
    subject: Optional[str] = None
    body: str
    variables: Optional[Dict[str, Any]] = None
    is_active: bool = True

class NotificationTemplateCreate(NotificationTemplateBase):
    pass

class NotificationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    template_type: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class NotificationTemplateResponse(NotificationTemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# File Upload Schemas
class FileUploadBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: Optional[str] = None
    file_type: Optional[str] = None
    uploaded_by: int
    department_id: Optional[int] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    semester_id: Optional[int] = None
    is_public: bool = False

class FileUploadCreate(FileUploadBase):
    pass

class FileUploadUpdate(BaseModel):
    filename: Optional[str] = None
    is_public: Optional[bool] = None

class FileUploadResponse(FileUploadBase):
    id: int
    download_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Analytics Schemas
class AnalyticsDashboardStats(BaseModel):
    total_users: int
    total_departments: int
    total_classes: int
    total_subjects: int
    total_exams: int
    total_students: int
    total_teachers: int
    active_semesters: int
    recent_activities: List[Dict[str, Any]]

class COPOAnalytics(BaseModel):
    co_id: int
    co_name: str
    po_id: int
    po_name: str
    mapping_strength: float
    attainment_percentage: float
    student_count: int
    average_score: float
    bloom_distribution: Dict[str, int]
    difficulty_distribution: Dict[str, int]

class StudentPerformanceAnalytics(BaseModel):
    student_id: int
    student_name: str
    semester_id: int
    semester_name: str
    class_id: int
    class_name: str
    total_subjects: int
    completed_subjects: int
    overall_percentage: float
    overall_grade: str
    gpa: float
    attendance_percentage: float
    co_attainment: Dict[str, float]
    po_attainment: Dict[str, float]
    bloom_mastery: Dict[str, float]
    difficulty_mastery: Dict[str, float]

class ExamAnalytics(BaseModel):
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
    bloom_distribution: Dict[str, Any]
    difficulty_analysis: Dict[str, Any]

# Bulk Operations Schemas
class BulkUploadResponse(BaseModel):
    success_count: int
    error_count: int
    errors: List[Dict[str, Any]]
    message: str

class BulkUserCreate(BaseModel):
    users: List[Dict[str, Any]]
    department_id: Optional[int] = None
    class_id: Optional[int] = None
    semester_id: Optional[int] = None

class BulkMarksUpload(BaseModel):
    exam_id: int
    marks_data: List[Dict[str, Any]]

class BulkQuestionsUpload(BaseModel):
    exam_id: int
    questions_data: List[Dict[str, Any]]
