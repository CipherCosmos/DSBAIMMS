from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict
from pydantic import BaseModel
from datetime import datetime
import json

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Exam, AuditLog
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

@app.get("/", response_model=Dict[str, str])
async def root():
    return {"message": "Analytics Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/analytics/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get dashboard statistics"""
    try:
        # Get basic counts
        total_users = db.query(User).count()
        total_departments = db.query(Department).count()
        total_classes = db.query(Class).count()
        total_subjects = db.query(Subject).count()
        total_exams = db.query(Exam).count()
        
        # Get active users
        active_students = db.query(User).filter(User.role == "student", User.is_active == True).count()
        active_teachers = db.query(User).filter(User.role == "teacher", User.is_active == True).count()
        
        return DashboardStats(
            total_users=total_users,
            total_departments=total_departments,
            total_classes=total_classes,
            total_subjects=total_subjects,
            total_exams=total_exams,
            active_students=active_students,
            active_teachers=active_teachers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard stats: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)
