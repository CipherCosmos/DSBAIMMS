from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import pandas as pd
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import Subject, Department, Class, User, Semester, CO, PO, TeacherSubject, AuditLog
from shared.auth import RoleChecker
from shared.schemas import SubjectResponse, SubjectCreate, SubjectUpdate
from shared.permissions import PermissionChecker

app = FastAPI(title="Subjects Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class SubjectCreateEnhanced(BaseModel):
    name: str
    code: str
    department_id: int
    semester_id: int
    class_id: int
    teacher_id: Optional[int] = None
    credits: Optional[int] = 3
    description: Optional[str] = None
    objectives: Optional[str] = None

class SubjectUpdateEnhanced(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    teacher_id: Optional[int] = None
    credits: Optional[int] = None
    description: Optional[str] = None
    objectives: Optional[str] = None

class SubjectAnalytics(BaseModel):
    total_subjects: int
    subjects_by_department: Dict[str, int]
    subjects_by_semester: Dict[str, int]
    subjects_by_class: Dict[str, int]
    subjects_without_teachers: int
    average_credits: float

class BulkSubjectCreate(BaseModel):
    subjects: List[SubjectCreateEnhanced]

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
    return {"message": "Subjects Service", "version": "1.0.0"}

# Get all subjects with role-based filtering
@app.get("/subjects", response_model=List[SubjectResponse])
async def get_subjects(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get subjects with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.semester),
        joinedload(Subject.class_),
        joinedload(Subject.teacher)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see subjects they teach
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_ids:
            query = query.filter(Subject.id.in_(subject_ids))
        else:
            query = query.filter(False)  # No access if no subjects assigned
    
    # Apply filters
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    if semester_id:
        query = query.filter(Subject.semester_id == semester_id)
    if class_id:
        query = query.filter(Subject.class_id == class_id)
    if teacher_id:
        query = query.filter(Subject.teacher_id == teacher_id)
    
    subjects = query.offset(skip).limit(limit).all()
    return subjects

# Get subject by ID
@app.get("/subjects/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get subject by ID with role-based access control"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    subject = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.semester),
        joinedload(Subject.class_),
        joinedload(Subject.teacher)
    ).filter(Subject.id == subject_id).first()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only access subjects they teach
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return subject

# Create subject
@app.post("/subjects", response_model=SubjectResponse)
async def create_subject(
    subject_data: SubjectCreateEnhanced,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new subject"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Role-based restrictions
    if current_user.role == "hod":
        # HODs can only create subjects in their department
        if subject_data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create subjects in your department")
    
    # Validate department exists
    department = db.query(Department).filter(Department.id == subject_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate semester exists
    semester = db.query(Semester).filter(Semester.id == subject_data.semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Validate class exists
    class_obj = db.query(Class).filter(Class.id == subject_data.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Validate teacher if provided
    if subject_data.teacher_id:
        teacher = db.query(User).filter(
            User.id == subject_data.teacher_id,
            User.role == "teacher",
            User.department_id == subject_data.department_id
        ).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found or not in same department")
    
    # Check if subject code already exists in department
    existing_subject = db.query(Subject).filter(
        Subject.code == subject_data.code,
        Subject.department_id == subject_data.department_id
    ).first()
    if existing_subject:
        raise HTTPException(status_code=400, detail="Subject code already exists in this department")
    
    # Create subject
    new_subject = Subject(
        name=subject_data.name,
        code=subject_data.code,
        department_id=subject_data.department_id,
        semester_id=subject_data.semester_id,
        class_id=subject_data.class_id,
        teacher_id=subject_data.teacher_id,
        credits=subject_data.credits,
        description=subject_data.description,
        objectives=subject_data.objectives,
        created_at=datetime.utcnow()
    )
    
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    
    # Create teacher-subject mapping if teacher is assigned
    if subject_data.teacher_id:
        teacher_subject = TeacherSubject(
            teacher_id=subject_data.teacher_id,
            subject_id=new_subject.id,
            assigned_at=datetime.utcnow()
        )
        db.add(teacher_subject)
        db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Subject", new_subject.id, None, {
        "name": subject_data.name,
        "code": subject_data.code,
        "department_id": subject_data.department_id,
        "class_id": subject_data.class_id
    })
    
    return new_subject

# Update subject
@app.put("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    subject_data: SubjectUpdateEnhanced,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update subject information"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only update subjects in your department")
    
    # Store old values for audit
    old_values = {
        "name": subject.name,
        "code": subject.code,
        "teacher_id": subject.teacher_id,
        "credits": subject.credits,
        "description": subject.description,
        "objectives": subject.objectives
    }
    
    # Validate teacher if being updated
    if subject_data.teacher_id is not None:
        if subject_data.teacher_id:
            teacher = db.query(User).filter(
                User.id == subject_data.teacher_id,
                User.role == "teacher",
                User.department_id == subject.department_id
            ).first()
            if not teacher:
                raise HTTPException(status_code=404, detail="Teacher not found or not in same department")
    
    # Validate subject code if being updated
    if subject_data.code is not None and subject_data.code != subject.code:
        existing_subject = db.query(Subject).filter(
            Subject.code == subject_data.code,
            Subject.department_id == subject.department_id,
            Subject.id != subject_id
        ).first()
        if existing_subject:
            raise HTTPException(status_code=400, detail="Subject code already exists in this department")
    
    # Update fields
    if subject_data.name is not None:
        subject.name = subject_data.name
    if subject_data.code is not None:
        subject.code = subject_data.code
    if subject_data.teacher_id is not None:
        subject.teacher_id = subject_data.teacher_id
    if subject_data.credits is not None:
        subject.credits = subject_data.credits
    if subject_data.description is not None:
        subject.description = subject_data.description
    if subject_data.objectives is not None:
        subject.objectives = subject_data.objectives
    
    subject.updated_at = datetime.utcnow()
    
    # Update teacher-subject mapping
    if subject_data.teacher_id is not None:
        # Remove existing mapping
        db.query(TeacherSubject).filter(TeacherSubject.subject_id == subject_id).delete()
        
        # Create new mapping if teacher is assigned
        if subject_data.teacher_id:
            teacher_subject = TeacherSubject(
                teacher_id=subject_data.teacher_id,
                subject_id=subject_id,
                assigned_at=datetime.utcnow()
            )
            db.add(teacher_subject)
    
    db.commit()
    db.refresh(subject)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Subject", subject_id, old_values, {
        "name": subject.name,
        "code": subject.code,
        "teacher_id": subject.teacher_id,
        "credits": subject.credits,
        "description": subject.description,
        "objectives": subject.objectives
    })
    
    return subject

# Delete subject
@app.delete("/subjects/{subject_id}")
async def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete subject"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Role-based restrictions
    if current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only delete subjects in your department")
    
    # Check if subject has exams
    from shared.models import Exam
    exam_count = db.query(Exam).filter(Exam.subject_id == subject_id).count()
    if exam_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete subject with {exam_count} exams. Please delete exams first.")
    
    # Check if subject has COs
    co_count = db.query(CO).filter(CO.subject_id == subject_id).count()
    if co_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete subject with {co_count} Course Outcomes. Please delete COs first.")
    
    # Remove teacher-subject mappings
    db.query(TeacherSubject).filter(TeacherSubject.subject_id == subject_id).delete()
    
    # Soft delete
    subject.is_active = False
    subject.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Subject", subject_id, {
        "name": subject.name,
        "code": subject.code,
        "department_id": subject.department_id
    }, None)
    
    return {"message": "Subject deleted successfully"}

# Get subject analytics
@app.get("/subjects/analytics", response_model=SubjectAnalytics)
async def get_subject_analytics(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get subject analytics and statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.semester),
        joinedload(Subject.class_)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(Subject.department_id == department_id)
    
    subjects = query.all()
    
    # Calculate analytics
    total_subjects = len(subjects)
    subjects_by_department = {}
    subjects_by_semester = {}
    subjects_by_class = {}
    subjects_without_teachers = 0
    total_credits = 0
    
    for subject in subjects:
        # By department
        if subject.department:
            dept_name = subject.department.name
            if dept_name in subjects_by_department:
                subjects_by_department[dept_name] += 1
            else:
                subjects_by_department[dept_name] = 1
        
        # By semester
        if subject.semester:
            sem_name = subject.semester.name
            if sem_name in subjects_by_semester:
                subjects_by_semester[sem_name] += 1
            else:
                subjects_by_semester[sem_name] = 1
        
        # By class
        if subject.class_:
            class_name = f"{subject.class_.name} - {subject.class_.section}"
            if class_name in subjects_by_class:
                subjects_by_class[class_name] += 1
            else:
                subjects_by_class[class_name] = 1
        
        # Count subjects without teachers
        if not subject.teacher_id:
            subjects_without_teachers += 1
        
        # Sum credits
        if subject.credits:
            total_credits += subject.credits
    
    average_credits = total_credits / total_subjects if total_subjects > 0 else 0
    
    return SubjectAnalytics(
        total_subjects=total_subjects,
        subjects_by_department=subjects_by_department,
        subjects_by_semester=subjects_by_semester,
        subjects_by_class=subjects_by_class,
        subjects_without_teachers=subjects_without_teachers,
        average_credits=average_credits
    )

@app.post("/api/subjects/bulk-update")
async def bulk_update_subjects(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk update subjects"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    subject_ids = request.get("subject_ids", [])
    update_data = request.get("update_data", {})
    
    if not subject_ids:
        raise HTTPException(status_code=400, detail="No subject IDs provided")
    
    updated_subjects = []
    for subject_id in subject_ids:
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            continue
            
        # Role-based access control
        if current_user.role == "hod":
            if subject.department_id != current_user.department_id:
                continue
        
        # Update subject data
        for field, value in update_data.items():
            if hasattr(subject, field) and field not in ["id", "created_at", "updated_at"]:
                setattr(subject, field, value)
        
        db.commit()
        updated_subjects.append(subject_id)
    
    # Log audit
    log_audit(db, current_user_id, "BULK_UPDATE", "Subject", None, None, {
        "subject_ids": updated_subjects,
        "update_data": update_data
    })
    
    return {
        "message": f"Updated {len(updated_subjects)} subjects",
        "updated_subjects": updated_subjects
    }

@app.post("/api/subjects/bulk-delete")
async def bulk_delete_subjects(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk delete subjects"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    subject_ids = request.get("subject_ids", [])
    
    if not subject_ids:
        raise HTTPException(status_code=400, detail="No subject IDs provided")
    
    deleted_subjects = []
    for subject_id in subject_ids:
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            continue
            
        # Role-based access control
        if current_user.role == "hod":
            if subject.department_id != current_user.department_id:
                continue
        
        # Store subject data for audit
        subject_data = {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "credits": subject.credits,
            "department_id": subject.department_id,
            "semester_id": subject.semester_id
        }
        
        db.delete(subject)
        deleted_subjects.append({"id": subject_id, "data": subject_data})
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_DELETE", "Subject", None, None, {
        "deleted_subjects": deleted_subjects
    })
    
    return {
        "message": f"Deleted {len(deleted_subjects)} subjects",
        "deleted_subjects": [s["id"] for s in deleted_subjects]
    }

@app.get("/api/subjects/export/{format}")
async def export_subjects(
    format: str,
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export subjects data in CSV or PDF format"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build query
    query = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.semester),
        joinedload(Subject.class_),
        joinedload(Subject.teacher)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif department_id:
        query = query.filter(Subject.department_id == department_id)
    
    if semester_id:
        query = query.filter(Subject.semester_id == semester_id)
    
    if teacher_id:
        query = query.filter(Subject.teacher_id == teacher_id)
    
    subjects = query.all()
    
    if format.lower() == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "ID", "Name", "Code", "Credits", "Department", "Semester", 
            "Class", "Teacher", "Created At"
        ])
        
        # Write data
        for subject in subjects:
            writer.writerow([
                subject.id,
                subject.name,
                subject.code,
                subject.credits,
                subject.department.name if subject.department else "",
                subject.semester.name if subject.semester else "",
                subject.class_.name if subject.class_ else "",
                subject.teacher.full_name if subject.teacher else "",
                subject.created_at.isoformat() if subject.created_at else ""
            ])
        
        csv_data = output.getvalue()
        output.close()
        
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=subjects_export.csv"}
        )
    
    elif format.lower() == "pdf":
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        import io
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Title
        title = Paragraph("Subjects Export Report", styles['Title'])
        
        # Table data
        data = [["ID", "Name", "Code", "Credits", "Department", "Semester", "Class", "Teacher"]]
        
        for subject in subjects:
            data.append([
                str(subject.id),
                subject.name,
                subject.code,
                str(subject.credits),
                subject.department.name if subject.department else "",
                subject.semester.name if subject.semester else "",
                subject.class_.name if subject.class_ else "",
                subject.teacher.full_name if subject.teacher else ""
            ])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        # Build PDF
        elements = [title, Spacer(1, 12), table]
        doc.build(elements)
        
        buffer.seek(0)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=subjects_export.pdf"}
        )
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'pdf'")

# Bulk Operations
@app.post("/api/subjects/bulk-create")
async def bulk_create_subjects(
    bulk_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk create subjects from uploaded data"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    subjects_data = bulk_data.get("subjects", [])
    if not subjects_data:
        raise HTTPException(status_code=400, detail="No subjects data provided")
    
    created_subjects = []
    errors = []
    
    for i, subject_data in enumerate(subjects_data):
        try:
            # Validate department access
            if current_user.role == "hod" and subject_data.get("department_id") != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied to department {subject_data.get('department_id')}")
                continue
            
            # Validate department exists
            department = db.query(Department).filter(Department.id == subject_data.get("department_id")).first()
            if not department:
                errors.append(f"Row {i+1}: Department not found")
                continue
            
            # Validate semester exists
            semester = db.query(Semester).filter(Semester.id == subject_data.get("semester_id")).first()
            if not semester:
                errors.append(f"Row {i+1}: Semester not found")
                continue
            
            # Validate class exists
            class_obj = db.query(Class).filter(Class.id == subject_data.get("class_id")).first()
            if not class_obj:
                errors.append(f"Row {i+1}: Class not found")
                continue
            
            # Validate teacher if provided
            if subject_data.get("teacher_id"):
                teacher = db.query(User).filter(
                    User.id == subject_data.get("teacher_id"),
                    User.role == "teacher",
                    User.department_id == subject_data.get("department_id")
                ).first()
                if not teacher:
                    errors.append(f"Row {i+1}: Invalid teacher")
                    continue
            
            # Check if subject code already exists
            existing_subject = db.query(Subject).filter(
                Subject.code == subject_data["code"],
                Subject.department_id == subject_data["department_id"]
            ).first()
            if existing_subject:
                errors.append(f"Row {i+1}: Subject code already exists")
                continue
            
            # Create subject
            new_subject = Subject(
                name=subject_data["name"],
                code=subject_data["code"],
                department_id=subject_data["department_id"],
                semester_id=subject_data["semester_id"],
                class_id=subject_data["class_id"],
                teacher_id=subject_data.get("teacher_id"),
                credits=subject_data.get("credits", 3),
                description=subject_data.get("description"),
                objectives=subject_data.get("objectives"),
                created_at=datetime.utcnow()
            )
            
            db.add(new_subject)
            db.commit()
            db.refresh(new_subject)
            
            # Create teacher-subject mapping if teacher is assigned
            if new_subject.teacher_id:
                teacher_subject = TeacherSubject(
                    teacher_id=new_subject.teacher_id,
                    subject_id=new_subject.id,
                    assigned_at=datetime.utcnow()
                )
                db.add(teacher_subject)
                db.commit()
            
            created_subjects.append({
                "id": new_subject.id,
                "name": new_subject.name,
                "code": new_subject.code,
                "department_id": new_subject.department_id,
                "semester_id": new_subject.semester_id,
                "class_id": new_subject.class_id,
                "teacher_id": new_subject.teacher_id
            })
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue
    
    return {
        "message": f"Created {len(created_subjects)} subjects successfully",
        "created_subjects": created_subjects,
        "errors": errors
    }

@app.post("/api/subjects/bulk-assign-teachers")
async def bulk_assign_teachers(
    assignment_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk assign teachers to subjects"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    assignments = assignment_data.get("assignments", [])
    if not assignments:
        raise HTTPException(status_code=400, detail="No assignments data provided")
    
    assigned_subjects = []
    errors = []
    
    for i, assignment in enumerate(assignments):
        try:
            subject_id = assignment.get("subject_id")
            teacher_id = assignment.get("teacher_id")
            
            if not subject_id or not teacher_id:
                errors.append(f"Row {i+1}: Subject ID and Teacher ID are required")
                continue
            
            # Validate subject exists and permissions
            subject = db.query(Subject).filter(Subject.id == subject_id).first()
            if not subject:
                errors.append(f"Row {i+1}: Subject not found")
                continue
            
            if current_user.role == "hod" and subject.department_id != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied to subject")
                continue
            
            # Validate teacher exists and permissions
            teacher = db.query(User).filter(
                User.id == teacher_id,
                User.role == "teacher",
                User.department_id == subject.department_id
            ).first()
            if not teacher:
                errors.append(f"Row {i+1}: Invalid teacher")
                continue
            
            # Check if assignment already exists
            existing_assignment = db.query(TeacherSubject).filter(
                TeacherSubject.teacher_id == teacher_id,
                TeacherSubject.subject_id == subject_id
            ).first()
            
            if existing_assignment:
                errors.append(f"Row {i+1}: Teacher already assigned to this subject")
                continue
            
            # Assign teacher to subject
            subject.teacher_id = teacher_id
            subject.updated_at = datetime.utcnow()
            
            # Create teacher-subject mapping
            teacher_subject = TeacherSubject(
                teacher_id=teacher_id,
                subject_id=subject_id,
                assigned_at=datetime.utcnow()
            )
            db.add(teacher_subject)
            db.commit()
            
            assigned_subjects.append({
                "subject_id": subject_id,
                "subject_name": subject.name,
                "teacher_id": teacher_id,
                "teacher_name": f"{teacher.first_name} {teacher.last_name}"
            })
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue
    
    return {
        "message": f"Assigned {len(assigned_subjects)} subjects successfully",
        "assigned_subjects": assigned_subjects,
        "errors": errors
    }

@app.post("/api/subjects/bulk-update")
async def bulk_update_subjects(
    bulk_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk update subjects"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    updates_data = bulk_data.get("updates", [])
    if not updates_data:
        raise HTTPException(status_code=400, detail="No updates data provided")
    
    updated_subjects = []
    errors = []
    
    for i, update_data in enumerate(updates_data):
        try:
            subject_id = update_data.get("subject_id")
            if not subject_id:
                errors.append(f"Row {i+1}: Subject ID is required")
                continue
            
            # Get subject
            subject = db.query(Subject).filter(Subject.id == subject_id).first()
            if not subject:
                errors.append(f"Row {i+1}: Subject not found")
                continue
            
            # Check permissions
            if current_user.role == "hod" and subject.department_id != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied")
                continue
            
            # Update fields
            update_fields = update_data.get("fields", {})
            for field, value in update_fields.items():
                if hasattr(subject, field) and field not in ["id", "created_at"]:
                    setattr(subject, field, value)
            
            subject.updated_at = datetime.utcnow()
            db.commit()
            
            updated_subjects.append({
                "id": subject.id,
                "name": subject.name,
                "code": subject.code,
                "updated_fields": list(update_fields.keys())
            })
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue
    
    return {
        "message": f"Updated {len(updated_subjects)} subjects successfully",
        "updated_subjects": updated_subjects,
        "errors": errors
    }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "subjects"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
