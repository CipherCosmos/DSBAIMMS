from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, extract
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date, timedelta
import pandas as pd
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Semester, AuditLog, Attendance
from shared.auth import RoleChecker
from shared.permissions import PermissionChecker

app = FastAPI(title="Attendance Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class AttendanceCreate(BaseModel):
    student_id: int
    subject_id: int
    class_id: int
    attendance_date: date
    status: str  # 'present', 'absent', 'late', 'excused'
    remarks: Optional[str] = None

class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceAnalytics(BaseModel):
    total_students: int
    attendance_rate: float
    students_by_attendance: Dict[str, int]
    subjects_by_attendance: Dict[str, float]
    daily_attendance: List[Dict[str, Any]]
    attendance_trends: Dict[str, float]

class BulkAttendanceCreate(BaseModel):
    attendances: List[AttendanceCreate]

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
    return {"message": "Attendance Service", "version": "1.0.0"}

# Get attendance records with role-based filtering
@app.get("/attendance")
async def get_attendance(
    student_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get attendance records with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Attendance).options(
        joinedload(Attendance.student),
        joinedload(Attendance.subject),
        joinedload(Attendance.class_)
    )
    
    # Apply role-based filtering
    if current_user.role == "student":
        # Students can only see their own attendance
        query = query.filter(Attendance.student_id == current_user_id)
    elif current_user.role == "teacher":
        # Teachers can only see attendance for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.filter(Attendance.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)  # No access if no subjects assigned
    elif current_user.role == "hod":
        # HODs can only see attendance in their department
        if current_user.department_id:
            query = query.join(Class).filter(Class.department_id == current_user.department_id)
    
    # Apply filters
    if student_id:
        query = query.filter(Attendance.student_id == student_id)
    if subject_id:
        query = query.filter(Attendance.subject_id == subject_id)
    if class_id:
        query = query.filter(Attendance.class_id == class_id)
    if start_date:
        query = query.filter(Attendance.attendance_date >= start_date)
    if end_date:
        query = query.filter(Attendance.attendance_date <= end_date)
    if status:
        query = query.filter(Attendance.status == status)
    
    attendances = query.offset(skip).limit(limit).all()
    return attendances

# Create attendance record
@app.post("/attendance")
async def create_attendance(
    attendance_data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new attendance record"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate student exists and is active
    student = db.query(User).filter(
        User.id == attendance_data.student_id,
        User.role == "student",
        User.is_active == True
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found or inactive")
    
    # Validate subject exists
    subject = db.query(Subject).filter(Subject.id == attendance_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Validate class exists
    class_obj = db.query(Class).filter(Class.id == attendance_data.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Role-based restrictions
    if current_user.role == "teacher":
        # Teachers can only mark attendance for subjects they teach
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Cannot mark attendance for subjects you don't teach")
    elif current_user.role == "hod":
        # HODs can only mark attendance in their department
        if class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot mark attendance for classes outside your department")
    
    # Check if attendance already exists for this student, subject, and date
    existing_attendance = db.query(Attendance).filter(
        Attendance.student_id == attendance_data.student_id,
        Attendance.subject_id == attendance_data.subject_id,
        Attendance.attendance_date == attendance_data.attendance_date
    ).first()
    if existing_attendance:
        raise HTTPException(status_code=400, detail="Attendance already recorded for this student, subject, and date")
    
    # Validate attendance status
    valid_statuses = ['present', 'absent', 'late', 'excused']
    if attendance_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Create attendance record
    new_attendance = Attendance(
        student_id=attendance_data.student_id,
        subject_id=attendance_data.subject_id,
        class_id=attendance_data.class_id,
        attendance_date=attendance_data.attendance_date,
        status=attendance_data.status,
        remarks=attendance_data.remarks,
        marked_by=current_user_id,
        created_at=datetime.utcnow()
    )
    
    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Attendance", new_attendance.id, None, {
        "student_id": attendance_data.student_id,
        "subject_id": attendance_data.subject_id,
        "status": attendance_data.status,
        "attendance_date": attendance_data.attendance_date.isoformat()
    })
    
    return new_attendance

# Update attendance record
@app.put("/attendance/{attendance_id}")
async def update_attendance(
    attendance_id: int,
    attendance_data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update attendance record"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Role-based access control
    if current_user.role == "teacher":
        # Teachers can only update attendance for subjects they teach
        subject = db.query(Subject).filter(Subject.id == attendance.subject_id).first()
        if not subject or subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Cannot update attendance for subjects you don't teach")
    elif current_user.role == "hod":
        # HODs can only update attendance in their department
        class_obj = db.query(Class).filter(Class.id == attendance.class_id).first()
        if not class_obj or class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot update attendance for classes outside your department")
    
    # Store old values for audit
    old_values = {
        "status": attendance.status,
        "remarks": attendance.remarks
    }
    
    # Validate status if being updated
    if attendance_data.status is not None:
        valid_statuses = ['present', 'absent', 'late', 'excused']
        if attendance_data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Update fields
    if attendance_data.status is not None:
        attendance.status = attendance_data.status
    if attendance_data.remarks is not None:
        attendance.remarks = attendance_data.remarks
    
    attendance.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(attendance)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Attendance", attendance_id, old_values, {
        "status": attendance.status,
        "remarks": attendance.remarks
    })
    
    return attendance

# Delete attendance record
@app.delete("/attendance/{attendance_id}")
async def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete attendance record"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Role-based access control
    if current_user.role == "teacher":
        subject = db.query(Subject).filter(Subject.id == attendance.subject_id).first()
        if not subject or subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Cannot delete attendance for subjects you don't teach")
    elif current_user.role == "hod":
        class_obj = db.query(Class).filter(Class.id == attendance.class_id).first()
        if not class_obj or class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot delete attendance for classes outside your department")
    
    # Log audit before deletion
    log_audit(db, current_user_id, "DELETE", "Attendance", attendance_id, {
        "student_id": attendance.student_id,
        "subject_id": attendance.subject_id,
        "status": attendance.status,
        "attendance_date": attendance.attendance_date.isoformat()
    }, None)
    
    db.delete(attendance)
    db.commit()
    
    return {"message": "Attendance record deleted successfully"}

# Get attendance analytics
@app.get("/attendance/analytics")
async def get_attendance_analytics(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get attendance analytics and statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build base query with role-based filtering
    query = db.query(Attendance).options(
        joinedload(Attendance.student),
        joinedload(Attendance.subject),
        joinedload(Attendance.class_)
    )
    
    if current_user.role == "hod":
        if current_user.department_id:
            query = query.join(Class).filter(Class.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.filter(Attendance.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)
    
    # Apply filters
    if department_id:
        query = query.join(Class).filter(Class.department_id == department_id)
    if semester_id:
        query = query.join(Class).filter(Class.semester_id == semester_id)
    if class_id:
        query = query.filter(Attendance.class_id == class_id)
    if subject_id:
        query = query.filter(Attendance.subject_id == subject_id)
    if start_date:
        query = query.filter(Attendance.attendance_date >= start_date)
    if end_date:
        query = query.filter(Attendance.attendance_date <= end_date)
    
    attendances = query.all()
    
    # Calculate analytics
    total_records = len(attendances)
    present_count = len([a for a in attendances if a.status == 'present'])
    absent_count = len([a for a in attendances if a.status == 'absent'])
    late_count = len([a for a in attendances if a.status == 'late'])
    excused_count = len([a for a in attendances if a.status == 'excused'])
    
    attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
    
    # Students by attendance
    students_by_attendance = {}
    for attendance in attendances:
        student_name = attendance.student.full_name if attendance.student else "Unknown"
        if student_name not in students_by_attendance:
            students_by_attendance[student_name] = {"present": 0, "absent": 0, "late": 0, "excused": 0}
        students_by_attendance[student_name][attendance.status] += 1
    
    # Subjects by attendance rate
    subjects_by_attendance = {}
    for attendance in attendances:
        subject_name = attendance.subject.name if attendance.subject else "Unknown"
        if subject_name not in subjects_by_attendance:
            subjects_by_attendance[subject_name] = {"total": 0, "present": 0}
        subjects_by_attendance[subject_name]["total"] += 1
        if attendance.status == 'present':
            subjects_by_attendance[subject_name]["present"] += 1
    
    # Calculate attendance rates for subjects
    for subject_name in subjects_by_attendance:
        total = subjects_by_attendance[subject_name]["total"]
        present = subjects_by_attendance[subject_name]["present"]
        subjects_by_attendance[subject_name] = (present / total * 100) if total > 0 else 0
    
    # Daily attendance trend
    daily_attendance = {}
    for attendance in attendances:
        date_str = attendance.attendance_date.isoformat()
        if date_str not in daily_attendance:
            daily_attendance[date_str] = {"total": 0, "present": 0}
        daily_attendance[date_str]["total"] += 1
        if attendance.status == 'present':
            daily_attendance[date_str]["present"] += 1
    
    # Calculate daily rates
    daily_attendance_list = []
    for date_str, data in daily_attendance.items():
        rate = (data["present"] / data["total"] * 100) if data["total"] > 0 else 0
        daily_attendance_list.append({
            "date": date_str,
            "total_students": data["total"],
            "present_students": data["present"],
            "attendance_rate": rate
        })
    
    # Sort by date
    daily_attendance_list.sort(key=lambda x: x["date"])
    
    # Attendance trends (weekly comparison)
    attendance_trends = {}
    if len(daily_attendance_list) >= 14:  # At least 2 weeks of data
        recent_week = daily_attendance_list[-7:]
        previous_week = daily_attendance_list[-14:-7]
        
        recent_avg = sum([d["attendance_rate"] for d in recent_week]) / len(recent_week)
        previous_avg = sum([d["attendance_rate"] for d in previous_week]) / len(previous_week)
        
        attendance_trends = {
            "recent_week_avg": recent_avg,
            "previous_week_avg": previous_avg,
            "change": recent_avg - previous_avg,
            "change_percentage": ((recent_avg - previous_avg) / previous_avg * 100) if previous_avg > 0 else 0
        }
    
    return AttendanceAnalytics(
        total_students=len(set([a.student_id for a in attendances])),
        attendance_rate=attendance_rate,
        students_by_attendance=students_by_attendance,
        subjects_by_attendance=subjects_by_attendance,
        daily_attendance=daily_attendance_list,
        attendance_trends=attendance_trends
    )

# Bulk create attendance records
@app.post("/attendance/bulk")
async def bulk_create_attendance(
    bulk_data: BulkAttendanceCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk create attendance records"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    created_attendances = []
    errors = []
    
    for i, attendance_data in enumerate(bulk_data.attendances):
        try:
            # Validate student exists
            student = db.query(User).filter(
                User.id == attendance_data.student_id,
                User.role == "student",
                User.is_active == True
            ).first()
            if not student:
                errors.append(f"Row {i+1}: Student not found or inactive")
                continue
            
            # Validate subject exists
            subject = db.query(Subject).filter(Subject.id == attendance_data.subject_id).first()
            if not subject:
                errors.append(f"Row {i+1}: Subject not found")
                continue
            
            # Validate class exists
            class_obj = db.query(Class).filter(Class.id == attendance_data.class_id).first()
            if not class_obj:
                errors.append(f"Row {i+1}: Class not found")
                continue
            
            # Role-based validation
            if current_user.role == "teacher":
                if subject.teacher_id != current_user_id:
                    errors.append(f"Row {i+1}: Cannot mark attendance for subjects you don't teach")
                    continue
            elif current_user.role == "hod":
                if class_obj.department_id != current_user.department_id:
                    errors.append(f"Row {i+1}: Cannot mark attendance for classes outside your department")
                    continue
            
            # Check for duplicate
            existing_attendance = db.query(Attendance).filter(
                Attendance.student_id == attendance_data.student_id,
                Attendance.subject_id == attendance_data.subject_id,
                Attendance.attendance_date == attendance_data.attendance_date
            ).first()
            if existing_attendance:
                errors.append(f"Row {i+1}: Attendance already recorded for this student, subject, and date")
                continue
            
            # Validate status
            valid_statuses = ['present', 'absent', 'late', 'excused']
            if attendance_data.status not in valid_statuses:
                errors.append(f"Row {i+1}: Invalid status. Must be one of: {', '.join(valid_statuses)}")
                continue
            
            # Create attendance record
            new_attendance = Attendance(
                student_id=attendance_data.student_id,
                subject_id=attendance_data.subject_id,
                class_id=attendance_data.class_id,
                attendance_date=attendance_data.attendance_date,
                status=attendance_data.status,
                remarks=attendance_data.remarks,
                marked_by=current_user_id,
                created_at=datetime.utcnow()
            )
            
            db.add(new_attendance)
            db.commit()
            db.refresh(new_attendance)
            
            created_attendances.append({
                "id": new_attendance.id,
                "student_id": new_attendance.student_id,
                "subject_id": new_attendance.subject_id,
                "status": new_attendance.status
            })
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            db.rollback()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_CREATE", "Attendance", None, None, {
        "total_requested": len(bulk_data.attendances),
        "created": len(created_attendances),
        "errors": len(errors)
    })
    
    return {
        "created_attendances": created_attendances,
        "errors": errors,
        "summary": {
            "total_requested": len(bulk_data.attendances),
            "created": len(created_attendances),
            "failed": len(errors)
        }
    }

@app.post("/api/attendance/bulk-update")
async def bulk_update_attendance(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk update attendance records"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    attendance_ids = request.get("attendance_ids", [])
    update_data = request.get("update_data", {})
    
    if not attendance_ids:
        raise HTTPException(status_code=400, detail="No attendance IDs provided")
    
    updated_attendances = []
    for attendance_id in attendance_ids:
        attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
        if not attendance:
            continue
            
        # Role-based access control
        if current_user.role == "teacher":
            subject = db.query(Subject).filter(Subject.id == attendance.subject_id).first()
            if not subject or subject.teacher_id != current_user_id:
                continue
        elif current_user.role == "hod":
            class_obj = db.query(Class).filter(Class.id == attendance.class_id).first()
            if not class_obj or class_obj.department_id != current_user.department_id:
                continue
        
        # Update attendance data
        for field, value in update_data.items():
            if hasattr(attendance, field) and field not in ["id", "created_at", "updated_at"]:
                setattr(attendance, field, value)
        
        db.commit()
        updated_attendances.append(attendance_id)
    
    # Log audit
    log_audit(db, current_user_id, "BULK_UPDATE", "Attendance", None, None, {
        "attendance_ids": updated_attendances,
        "update_data": update_data
    })
    
    return {
        "message": f"Updated {len(updated_attendances)} attendance records",
        "updated_attendances": updated_attendances
    }

@app.post("/api/attendance/bulk-delete")
async def bulk_delete_attendance(
    request: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk delete attendance records"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    attendance_ids = request.get("attendance_ids", [])
    
    if not attendance_ids:
        raise HTTPException(status_code=400, detail="No attendance IDs provided")
    
    deleted_attendances = []
    for attendance_id in attendance_ids:
        attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
        if not attendance:
            continue
            
        # Role-based access control
        if current_user.role == "teacher":
            subject = db.query(Subject).filter(Subject.id == attendance.subject_id).first()
            if not subject or subject.teacher_id != current_user_id:
                continue
        elif current_user.role == "hod":
            class_obj = db.query(Class).filter(Class.id == attendance.class_id).first()
            if not class_obj or class_obj.department_id != current_user.department_id:
                continue
        
        # Store attendance data for audit
        attendance_data = {
            "id": attendance.id,
            "student_id": attendance.student_id,
            "subject_id": attendance.subject_id,
            "class_id": attendance.class_id,
            "status": attendance.status,
            "attendance_date": attendance.attendance_date.isoformat()
        }
        
        db.delete(attendance)
        deleted_attendances.append({"id": attendance_id, "data": attendance_data})
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_DELETE", "Attendance", None, None, {
        "deleted_attendances": deleted_attendances
    })
    
    return {
        "message": f"Deleted {len(deleted_attendances)} attendance records",
        "deleted_attendances": [a["id"] for a in deleted_attendances]
    }

@app.get("/api/attendance/export/{format}")
async def export_attendance(
    format: str,
    student_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export attendance data in CSV or PDF format"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build query
    query = db.query(Attendance).options(
        joinedload(Attendance.student),
        joinedload(Attendance.subject),
        joinedload(Attendance.class_)
    )
    
    # Apply role-based filtering
    if current_user.role == "teacher":
        # Teachers can only see attendance for subjects they teach
        query = query.join(Subject).filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "hod":
        # HODs can only see attendance in their department
        query = query.join(Class).filter(Class.department_id == current_user.department_id)
    
    # Apply filters
    if student_id:
        query = query.filter(Attendance.student_id == student_id)
    if subject_id:
        query = query.filter(Attendance.subject_id == subject_id)
    if class_id:
        query = query.filter(Attendance.class_id == class_id)
    if start_date:
        query = query.filter(Attendance.attendance_date >= start_date)
    if end_date:
        query = query.filter(Attendance.attendance_date <= end_date)
    
    attendances = query.all()
    
    if format.lower() == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "ID", "Student", "Subject", "Class", "Date", "Status", "Remarks", "Marked By"
        ])
        
        # Write data
        for attendance in attendances:
            writer.writerow([
                attendance.id,
                attendance.student.full_name if attendance.student else "",
                attendance.subject.name if attendance.subject else "",
                attendance.class_.name if attendance.class_ else "",
                attendance.attendance_date.isoformat() if attendance.attendance_date else "",
                attendance.status,
                attendance.remarks or "",
                attendance.marked_by or ""
            ])
        
        csv_data = output.getvalue()
        output.close()
        
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=attendance_export.csv"}
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
        title = Paragraph("Attendance Export Report", styles['Title'])
        
        # Table data
        data = [["Student", "Subject", "Class", "Date", "Status", "Remarks"]]
        
        for attendance in attendances:
            data.append([
                attendance.student.full_name if attendance.student else "",
                attendance.subject.name if attendance.subject else "",
                attendance.class_.name if attendance.class_ else "",
                attendance.attendance_date.strftime("%Y-%m-%d") if attendance.attendance_date else "",
                attendance.status,
                attendance.remarks or ""
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
            headers={"Content-Disposition": f"attachment; filename=attendance_export.pdf"}
        )
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'pdf'")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "attendance"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
