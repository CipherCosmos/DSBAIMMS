from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import json,

from shared.database import get_db
from shared.models import User, Department, Class, Subject, TeacherSubject
from shared.schemas import UserCreate, UserUpdate, UserResponse
from shared.auth import RoleChecker,

app = FastAPI(title="User Service", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "User Service is running"}

@app.get("/users")
async def get_users(
    skip: int   = 0,
    limit: int   = 100,
    department_id: Optional[int]   = None,
    role: Optional[str]   = None,
    search: Optional[str]   = None,
    db: Session   = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get all users with optional filtering"""
    query = db.query(User)
    
    if department_id:
        query = query.filter(User.department_id == department_id)
    if role:
        query = query.filter(User.role == role)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.username.ilike(f"%{search}%"))
        )
    
    users = query.offset(skip).limit(limit).all()
    
    result = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "phone": user.phone,
            "address": user.address,
            "department_id": user.department_id,
            "class_id": user.class_id,
            "student_id": user.student_id,
            "employee_id": user.employee_id,
            "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
            "gender": user.gender,
            "qualification": user.qualification,
            "experience_years": user.experience_years,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "department_name": None,
            "class_name": None,
            "subjects": []
        }
        
        # Get department name,
        if user.department_id:
            dept = db.query(Department).filter(Department.id == user.department_id).first()
            if dept:
                user_dict["department_name"] = dept.name
        
        # Get class name,
        if user.class_id:
            cls = db.query(Class).filter(Class.id == user.class_id).first()
            if cls:
                user_dict["class_name"] = cls.name
        
        # Get subjects for teachers,
        if user.role == "teacher":
            teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
            for ts in teacher_subjects:
                subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
                if subject:
                    user_dict["subjects"].append({
                        "id": subject.id,
                        "name": subject.name,
                        "code": subject.code
                    })
        
        result.append(user_dict)
    
    return result

@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: Session   = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get a specific user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_dict = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "phone": user.phone,
        "address": user.address,
        "department_id": user.department_id,
        "class_id": user.class_id,
        "student_id": user.student_id,
        "employee_id": user.employee_id,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "gender": user.gender,
        "qualification": user.qualification,
        "experience_years": user.experience_years,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "department_name": None,
        "class_name": None,
        "subjects": []
    }
    
    # Get department name,
    if user.department_id:
        dept = db.query(Department).filter(Department.id == user.department_id).first()
        if dept:
            user_dict["department_name"] = dept.name
    
    # Get class name,
    if user.class_id:
        cls = db.query(Class).filter(Class.id == user.class_id).first()
        if cls:
            user_dict["class_name"] = cls.name
    
    # Get subjects for teachers,
    if user.role == "teacher":
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
        for ts in teacher_subjects:
            subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
            if subject:
                user_dict["subjects"].append({
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code
                })
    
    return user_dict

@app.get("/stats")
async def get_user_stats(
    db: Session   = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get user statistics"""
    try:
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        inactive_users = total_users - active_users
        
        # Get role counts,
        role_counts = {}
        for role in ["admin", "hod", "teacher", "student"]:
            count = db.query(User).filter(User.role == role, User.is_active == True).count()
            role_counts[role] = count,
        
        return {
            "total": total_users,
            "active": active_users,
            "inactive": inactive_users,
            "roles": len([r for r in role_counts.values() if r > 0]),
            "byRole": role_counts
        }
    except Exception as e:
        return {
            "total": 0,
            "active": 0,
            "inactive": 0,
            "roles": 0,
            "byRole": {"admin": 0, "hod": 0, "teacher": 0, "student": 0}
        }

if __name__ == "__main__":
    import uvicorn,
    uvicorn.run(app, host="0.0.0.0", port=8011)


