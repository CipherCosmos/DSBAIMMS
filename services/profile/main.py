from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
import json
import os
import shutil
from pathlib import Path

from shared.database import get_db
from shared.models import User, AuditLog
from shared.auth import get_current_user_from_header, RoleChecker
from shared.permissions import PermissionChecker, Permission

app = FastAPI(title="Profile Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Profile schemas
class ProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    specializations: Optional[str] = None

class ProfileResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    phone: Optional[str]
    address: Optional[str]
    date_of_birth: Optional[str]
    gender: Optional[str]
    qualification: Optional[str]
    experience_years: Optional[int]
    specializations: Optional[str]
    profile_picture: Optional[str]
    department_id: Optional[int]
    department_name: Optional[str]
    class_id: Optional[int]
    class_name: Optional[str]
    student_id: Optional[str]
    employee_id: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str
    last_login: Optional[str]

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class ProfileStatsResponse(BaseModel):
    total_profile_views: int
    last_updated: str
    completion_percentage: int
    missing_fields: list

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None, request: Request = None):
    """Log audit trail"""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()

def format_profile_response(user: User) -> Dict[str, Any]:
    """Format user profile response"""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "phone": user.phone,
        "address": user.address,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "gender": user.gender,
        "qualification": user.qualification,
        "experience_years": user.experience_years,
        "specializations": user.specializations,
        "profile_picture": user.profile_picture,
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None,
        "class_id": user.class_id,
        "class_name": user.class_.name if user.class_ else None,
        "student_id": user.student_id,
        "employee_id": user.employee_id,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None
    }

@app.get("/", response_model=Dict[str, str])
async def root():
    """Service health check"""
    return {"message": "Profile Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/profile", response_model=ProfileResponse)
async def get_profile(
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_from_header)
):
    """Get current user's profile"""
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log profile view
    log_audit(db, current_user_id, "VIEW_PROFILE", "users", current_user_id, request=request)
    
    return format_profile_response(user)

@app.get("/api/profile/{user_id}", response_model=ProfileResponse)
async def get_user_profile(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get specific user's profile (with permissions)"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    target_user = db.query(User).filter(User.id == user_id).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    if current_user.role == "hod" and current_user.department_id != target_user.department_id:
        raise HTTPException(status_code=403, detail="Can only view profiles in your department")
    elif current_user.role == "teacher" and target_user.role != "student":
        raise HTTPException(status_code=403, detail="Teachers can only view student profiles")
    
    # Log profile view
    log_audit(db, current_user_id, "VIEW_PROFILE", "users", user_id, request=request)
    
    return format_profile_response(target_user)

@app.put("/api/profile", response_model=ProfileResponse)
async def update_profile(
    profile_data: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_from_header)
):
    """Update current user's profile"""
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Store old values for audit
    old_values = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "gender": user.gender,
        "qualification": user.qualification,
        "experience_years": user.experience_years,
        "specializations": user.specializations
    }
    
    # Update fields
    update_data = profile_data.dict(exclude_unset=True)
    
    # Handle date conversion
    if "date_of_birth" in update_data and update_data["date_of_birth"]:
        try:
            update_data["date_of_birth"] = datetime.strptime(update_data["date_of_birth"], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Update full name if first/last name changed
    if "first_name" in update_data or "last_name" in update_data:
        first_name = update_data.get("first_name", user.first_name)
        last_name = update_data.get("last_name", user.last_name)
        update_data["full_name"] = f"{first_name or ''} {last_name or ''}".strip()
    
    # Update user
    for field, value in update_data.items():
        setattr(user, field, value)
    
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE_PROFILE", "users", current_user_id, 
              old_values=old_values, new_values=update_data, request=request)
    
    return format_profile_response(user)

@app.post("/api/profile/change-password")
async def change_password(
    password_data: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_from_header)
):
    """Change user password"""
    from shared.auth import verify_password, get_password_hash
    
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")
    
    # Update password
    user.hashed_password = get_password_hash(password_data.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "CHANGE_PASSWORD", "users", current_user_id, request=request)
    
    return {"message": "Password changed successfully"}

@app.post("/api/profile/upload-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_from_header)
):
    """Upload profile picture"""
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Validate file size (max 5MB)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("uploads/profile_pictures")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"user_{current_user_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{file_extension}"
    file_path = upload_dir / filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    # Update user profile picture path
    user = db.query(User).filter(User.id == current_user_id).first()
    if user:
        # Delete old profile picture if exists
        if user.profile_picture and os.path.exists(user.profile_picture):
            os.remove(user.profile_picture)
        
        user.profile_picture = str(file_path)
        user.updated_at = datetime.utcnow()
        db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "UPLOAD_PROFILE_PICTURE", "users", current_user_id, request=request)
    
    return {"message": "Profile picture uploaded successfully", "filename": filename}

@app.delete("/api/profile/picture")
async def delete_profile_picture(
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_from_header)
):
    """Delete profile picture"""
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.profile_picture and os.path.exists(user.profile_picture):
        os.remove(user.profile_picture)
    
    user.profile_picture = None
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE_PROFILE_PICTURE", "users", current_user_id, request=request)
    
    return {"message": "Profile picture deleted successfully"}

@app.get("/api/profile/stats", response_model=ProfileStatsResponse)
async def get_profile_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_from_header)
):
    """Get profile completion statistics"""
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate completion percentage
    required_fields = ["first_name", "last_name", "email", "phone"]
    optional_fields = ["address", "date_of_birth", "gender", "qualification", "experience_years", "specializations"]
    
    total_fields = len(required_fields) + len(optional_fields)
    completed_fields = 0
    missing_fields = []
    
    for field in required_fields:
        if getattr(user, field):
            completed_fields += 2  # Required fields count double
        else:
            missing_fields.append(field)
    
    for field in optional_fields:
        if getattr(user, field):
            completed_fields += 1
        else:
            missing_fields.append(field)
    
    completion_percentage = int((completed_fields / (len(required_fields) * 2 + len(optional_fields))) * 100)
    
    return ProfileStatsResponse(
        total_profile_views=0,  # This would need to be tracked separately
        last_updated=user.updated_at.isoformat() if user.updated_at else None,
        completion_percentage=completion_percentage,
        missing_fields=missing_fields
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "profile"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8025)
