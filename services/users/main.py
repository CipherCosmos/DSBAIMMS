from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import json

from shared.database import get_db
from shared.models import User, Department, Class, Subject, TeacherSubject
from shared.schemas import UserCreate, UserUpdate, UserResponse
from shared.auth import RoleChecker

app = FastAPI(title="User Service", version="1.0.0")

def validate_role_based_fields(role: str, user_data: dict) -> dict:
    """Validate and clean fields based on user role"""
    cleaned_data = user_data.copy()
    
    # Helper function to convert empty strings to None for optional integer fields
    def clean_int_field(field_name):
        value = cleaned_data.get(field_name)
        if value == "" or value is None:
            cleaned_data[field_name] = None
        else:
            try:
                cleaned_data[field_name] = int(value) if value else None
            except (ValueError, TypeError):
                cleaned_data[field_name] = None
    
    # Clean all optional integer fields first
    for field in ["department_id", "class_id", "experience_years"]:
        clean_int_field(field)
    
    if role == "student":
        # Students should only have student_id, not employee_id
        cleaned_data["employee_id"] = None
        cleaned_data["experience_years"] = None
        cleaned_data["qualification"] = None
        # Students should have class_id
        if not cleaned_data.get("class_id"):
            cleaned_data["class_id"] = None
    
    elif role in ["teacher", "hod", "admin"]:
        # Staff should only have employee_id, not student_id
        cleaned_data["student_id"] = None
        # Staff should have department_id
        if not cleaned_data.get("department_id"):
            cleaned_data["department_id"] = None
        # Teachers and HODs should have experience_years and qualification
        if role in ["teacher", "hod"]:
            if not cleaned_data.get("experience_years"):
                cleaned_data["experience_years"] = 0
            if not cleaned_data.get("qualification"):
                cleaned_data["qualification"] = None
    
    return cleaned_data

def generate_employee_id(role: str, db: Session) -> str:
    """Generate employee ID based on role"""
    if role == "admin":
        prefix = "ADM"
    elif role == "hod":
        prefix = "HOD"
    elif role == "teacher":
        prefix = "TCH"
    else:
        return None
    
    # Get the last employee ID for this role
    last_user = db.query(User).filter(
        User.role == role,
        User.employee_id.isnot(None),
        User.employee_id.like(f"{prefix}%")
    ).order_by(User.employee_id.desc()).first()
    
    if last_user and last_user.employee_id:
        try:
            last_num = int(last_user.employee_id[3:])  # Extract number part
            new_num = last_num + 1
        except (ValueError, IndexError):
            new_num = 1
    else:
        new_num = 1
    
    return f"{prefix}{new_num:03d}"

def generate_student_id(db: Session) -> str:
    """Generate student ID"""
    # Get the last student ID
    last_user = db.query(User).filter(
        User.role == "student",
        User.student_id.isnot(None),
        User.student_id.like("STU%")
    ).order_by(User.student_id.desc()).first()
    
    if last_user and last_user.student_id:
        try:
            last_num = int(last_user.student_id[3:])  # Extract number part
            new_num = last_num + 1
        except (ValueError, IndexError):
            new_num = 1
    else:
        new_num = 1
    
    return f"STU{new_num:03d}"

def format_user_response(user: User, db: Session) -> dict:
    """Format user data according to UserResponse schema"""
    # Parse specializations from JSON string
    specializations = []
    if user.specializations:
        try:
            import json
            specializations = json.loads(user.specializations)
            if not isinstance(specializations, list):
                specializations = []
        except (json.JSONDecodeError, TypeError):
            specializations = []
    
    user_response = {
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
        "specializations": specializations,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "department_name": None,
        "class_name": None,
        "subjects": []
    }
    
    # Get department name
    if user.department_id:
        dept = db.query(Department).filter(Department.id == user.department_id).first()
        if dept:
            user_response["department_name"] = dept.name
    
    # Get class name
    if user.class_id:
        cls = db.query(Class).filter(Class.id == user.class_id).first()
        if cls:
            user_response["class_name"] = cls.name
    
    # Get subjects for teachers
    if user.role == "teacher":
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
        for ts in teacher_subjects:
            subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
            if subject:
                user_response["subjects"].append({
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code
                })
    
    return user_response

@app.get("/")
async def root():
    return {"message": "User Service is running"}

@app.get("/users")
async def get_users(
    skip: int = 0,
    limit: int = 100,
    department_id: Optional[int] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
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
        result.append(format_user_response(user, db))
    
    return result

@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get a specific user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return format_user_response(user, db)

@app.get("/stats")
async def get_user_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get user statistics"""
    try:
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        inactive_users = total_users - active_users
        
        # Get role counts for all users (active and inactive)
        role_counts = {}
        for role in ["admin", "hod", "teacher", "student"]:
            count = db.query(User).filter(User.role == role).count()
            role_counts[role] = count
        
        # Count distinct roles that actually exist in the database
        distinct_roles = db.query(User.role).distinct().all()
        unique_roles_count = len(distinct_roles)
        
        return {
            "total": total_users,
            "active": active_users,
            "inactive": inactive_users,
            "roles": unique_roles_count,
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

@app.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new user"""
    from passlib.context import CryptContext
    from shared.permissions import PermissionChecker, Permission
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Check if user has permission to create users
    if not PermissionChecker.has_permission(current_user.role, Permission.CREATE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create users")
    
    # Check if username or email already exists
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Hash password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(user_data.password)
    
    # Convert user_data to dict for validation
    user_dict = user_data.dict()
    
    # Validate and clean fields based on role
    cleaned_data = validate_role_based_fields(user_data.role, user_dict)
    
    # Generate IDs based on role
    if user_data.role == "student":
        if not cleaned_data.get("student_id"):
            cleaned_data["student_id"] = generate_student_id(db)
    else:
        if not cleaned_data.get("employee_id"):
            cleaned_data["employee_id"] = generate_employee_id(user_data.role, db)
    
    # Handle specializations
    specializations_json = None
    if cleaned_data.get("specializations"):
        import json
        specializations_json = json.dumps(cleaned_data["specializations"])
    
    # Generate full_name from first_name and last_name if not provided
    full_name = cleaned_data.get("full_name")
    if not full_name and (cleaned_data.get("first_name") or cleaned_data.get("last_name")):
        full_name = f"{cleaned_data.get('first_name', '')} {cleaned_data.get('last_name', '')}".strip()
    
    # Handle date_of_birth conversion from string to datetime
    date_of_birth = None
    if cleaned_data.get("date_of_birth"):
        try:
            from datetime import datetime
            date_of_birth = datetime.strptime(cleaned_data["date_of_birth"], "%Y-%m-%d")
        except ValueError:
            date_of_birth = None
    
    # Extract validated fields
    department_id = cleaned_data.get("department_id")
    class_id = cleaned_data.get("class_id")
    experience_years = cleaned_data.get("experience_years")
    student_id = cleaned_data.get("student_id")
    employee_id = cleaned_data.get("employee_id")
    qualification = cleaned_data.get("qualification")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=full_name,
        first_name=cleaned_data.get("first_name"),
        last_name=cleaned_data.get("last_name"),
        role=user_data.role,
        department_id=department_id,
        class_id=class_id,
        phone=cleaned_data.get("phone"),
        address=cleaned_data.get("address"),
        student_id=student_id,
        employee_id=employee_id,
        hashed_password=hashed_password,
        is_active=user_data.is_active if user_data.is_active is not None else True,
        specializations=specializations_json,
        date_of_birth=date_of_birth,
        experience_years=experience_years,
        qualification=qualification,
        gender=cleaned_data.get("gender")
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return format_user_response(user, db)

@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update a user"""
    from shared.permissions import PermissionChecker, Permission
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Get target user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions based on role
    permission_level = PermissionChecker.get_permission_level(current_user.role, Permission.UPDATE_USERS)
    
    if permission_level == "no_access":
        raise HTTPException(status_code=403, detail="Insufficient permissions to update users")
    elif permission_level == "own_only" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Can only update own profile")
    elif permission_level == "dept_only" and current_user.department_id != user.department_id:
        raise HTTPException(status_code=403, detail="Can only update users in your department")
    
    # Update user data - handle all fields explicitly
    update_data = user_data.dict(exclude_unset=True)
    
    # Check if role is being changed
    new_role = update_data.get("role", user.role)
    role_changed = new_role != user.role
    
    # Validate and clean fields based on new role
    cleaned_data = validate_role_based_fields(new_role, update_data)
    
    # Handle role change - generate appropriate IDs
    if role_changed:
        if new_role == "student":
            # Changing to student - generate student_id, remove employee_id
            if not cleaned_data.get("student_id"):
                cleaned_data["student_id"] = generate_student_id(db)
            cleaned_data["employee_id"] = None
        else:
            # Changing to staff - generate employee_id, remove student_id
            if not cleaned_data.get("employee_id"):
                cleaned_data["employee_id"] = generate_employee_id(new_role, db)
            cleaned_data["student_id"] = None
    
    # Hash password if provided
    if "password" in cleaned_data:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        cleaned_data["hashed_password"] = pwd_context.hash(cleaned_data.pop("password"))
    
    # Handle specializations
    if "specializations" in cleaned_data:
        import json
        if cleaned_data["specializations"]:
            cleaned_data["specializations"] = json.dumps(cleaned_data["specializations"])
        else:
            cleaned_data["specializations"] = None
    
    # Handle full_name generation from first_name and last_name
    if "first_name" in cleaned_data or "last_name" in cleaned_data:
        first_name = cleaned_data.get("first_name", user.first_name)
        last_name = cleaned_data.get("last_name", user.last_name)
        if first_name or last_name:
            cleaned_data["full_name"] = f"{first_name or ''} {last_name or ''}".strip()
    
    # Handle date_of_birth conversion from string to datetime
    if "date_of_birth" in cleaned_data and cleaned_data["date_of_birth"]:
        try:
            from datetime import datetime
            cleaned_data["date_of_birth"] = datetime.strptime(cleaned_data["date_of_birth"], "%Y-%m-%d")
        except ValueError:
            cleaned_data["date_of_birth"] = None
    
    # Handle subject_ids for teachers (if provided)
    if "subject_ids" in cleaned_data:
        subject_ids = cleaned_data.pop("subject_ids")
        if subject_ids and new_role == "teacher":
            # Remove existing teacher subjects
            db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).delete()
            # Add new teacher subjects
            for subject_id in subject_ids:
                teacher_subject = TeacherSubject(teacher_id=user.id, subject_id=subject_id)
                db.add(teacher_subject)
    
    # Update all fields
    for field, value in cleaned_data.items():
        if hasattr(user, field):
            setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return format_user_response(user, db)

@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a user"""
    from shared.permissions import PermissionChecker, Permission
    from shared.models import AuditLog
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Check if user has permission to delete users
    if not PermissionChecker.has_permission(current_user.role, Permission.DELETE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete users")
    
    # Get target user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if trying to delete self
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check department restrictions for HOD
    if current_user.role == "hod" and current_user.department_id != user.department_id:
        raise HTTPException(status_code=403, detail="Can only delete users in your department")
    
    try:
        # Handle foreign key constraints by setting referencing fields to NULL
        from shared.models import Department, Class, TeacherSubject, Mark, QuestionBank, QuestionBankItem, FileUpload, Notification, AuditLog
        
        # Set user_id to NULL in audit logs
        db.query(AuditLog).filter(AuditLog.user_id == user_id).update({"user_id": None})
        
        # Set hod_id to NULL in departments
        db.query(Department).filter(Department.hod_id == user_id).update({"hod_id": None})
        
        # Set class_teacher_id and cr_id to NULL in classes
        db.query(Class).filter(Class.class_teacher_id == user_id).update({"class_teacher_id": None})
        db.query(Class).filter(Class.cr_id == user_id).update({"cr_id": None})
        
        # Set teacher_id to NULL in teacher subjects (this has CASCADE, but let's be explicit)
        db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).delete()
        
        # Set graded_by to NULL in marks
        db.query(Mark).filter(Mark.graded_by == user_id).update({"graded_by": None})
        
        # Set created_by to NULL in question banks
        db.query(QuestionBank).filter(QuestionBank.created_by == user_id).update({"created_by": None})
        
        # Set added_by to NULL in question bank items
        db.query(QuestionBankItem).filter(QuestionBankItem.added_by == user_id).update({"added_by": None})
        
        # Set uploaded_by to NULL in file uploads
        db.query(FileUpload).filter(FileUpload.uploaded_by == user_id).update({"uploaded_by": None})
        
        # Set user_id to NULL in notifications
        db.query(Notification).filter(Notification.user_id == user_id).update({"user_id": None})
        
        # Then delete the user
        db.delete(user)
        db.commit()
        
        return {"message": "User deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")

@app.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Reset a user's password"""
    from passlib.context import CryptContext
    from shared.permissions import PermissionChecker, Permission
    import secrets
    import string
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Check if user has permission to change passwords
    if not PermissionChecker.has_permission(current_user.role, Permission.CHANGE_PASSWORDS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to reset passwords")
    
    # Get target user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check department restrictions for HOD
    if current_user.role == "hod" and current_user.department_id != user.department_id:
        raise HTTPException(status_code=403, detail="Can only reset passwords for users in your department")
    
    # Generate new password
    alphabet = string.ascii_letters + string.digits
    new_password = ''.join(secrets.choice(alphabet) for i in range(12))
    
    # Hash new password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user.hashed_password = pwd_context.hash(new_password)
    
    db.commit()
    
    return {"message": "Password reset successfully", "new_password": new_password}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
