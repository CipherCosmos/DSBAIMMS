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
from shared.models import Class, Department, User, Subject, Semester, AuditLog, StudentSemesterEnrollment
from shared.auth import RoleChecker
from shared.schemas import ClassResponse, ClassCreate, ClassUpdate
from shared.permissions import PermissionChecker

app = FastAPI(title="Classes Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class ClassCreateEnhanced(BaseModel):
    name: str
    section: str
    department_id: int
    semester_id: int
    class_teacher_id: Optional[int] = None
    cr_id: Optional[int] = None
    max_students: Optional[int] = 60
    description: Optional[str] = None

class ClassUpdateEnhanced(BaseModel):
    name: Optional[str] = None
    section: Optional[str] = None
    class_teacher_id: Optional[int] = None
    cr_id: Optional[int] = None
    max_students: Optional[int] = None
    description: Optional[str] = None

class ClassAnalytics(BaseModel):
    total_classes: int
    classes_by_department: Dict[str, int]
    classes_by_semester: Dict[str, int]
    average_students_per_class: float
    classes_without_teachers: int
    classes_without_cr: int

class BulkClassCreate(BaseModel):
    classes: List[ClassCreateEnhanced]

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
    return {"message": "Classes Service", "version": "1.0.0"}

# Get all classes with role-based filtering
@app.get("/classes", response_model=List[ClassResponse])
async def get_classes(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get classes with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.semester),
        joinedload(Class.class_teacher),
        joinedload(Class.cr)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Class.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see classes they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        class_ids = [subject.class_id for subject in teacher_subjects]
        if class_ids:
            query = query.filter(Class.id.in_(class_ids))
        else:
            query = query.filter(False)  # No access if no subjects assigned
    
    # Apply filters
    if department_id:
        query = query.filter(Class.department_id == department_id)
    if semester_id:
        query = query.filter(Class.semester_id == semester_id)
    
    classes = query.offset(skip).limit(limit).all()
    return classes

# Get class by ID
@app.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get class by ID with role-based access control"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    class_obj = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.semester),
        joinedload(Class.class_teacher),
        joinedload(Class.cr)
    ).filter(Class.id == class_id).first()
    
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only access classes they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        class_ids = [subject.class_id for subject in teacher_subjects]
        if class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return class_obj

# Create class
@app.post("/classes", response_model=ClassResponse)
async def create_class(
    class_data: ClassCreateEnhanced,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new class"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Role-based restrictions
    if current_user.role == "hod":
        # HODs can only create classes in their department
        if class_data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create classes in your department")
    
    # Validate department exists
    department = db.query(Department).filter(Department.id == class_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate semester exists
    semester = db.query(Semester).filter(Semester.id == class_data.semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Validate class teacher if provided
    if class_data.class_teacher_id:
        class_teacher = db.query(User).filter(
            User.id == class_data.class_teacher_id,
            User.role == "teacher",
            User.department_id == class_data.department_id
        ).first()
        if not class_teacher:
            raise HTTPException(status_code=404, detail="Class teacher not found or not in same department")
    
    # Validate CR if provided
    if class_data.cr_id:
        cr = db.query(User).filter(
            User.id == class_data.cr_id,
            User.role == "student",
            User.class_id == None  # CR should not already be assigned to another class
        ).first()
        if not cr:
            raise HTTPException(status_code=404, detail="Class Representative not found or already assigned")
    
    # Check if class name and section combination already exists in department
    existing_class = db.query(Class).filter(
        Class.name == class_data.name,
        Class.section == class_data.section,
        Class.department_id == class_data.department_id,
        Class.semester_id == class_data.semester_id
    ).first()
    if existing_class:
        raise HTTPException(status_code=400, detail="Class with this name and section already exists in the department and semester")
    
    # Create class
    new_class = Class(
        name=class_data.name,
        section=class_data.section,
        department_id=class_data.department_id,
        semester_id=class_data.semester_id,
        class_teacher_id=class_data.class_teacher_id,
        cr_id=class_data.cr_id,
        max_students=class_data.max_students,
        description=class_data.description,
        created_at=datetime.utcnow()
    )
    
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    # Assign CR to class if provided
    if class_data.cr_id:
        cr_user = db.query(User).filter(User.id == class_data.cr_id).first()
        if cr_user:
            cr_user.class_id = new_class.id
            db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Class", new_class.id, None, {
        "name": class_data.name,
        "section": class_data.section,
        "department_id": class_data.department_id,
        "semester_id": class_data.semester_id
    })
    
    return new_class

# Update class
@app.put("/classes/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: int,
    class_data: ClassUpdateEnhanced,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update class information"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only update classes in your department")
    
    # Store old values for audit
    old_values = {
        "name": class_obj.name,
        "section": class_obj.section,
        "class_teacher_id": class_obj.class_teacher_id,
        "cr_id": class_obj.cr_id,
        "max_students": class_obj.max_students,
        "description": class_obj.description
    }
    
    # Validate class teacher if being updated
    if class_data.class_teacher_id is not None:
        if class_data.class_teacher_id:
            class_teacher = db.query(User).filter(
                User.id == class_data.class_teacher_id,
                User.role == "teacher",
                User.department_id == class_obj.department_id
            ).first()
            if not class_teacher:
                raise HTTPException(status_code=404, detail="Class teacher not found or not in same department")
    
    # Validate CR if being updated
    if class_data.cr_id is not None:
        if class_data.cr_id:
            cr = db.query(User).filter(
                User.id == class_data.cr_id,
                User.role == "student"
            ).first()
            if not cr:
                raise HTTPException(status_code=404, detail="Class Representative not found")
            
            # Check if CR is already assigned to another class
            if cr.class_id and cr.class_id != class_id:
                raise HTTPException(status_code=400, detail="Class Representative is already assigned to another class")
    
    # Update fields
    if class_data.name is not None:
        class_obj.name = class_data.name
    if class_data.section is not None:
        class_obj.section = class_data.section
    if class_data.class_teacher_id is not None:
        class_obj.class_teacher_id = class_data.class_teacher_id
    if class_data.cr_id is not None:
        # Remove CR from old class if changing
        if class_obj.cr_id != class_data.cr_id:
            if class_obj.cr_id:
                old_cr = db.query(User).filter(User.id == class_obj.cr_id).first()
                if old_cr:
                    old_cr.class_id = None
            # Assign new CR to class
            if class_data.cr_id:
                new_cr = db.query(User).filter(User.id == class_data.cr_id).first()
                if new_cr:
                    new_cr.class_id = class_id
        class_obj.cr_id = class_data.cr_id
    if class_data.max_students is not None:
        class_obj.max_students = class_data.max_students
    if class_data.description is not None:
        class_obj.description = class_data.description
    
    class_obj.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(class_obj)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Class", class_id, old_values, {
        "name": class_obj.name,
        "section": class_obj.section,
        "class_teacher_id": class_obj.class_teacher_id,
        "cr_id": class_obj.cr_id,
        "max_students": class_obj.max_students,
        "description": class_obj.description
    })
    
    return class_obj

# Delete class
@app.delete("/classes/{class_id}")
async def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete class (soft delete by setting is_active to False)"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Role-based restrictions
    if current_user.role == "hod":
        if class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only delete classes in your department")
    
    # Check if class has students
    student_count = db.query(User).filter(User.class_id == class_id, User.role == "student").count()
    if student_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete class with {student_count} students. Please reassign students first.")
    
    # Check if class has subjects
    subject_count = db.query(Subject).filter(Subject.class_id == class_id).count()
    if subject_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete class with {subject_count} subjects. Please reassign subjects first.")
    
    # Remove CR assignment
    if class_obj.cr_id:
        cr = db.query(User).filter(User.id == class_obj.cr_id).first()
        if cr:
            cr.class_id = None
    
    # Soft delete
    class_obj.is_active = False
    class_obj.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Class", class_id, {
        "name": class_obj.name,
        "section": class_obj.section,
        "department_id": class_obj.department_id
    }, None)
    
    return {"message": "Class deleted successfully"}

# Get class students
@app.get("/classes/{class_id}/students")
async def get_class_students(
    class_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get students in a class"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only access classes they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        class_ids = [subject.class_id for subject in teacher_subjects]
        if class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    students = db.query(User).filter(
        User.class_id == class_id,
        User.role == "student",
        User.is_active == True
    ).offset(skip).limit(limit).all()
    
    return students

# Get class analytics
@app.get("/classes/analytics", response_model=ClassAnalytics)
async def get_class_analytics(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get class analytics and statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.semester)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Class.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(Class.department_id == department_id)
    
    classes = query.all()
    
    # Calculate analytics
    total_classes = len(classes)
    classes_by_department = {}
    classes_by_semester = {}
    total_students = 0
    classes_without_teachers = 0
    classes_without_cr = 0
    
    for class_obj in classes:
        # By department
        if class_obj.department:
            dept_name = class_obj.department.name
            if dept_name in classes_by_department:
                classes_by_department[dept_name] += 1
            else:
                classes_by_department[dept_name] = 1
        
        # By semester
        if class_obj.semester:
            sem_name = class_obj.semester.name
            if sem_name in classes_by_semester:
                classes_by_semester[sem_name] += 1
            else:
                classes_by_semester[sem_name] = 1
        
        # Count students in class
        student_count = db.query(User).filter(
            User.class_id == class_obj.id,
            User.role == "student",
            User.is_active == True
        ).count()
        total_students += student_count
        
        # Check for missing assignments
        if not class_obj.class_teacher_id:
            classes_without_teachers += 1
        if not class_obj.cr_id:
            classes_without_cr += 1
    
    average_students_per_class = total_students / total_classes if total_classes > 0 else 0
    
    return ClassAnalytics(
        total_classes=total_classes,
        classes_by_department=classes_by_department,
        classes_by_semester=classes_by_semester,
        average_students_per_class=average_students_per_class,
        classes_without_teachers=classes_without_teachers,
        classes_without_cr=classes_without_cr
    )

@app.post("/api/classes/bulk-update")
async def bulk_update_classes(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk update classes"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    class_ids = request.get("class_ids", [])
    update_data = request.get("update_data", {})
    
    if not class_ids:
        raise HTTPException(status_code=400, detail="No class IDs provided")
    
    updated_classes = []
    for class_id in class_ids:
        class_obj = db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            continue
            
        # Role-based access control
        if current_user.role == "hod":
            if class_obj.department_id != current_user.department_id:
                continue
        
        # Update class data
        for field, value in update_data.items():
            if hasattr(class_obj, field) and field not in ["id", "created_at", "updated_at"]:
                setattr(class_obj, field, value)
        
        db.commit()
        updated_classes.append(class_id)
    
    # Log audit
    log_audit(db, current_user_id, "BULK_UPDATE", "Class", None, None, {
        "class_ids": updated_classes,
        "update_data": update_data
    })
    
    return {
        "message": f"Updated {len(updated_classes)} classes",
        "updated_classes": updated_classes
    }

@app.post("/api/classes/bulk-delete")
async def bulk_delete_classes(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk delete classes"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    class_ids = request.get("class_ids", [])
    
    if not class_ids:
        raise HTTPException(status_code=400, detail="No class IDs provided")
    
    deleted_classes = []
    for class_id in class_ids:
        class_obj = db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            continue
            
        # Role-based access control
        if current_user.role == "hod":
            if class_obj.department_id != current_user.department_id:
                continue
        
        # Store class data for audit
        class_data = {
            "id": class_obj.id,
            "name": class_obj.name,
            "section": class_obj.section,
            "department_id": class_obj.department_id,
            "semester_id": class_obj.semester_id
        }
        
        db.delete(class_obj)
        deleted_classes.append({"id": class_id, "data": class_data})
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_DELETE", "Class", None, None, {
        "deleted_classes": deleted_classes
    })
    
    return {
        "message": f"Deleted {len(deleted_classes)} classes",
        "deleted_classes": [c["id"] for c in deleted_classes]
    }

@app.get("/api/classes/export/{format}")
async def export_classes(
    format: str,
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export classes data in CSV or PDF format"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build query
    query = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.semester),
        joinedload(Class.class_teacher),
        joinedload(Class.class_representative)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Class.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(Class.department_id == department_id)
    
    if semester_id:
        query = query.filter(Class.semester_id == semester_id)
    
    classes = query.all()
    
    if format.lower() == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "ID", "Name", "Section", "Department", "Semester", 
            "Class Teacher", "Class Representative", "Max Students", 
            "Description", "Created At"
        ])
        
        # Write data
        for class_obj in classes:
            writer.writerow([
                class_obj.id,
                class_obj.name,
                class_obj.section,
                class_obj.department.name if class_obj.department else "",
                class_obj.semester.name if class_obj.semester else "",
                class_obj.class_teacher.full_name if class_obj.class_teacher else "",
                class_obj.class_representative.full_name if class_obj.class_representative else "",
                class_obj.max_students,
                class_obj.description or "",
                class_obj.created_at.isoformat() if class_obj.created_at else ""
            ])
        
        csv_data = output.getvalue()
        output.close()
        
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=classes_export.csv"}
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
        title = Paragraph("Classes Export Report", styles['Title'])
        
        # Table data
        data = [["ID", "Name", "Section", "Department", "Semester", "Class Teacher", "Class Representative"]]
        
        for class_obj in classes:
            data.append([
                str(class_obj.id),
                class_obj.name,
                class_obj.section,
                class_obj.department.name if class_obj.department else "",
                class_obj.semester.name if class_obj.semester else "",
                class_obj.class_teacher.full_name if class_obj.class_teacher else "",
                class_obj.class_representative.full_name if class_obj.class_representative else ""
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
            headers={"Content-Disposition": f"attachment; filename=classes_export.pdf"}
        )
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'pdf'")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "classes"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
