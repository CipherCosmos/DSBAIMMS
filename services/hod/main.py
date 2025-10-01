# HOD Dashboard Service
# Department-scoped functionality with analytics and management features

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

app = FastAPI(title="HOD Dashboard Service", version="1.0.0")

def get_hod_department(db: Session, user_id: int) -> Department:
    """Get the department for the HOD user"""
    hod = db.query(User).filter(User.id == user_id, User.role == "hod").first()
    if not hod:
        raise HTTPException(status_code=403, detail="HOD access required")

    department = db.query(Department).filter(Department.hod_id == user_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="No department assigned to HOD")

    return department


@app.get("/")
async def root():
    return {"message": "HOD Dashboard Service is running"}

@app.get("/api/hod/dashboard-stats")
async def get_hod_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get HOD dashboard statistics for their department"""
    department = get_hod_department(db, current_user_id)

    # Department-level counts
    total_students = db.query(User).filter(
        User.department_id == department.id,
        User.role == "student"
    ).count()

    total_teachers = db.query(User).filter(
        User.department_id == department.id,
        User.role == "teacher"
    ).count()

    total_classes = db.query(Class).filter(Class.department_id == department.id).count()
    total_subjects = db.query(Subject).filter(Subject.department_id == department.id).count()
    total_semesters = db.query(Semester).filter(Semester.department_id == department.id).count()

    # Active counts
    active_students = db.query(User).filter(
        User.department_id == department.id,
        User.role == "student",
        User.is_active == True
    ).count()

    active_teachers = db.query(User).filter(
        User.department_id == department.id,
        User.role == "teacher",
        User.is_active == True
    ).count()

    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_students = db.query(User).filter(
        User.department_id == department.id,
        User.role == "student",
        User.created_at >= week_ago
    ).count()

    recent_exams = db.query(Exam).join(Subject).filter(
        Subject.department_id == department.id,
        Exam.created_at >= week_ago
    ).count()

    # Performance metrics for department
    dept_marks = db.query(Mark).join(Exam).join(Subject).filter(
        Subject.department_id == department.id,
        Mark.is_attempted == True
    ).all()

    avg_score = 0.0
    pass_rate = 0.0
    if dept_marks:
        total_obtained = sum(mark.marks_obtained for mark in dept_marks)
        total_max = sum(mark.max_marks for mark in dept_marks)
        avg_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Calculate pass rate
        unique_students = set(mark.student_id for mark in dept_marks)
        passing_students = 0
        for student_id in unique_students:
            student_marks = [mark for mark in dept_marks if mark.student_id == student_id]
            if student_marks:
                student_obtained = sum(mark.marks_obtained for mark in student_marks)
                student_max = sum(mark.max_marks for mark in student_marks)
                student_percentage = (student_obtained / student_max * 100) if student_max > 0 else 0
                if student_percentage >= 40:
                    passing_students += 1

        pass_rate = (passing_students / len(unique_students) * 100) if unique_students else 0.0

    # Class-wise statistics
    class_stats = []
    classes = db.query(Class).filter(Class.department_id == department.id).all()
    for class_obj in classes:
        class_students = db.query(User).filter(
            User.class_id == class_obj.id,
            User.role == "student"
        ).count()

        class_subjects = db.query(Subject).filter(Subject.class_id == class_obj.id).count()

        class_exams = db.query(Exam).filter(Exam.class_id == class_obj.id).count()

        class_stats.append({
            "class_id": class_obj.id,
            "class_name": class_obj.name,
            "semester_name": class_obj.semester.name if class_obj.semester else None,
            "students_count": class_students,
            "subjects_count": class_subjects,
            "exams_count": class_exams,
            "class_teacher": class_obj.class_teacher.full_name if class_obj.class_teacher else None
        })

    return {
        "department": {
            "id": department.id,
            "name": department.name,
            "code": department.code,
            "description": department.description
        },
        "overview": {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_classes": total_classes,
            "total_subjects": total_subjects,
            "total_semesters": total_semesters
        },
        "active_counts": {
            "students": active_students,
            "teachers": active_teachers
        },
        "recent_activity": {
            "new_students_week": recent_students,
            "new_exams_week": recent_exams
        },
        "performance": {
            "average_score": float(avg_score),
            "pass_rate": float(pass_rate)
        },
        "class_stats": class_stats
    }

@app.get("/api/hod/classes")
async def get_hod_classes(
    skip: int = 0,
    limit: int = 100,
    semester_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get classes for HOD's department"""
    department = get_hod_department(db, current_user_id)

    query = db.query(Class).filter(Class.department_id == department.id)

    # Apply filters
    if semester_id:
        query = query.filter(Class.semester_id == semester_id)
    if is_active is not None:
        query = query.filter(Class.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                Class.name.ilike(f"%{search}%"),
                Class.description.ilike(f"%{search}%")
            )
        )

    classes = query.offset(skip).limit(limit).all()

    results = []
    for class_obj in classes:
        # Get counts for this class
        students_count = db.query(User).filter(
            User.class_id == class_obj.id,
            User.role == "student"
        ).count()

        subjects_count = db.query(Subject).filter(Subject.class_id == class_obj.id).count()

        exams_count = db.query(Exam).filter(Exam.class_id == class_obj.id).count()

        results.append({
            "id": class_obj.id,
            "name": class_obj.name,
            "description": class_obj.description,
            "semester_id": class_obj.semester_id,
            "semester_name": class_obj.semester.name if class_obj.semester else None,
            "class_teacher_id": class_obj.class_teacher_id,
            "class_teacher_name": class_obj.class_teacher.full_name if class_obj.class_teacher else None,
            "class_representative_id": class_obj.class_representative_id,
            "class_representative_name": class_obj.class_representative.full_name if class_obj.class_representative else None,
            "is_active": class_obj.is_active,
            "created_at": class_obj.created_at,
            "updated_at": class_obj.updated_at,
            "students_count": students_count,
            "subjects_count": subjects_count,
            "exams_count": exams_count
        })

    return results

@app.post("/api/hod/classes")
async def create_hod_class(
    class_data: ClassCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Create a new class in HOD's department"""
    department = get_hod_department(db, current_user_id)

    # Verify semester belongs to department
    semester = db.query(Semester).filter(
        Semester.id == class_data.semester_id,
        Semester.department_id == department.id
    ).first()
    if not semester:
        raise HTTPException(status_code=400, detail="Semester not found in department")

    # Create class
    new_class = Class(
        name=class_data.name,
        description=class_data.description,
        semester_id=class_data.semester_id,
        department_id=department.id,
        class_teacher_id=class_data.class_teacher_id,
        class_representative_id=class_data.class_representative_id,
        is_active=class_data.is_active
    )

    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "classes", new_class.id,
              None, {"name": new_class.name, "semester_id": new_class.semester_id})

    return {
        "id": new_class.id,
        "name": new_class.name,
        "description": new_class.description,
        "semester_id": new_class.semester_id,
        "department_id": new_class.department_id,
        "class_teacher_id": new_class.class_teacher_id,
        "class_representative_id": new_class.class_representative_id,
        "is_active": new_class.is_active,
        "created_at": new_class.created_at
    }

@app.get("/api/hod/teachers")
async def get_hod_teachers(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get teachers in HOD's department"""
    department = get_hod_department(db, current_user_id)

    query = db.query(User).filter(
        User.department_id == department.id,
        User.role == "teacher"
    )

    # Apply filters
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.employee_id.ilike(f"%{search}%")
            )
        )

    teachers = query.offset(skip).limit(limit).all()

    results = []
    for teacher in teachers:
        # Get subjects taught by this teacher
        teacher_subjects = db.query(TeacherSubject).filter(
            TeacherSubject.teacher_id == teacher.id
        ).all()

        subjects_taught = []
        for ts in teacher_subjects:
            subjects_taught.append({
                "subject_id": ts.subject.id,
                "subject_name": ts.subject.name,
                "subject_code": ts.subject.code,
                "class_name": ts.subject.class_assigned.name if ts.subject.class_assigned else None
            })

        results.append({
            "id": teacher.id,
            "username": teacher.username,
            "email": teacher.email,
            "full_name": teacher.full_name,
            "first_name": teacher.first_name,
            "last_name": teacher.last_name,
            "employee_id": teacher.employee_id,
            "phone": teacher.phone,
            "is_active": teacher.is_active,
            "created_at": teacher.created_at,
            "last_login": teacher.last_login,
            "subjects_taught": subjects_taught
        })

    return results

@app.post("/api/hod/teachers")
async def create_hod_teacher(
    teacher_data: UserCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Create a new teacher in HOD's department"""
    department = get_hod_department(db, current_user_id)

    # Check if user already exists
    existing_user = db.query(User).filter(
        or_(User.username == teacher_data.username, User.email == teacher_data.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with username or email already exists")

    # Hash password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(teacher_data.password)

    # Create teacher
    new_teacher = User(
        username=teacher_data.username,
        email=teacher_data.email,
        full_name=teacher_data.full_name,
        first_name=teacher_data.first_name,
        last_name=teacher_data.last_name,
        role="teacher",
        hashed_password=hashed_password,
        department_id=department.id,
        employee_id=teacher_data.employee_id,
        phone=teacher_data.phone,
        address=teacher_data.address,
        is_active=teacher_data.is_active
    )

    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "users", new_teacher.id,
              None, {"username": new_teacher.username, "role": "teacher"})

    return {
        "id": new_teacher.id,
        "username": new_teacher.username,
        "email": new_teacher.email,
        "full_name": new_teacher.full_name,
        "role": new_teacher.role,
        "department_id": new_teacher.department_id,
        "is_active": new_teacher.is_active,
        "created_at": new_teacher.created_at
    }

@app.get("/api/hod/students")
async def get_hod_students(
    skip: int = 0,
    limit: int = 100,
    class_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get students in HOD's department"""
    department = get_hod_department(db, current_user_id)

    query = db.query(User).filter(
        User.department_id == department.id,
        User.role == "student"
    )

    # Apply filters
    if class_id:
        query = query.filter(User.class_id == class_id)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.student_id.ilike(f"%{search}%")
            )
        )

    students = query.offset(skip).limit(limit).all()

    results = []
    for student in students:
        # Get class information
        class_info = None
        if student.class_assigned:
            class_info = {
                "class_id": student.class_assigned.id,
                "class_name": student.class_assigned.name,
                "semester_name": student.class_assigned.semester.name if student.class_assigned.semester else None
            }

        results.append({
            "id": student.id,
            "username": student.username,
            "email": student.email,
            "full_name": student.full_name,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "student_id": student.student_id,
            "phone": student.phone,
            "is_active": student.is_active,
            "created_at": student.created_at,
            "last_login": student.last_login,
            "class_info": class_info
        })

    return results

@app.post("/api/hod/students")
async def create_hod_student(
    student_data: UserCreate,
    class_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Create a new student in HOD's department"""
    department = get_hod_department(db, current_user_id)

    # Verify class belongs to department
    class_obj = db.query(Class).filter(
        Class.id == class_id,
        Class.department_id == department.id
    ).first()
    if not class_obj:
        raise HTTPException(status_code=400, detail="Class not found in department")

    # Check if user already exists
    existing_user = db.query(User).filter(
        or_(User.username == student_data.username, User.email == student_data.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with username or email already exists")

    # Hash password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(student_data.password)

    # Create student
    new_student = User(
        username=student_data.username,
        email=student_data.email,
        full_name=student_data.full_name,
        first_name=student_data.first_name,
        last_name=student_data.last_name,
        role="student",
        hashed_password=hashed_password,
        department_id=department.id,
        class_id=class_id,
        student_id=student_data.student_id,
        phone=student_data.phone,
        address=student_data.address,
        is_active=student_data.is_active
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "users", new_student.id,
              None, {"username": new_student.username, "role": "student", "class_id": class_id})

    return {
        "id": new_student.id,
        "username": new_student.username,
        "email": new_student.email,
        "full_name": new_student.full_name,
        "role": new_student.role,
        "department_id": new_student.department_id,
        "class_id": new_student.class_id,
        "is_active": new_student.is_active,
        "created_at": new_student.created_at
    }

@app.get("/api/hod/subjects")
async def get_hod_subjects(
    skip: int = 0,
    limit: int = 100,
    class_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get subjects in HOD's department"""
    department = get_hod_department(db, current_user_id)

    query = db.query(Subject).filter(Subject.department_id == department.id)

    # Apply filters
    if class_id:
        query = query.filter(Subject.class_id == class_id)
    if semester_id:
        query = query.join(Class).filter(Class.semester_id == semester_id)
    if is_active is not None:
        query = query.filter(Subject.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                Subject.name.ilike(f"%{search}%"),
                Subject.code.ilike(f"%{search}%"),
                Subject.description.ilike(f"%{search}%")
            )
        )

    subjects = query.offset(skip).limit(limit).all()

    results = []
    for subject in subjects:
        # Get teachers for this subject
        teacher_subjects = db.query(TeacherSubject).filter(
            TeacherSubject.subject_id == subject.id
        ).all()

        teachers = []
        for ts in teacher_subjects:
            teachers.append({
                "teacher_id": ts.teacher.id,
                "teacher_name": ts.teacher.full_name,
                "employee_id": ts.teacher.employee_id
            })

        results.append({
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "description": subject.description,
            "credits": subject.credits,
            "class_id": subject.class_id,
            "class_name": subject.class_assigned.name if subject.class_assigned else None,
            "semester_id": subject.class_assigned.semester_id if subject.class_assigned else None,
            "semester_name": subject.class_assigned.semester.name if subject.class_assigned and subject.class_assigned.semester else None,
            "is_active": subject.is_active,
            "created_at": subject.created_at,
            "updated_at": subject.updated_at,
            "teachers": teachers
        })

    return results

@app.post("/api/hod/subjects")
async def create_hod_subject(
    subject_data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Create a new subject in HOD's department"""
    department = get_hod_department(db, current_user_id)

    # Verify class belongs to department
    class_obj = db.query(Class).filter(
        Class.id == subject_data.class_id,
        Class.department_id == department.id
    ).first()
    if not class_obj:
        raise HTTPException(status_code=400, detail="Class not found in department")

    # Create subject
    new_subject = Subject(
        name=subject_data.name,
        code=subject_data.code,
        description=subject_data.description,
        credits=subject_data.credits,
        class_id=subject_data.class_id,
        department_id=department.id,
        is_active=subject_data.is_active
    )

    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "subjects", new_subject.id,
              None, {"name": new_subject.name, "code": new_subject.code, "class_id": new_subject.class_id})

    return {
        "id": new_subject.id,
        "name": new_subject.name,
        "code": new_subject.code,
        "description": new_subject.description,
        "credits": new_subject.credits,
        "class_id": new_subject.class_id,
        "department_id": new_subject.department_id,
        "is_active": new_subject.is_active,
        "created_at": new_subject.created_at
    }

@app.get("/api/hod/analytics/performance")
async def get_hod_performance_analytics(
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get performance analytics for HOD's department"""
    department = get_hod_department(db, current_user_id)

    # Build base query for marks in department
    marks_query = db.query(Mark).join(Exam).join(Subject).filter(
        Subject.department_id == department.id,
        Mark.is_attempted == True
    )

    # Apply filters
    if semester_id:
        marks_query = marks_query.join(Class).filter(Class.semester_id == semester_id)
    if class_id:
        marks_query = marks_query.join(Exam).filter(Exam.class_id == class_id)
    if subject_id:
        marks_query = marks_query.filter(Subject.id == subject_id)

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
            "teacher_performance": []
        }

    # Calculate basic statistics
    unique_students = set(mark.student_id for mark in marks)
    unique_exams = set(mark.exam_id for mark in marks)

    total_obtained = sum(mark.marks_obtained for mark in marks)
    total_max = sum(mark.max_marks for mark in marks)
    average_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

    # Calculate pass rate
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
    subjects = db.query(Subject).filter(Subject.department_id == department.id).all()
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
    classes = db.query(Class).filter(Class.department_id == department.id).all()
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
                "average_score": float(class_avg),
                "total_students": len(set(mark.student_id for mark in class_marks)),
                "total_exams": len(set(mark.exam_id for mark in class_marks))
            })

    # Teacher performance
    teacher_performance = []
    teachers = db.query(User).filter(
        User.department_id == department.id,
        User.role == "teacher"
    ).all()

    for teacher in teachers:
        teacher_subjects = db.query(TeacherSubject).filter(
            TeacherSubject.teacher_id == teacher.id
        ).all()

        teacher_subject_ids = [ts.subject_id for ts in teacher_subjects]
        teacher_marks = [mark for mark in marks if mark.exam.subject_id in teacher_subject_ids]

        if teacher_marks:
            teacher_obtained = sum(mark.marks_obtained for mark in teacher_marks)
            teacher_max = sum(mark.max_marks for mark in teacher_marks)
            teacher_avg = (teacher_obtained / teacher_max * 100) if teacher_max > 0 else 0.0

            teacher_performance.append({
                "teacher_id": teacher.id,
                "teacher_name": teacher.full_name,
                "employee_id": teacher.employee_id,
                "average_score": float(teacher_avg),
                "subjects_count": len(teacher_subject_ids),
                "total_students": len(set(mark.student_id for mark in teacher_marks)),
                "total_exams": len(set(mark.exam_id for mark in teacher_marks))
            })

    return {
        "total_students": len(unique_students),
        "total_exams": len(unique_exams),
        "average_score": float(average_score),
        "pass_rate": float(pass_rate),
        "grade_distribution": grade_distribution,
        "subject_performance": subject_performance,
        "class_performance": class_performance,
        "teacher_performance": teacher_performance
    }

@app.get("/api/hod/bulk-operations/template")
async def get_bulk_template(
    operation_type: str = Query(..., description="Type of bulk operation: users, subjects, marks, questions"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["hod"]))
):
    """Get bulk operation template for HOD"""
    department = get_hod_department(db, current_user_id)

    if operation_type == "users":
        return {
            "template": {
                "headers": ["username", "email", "full_name", "first_name", "last_name", "role", "class_id", "student_id", "employee_id", "phone", "address", "date_of_birth", "gender", "qualification", "experience_years", "specializations"],
                "required_fields": ["username", "email", "role"],
                "role_options": ["teacher", "student"],
                "class_options": [
                    {"id": c.id, "name": c.name}
                    for c in db.query(Class).filter(Class.department_id == department.id).all()
                ]
            }
        }
    elif operation_type == "subjects":
        return {
            "template": {
                "headers": ["name", "code", "description", "credits", "class_id"],
                "required_fields": ["name", "code", "class_id"],
                "class_options": [
                    {"id": c.id, "name": c.name}
                    for c in db.query(Class).filter(Class.department_id == department.id).all()
                ]
            }
        }
    else:
        raise HTTPException(status_code=400, detail="Unsupported operation type")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "hod"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)
