from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date
import json

from shared.database import get_db
from shared.models import Semester, Department, Class, Subject, User, StudentSemesterEnrollment, AuditLog
from shared.auth import RoleChecker
from shared.permissions import PermissionChecker, Permission
from shared.schemas import SemesterResponse, SemesterCreate, SemesterUpdate

app = FastAPI(title="Semester Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class SemesterEnrollmentRequest(BaseModel):
    student_id: int
    semester_id: int
    enrollment_date: Optional[str] = None
    status: str = "active"  # active, completed, dropped

class SemesterPromotionRequest(BaseModel):
    student_ids: List[int]
    from_semester_id: int
    to_semester_id: int
    promotion_date: Optional[str] = None

class SemesterAnalytics(BaseModel):
    semester_id: int
    semester_name: str
    department_name: str
    total_students: int
    active_students: int
    completed_students: int
    dropped_students: int
    total_classes: int
    total_subjects: int
    average_attendance: float
    promotion_rate: float



def format_semester_response(semester: Semester) -> Dict[str, Any]:
    """Format semester response with related data"""
    return {
        "id": semester.id,
        "name": semester.name,
        "department_id": semester.department_id,
        "department_name": semester.department.name if semester.department else None,
        "academic_year": semester.academic_year,
        "start_date": semester.start_date.isoformat() if semester.start_date else None,
        "end_date": semester.end_date.isoformat() if semester.end_date else None,
        "is_active": semester.is_active,
        "created_at": semester.created_at.isoformat() if semester.created_at else None,
        "updated_at": semester.updated_at.isoformat() if semester.updated_at else None,
        "class_count": len(semester.classes) if semester.classes else 0,
        "subject_count": len(semester.subjects) if semester.subjects else 0,
        "student_count": len(semester.enrollments) if semester.enrollments else 0
    }

@app.get("/", response_model=Dict[str, str])
async def root():
    """Service health check"""
    return {"message": "Semester Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/semesters", response_model=List[SemesterResponse])
async def get_semesters(
    department_id: Optional[int] = Query(None),
    academic_year: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get semesters with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    query = db.query(Semester).options(
        joinedload(Semester.department),
        joinedload(Semester.classes),
        joinedload(Semester.subjects),
        joinedload(Semester.enrollments)
    )

    # Apply role-based filtering
    if current_user.role == "hod":
        # HOD can only see semesters in their department
        query = query.filter(Semester.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can see semesters where they teach
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_ids.contains([current_user.id]))
        query = query.filter(Semester.subjects.any(Subject.id.in_(teacher_subjects)))

    # Apply additional filters
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            query = query.filter(Semester.department_id == department_id)
        else:
            raise HTTPException(status_code=403, detail="You cannot access this department")

    if academic_year:
        query = query.filter(Semester.academic_year == academic_year)

    if is_active is not None:
        query = query.filter(Semester.is_active == is_active)

    semesters = query.offset(skip).limit(limit).all()

    result = []
    for semester in semesters:
        result.append(format_semester_response(semester))

    return result

@app.get("/api/semesters/{semester_id}", response_model=SemesterResponse)
async def get_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get specific semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    semester = db.query(Semester).options(
        joinedload(Semester.department),
        joinedload(Semester.classes),
        joinedload(Semester.subjects),
        joinedload(Semester.enrollments)
    ).filter(Semester.id == semester_id).first()

    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Check permissions
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot access semesters from other departments")
    elif current_user.role == "teacher":
        # Check if teacher teaches in this semester
        teacher_subjects = db.query(Subject.id).filter(
            Subject.semester_id == semester_id,
            Subject.teacher_ids.contains([current_user.id])
        ).first()
        if not teacher_subjects:
            raise HTTPException(status_code=403, detail="Cannot access semesters where you don't teach")

    return format_semester_response(semester)

@app.post("/api/semesters", response_model=SemesterResponse)
async def create_semester(
    semester_data: SemesterCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Check permissions
    if not PermissionChecker.has_permission(current_user.role, Permission.CREATE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create semesters")

    # HOD can only create semesters in their department
    if current_user.role == "hod" and semester_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Can only create semesters in your department")

    # Validate department exists
    department = db.query(Department).filter(Department.id == semester_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check for duplicate semester name in department
    existing_semester = db.query(Semester).filter(
        Semester.department_id == semester_data.department_id,
        Semester.name == semester_data.name,
        Semester.academic_year == semester_data.academic_year
    ).first()

    if existing_semester:
        raise HTTPException(status_code=400, detail="Semester with this name already exists in the department for this academic year")

    # Parse dates
    start_date = None
    end_date = None

    if semester_data.start_date:
        try:
            start_date = datetime.strptime(semester_data.start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start date format. Use YYYY-MM-DD")

    if semester_data.end_date:
        try:
            end_date = datetime.strptime(semester_data.end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date format. Use YYYY-MM-DD")

    # Validate date range
    if start_date and end_date and start_date >= end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")

    # Create semester
    semester = Semester(
        name=semester_data.name,
        department_id=semester_data.department_id,
        academic_year=semester_data.academic_year,
        start_date=start_date,
        end_date=end_date,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(semester)
    db.commit()
    db.refresh(semester)

    # Log audit
    log_audit(db, current_user_id, "CREATE_SEMESTER", "semesters", semester.id,
              new_values=semester_data.dict(), request=request)

    return format_semester_response(semester)

@app.put("/api/semesters/{semester_id}", response_model=SemesterResponse)
async def update_semester(
    semester_id: int,
    semester_data: SemesterUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Check permissions
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Can only update semesters in your department")

    # Store old values for audit
    old_values = {
        "name": semester.name,
        "academic_year": semester.academic_year,
        "start_date": semester.start_date.isoformat() if semester.start_date else None,
        "end_date": semester.end_date.isoformat() if semester.end_date else None,
        "is_active": semester.is_active
    }

    # Update fields
    update_data = semester_data.dict(exclude_unset=True)

    # Handle date conversions
    if "start_date" in update_data and update_data["start_date"]:
        try:
            update_data["start_date"] = datetime.strptime(update_data["start_date"], "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start date format. Use YYYY-MM-DD")

    if "end_date" in update_data and update_data["end_date"]:
        try:
            update_data["end_date"] = datetime.strptime(update_data["end_date"], "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date format. Use YYYY-MM-DD")

    # Validate date range
    start_date = update_data.get("start_date", semester.start_date)
    end_date = update_data.get("end_date", semester.end_date)

    if start_date and end_date and start_date >= end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")

    # Update semester
    for field, value in update_data.items():
        setattr(semester, field, value)

    semester.updated_at = datetime.utcnow()
    db.commit()

    # Log audit
    log_audit(db, current_user_id, "UPDATE_SEMESTER", "semesters", semester_id,
              old_values=old_values, new_values=update_data, request=request)

    return format_semester_response(semester)

@app.delete("/api/semesters/{semester_id}")
async def delete_semester(
    semester_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Delete semester (admin only)"""
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Check if semester has active enrollments
    active_enrollments = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.semester_id == semester_id,
        StudentSemesterEnrollment.status == "active"
    ).count()

    if active_enrollments > 0:
        raise HTTPException(status_code=400, detail="Cannot delete semester with active student enrollments")

    # Store old values for audit
    old_values = format_semester_response(semester)

    db.delete(semester)
    db.commit()

    # Log audit
    log_audit(db, current_user_id, "DELETE_SEMESTER", "semesters", semester_id,
              old_values=old_values, request=request)

    return {"message": "Semester deleted successfully"}

@app.post("/api/semesters/{semester_id}/enroll-student")
async def enroll_student(
    semester_id: int,
    enrollment_data: SemesterEnrollmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Enroll student in semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Validate semester exists
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Validate student exists
    student = db.query(User).filter(User.id == enrollment_data.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check permissions
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Can only enroll students in your department's semesters")

    # Check if student is already enrolled
    existing_enrollment = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.student_id == enrollment_data.student_id,
        StudentSemesterEnrollment.semester_id == semester_id
    ).first()

    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this semester")

    # Parse enrollment date
    enrollment_date = datetime.utcnow().date()
    if enrollment_data.enrollment_date:
        try:
            enrollment_date = datetime.strptime(enrollment_data.enrollment_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid enrollment date format. Use YYYY-MM-DD")

    # Create enrollment
    enrollment = StudentSemesterEnrollment(
        student_id=enrollment_data.student_id,
        semester_id=semester_id,
        enrollment_date=enrollment_date,
        status=enrollment_data.status,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # Log audit
    log_audit(db, current_user_id, "ENROLL_STUDENT", "student_semester_enrollments", enrollment.id,
              new_values=enrollment_data.dict(), request=request)

    return {"message": "Student enrolled successfully", "enrollment_id": enrollment.id}

@app.get("/api/semesters/{semester_id}/analytics", response_model=SemesterAnalytics)
async def get_semester_analytics(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get semester analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    semester = db.query(Semester).options(
        joinedload(Semester.department),
        joinedload(Semester.classes),
        joinedload(Semester.subjects),
        joinedload(Semester.enrollments)
    ).filter(Semester.id == semester_id).first()

    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Check permissions
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot access analytics for other departments")

    # Calculate analytics
    total_students = len(semester.enrollments) if semester.enrollments else 0
    active_students = len([e for e in semester.enrollments if e.status == "active"]) if semester.enrollments else 0
    completed_students = len([e for e in semester.enrollments if e.status == "completed"]) if semester.enrollments else 0
    dropped_students = len([e for e in semester.enrollments if e.status == "dropped"]) if semester.enrollments else 0

    return SemesterAnalytics(
        semester_id=semester.id,
        semester_name=semester.name,
        department_name=semester.department.name if semester.department else None,
        total_students=total_students,
        active_students=active_students,
        completed_students=completed_students,
        dropped_students=dropped_students,
        total_classes=len(semester.classes) if semester.classes else 0,
        total_subjects=len(semester.subjects) if semester.subjects else 0,
        average_attendance=0.0,  # This would need to be calculated from attendance records
        promotion_rate=(completed_students / total_students * 100) if total_students > 0 else 0.0
    )

# Bulk Operations for Semesters
@app.post("/api/semesters/bulk-create")
async def bulk_create_semesters(
    bulk_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk create semesters"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    semesters_data = bulk_data.get("semesters", [])
    if not semesters_data:
        raise HTTPException(status_code=400, detail="No semesters data provided")

    created_semesters = []
    errors = []

    for i, semester_data in enumerate(semesters_data):
        try:
            # Validate department access
            if current_user.role == "hod" and semester_data.get("department_id") != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied to department {semester_data.get('department_id')}")
                continue

            # Validate department exists
            department = db.query(Department).filter(Department.id == semester_data.get("department_id")).first()
            if not department:
                errors.append(f"Row {i+1}: Department not found")
                continue

            # Check if semester already exists for this department and academic year
            existing_semester = db.query(Semester).filter(
                Semester.department_id == semester_data["department_id"],
                Semester.name == semester_data["name"],
                Semester.academic_year == semester_data.get("academic_year")
            ).first()

            if existing_semester:
                errors.append(f"Row {i+1}: Semester already exists for this department and academic year")
                continue

            # Create semester
            new_semester = Semester(
                name=semester_data["name"],
                department_id=semester_data["department_id"],
                academic_year=semester_data.get("academic_year", datetime.now().year),
                start_date=datetime.fromisoformat(semester_data["start_date"]) if semester_data.get("start_date") else None,
                end_date=datetime.fromisoformat(semester_data["end_date"]) if semester_data.get("end_date") else None,
                is_active=semester_data.get("is_active", True),
                created_at=datetime.utcnow()
            )

            db.add(new_semester)
            db.commit()
            db.refresh(new_semester)

            created_semesters.append({
                "id": new_semester.id,
                "name": new_semester.name,
                "department_id": new_semester.department_id,
                "academic_year": new_semester.academic_year,
                "is_active": new_semester.is_active
            })

            # Log audit
            log_audit(db, current_user_id, "CREATE", "Semester", new_semester.id, None, semester_data)

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue

    return {
        "message": f"Created {len(created_semesters)} semesters successfully",
        "created_semesters": created_semesters,
        "errors": errors
    }

@app.post("/api/semesters/bulk-enroll-students")
async def bulk_enroll_students(
    enrollment_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk enroll students to semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    semester_id = enrollment_data.get("semester_id")
    student_ids = enrollment_data.get("student_ids", [])

    if not semester_id or not student_ids:
        raise HTTPException(status_code=400, detail="Semester ID and student IDs are required")

    # Validate semester exists and permissions
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied to semester")

    enrolled_students = []
    errors = []

    for student_id in student_ids:
        try:
            # Validate student exists and permissions
            student = db.query(User).filter(
                User.id == student_id,
                User.role == "student",
                User.department_id == semester.department_id
            ).first()

            if not student:
                errors.append(f"Student {student_id} not found or access denied")
                continue

            # Check if already enrolled
            existing_enrollment = db.query(StudentSemesterEnrollment).filter(
                StudentSemesterEnrollment.student_id == student_id,
                StudentSemesterEnrollment.semester_id == semester_id,
                StudentSemesterEnrollment.status == "active"
            ).first()

            if existing_enrollment:
                errors.append(f"Student {student_id} already enrolled in this semester")
                continue

            # Create enrollment
            enrollment = StudentSemesterEnrollment(
                student_id=student_id,
                semester_id=semester_id,
                enrollment_date=datetime.utcnow(),
                status="active"
            )

            db.add(enrollment)
            enrolled_students.append({
                "student_id": student_id,
                "student_name": f"{student.first_name} {student.last_name}",
                "semester_id": semester_id,
                "enrollment_date": enrollment.enrollment_date.isoformat()
            })

        except Exception as e:
            errors.append(f"Student {student_id}: {str(e)}")
            continue

    db.commit()

    # Log audit
    log_audit(db, current_user_id, "BULK_ENROLL", "StudentSemesterEnrollment", None, None, {
        "semester_id": semester_id,
        "enrolled_students": enrolled_students
    })

    return {
        "message": f"Enrolled {len(enrolled_students)} students successfully",
        "enrolled_students": enrolled_students,
        "errors": errors
    }

@app.post("/api/semesters/promote-students")
async def promote_students_to_next_semester(
    promotion_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Promote students from one semester to the next"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    from_semester_id = promotion_data.get("from_semester_id")
    to_semester_id = promotion_data.get("to_semester_id")
    student_ids = promotion_data.get("student_ids", [])

    if not all([from_semester_id, to_semester_id, student_ids]):
        raise HTTPException(status_code=400, detail="From semester, to semester, and student IDs are required")

    # Validate semesters exist and permissions
    from_semester = db.query(Semester).filter(Semester.id == from_semester_id).first()
    to_semester = db.query(Semester).filter(Semester.id == to_semester_id).first()

    if not from_semester or not to_semester:
        raise HTTPException(status_code=404, detail="One or both semesters not found")

    if current_user.role == "hod":
        if from_semester.department_id != current_user.department_id or to_semester.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied to semesters from different department")

    promoted_students = []
    errors = []

    for student_id in student_ids:
        try:
            # Validate student exists and is enrolled in from_semester
            student = db.query(User).filter(User.id == student_id, User.role == "student").first()
            if not student:
                errors.append(f"Student {student_id} not found")
                continue

            # Check if student is enrolled in from_semester
            current_enrollment = db.query(StudentSemesterEnrollment).filter(
                StudentSemesterEnrollment.student_id == student_id,
                StudentSemesterEnrollment.semester_id == from_semester_id,
                StudentSemesterEnrollment.status == "active"
            ).first()

            if not current_enrollment:
                errors.append(f"Student {student_id} not enrolled in source semester")
                continue

            # Mark current enrollment as completed
            current_enrollment.status = "completed"
            current_enrollment.completion_date = datetime.utcnow()

            # Create new enrollment in target semester
            new_enrollment = StudentSemesterEnrollment(
                student_id=student_id,
                semester_id=to_semester_id,
                enrollment_date=datetime.utcnow(),
                status="active"
            )

            db.add(new_enrollment)

            promoted_students.append({
                "student_id": student_id,
                "student_name": f"{student.first_name} {student.last_name}",
                "from_semester": from_semester.name,
                "to_semester": to_semester.name,
                "promotion_date": datetime.utcnow().isoformat()
            })

        except Exception as e:
            errors.append(f"Student {student_id}: {str(e)}")
            continue

    db.commit()

    # Log audit
    log_audit(db, current_user_id, "PROMOTE", "StudentSemesterEnrollment", None, None, {
        "from_semester_id": from_semester_id,
        "to_semester_id": to_semester_id,
        "promoted_students": promoted_students
    })

    return {
        "message": f"Promoted {len(promoted_students)} students successfully",
        "promoted_students": promoted_students,
        "errors": errors
    }

@app.get("/api/semesters/performance-summary")
async def get_semester_performance_summary(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive performance summary for a semester"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        # Get semester
        semester = db.query(Semester).filter(Semester.id == semester_id).first()
        if not semester:
            raise HTTPException(status_code=404, detail="Semester not found")

        # Check permissions
        if current_user.role == "hod" and semester.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied to semester")

        # Get enrolled students
        enrollments = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.semester_id == semester_id,
            StudentSemesterEnrollment.status == "active"
        ).all()

        student_ids = [enrollment.student_id for enrollment in enrollments]

        # Get performance data
        from shared.models import Mark, Exam

        # Get all marks for students in this semester
        semester_marks = db.query(Mark).join(Exam).filter(
            Exam.semester_id == semester_id,
            Mark.student_id.in_(student_ids)
        ).all()

        # Calculate performance metrics
        total_marks = len(semester_marks)
        if total_marks > 0:
            total_obtained = sum(float(mark.marks_obtained) for mark in semester_marks)
            total_maximum = sum(float(mark.max_marks) for mark in semester_marks)
            average_performance = round((total_obtained / total_maximum * 100), 2)

            # Grade distribution
            grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
            for mark in semester_marks:
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

            # Pass rate
            passing_marks = len([m for m in semester_marks if float(m.marks_obtained) >= float(m.max_marks) * 0.4])
            pass_rate = round((passing_marks / total_marks * 100), 2)
        else:
            average_performance = 0.0
            grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
            pass_rate = 0.0

        # Get class-wise performance
        classes = db.query(Class).filter(Class.semester_id == semester_id).all()
        class_performance = []

        for class_obj in classes:
            class_marks = db.query(Mark).join(Exam).filter(Exam.class_id == class_obj.id).all()
            if class_marks:
                total_obtained = sum(float(mark.marks_obtained) for mark in class_marks)
                total_maximum = sum(float(mark.max_marks) for mark in class_marks)
                avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
            else:
                avg_performance = 0.0

            class_performance.append({
                "class_id": class_obj.id,
                "class_name": class_obj.name,
                "student_count": len([e for e in enrollments if e.student.class_id == class_obj.id]),
                "average_performance": avg_performance
            })

        return {
            "semester_id": semester.id,
            "semester_name": semester.name,
            "department_name": semester.department.name if semester.department else "Unknown",
            "total_students": len(enrollments),
            "total_marks": total_marks,
            "average_performance": average_performance,
            "pass_rate": pass_rate,
            "grade_distribution": grade_distribution,
            "class_performance": class_performance,
            "academic_year": semester.academic_year,
            "start_date": semester.start_date.isoformat() if semester.start_date else None,
            "end_date": semester.end_date.isoformat() if semester.end_date else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching semester performance summary: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "semesters"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)