from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime, date
import json
import csv
import io
import pandas as pd
from io import StringIO, BytesIO

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Exam, AuditLog, Mark, Question, CO, PO, COPOMapping
from shared.auth import RoleChecker

app = FastAPI(title="Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class DashboardStats(BaseModel):
    total_users: int
    total_departments: int
    total_classes: int
    total_subjects: int
    total_exams: int
    active_students: int
    active_teachers: int
    total_marks: int
    average_performance: float
    recent_activities: List[Dict]

class PerformanceAnalytics(BaseModel):
    department_performance: Dict[str, float]
    class_performance: Dict[str, float]
    subject_performance: Dict[str, float]
    teacher_performance: Dict[str, float]
    semester_trends: Dict[str, float]
    co_po_attainment: Dict[str, float]

class StudentAnalytics(BaseModel):
    student_id: int
    student_name: str
    department: str
    class_name: str
    total_exams: int
    average_percentage: float
    grade_distribution: Dict[str, int]
    improvement_trend: List[Dict]
    co_attainment: Dict[str, float]
    attendance_percentage: float

class TeacherAnalytics(BaseModel):
    teacher_id: int
    teacher_name: str
    department: str
    subjects_taught: List[str]
    total_students: int
    average_class_performance: float
    exam_creation_count: int
    question_bank_size: int
    student_feedback_score: float

class DepartmentAnalytics(BaseModel):
    department_id: int
    department_name: str
    total_students: int
    total_teachers: int
    total_subjects: int
    average_performance: float
    pass_rate: float
    top_performing_classes: List[Dict]
    improvement_areas: List[str]

@app.get("/", response_model=Dict[str, str])
async def root():
    return {"message": "Analytics Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/analytics/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive dashboard statistics"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Build base queries with role-based filtering
        users_query = db.query(User)
        departments_query = db.query(Department)
        classes_query = db.query(Class)
        subjects_query = db.query(Subject)
        exams_query = db.query(Exam)
        
        # Apply role-based filtering
        if current_user.role == "hod":
            departments_query = departments_query.filter(Department.id == current_user.department_id)
            users_query = users_query.filter(User.department_id == current_user.department_id)
            classes_query = classes_query.join(Department).filter(Department.id == current_user.department_id)
            subjects_query = subjects_query.join(Department).filter(Department.id == current_user.department_id)
            exams_query = exams_query.join(Subject).join(Department).filter(Department.id == current_user.department_id)
        elif current_user.role == "teacher":
            # Teachers can only see their department's data
            users_query = users_query.filter(User.department_id == current_user.department_id)
            departments_query = departments_query.filter(Department.id == current_user.department_id)
            classes_query = classes_query.join(Department).filter(Department.id == current_user.department_id)
            subjects_query = subjects_query.filter(Subject.teacher_id == current_user_id)
            exams_query = exams_query.filter(Exam.created_by == current_user_id)
        
        # Get basic counts
        total_users = users_query.count()
        total_departments = departments_query.count()
        total_classes = classes_query.count()
        total_subjects = subjects_query.count()
        total_exams = exams_query.count()
        
        # Get active users
        active_students = users_query.filter(User.role == "student", User.is_active == True).count()
        active_teachers = users_query.filter(User.role == "teacher", User.is_active == True).count()
        
        # Get marks statistics
        marks_query = db.query(Mark)
        if current_user.role == "hod":
            marks_query = marks_query.join(Exam).join(Subject).join(Department).filter(Department.id == current_user.department_id)
        elif current_user.role == "teacher":
            marks_query = marks_query.join(Exam).filter(Exam.created_by == current_user_id)
        
        total_marks = marks_query.count()
        
        # Calculate average performance
        marks_data = marks_query.all()
        if marks_data:
            total_obtained = sum(float(mark.marks_obtained) for mark in marks_data)
            total_maximum = sum(float(mark.max_marks) for mark in marks_data)
            average_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
        else:
            average_performance = 0.0
        
        # Get recent activities (last 10 audit logs)
        audit_query = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
        recent_activities = []
        for audit in audit_query.all():
            recent_activities.append({
                "action": audit.action,
                "table_name": audit.table_name,
                "user_id": audit.user_id,
                "created_at": audit.created_at.isoformat(),
                "ip_address": audit.ip_address
            })
        
        return DashboardStats(
            total_users=total_users,
            total_departments=total_departments,
            total_classes=total_classes,
            total_subjects=total_subjects,
            total_exams=total_exams,
            active_students=active_students,
            active_teachers=active_teachers,
            total_marks=total_marks,
            average_performance=average_performance,
            recent_activities=recent_activities
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard stats: {str(e)}")

# Comprehensive Analytics Endpoints
@app.get("/api/analytics/performance", response_model=PerformanceAnalytics)
async def get_performance_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive performance analytics"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Department performance
        departments_query = db.query(Department)
        if current_user.role == "hod":
            departments_query = departments_query.filter(Department.id == current_user.department_id)
        elif department_id and current_user.role == "admin":
            departments_query = departments_query.filter(Department.id == department_id)
        
        departments = departments_query.all()
        department_performance = {}
        
        for dept in departments:
            # Calculate department average performance
            dept_marks = db.query(Mark).join(Exam).join(Subject).filter(Subject.department_id == dept.id).all()
            if dept_marks:
                total_obtained = sum(float(mark.marks_obtained) for mark in dept_marks)
                total_maximum = sum(float(mark.max_marks) for mark in dept_marks)
                avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
            else:
                avg_performance = 0.0
            department_performance[dept.name] = avg_performance
        
        # Class performance
        classes_query = db.query(Class)
        if current_user.role == "hod":
            classes_query = classes_query.join(Department).filter(Department.id == current_user.department_id)
        
        classes = classes_query.all()
        class_performance = {}
        
        for class_obj in classes:
            # Calculate class average performance
            class_marks = db.query(Mark).join(Exam).filter(Exam.class_id == class_obj.id).all()
            if class_marks:
                total_obtained = sum(float(mark.marks_obtained) for mark in class_marks)
                total_maximum = sum(float(mark.max_marks) for mark in class_marks)
                avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
            else:
                avg_performance = 0.0
            class_performance[f"{class_obj.name} - {class_obj.department.name}"] = avg_performance
        
        # Subject performance
        subjects_query = db.query(Subject)
        if current_user.role == "hod":
            subjects_query = subjects_query.join(Department).filter(Department.id == current_user.department_id)
        elif current_user.role == "teacher":
            subjects_query = subjects_query.filter(Subject.teacher_id == current_user_id)
        
        subjects = subjects_query.all()
        subject_performance = {}
        
        for subject in subjects:
            # Calculate subject average performance
            subject_marks = db.query(Mark).join(Exam).filter(Exam.subject_id == subject.id).all()
            if subject_marks:
                total_obtained = sum(float(mark.marks_obtained) for mark in subject_marks)
                total_maximum = sum(float(mark.max_marks) for mark in subject_marks)
                avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
            else:
                avg_performance = 0.0
            subject_performance[subject.name] = avg_performance
        
        # Teacher performance
        teachers_query = db.query(User).filter(User.role == "teacher")
        if current_user.role == "hod":
            teachers_query = teachers_query.filter(User.department_id == current_user.department_id)
        
        teachers = teachers_query.all()
        teacher_performance = {}
        
        for teacher in teachers:
            # Calculate teacher's class average performance
            teacher_subjects = db.query(Subject).filter(Subject.teacher_id == teacher.id).all()
            subject_ids = [subject.id for subject in teacher_subjects]
            
            if subject_ids:
                teacher_marks = db.query(Mark).join(Exam).filter(Exam.subject_id.in_(subject_ids)).all()
                if teacher_marks:
                    total_obtained = sum(float(mark.marks_obtained) for mark in teacher_marks)
                    total_maximum = sum(float(mark.max_marks) for mark in teacher_marks)
                    avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
                else:
                    avg_performance = 0.0
            else:
                avg_performance = 0.0
            
            teacher_performance[f"{teacher.first_name} {teacher.last_name}"] = avg_performance
        
        # Semester trends (placeholder - would need semester data)
        semester_trends = {"Current": 75.5, "Previous": 72.3, "Trend": 3.2}
        
        # CO/PO attainment (placeholder - would integrate with COPO service)
        co_po_attainment = {"CO1": 85.2, "CO2": 78.9, "PO1": 82.1, "PO2": 76.4}
        
        return PerformanceAnalytics(
            department_performance=department_performance,
            class_performance=class_performance,
            subject_performance=subject_performance,
            teacher_performance=teacher_performance,
            semester_trends=semester_trends,
            co_po_attainment=co_po_attainment
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching performance analytics: {str(e)}")

@app.get("/api/analytics/students/{student_id}", response_model=StudentAnalytics)
async def get_student_analytics(
    student_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get detailed student analytics"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Check permissions
        if current_user.role == "student" and current_user_id != student_id:
            raise HTTPException(status_code=403, detail="Students can only view their own analytics")
        
        # Get student
        student = db.query(User).filter(User.id == student_id, User.role == "student").first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Check department access for HOD
        if current_user.role == "hod" and current_user.department_id != student.department_id:
            raise HTTPException(status_code=403, detail="Access denied to student from different department")
        
        # Get student's marks
        student_marks = db.query(Mark).filter(Mark.student_id == student_id).all()
        
        # Calculate performance metrics
        total_exams = len(student_marks)
        if student_marks:
            total_obtained = sum(float(mark.marks_obtained) for mark in student_marks)
            total_maximum = sum(float(mark.max_marks) for mark in student_marks)
            average_percentage = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
        else:
            average_percentage = 0.0
        
        # Grade distribution
        grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        for mark in student_marks:
            percentage = (float(mark.marks_obtained) / float(mark.max_marks) * 100) if mark.max_marks > 0 else 0
            if percentage >= 90:
                grade_distribution["A+"] += 1
            elif percentage >= 80:
                grade_distribution["A"] += 1
            elif percentage >= 70:
                grade_distribution["B+"] += 1
            elif percentage >= 60:
                grade_distribution["B"] += 1
            elif percentage >= 50:
                grade_distribution["C"] += 1
            elif percentage >= 40:
                grade_distribution["D"] += 1
            else:
                grade_distribution["F"] += 1
        
        # Improvement trend (last 10 exams)
        recent_marks = sorted(student_marks, key=lambda x: x.created_at, reverse=True)[:10]
        improvement_trend = []
        for mark in reversed(recent_marks):
            percentage = (float(mark.marks_obtained) / float(mark.max_marks) * 100) if mark.max_marks > 0 else 0
            improvement_trend.append({
                "exam_name": mark.exam.name if mark.exam else "Unknown",
                "percentage": round(percentage, 2),
                "date": mark.created_at.isoformat()
            })
        
        # CO attainment (placeholder - would integrate with COPO service)
        co_attainment = {"CO1": 85.2, "CO2": 78.9, "CO3": 82.1}
        
        # Attendance percentage (placeholder - would integrate with attendance service)
        attendance_percentage = 87.5
        
        return StudentAnalytics(
            student_id=student.id,
            student_name=f"{student.first_name} {student.last_name}",
            department=student.department.name if student.department else "Unknown",
            class_name=student.class_rel.name if student.class_rel else "Unknown",
            total_exams=total_exams,
            average_percentage=average_percentage,
            grade_distribution=grade_distribution,
            improvement_trend=improvement_trend,
            co_attainment=co_attainment,
            attendance_percentage=attendance_percentage
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching student analytics: {str(e)}")

@app.get("/api/analytics/teachers/{teacher_id}", response_model=TeacherAnalytics)
async def get_teacher_analytics(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get detailed teacher analytics"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Get teacher
        teacher = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        # Check department access for HOD
        if current_user.role == "hod" and current_user.department_id != teacher.department_id:
            raise HTTPException(status_code=403, detail="Access denied to teacher from different department")
        
        # Get teacher's subjects
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == teacher_id).all()
        subjects_taught = [subject.name for subject in teacher_subjects]
        
        # Get total students taught by this teacher
        subject_ids = [subject.id for subject in teacher_subjects]
        total_students = 0
        if subject_ids:
            total_students = db.query(User).filter(
                User.role == "student",
                User.class_id.in_([subject.class_id for subject in teacher_subjects])
            ).count()
        
        # Calculate average class performance
        teacher_marks = db.query(Mark).join(Exam).filter(Exam.subject_id.in_(subject_ids)).all() if subject_ids else []
        if teacher_marks:
            total_obtained = sum(float(mark.marks_obtained) for mark in teacher_marks)
            total_maximum = sum(float(mark.max_marks) for mark in teacher_marks)
            average_class_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
        else:
            average_class_performance = 0.0
        
        # Get exam creation count
        exam_creation_count = db.query(Exam).filter(Exam.created_by == teacher_id).count()
        
        # Get question bank size
        question_bank_size = db.query(Question).filter(Question.created_by == teacher_id).count()
        
        # Student feedback score (placeholder)
        student_feedback_score = 4.2
        
        return TeacherAnalytics(
            teacher_id=teacher.id,
            teacher_name=f"{teacher.first_name} {teacher.last_name}",
            department=teacher.department.name if teacher.department else "Unknown",
            subjects_taught=subjects_taught,
            total_students=total_students,
            average_class_performance=average_class_performance,
            exam_creation_count=exam_creation_count,
            question_bank_size=question_bank_size,
            student_feedback_score=student_feedback_score
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching teacher analytics: {str(e)}")

@app.get("/api/analytics/departments/{department_id}", response_model=DepartmentAnalytics)
async def get_department_analytics(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get detailed department analytics"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Check department access for HOD
        if current_user.role == "hod" and current_user.department_id != department_id:
            raise HTTPException(status_code=403, detail="Access denied to different department")
        
        # Get department
        department = db.query(Department).filter(Department.id == department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        
        # Get department statistics
        total_students = db.query(User).filter(User.role == "student", User.department_id == department_id).count()
        total_teachers = db.query(User).filter(User.role == "teacher", User.department_id == department_id).count()
        total_subjects = db.query(Subject).filter(Subject.department_id == department_id).count()
        
        # Calculate department average performance
        dept_marks = db.query(Mark).join(Exam).join(Subject).filter(Subject.department_id == department_id).all()
        if dept_marks:
            total_obtained = sum(float(mark.marks_obtained) for mark in dept_marks)
            total_maximum = sum(float(mark.max_marks) for mark in dept_marks)
            average_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
            
            # Calculate pass rate (40% and above)
            passing_marks = len([m for m in dept_marks if float(m.marks_obtained) >= float(m.max_marks) * 0.4])
            pass_rate = round((passing_marks / len(dept_marks) * 100), 2) if dept_marks else 0
        else:
            average_performance = 0.0
            pass_rate = 0.0
        
        # Get top performing classes
        classes = db.query(Class).filter(Class.department_id == department_id).all()
        top_performing_classes = []
        
        for class_obj in classes:
            class_marks = db.query(Mark).join(Exam).filter(Exam.class_id == class_obj.id).all()
            if class_marks:
                total_obtained = sum(float(mark.marks_obtained) for mark in class_marks)
                total_maximum = sum(float(mark.max_marks) for mark in class_marks)
                avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
            else:
                avg_performance = 0.0
            
            top_performing_classes.append({
                "class_name": class_obj.name,
                "average_performance": avg_performance,
                "total_students": db.query(User).filter(User.class_id == class_obj.id, User.role == "student").count()
            })
        
        # Sort by performance
        top_performing_classes.sort(key=lambda x: x["average_performance"], reverse=True)
        top_performing_classes = top_performing_classes[:5]  # Top 5
        
        # Improvement areas (placeholder)
        improvement_areas = ["Mathematics", "Programming", "Communication Skills"]
        
        return DepartmentAnalytics(
            department_id=department.id,
            department_name=department.name,
            total_students=total_students,
            total_teachers=total_teachers,
            total_subjects=total_subjects,
            average_performance=average_performance,
            pass_rate=pass_rate,
            top_performing_classes=top_performing_classes,
            improvement_areas=improvement_areas
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching department analytics: {str(e)}")

@app.get("/api/analytics/departments")
async def get_department_analytics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get department analytics"""
    try:
        departments = db.query(Department).all()
        return {
            "departments": [
                {
                    "id": dept.id,
                    "name": dept.name,
                    "code": dept.code,
                    "hod_name": dept.hod_name,
                    "created_at": dept.created_at.isoformat() if dept.created_at else None
                }
                for dept in departments
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching department analytics: {str(e)}")

@app.get("/api/analytics/classes")
async def get_class_analytics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get class analytics"""
    try:
        classes = db.query(Class).all()
        return {
            "classes": [
                {
                    "id": cls.id,
                    "name": cls.name,
                    "department_id": cls.department_id,
                    "created_at": cls.created_at.isoformat() if cls.created_at else None
                }
                for cls in classes
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching class analytics: {str(e)}")

@app.get("/api/analytics/students")
async def get_student_analytics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get student analytics"""
    try:
        students = db.query(User).filter(User.role == "student").all()
        return {
            "students": [
                {
                    "id": student.id,
                    "username": student.username,
                    "full_name": student.full_name,
                    "email": student.email,
                    "department_id": student.department_id,
                    "class_id": student.class_id,
                    "is_active": student.is_active
                }
                for student in students
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching student analytics: {str(e)}")

@app.get("/api/analytics/exams")
async def get_exam_analytics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get exam analytics"""
    try:
        exams = db.query(Exam).all()
        return {
            "exams": [
                {
                    "id": exam.id,
                    "title": exam.title,
                    "subject_id": exam.subject_id,
                    "class_id": exam.class_id,
                    "total_marks": exam.total_marks,
                    "duration_minutes": exam.duration_minutes,
                    "exam_date": exam.exam_date.isoformat() if exam.exam_date else None,
                    "status": exam.status
                }
                for exam in exams
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching exam analytics: {str(e)}")

@app.get("/api/analytics/co-po")
async def get_copo_analytics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get CO/PO analytics"""
    try:
        # Return basic CO/PO analytics
        return {
            "co_po_analytics": [],
            "message": "CO/PO analytics will be available when CO/PO service is running"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching CO/PO analytics: {str(e)}")

# Export Functionality
@app.get("/api/analytics/export/users")
async def export_users(
    format: str = Query("csv", regex="^(csv|excel|pdf)$"),
    department_id: Optional[int] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Export users data"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Build query with role-based filtering
    query = db.query(User).options(
        joinedload(User.department),
        joinedload(User.class_rel)
    )
    
    if current_user.role == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    
    if department_id and current_user.role == "admin":
        query = query.filter(User.department_id == department_id)
    
    if role:
        query = query.filter(User.role == role)
    
    users = query.all()
    
    # Prepare data for export
    data = []
    for user in users:
        data.append({
            "ID": user.id,
            "Username": user.username,
            "Email": user.email,
            "First Name": user.first_name,
            "Last Name": user.last_name,
            "Role": user.role,
            "Department": user.department.name if user.department else None,
            "Class": user.class_rel.name if user.class_rel else None,
            "Student ID": user.student_id,
            "Employee ID": user.employee_id,
            "Phone": user.phone,
            "Address": user.address,
            "Date of Birth": user.date_of_birth,
            "Gender": user.gender,
            "Qualification": user.qualification,
            "Experience Years": user.experience_years,
            "Specializations": user.specializations,
            "Is Active": user.is_active,
            "Created At": user.created_at,
            "Updated At": user.updated_at
        })
    
    if format == "csv":
        return export_csv(data, "users_export.csv")
    elif format == "excel":
        return export_excel(data, "users_export.xlsx")
    elif format == "pdf":
        return export_pdf(data, "users_export.pdf")

@app.get("/api/analytics/export/students")
async def export_students(
    format: str = Query("csv", regex="^(csv|excel|pdf)$"),
    department_id: Optional[int] = None,
    class_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export students data with performance metrics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Build query for students
    query = db.query(User).filter(User.role == "student").options(
        joinedload(User.department),
        joinedload(User.class_rel)
    )
    
    if current_user.role == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see students in their classes
        teacher_classes = db.query(Class).filter(Class.teacher_id == current_user_id).all()
        class_ids = [cls.id for cls in teacher_classes]
        if class_ids:
            query = query.filter(User.class_id.in_(class_ids))
        else:
            query = query.filter(False)
    
    if department_id and current_user.role == "admin":
        query = query.filter(User.department_id == department_id)
    
    if class_id:
        query = query.filter(User.class_id == class_id)
    
    students = query.all()
    
    # Prepare data with performance metrics
    data = []
    for student in students:
        # Get student's marks for performance calculation
        marks = db.query(Mark).filter(Mark.student_id == student.id).all()
        
        total_marks = sum(float(mark.marks_obtained) for mark in marks) if marks else 0
        total_max_marks = sum(float(mark.max_marks) for mark in marks) if marks else 0
        average_percentage = (total_marks / total_max_marks * 100) if total_max_marks > 0 else 0
        
        data.append({
            "Student ID": student.student_id,
            "First Name": student.first_name,
            "Last Name": student.last_name,
            "Email": student.email,
            "Department": student.department.name if student.department else None,
            "Class": student.class_rel.name if student.class_rel else None,
            "Phone": student.phone,
            "Date of Birth": student.date_of_birth,
            "Gender": student.gender,
            "Total Marks": total_marks,
            "Total Max Marks": total_max_marks,
            "Average Percentage": round(average_percentage, 2),
            "Exams Attempted": len(marks),
            "Is Active": student.is_active,
            "Created At": student.created_at
        })
    
    if format == "csv":
        return export_csv(data, "students_export.csv")
    elif format == "excel":
        return export_excel(data, "students_export.xlsx")
    elif format == "pdf":
        return export_pdf(data, "students_export.pdf")

@app.get("/api/analytics/export/exams")
async def export_exams(
    format: str = Query("csv", regex="^(csv|excel|pdf)$"),
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export exams data with analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Build query for exams
    query = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_rel)
    )
    
    if current_user.role == "hod":
        query = query.join(Subject).filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see exams for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.filter(Exam.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)
    
    if subject_id:
        query = query.filter(Exam.subject_id == subject_id)
    if class_id:
        query = query.filter(Exam.class_id == class_id)
    if department_id and current_user.role == "admin":
        query = query.join(Subject).filter(Subject.department_id == department_id)
    
    exams = query.all()
    
    # Prepare data with analytics
    data = []
    for exam in exams:
        # Get exam statistics
        marks = db.query(Mark).filter(Mark.exam_id == exam.id).all()
        
        total_attempts = len(marks)
        total_marks = sum(float(mark.marks_obtained) for mark in marks) if marks else 0
        total_max_marks = sum(float(mark.max_marks) for mark in marks) if marks else 0
        average_percentage = (total_marks / total_max_marks * 100) if total_max_marks > 0 else 0
        passing_count = len([m for m in marks if float(m.marks_obtained) >= float(m.max_marks) * 0.4])  # 40% passing
        passing_rate = (passing_count / total_attempts * 100) if total_attempts > 0 else 0
        
        data.append({
            "Exam ID": exam.id,
            "Exam Name": exam.name,
            "Subject": exam.subject.name if exam.subject else None,
            "Class": exam.class_rel.name if exam.class_rel else None,
            "Department": exam.subject.department.name if exam.subject and exam.subject.department else None,
            "Exam Date": exam.exam_date,
            "Duration": exam.duration_minutes,
            "Total Marks": exam.total_marks,
            "Total Attempts": total_attempts,
            "Average Percentage": round(average_percentage, 2),
            "Passing Rate": round(passing_rate, 2),
            "Status": exam.status,
            "Created At": exam.created_at
        })
    
    if format == "csv":
        return export_csv(data, "exams_export.csv")
    elif format == "excel":
        return export_excel(data, "exams_export.xlsx")
    elif format == "pdf":
        return export_pdf(data, "exams_export.pdf")

@app.get("/api/analytics/export/marks")
async def export_marks(
    format: str = Query("csv", regex="^(csv|excel|pdf)$"),
    student_id: Optional[int] = None,
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export marks data"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Build query for marks
    query = db.query(Mark).options(
        joinedload(Mark.exam),
        joinedload(Mark.student)
    )
    
    if current_user.role == "hod":
        query = query.join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see marks for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.join(Exam).filter(Exam.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)
    
    if student_id:
        query = query.filter(Mark.student_id == student_id)
    if exam_id:
        query = query.filter(Mark.exam_id == exam_id)
    if subject_id:
        query = query.join(Exam).filter(Exam.subject_id == subject_id)
    if class_id:
        query = query.join(Exam).filter(Exam.class_id == class_id)
    
    marks = query.all()
    
    # Prepare data
    data = []
    for mark in marks:
        percentage = (float(mark.marks_obtained) / float(mark.max_marks) * 100) if mark.max_marks > 0 else 0
        grade = "A+" if percentage >= 90 else "A" if percentage >= 80 else "B+" if percentage >= 70 else "B" if percentage >= 60 else "C" if percentage >= 50 else "D" if percentage >= 40 else "F"
        
        data.append({
            "Student ID": mark.student.student_id if mark.student else None,
            "Student Name": f"{mark.student.first_name} {mark.student.last_name}" if mark.student else None,
            "Exam Name": mark.exam.name if mark.exam else None,
            "Subject": mark.exam.subject.name if mark.exam and mark.exam.subject else None,
            "Class": mark.exam.class_rel.name if mark.exam and mark.exam.class_rel else None,
            "Marks Obtained": mark.marks_obtained,
            "Max Marks": mark.max_marks,
            "Percentage": round(percentage, 2),
            "Grade": grade,
            "Exam Date": mark.exam.exam_date if mark.exam else None,
            "Attempt Number": mark.attempt_number,
            "Is Best Attempt": mark.is_best_attempt,
            "Created At": mark.created_at
        })
    
    if format == "csv":
        return export_csv(data, "marks_export.csv")
    elif format == "excel":
        return export_excel(data, "marks_export.xlsx")
    elif format == "pdf":
        return export_pdf(data, "marks_export.pdf")

# Export Helper Functions
def export_csv(data: List[Dict], filename: str):
    """Export data to CSV format"""
    if not data:
        raise HTTPException(status_code=404, detail="No data to export")
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

def export_excel(data: List[Dict], filename: str):
    """Export data to Excel format"""
    if not data:
        raise HTTPException(status_code=404, detail="No data to export")
    
    df = pd.DataFrame(data)
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Data', index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

def export_pdf(data: List[Dict], filename: str):
    """Export data to PDF format (simplified - in production use reportlab)"""
    if not data:
        raise HTTPException(status_code=404, detail="No data to export")
    
    # For now, return CSV as PDF placeholder
    # In production, implement proper PDF generation using reportlab
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)
