from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date
import pandas as pd
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import Semester, Department, Class, Subject, User, StudentSemesterEnrollment, AuditLog
from shared.auth import RoleChecker
from shared.schemas import SemesterResponse, SemesterCreate, SemesterUpdate, StudentSemesterEnrollmentResponse, StudentSemesterEnrollmentCreate, StudentSemesterEnrollmentUpdate
from shared.permissions import PermissionChecker

app = FastAPI(title="Semesters Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class SemesterCreateEnhanced(BaseModel):
    name: str
    department_id: int
    semester_number: int
    academic_year: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = False
    is_completed: bool = False
    description: Optional[str] = None

class SemesterUpdateEnhanced(BaseModel):
    name: Optional[str] = None
    semester_number: Optional[int] = None
    academic_year: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None
    description: Optional[str] = None

class SemesterAnalytics(BaseModel):
    total_semesters: int
    active_semesters: int
    completed_semesters: int
    semesters_by_department: Dict[str, int]
    average_duration_days: float
    upcoming_semesters: int

class BulkSemesterCreate(BaseModel):
    semesters: List[SemesterCreateEnhanced]

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    """Log audit trail"""
    import json
    
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Semesters Service", "version": "1.0.0"}

# Get all semesters with role-based filtering
@app.get("/semesters", response_model=List[SemesterResponse])
async def get_semesters(
    department_id: Optional[int] = Query(None),
    academic_year: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_completed: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get semesters with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Semester).options(
        joinedload(Semester.department)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Semester.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see semesters in their department
        if current_user.department_id:
            query = query.filter(Semester.department_id == current_user.department_id)
        else:
            query = query.filter(False)  # No access if no department assigned
    
    # Apply filters
    if department_id:
        query = query.filter(Semester.department_id == department_id)
    if academic_year:
        query = query.filter(Semester.academic_year == academic_year)
    if is_active is not None:
        query = query.filter(Semester.is_active == is_active)
    if is_completed is not None:
        query = query.filter(Semester.is_completed == is_completed)
    
    semesters = query.offset(skip).limit(limit).all()
    return semesters

# Get semester by ID
@app.get("/semesters/{semester_id}", response_model=SemesterResponse)
async def get_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get semester by ID with role-based access control"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    semester = db.query(Semester).options(
        joinedload(Semester.department)
    ).filter(Semester.id == semester_id).first()
    
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if semester.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        if current_user.department_id != semester.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return semester

# Create semester
@app.post("/semesters", response_model=SemesterResponse)
async def create_semester(
    semester_data: SemesterCreateEnhanced,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Role-based restrictions
    if current_user.role == "hod":
        # HODs can only create semesters in their department
        if semester_data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create semesters in your department")
    
    # Validate department exists
    from shared.models import Department
    department = db.query(Department).filter(Department.id == semester_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if semester number already exists in department for same academic year
    existing_semester = db.query(Semester).filter(
        Semester.semester_number == semester_data.semester_number,
        Semester.department_id == semester_data.department_id,
        Semester.academic_year == semester_data.academic_year
    ).first()
    if existing_semester:
        raise HTTPException(status_code=400, detail="Semester with this number already exists in this department for the same academic year")
    
    # Validate dates if provided
    if semester_data.start_date and semester_data.end_date:
        if semester_data.start_date >= semester_data.end_date:
            raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # If making this semester active, deactivate other active semesters in the department
    if semester_data.is_active:
        db.query(Semester).filter(
            Semester.department_id == semester_data.department_id,
            Semester.is_active == True,
            Semester.id != None  # This will be None for new semester
        ).update({"is_active": False})
    
    # Create semester
    new_semester = Semester(
        name=semester_data.name,
        department_id=semester_data.department_id,
        semester_number=semester_data.semester_number,
        academic_year=semester_data.academic_year,
        start_date=semester_data.start_date,
        end_date=semester_data.end_date,
        is_active=semester_data.is_active,
        is_completed=semester_data.is_completed,
        description=semester_data.description,
        created_at=datetime.utcnow()
    )
    
    db.add(new_semester)
    db.commit()
    db.refresh(new_semester)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Semester", new_semester.id, None, {
        "name": semester_data.name,
        "semester_number": semester_data.semester_number,
        "department_id": semester_data.department_id,
        "academic_year": semester_data.academic_year
    })
    
    return new_semester

# Update semester
@app.put("/semesters/{semester_id}", response_model=SemesterResponse)
async def update_semester(
    semester_id: int,
    semester_data: SemesterUpdateEnhanced,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update semester information"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if semester.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only update semesters in your department")
    
    # Store old values for audit
    old_values = {
        "name": semester.name,
        "semester_number": semester.semester_number,
        "academic_year": semester.academic_year,
        "start_date": semester.start_date.isoformat() if semester.start_date else None,
        "end_date": semester.end_date.isoformat() if semester.end_date else None,
        "is_active": semester.is_active,
        "is_completed": semester.is_completed,
        "description": semester.description
    }
    
    # Validate semester number if being updated
    if semester_data.semester_number is not None and semester_data.semester_number != semester.semester_number:
        academic_year = semester_data.academic_year or semester.academic_year
        existing_semester = db.query(Semester).filter(
            Semester.semester_number == semester_data.semester_number,
            Semester.department_id == semester.department_id,
            Semester.academic_year == academic_year,
            Semester.id != semester_id
        ).first()
        if existing_semester:
            raise HTTPException(status_code=400, detail="Semester with this number already exists in this department for the same academic year")
    
    # Validate dates if provided
    start_date = semester_data.start_date or semester.start_date
    end_date = semester_data.end_date or semester.end_date
    if start_date and end_date:
        if start_date >= end_date:
            raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # If making this semester active, deactivate other active semesters in the department
    if semester_data.is_active is True:
        db.query(Semester).filter(
            Semester.department_id == semester.department_id,
            Semester.is_active == True,
            Semester.id != semester_id
        ).update({"is_active": False})
    
    # Update fields
    if semester_data.name is not None:
        semester.name = semester_data.name
    if semester_data.semester_number is not None:
        semester.semester_number = semester_data.semester_number
    if semester_data.academic_year is not None:
        semester.academic_year = semester_data.academic_year
    if semester_data.start_date is not None:
        semester.start_date = semester_data.start_date
    if semester_data.end_date is not None:
        semester.end_date = semester_data.end_date
    if semester_data.is_active is not None:
        semester.is_active = semester_data.is_active
    if semester_data.is_completed is not None:
        semester.is_completed = semester_data.is_completed
    if semester_data.description is not None:
        semester.description = semester_data.description
    
    semester.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(semester)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Semester", semester_id, old_values, {
        "name": semester.name,
        "semester_number": semester.semester_number,
        "academic_year": semester.academic_year,
        "start_date": semester.start_date.isoformat() if semester.start_date else None,
        "end_date": semester.end_date.isoformat() if semester.end_date else None,
        "is_active": semester.is_active,
        "is_completed": semester.is_completed,
        "description": semester.description
    })
    
    return semester

# Delete semester
@app.delete("/semesters/{semester_id}")
async def delete_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Role-based restrictions
    if current_user.role == "hod":
        if semester.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only delete semesters in your department")
    
    # Check if semester has classes
    class_count = db.query(Class).filter(Class.semester_id == semester_id).count()
    if class_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete semester with {class_count} classes. Please delete classes first.")
    
    # Check if semester has subjects
    subject_count = db.query(Subject).filter(Subject.semester_id == semester_id).count()
    if subject_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete semester with {subject_count} subjects. Please delete subjects first.")
    
    # Check if semester has student enrollments
    enrollment_count = db.query(StudentSemesterEnrollment).filter(StudentSemesterEnrollment.semester_id == semester_id).count()
    if enrollment_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete semester with {enrollment_count} student enrollments. Please delete enrollments first.")
    
    # Soft delete
    semester.is_active = False
    semester.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Semester", semester_id, {
        "name": semester.name,
        "semester_number": semester.semester_number,
        "department_id": semester.department_id,
        "academic_year": semester.academic_year
    }, None)
    
    return {"message": "Semester deleted successfully"}

# Get semester classes
@app.get("/semesters/{semester_id}/classes")
async def get_semester_classes(
    semester_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get classes in a semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if semester.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        if current_user.department_id != semester.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    classes = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.class_teacher),
        joinedload(Class.cr)
    ).filter(
        Class.semester_id == semester_id,
        Class.is_active == True
    ).offset(skip).limit(limit).all()
    
    return classes

# Get semester analytics
@app.get("/semesters/analytics", response_model=SemesterAnalytics)
async def get_semester_analytics(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get semester analytics and statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Semester).options(
        joinedload(Semester.department)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Semester.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(Semester.department_id == department_id)
    
    semesters = query.all()
    
    # Calculate analytics
    total_semesters = len(semesters)
    active_semesters = len([s for s in semesters if s.is_active])
    completed_semesters = len([s for s in semesters if s.is_completed])
    semesters_by_department = {}
    total_duration_days = 0
    semesters_with_dates = 0
    upcoming_semesters = 0
    current_date = datetime.now().date()
    
    for semester in semesters:
        # By department
        if semester.department:
            dept_name = semester.department.name
            if dept_name in semesters_by_department:
                semesters_by_department[dept_name] += 1
            else:
                semesters_by_department[dept_name] = 1
        
        # Calculate duration
        if semester.start_date and semester.end_date:
            duration = (semester.end_date - semester.start_date).days
            total_duration_days += duration
            semesters_with_dates += 1
            
            # Check if upcoming
            if semester.start_date > current_date:
                upcoming_semesters += 1
    
    average_duration_days = total_duration_days / semesters_with_dates if semesters_with_dates > 0 else 0
    
    return SemesterAnalytics(
        total_semesters=total_semesters,
        active_semesters=active_semesters,
        completed_semesters=completed_semesters,
        semesters_by_department=semesters_by_department,
        average_duration_days=average_duration_days,
        upcoming_semesters=upcoming_semesters
    )

@app.post("/api/semesters/bulk-update")
async def bulk_update_semesters(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk update semesters"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    semester_ids = request.get("semester_ids", [])
    update_data = request.get("update_data", {})
    
    if not semester_ids:
        raise HTTPException(status_code=400, detail="No semester IDs provided")
    
    updated_semesters = []
    for semester_id in semester_ids:
        semester = db.query(Semester).filter(Semester.id == semester_id).first()
        if not semester:
            continue
            
        # Role-based access control
        if current_user.role == "hod":
            if semester.department_id != current_user.department_id:
                continue
        
        # Update semester data
        for field, value in update_data.items():
            if hasattr(semester, field) and field not in ["id", "created_at", "updated_at"]:
                setattr(semester, field, value)
        
        db.commit()
        updated_semesters.append(semester_id)
    
    # Log audit
    log_audit(db, current_user_id, "BULK_UPDATE", "Semester", None, None, {
        "semester_ids": updated_semesters,
        "update_data": update_data
    })
    
    return {
        "message": f"Updated {len(updated_semesters)} semesters",
        "updated_semesters": updated_semesters
    }

@app.post("/api/semesters/bulk-delete")
async def bulk_delete_semesters(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk delete semesters"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    semester_ids = request.get("semester_ids", [])
    
    if not semester_ids:
        raise HTTPException(status_code=400, detail="No semester IDs provided")
    
    deleted_semesters = []
    for semester_id in semester_ids:
        semester = db.query(Semester).filter(Semester.id == semester_id).first()
        if not semester:
            continue
            
        # Role-based access control
        if current_user.role == "hod":
            if semester.department_id != current_user.department_id:
                continue
        
        # Check dependencies
        class_count = db.query(Class).filter(Class.semester_id == semester_id).count()
        subject_count = db.query(Subject).filter(Subject.semester_id == semester_id).count()
        enrollment_count = db.query(StudentSemesterEnrollment).filter(StudentSemesterEnrollment.semester_id == semester_id).count()
        
        if class_count > 0 or subject_count > 0 or enrollment_count > 0:
            continue  # Skip semesters with dependencies
        
        # Store semester data for audit
        semester_data = {
            "id": semester.id,
            "name": semester.name,
            "semester_number": semester.semester_number,
            "academic_year": semester.academic_year,
            "department_id": semester.department_id
        }
        
        db.delete(semester)
        deleted_semesters.append({"id": semester_id, "data": semester_data})
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_DELETE", "Semester", None, None, {
        "deleted_semesters": deleted_semesters
    })
    
    return {
        "message": f"Deleted {len(deleted_semesters)} semesters",
        "deleted_semesters": [s["id"] for s in deleted_semesters]
    }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "semesters"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
