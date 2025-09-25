# Additional models for enhanced semester context and missing features
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.types import DECIMAL as Decimal
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()

class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False)  # present, absent, late, excused
    remarks = Column(Text)
    marked_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    subject = relationship("Subject")
    class_assigned = relationship("Class")
    semester = relationship("Semester")
    marker = relationship("User", foreign_keys=[marked_by])

class StudentPerformance(Base):
    __tablename__ = "student_performance"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    total_marks = Column(Decimal(5,2), default=0.0)
    obtained_marks = Column(Decimal(5,2), default=0.0)
    percentage = Column(Decimal(5,2), default=0.0)
    grade = Column(String(5))
    gpa = Column(Decimal(3,2), default=0.0)
    attendance_percentage = Column(Decimal(5,2), default=0.0)
    co_attainment = Column(JSON)
    po_attainment = Column(JSON)
    bloom_attainment = Column(JSON)
    difficulty_mastery = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    semester = relationship("Semester")
    subject = relationship("Subject")
    class_assigned = relationship("Class")

class COAttainment(Base):
    __tablename__ = "co_attainment"
    
    id = Column(Integer, primary_key=True, index=True)
    co_id = Column(Integer, ForeignKey("cos.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    attainment_percentage = Column(Decimal(5,2), default=0.0)
    target_percentage = Column(Decimal(5,2), default=70.0)
    student_count = Column(Integer, default=0)
    average_score = Column(Decimal(5,2), default=0.0)
    bloom_distribution = Column(JSON)
    difficulty_distribution = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    co = relationship("CO")
    semester = relationship("Semester")
    class_assigned = relationship("Class")
    subject = relationship("Subject")

class POAttainment(Base):
    __tablename__ = "po_attainment"
    
    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("pos.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    attainment_percentage = Column(Decimal(5,2), default=0.0)
    target_percentage = Column(Decimal(5,2), default=70.0)
    student_count = Column(Integer, default=0)
    average_score = Column(Decimal(5,2), default=0.0)
    co_contributions = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    po = relationship("PO")
    semester = relationship("Semester")
    class_assigned = relationship("Class")
    department = relationship("Department")

class SystemMetrics(Base):
    __tablename__ = "system_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Decimal(10,4), nullable=False)
    metric_unit = Column(String(20))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    metadata = Column(JSON)

class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)
    activity_description = Column(Text)
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    metadata = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])

class NotificationTemplate(Base):
    __tablename__ = "notification_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    template_type = Column(String(50), nullable=False)
    subject = Column(String(200))
    body = Column(Text, nullable=False)
    variables = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class FileUpload(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100))
    file_type = Column(String(50))
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    is_public = Column(Boolean, default=False)
    download_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by])
    department = relationship("Department")
    class_assigned = relationship("Class")
    subject = relationship("Subject")
    semester = relationship("Semester")
