from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json,

from shared.database import get_db
from shared.models import User, Department, Class, AuditLog, Subject, TeacherSubject
from shared.auth import RoleChecker, get_password_hash
from pydantic import BaseModel, EmailStr,

app = FastAPI(title="User Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from shared.schemas import UserCreate, UserUpdate, UserResponse,

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None
    )
    db.add(audit_log)
    db.commit()

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
        
        # Count by role,
        role_counts = {}
        for role in ["admin", "hod", "teacher", "student"]:
            count = db.query(User).filter(User.role == role, User.is_active == True).count()
            role_counts[role] = count
        
        # Count unique roles with active users,
        unique_roles = len([role for role, count in role_counts.items() if count > 0])
        
        return {
            "total": total_users,
            "active": active_users,
            "inactive": inactive_users,
            "roles": unique_roles,
            "byRole": role_counts
        }
    except Exception as e:
        print(f"Error in get_user_stats: {e}")
        return {
            "total": 0,
            "active": 0,
            "inactive": 0,
            "byRole": {"admin": 0, "hod": 0, "teacher": 0, "student": 0}
        }

@app.get("/subjects")
async def get_subjects(
    department_id: Optional[int]   = Query(None),
    db: Session   = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get available subjects"""
    query = db.query(Subject)
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    
    subjects = query.all()
    return [{"id": s.id, "name": s.name, "code": s.code, "department_id": s.department_id} for s in subjects]

@app.get("/export")
async def export_users(
    format: str    = "csv",
    role: Optional[str]     = None,
    department_id: Optional[int]     = None,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Export users in CSV or PDF format"""
    query = db.query(User).options(
        joinedload(User.department),
        joinedload(User.class_assigned)
    )
    
    if role:
        query = query.filter(User.role == role)
    if department_id:
        query = query.filter(User.department_id == department_id)
    
    users = query.all()
    
    if format.lower() == "csv":
        import csv,
        import io,
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header,
        writer.writerow([
            "ID", "Username", "Email", "Full Name", "First Name", "Last Name",
            "Role", "Phone", "Address", "Student ID", "Employee ID",
            "Department", "Class", "Status", "Created At"
        ])
        
        # Write data,
        for user in users:
            writer.writerow([
                user.id, user.username, user.email, user.full_name,
                user.first_name or "", user.last_name or "", user.role,
                user.phone or "", user.address or "", user.student_id or "",
                user.employee_id or "", user.department.name if user.department else "",
                user.class_assigned.name if user.class_assigned else "",
                "Active" if user.is_active else "Inactive",
                user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else ""
            ])
        
        return {"csv_data": output.getvalue()}
    
    elif format.lower() == "pdf":
        # For PDF export, we'll return the data and let frontend handle PDF generation,
        users_data = []
        for user in users:
            users_data.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "phone": user.phone,
                "address": user.address,
                "student_id": user.student_id,
                "employee_id": user.employee_id,
                "department": user.department.name if user.department else "",
                "class": user.class_assigned.name if user.class_assigned else "",
                "status": "Active" if user.is_active else "Inactive",
                "created_at": user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else ""
            })
        
        return {"pdf_data": users_data}
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'pdf'")

@app.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str]     = None,
    department_id: Optional[int]     = None,
    search: Optional[str]     = None,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    query = db.query(User).options(
        joinedload(User.department),
        joinedload(User.class_assigned)
    )
    
    # Get current user to check permissions,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # HOD can only see users in their department,
    if current_user.role == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(User.department_id == department_id)
    
    if role:
        query = query.filter(User.role == role)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            User.full_name.ilike(search_term) |
            User.username.ilike(search_term) |
            User.email.ilike(search_term)
        )
    
    users = query.offset(skip).limit(limit).all()
    
    result = []
    for user in users:
        # Get subject details for teachers,
        subjects_data = []
        if user.role == "teacher":
            teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
            for ts in teacher_subjects:
                subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
                if subject:
                    subjects_data.append({
                        "id": subject.id,
                        "name": subject.name,
                        "code": subject.code
                    })
        
        specializations_list = json.loads(user.specializations) if user.specializations else []
        
        user_dict = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
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
            "date_of_birth": user.date_of_birth,
            "gender": user.gender,
            "qualification": user.qualification,
            "experience_years": user.experience_years,
            "subjects": subjects_data,
            "specializations": specializations_list,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login": user.last_login,
            "department_name": user.department.name if user.department else None,
            "class_name": user.class_assigned.name if user.class_assigned else None
        }
        result.append(user_dict)
    
    return result

@app.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    user = db.query(User).options(
        joinedload(User.department),
        joinedload(User.class_assigned)
    ).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission check,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if current_user.role == "student" and current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod" and user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
        address=user.address,
        department_id=user.department_id,
        class_id=user.class_id,
        student_id=user.student_id,
        employee_id=user.employee_id,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        department_name=user.department.name if user.department else None,
        class_name=user.class_assigned.name if user.class_assigned else None
    )

@app.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    # Check if username/email already exists,
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Permission check for HOD,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if current_user.role == "hod":
        if user_data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create users in your department")
    
    # Create new user,
    hashed_password = get_password_hash(user_data.password)
    
    # Handle JSON fields,
    specializations_json = json.dumps(user_data.specializations) if user_data.specializations else None,
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        hashed_password=hashed_password,
        role=user_data.role.value if hasattr(user_data.role, 'value') else user_data.role,
        phone=user_data.phone,
        address=user_data.address,
        department_id=user_data.department_id,
        class_id=user_data.class_id,
        student_id=user_data.student_id,
        employee_id=user_data.employee_id,
        date_of_birth=user_data.date_of_birth,
        gender=user_data.gender,
        qualification=user_data.qualification,
        experience_years=user_data.experience_years,
        specializations=specializations_json
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Handle subject assignments for teachers,
    if user_data.role == "teacher" and user_data.subject_ids:
        for subject_id in user_data.subject_ids:
            teacher_subject = TeacherSubject(teacher_id=new_user.id, subject_id=subject_id)
            db.add(teacher_subject)
        db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "CREATE", "users", new_user.id,
             new_values=user_data.dict(exclude={"password"}))
    
    # Get subject details for teachers,
    subjects_data = []
    if new_user.role == "teacher":
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == new_user.id).all()
        for ts in teacher_subjects:
            subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
            if subject:
                subjects_data.append({
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code
                })
    
    specializations_list = json.loads(new_user.specializations) if new_user.specializations else []
    
    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        role=new_user.role,
        phone=new_user.phone,
        address=new_user.address,
        department_id=new_user.department_id,
        class_id=new_user.class_id,
        student_id=new_user.student_id,
        employee_id=new_user.employee_id,
        date_of_birth=new_user.date_of_birth,
        gender=new_user.gender,
        qualification=new_user.qualification,
        experience_years=new_user.experience_years,
        subjects=subjects_data,
        specializations=specializations_list,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
        last_login=new_user.last_login,
        department_name=new_user.department.name if new_user.department else None,
        class_name=f"{new_user.class_assigned.name}" if new_user.class_assigned else None
    )

@app.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission check,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if current_user.role == "student" and current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Can only update your own profile")
    elif current_user.role == "hod" and user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit,
    old_values = {
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "address": user.address,
        "department_id": user.department_id,
        "class_id": user.class_id,
        "student_id": user.student_id,
        "employee_id": user.employee_id,
        "date_of_birth": user.date_of_birth,
        "gender": user.gender,
        "qualification": user.qualification,
        "experience_years": user.experience_years,
        "subjects": user.subjects,
        "specializations": user.specializations,
        "is_active": user.is_active
    }
    
    # Update fields,
    update_data = user_data.dict(exclude_unset=True)
    
    # Handle password hashing,
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    # Handle JSON fields,
    if "specializations" in update_data and update_data["specializations"] is not None:
        update_data["specializations"] = json.dumps(update_data["specializations"])
    
    # Handle subject assignments for teachers,
    subject_ids = update_data.pop("subject_ids", None)
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    # Handle subject assignments for teachers,
    if user.role == "teacher" and subject_ids is not None:
        # Remove existing assignments,
        db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).delete()
        
        # Add new assignments,
        for subject_id in subject_ids:
            teacher_subject = TeacherSubject(teacher_id=user_id, subject_id=subject_id)
            db.add(teacher_subject)
        db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "UPDATE", "users", user_id, old_values, update_data)
    
    # Get subject details for teachers,
    subjects_data = []
    if user.role == "teacher":
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
        for ts in teacher_subjects:
            subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
            if subject:
                subjects_data.append({
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code
                })
    
    specializations_list = json.loads(user.specializations) if user.specializations else []
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        phone=user.phone,
        address=user.address,
        department_id=user.department_id,
        class_id=user.class_id,
        student_id=user.student_id,
        employee_id=user.employee_id,
        date_of_birth=user.date_of_birth,
        gender=user.gender,
        qualification=user.qualification,
        experience_years=user.experience_years,
        subjects=subjects_data,
        specializations=specializations_list,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        department_name=user.department.name if user.department else None,
        class_name=f"{user.class_assigned.name}" if user.class_assigned else None
    )

@app.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission check for HOD,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if current_user.role == "hod" and user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Soft delete (deactivate)
    old_values = {"is_active": user.is_active}
    user.is_active = False,
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "DELETE", "users", user_id, old_values, {"is_active": False})
    
    return {"message": "User deleted successfully"}

@app.post("/bulk-update")
async def bulk_update_users(
    user_ids: List[int],
    update_data: dict,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk update multiple users"""
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    if not users:
        raise HTTPException(status_code=404, detail="No users found")
    
    # Permission check for HOD,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if current_user.role == "hod":
        for user in users:
            if user.department_id != current_user.department_id:
                raise HTTPException(status_code=403, detail="Can only update users in your department")
    
    # Update users,
    for user in users:
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)
    
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "BULK_UPDATE", "users", None,
             new_values={"user_ids": user_ids, "update_data": update_data})
    
    return {"message": f"Updated {len(users)} users successfully"}

@app.post("/bulk-delete")
async def bulk_delete_users(
    user_ids: List[int],
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk delete multiple users"""
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    if not users:
        raise HTTPException(status_code=404, detail="No users found")
    
    # Permission check for HOD,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if current_user.role == "hod":
        for user in users:
            if user.department_id != current_user.department_id:
                raise HTTPException(status_code=403, detail="Can only delete users in your department")
    
    # Soft delete users,
    for user in users:
        user.is_active = False,
    
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "BULK_DELETE", "users", None,
             new_values={"user_ids": user_ids})
    
    return {"message": f"Deleted {len(users)} users successfully"}

@app.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Reset user password"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission check for HOD,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if current_user.role == "hod" and user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate temporary password (in real app, send email)
    temp_password = "TempPass123!"
    user.hashed_password = get_password_hash(temp_password)
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "RESET_PASSWORD", "users", user_id)
    
    return {"message": "Password reset successfully", "temp_password": temp_password}


@app.post("/{user_id}/subjects")
async def assign_subjects(
    user_id: int,
    subject_ids: List[int],
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Assign subjects to a teacher"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role != "teacher":
        raise HTTPException(status_code=400, detail="Can only assign subjects to teachers")
    
    # Remove existing assignments,
    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).delete()
    
    # Add new assignments,
    for subject_id in subject_ids:
        teacher_subject = TeacherSubject(teacher_id=user_id, subject_id=subject_id)
        db.add(teacher_subject)
    
    db.commit()
    return {"message": "Subjects assigned successfully"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "users"}

if __name__ == "__main__":
    import uvicorn,
    uvicorn.run(app, host="0.0.0.0", port=8011)