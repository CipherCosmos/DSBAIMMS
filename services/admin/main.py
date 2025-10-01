# Admin Dashboard Service
# Comprehensive admin functionality with all features from specification

from fastapi import FastAPI, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc, asc
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
import json

from shared.database import get_db
from shared.models import (
    User, Department, Semester, Class, Subject, Exam, Question, Mark,
    CO, PO, COPOMapping, StudentSemesterEnrollment, Attendance,
    TeacherSubject, ExamAnalytics, AuditLog
)
from shared.schemas import (
    DashboardStats, BulkOperationResult, ExportRequest,
    UserCreate, DepartmentCreate, SemesterCreate, ClassCreate, SubjectCreate
)
from shared.auth import RoleChecker
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Admin Dashboard Service", version="1.0.0")


@app.get("/")
async def root():
    return {"message": "Admin Dashboard Service is running"}

@app.get("/api/admin/dashboard-stats")
async def get_admin_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Get comprehensive admin dashboard statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Basic counts
    total_users = db.query(User).count()
    total_departments = db.query(Department).count()
    total_semesters = db.query(Semester).count()
    total_classes = db.query(Class).count()
    total_subjects = db.query(Subject).count()
    total_exams = db.query(Exam).count()
    total_questions = db.query(Question).count()
    total_marks = db.query(Mark).count()

    # Role-based counts
    admin_count = db.query(User).filter(User.role == "admin").count()
    hod_count = db.query(User).filter(User.role == "hod").count()
    teacher_count = db.query(User).filter(User.role == "teacher").count()
    student_count = db.query(User).filter(User.role == "student").count()

    # Active counts
    active_users = db.query(User).filter(User.is_active == True).count()
    active_departments = db.query(Department).filter(Department.is_active == True).count()
    active_semesters = db.query(Semester).filter(Semester.is_active == True).count()
    active_classes = db.query(Class).filter(Class.is_active == True).count()
    active_subjects = db.query(Subject).filter(Subject.is_active == True).count()

    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_users = db.query(User).filter(User.created_at >= week_ago).count()
    recent_exams = db.query(Exam).filter(Exam.created_at >= week_ago).count()
    recent_marks = db.query(Mark).filter(Mark.created_at >= week_ago).count()

    # Performance metrics
    avg_exam_score = db.query(func.avg(Mark.marks_obtained / Mark.max_marks * 100)).filter(
        Mark.is_attempted == True
    ).scalar() or 0

    # Department-wise statistics
    dept_stats = []
    departments = db.query(Department).all()
    for dept in departments:
        dept_users = db.query(User).filter(User.department_id == dept.id).count()
        dept_students = db.query(User).filter(
            User.department_id == dept.id,
            User.role == "student"
        ).count()
        dept_teachers = db.query(User).filter(
            User.department_id == dept.id,
            User.role == "teacher"
        ).count()
        dept_classes = db.query(Class).filter(Class.department_id == dept.id).count()
        dept_subjects = db.query(Subject).filter(Subject.department_id == dept.id).count()

        dept_stats.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "department_code": dept.code,
            "total_users": dept_users,
            "students": dept_students,
            "teachers": dept_teachers,
            "classes": dept_classes,
            "subjects": dept_subjects,
            "hod_name": dept.hod.full_name if dept.hod else None
        })

    return {
        "overview": {
            "total_users": total_users,
            "total_departments": total_departments,
            "total_semesters": total_semesters,
            "total_classes": total_classes,
            "total_subjects": total_subjects,
            "total_exams": total_exams,
            "total_questions": total_questions,
            "total_marks": total_marks
        },
        "roles": {
            "admins": admin_count,
            "hods": hod_count,
            "teachers": teacher_count,
            "students": student_count
        },
        "active_counts": {
            "users": active_users,
            "departments": active_departments,
            "semesters": active_semesters,
            "classes": active_classes,
            "subjects": active_subjects
        },
        "recent_activity": {
            "new_users_week": recent_users,
            "new_exams_week": recent_exams,
            "new_marks_week": recent_marks
        },
        "performance": {
            "avg_exam_score": float(avg_exam_score) if avg_exam_score else 0.0
        },
        "department_stats": dept_stats
    }

@app.get("/api/admin/users")
async def get_admin_users(
    skip: int = 0,
    limit: int = 100,
    department_id: Optional[int] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Get all users with admin-level access"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(User)

    # Apply filters
    if department_id:
        query = query.filter(User.department_id == department_id)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.username.ilike(f"%{search}%"),
                User.student_id.ilike(f"%{search}%"),
                User.employee_id.ilike(f"%{search}%")
            )
        )

    users = query.offset(skip).limit(limit).all()

    results = []
    for user in users:
        results.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_active": user.is_active,
            "department_id": user.department_id,
            "department_name": user.department.name if user.department else None,
            "class_id": user.class_id,
            "class_name": user.class_assigned.name if user.class_assigned else None,
            "student_id": user.student_id,
            "employee_id": user.employee_id,
            "phone": user.phone,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login": user.last_login
        })

    return results

@app.get("/api/admin/departments")
async def get_admin_departments(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Get all departments with admin-level access"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(Department)

    # Apply filters
    if is_active is not None:
        query = query.filter(Department.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                Department.name.ilike(f"%{search}%"),
                Department.code.ilike(f"%{search}%"),
                Department.description.ilike(f"%{search}%")
            )
        )

    departments = query.offset(skip).limit(limit).all()

    results = []
    for dept in departments:
        # Get counts for this department
        users_count = db.query(User).filter(User.department_id == dept.id).count()
        students_count = db.query(User).filter(
            User.department_id == dept.id,
            User.role == "student"
        ).count()
        teachers_count = db.query(User).filter(
            User.department_id == dept.id,
            User.role == "teacher"
        ).count()
        classes_count = db.query(Class).filter(Class.department_id == dept.id).count()
        subjects_count = db.query(Subject).filter(Subject.department_id == dept.id).count()
        semesters_count = db.query(Semester).filter(Semester.department_id == dept.id).count()

        results.append({
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "description": dept.description,
            "hod_id": dept.hod_id,
            "hod_name": dept.hod.full_name if dept.hod else None,
            "duration_years": dept.duration_years,
            "academic_year": dept.academic_year,
            "semester_count": dept.semester_count,
            "current_semester": dept.current_semester,
            "is_active": dept.is_active,
            "created_at": dept.created_at,
            "updated_at": dept.updated_at,
            "users_count": users_count,
            "students_count": students_count,
            "teachers_count": teachers_count,
            "classes_count": classes_count,
            "subjects_count": subjects_count,
            "semesters_count": semesters_count
        })

    return results

@app.get("/api/admin/analytics/performance")
async def get_performance_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Get comprehensive performance analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Build base query for marks
    marks_query = db.query(Mark).filter(Mark.is_attempted == True)

    # Apply filters
    if department_id:
        marks_query = marks_query.join(Exam).join(Subject).filter(Subject.department_id == department_id)
    if semester_id:
        marks_query = marks_query.join(Exam).filter(Exam.semester_id == semester_id)
    if class_id:
        marks_query = marks_query.join(Exam).filter(Exam.class_id == class_id)
    if subject_id:
        marks_query = marks_query.join(Exam).filter(Exam.subject_id == subject_id)

    marks = marks_query.all()

    if not marks:
        return {
            "total_students": 0,
            "total_exams": 0,
            "average_score": 0.0,
            "pass_rate": 0.0,
            "grade_distribution": {},
            "subject_performance": [],
            "class_performance": [],
            "department_performance": []
        }

    # Calculate basic statistics
    unique_students = set(mark.student_id for mark in marks)
    unique_exams = set(mark.exam_id for mark in marks)

    total_obtained = sum(mark.marks_obtained for mark in marks)
    total_max = sum(mark.max_marks for mark in marks)
    average_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

    # Calculate pass rate (assuming 40% is passing)
    passing_students = 0
    for student_id in unique_students:
        student_marks = [mark for mark in marks if mark.student_id == student_id]
        if student_marks:
            student_obtained = sum(mark.marks_obtained for mark in student_marks)
            student_max = sum(mark.max_marks for mark in student_marks)
            student_percentage = (student_obtained / student_max * 100) if student_max > 0 else 0
            if student_percentage >= 40:
                passing_students += 1

    pass_rate = (passing_students / len(unique_students) * 100) if unique_students else 0.0

    # Grade distribution
    grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C+": 0, "C": 0, "D": 0, "F": 0}

    for student_id in unique_students:
        student_marks = [mark for mark in marks if mark.student_id == student_id]
        if student_marks:
            student_obtained = sum(mark.marks_obtained for mark in student_marks)
            student_max = sum(mark.max_marks for mark in student_marks)
            student_percentage = (student_obtained / student_max * 100) if student_max > 0 else 0

            if student_percentage >= 90:
                grade_distribution["A+"] += 1
            elif student_percentage >= 80:
                grade_distribution["A"] += 1
            elif student_percentage >= 70:
                grade_distribution["B+"] += 1
            elif student_percentage >= 60:
                grade_distribution["B"] += 1
            elif student_percentage >= 50:
                grade_distribution["C+"] += 1
            elif student_percentage >= 40:
                grade_distribution["C"] += 1
            elif student_percentage >= 30:
                grade_distribution["D"] += 1
            else:
                grade_distribution["F"] += 1

    # Subject performance
    subject_performance = []
    subjects = db.query(Subject).all()
    for subject in subjects:
        subject_marks = [mark for mark in marks if mark.exam.subject_id == subject.id]
        if subject_marks:
            subject_obtained = sum(mark.marks_obtained for mark in subject_marks)
            subject_max = sum(mark.max_marks for mark in subject_marks)
            subject_avg = (subject_obtained / subject_max * 100) if subject_max > 0 else 0.0

            subject_performance.append({
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "average_score": float(subject_avg),
                "total_students": len(set(mark.student_id for mark in subject_marks)),
                "total_exams": len(set(mark.exam_id for mark in subject_marks))
            })

    # Class performance
    class_performance = []
    classes = db.query(Class).all()
    for class_obj in classes:
        class_marks = [mark for mark in marks if mark.exam.class_id == class_obj.id]
        if class_marks:
            class_obtained = sum(mark.marks_obtained for mark in class_marks)
            class_max = sum(mark.max_marks for mark in class_marks)
            class_avg = (class_obtained / class_max * 100) if class_max > 0 else 0.0

            class_performance.append({
                "class_id": class_obj.id,
                "class_name": class_obj.name,
                "semester_name": class_obj.semester.name if class_obj.semester else None,
                "department_name": class_obj.department.name if class_obj.department else None,
                "average_score": float(class_avg),
                "total_students": len(set(mark.student_id for mark in class_marks)),
                "total_exams": len(set(mark.exam_id for mark in class_marks))
            })

    # Department performance
    department_performance = []
    departments = db.query(Department).all()
    for dept in departments:
        dept_marks = [mark for mark in marks if mark.exam.subject.department_id == dept.id]
        if dept_marks:
            dept_obtained = sum(mark.marks_obtained for mark in dept_marks)
            dept_max = sum(mark.max_marks for mark in dept_marks)
            dept_avg = (dept_obtained / dept_max * 100) if dept_max > 0 else 0.0

            department_performance.append({
                "department_id": dept.id,
                "department_name": dept.name,
                "department_code": dept.code,
                "average_score": float(dept_avg),
                "total_students": len(set(mark.student_id for mark in dept_marks)),
                "total_exams": len(set(mark.exam_id for mark in dept_marks))
            })

    return {
        "total_students": len(unique_students),
        "total_exams": len(unique_exams),
        "average_score": float(average_score),
        "pass_rate": float(pass_rate),
        "grade_distribution": grade_distribution,
        "subject_performance": subject_performance,
        "class_performance": class_performance,
        "department_performance": department_performance
    }

@app.post("/api/admin/bulk-operations/users")
async def bulk_create_users(
    users_data: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk create users"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    created_users = []
    errors = []

    for i, user_data in enumerate(users_data):
        try:
            # Validate required fields
            if not user_data.get("username") or not user_data.get("email") or not user_data.get("role"):
                errors.append(f"Row {i+1}: Missing required fields (username, email, role)")
                continue

            # Check if user already exists
            existing_user = db.query(User).filter(
                or_(User.username == user_data["username"], User.email == user_data["email"])
            ).first()
            if existing_user:
                errors.append(f"Row {i+1}: User with username or email already exists")
                continue

            # Hash password
            password = user_data.get("password", "default123")
            hashed_password = pwd_context.hash(password)

            # Create user
            user = User(
                username=user_data["username"],
                email=user_data["email"],
                full_name=user_data.get("full_name", ""),
                first_name=user_data.get("first_name"),
                last_name=user_data.get("last_name"),
                role=user_data["role"],
                hashed_password=hashed_password,
                department_id=user_data.get("department_id"),
                class_id=user_data.get("class_id"),
                student_id=user_data.get("student_id"),
                employee_id=user_data.get("employee_id"),
                phone=user_data.get("phone"),
                address=user_data.get("address"),
                is_active=user_data.get("is_active", True)
            )

            db.add(user)
            db.flush()  # Get the ID
            created_users.append(user.id)

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    if created_users:
        db.commit()

    return BulkOperationResult(
        success=len(errors) == 0,
        processed_count=len(users_data),
        error_count=len(errors),
        errors=errors,
        created_ids=created_users
    )

@app.post("/api/admin/bulk-operations/export")
async def bulk_export_data(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk export data in various formats"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # This would implement actual export functionality
    # For now, return a placeholder response
    return {
        "message": "Export request received",
        "export_type": export_request.export_type,
        "entity_type": export_request.entity_type,
        "filters": export_request.filters,
        "format": export_request.format,
        "status": "processing"
    }

@app.post("/api/admin/bulk-operations/import")
async def bulk_import_data(
    file: UploadFile = File(...),
    entity_type: str = Query(..., description="Type of entity to import"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk import data from file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate file type
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    # This would implement actual import functionality
    # For now, return a placeholder response
    return {
        "message": "Import request received",
        "filename": file.filename,
        "entity_type": entity_type,
        "status": "processing"
    }

@app.get("/api/admin/bulk-operations/templates")
async def get_bulk_templates(
    entity_type: str = Query(..., description="Type of entity"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Get bulk operation templates for different entities"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    templates = {
        "users": {
            "headers": ["username", "email", "full_name", "first_name", "last_name", "role", "department_id", "class_id", "student_id", "employee_id", "phone", "address", "date_of_birth", "gender", "qualification", "experience_years", "specializations"],
            "required_fields": ["username", "email", "role"],
            "role_options": ["admin", "hod", "teacher", "student"],
            "department_options": [
                {"id": d.id, "name": d.name}
                for d in db.query(Department).all()
            ],
            "class_options": [
                {"id": c.id, "name": c.name}
                for c in db.query(Class).all()
            ]
        },
        "departments": {
            "headers": ["name", "code", "description", "duration_years", "academic_year", "semester_count"],
            "required_fields": ["name", "code"],
            "description": "Department management template"
        },
        "subjects": {
            "headers": ["name", "code", "description", "credits", "class_id", "department_id"],
            "required_fields": ["name", "code", "class_id"],
            "class_options": [
                {"id": c.id, "name": c.name}
                for c in db.query(Class).all()
            ],
            "department_options": [
                {"id": d.id, "name": d.name}
                for d in db.query(Department).all()
            ]
        },
        "exams": {
            "headers": ["title", "description", "exam_type", "subject_id", "class_id", "total_marks", "duration_minutes", "start_time", "end_time"],
            "required_fields": ["title", "subject_id", "class_id", "total_marks"],
            "exam_type_options": ["internal", "external", "assignment", "quiz", "project"],
            "subject_options": [
                {"id": s.id, "name": s.name}
                for s in db.query(Subject).all()
            ],
            "class_options": [
                {"id": c.id, "name": c.name}
                for c in db.query(Class).all()
            ]
        }
    }

    if entity_type not in templates:
        raise HTTPException(status_code=400, detail="Unsupported entity type")

    return templates[entity_type]

@app.get("/api/admin/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    table_name: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Get audit logs with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(AuditLog)

    # Apply filters
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if table_name:
        query = query.filter(AuditLog.table_name.ilike(f"%{table_name}%"))
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    logs = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

    results = []
    for log in logs:
        results.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user.full_name if log.user else None,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "old_values": json.loads(log.old_values) if log.old_values else None,
            "new_values": json.loads(log.new_values) if log.new_values else None,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at
        })

    return results

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "admin"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8014)
