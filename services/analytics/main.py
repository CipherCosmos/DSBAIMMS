# Analytics Service
# Comprehensive analytics and reporting for all roles

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
    COAttainmentResponse, POAttainmentResponse, StudentPerformanceResponse
)
from shared.auth import RoleChecker
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Analytics Service", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Analytics Service is running"}

@app.get("/api/analytics/dashboard")
async def get_dashboard(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get dashboard analytics - alias for dashboard-stats"""
    return await get_analytics_dashboard_stats(department_id, semester_id, class_id, subject_id, db, current_user_id)

@app.get("/api/analytics/dashboard-stats")
async def get_analytics_dashboard_stats(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get comprehensive analytics dashboard statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Get teacher's subjects
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        if not teacher_subjects:
            return {"message": "No subjects assigned to teacher"}
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_id and subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this subject")
    elif current_user.role == "student":
        if not current_user.class_id:
            return {"message": "No class assigned to student"}
        class_id = current_user.class_id

    # Build base queries
    marks_query = db.query(Mark).filter(Mark.is_attempted == True)
    users_query = db.query(User)
    exams_query = db.query(Exam)

    # Apply filters
    if department_id:
        marks_query = marks_query.join(Exam).join(Subject).filter(Subject.department_id == department_id)
        users_query = users_query.filter(User.department_id == department_id)
        exams_query = exams_query.join(Subject).filter(Subject.department_id == department_id)

    if semester_id:
        marks_query = marks_query.join(Exam).join(Class).filter(Class.semester_id == semester_id)
        exams_query = exams_query.join(Class).filter(Class.semester_id == semester_id)

    if class_id:
        marks_query = marks_query.join(Exam).filter(Exam.class_id == class_id)
        users_query = users_query.filter(User.class_id == class_id)
        exams_query = exams_query.filter(Exam.class_id == class_id)

    if subject_id:
        marks_query = marks_query.join(Exam).filter(Exam.subject_id == subject_id)
        exams_query = exams_query.filter(Exam.subject_id == subject_id)

    # Get data
    marks = marks_query.all()
    users = users_query.all()
    exams = exams_query.all()

    # Calculate basic statistics
    total_users = len(users)
    total_students = len([u for u in users if u.role == "student"])
    total_teachers = len([u for u in users if u.role == "teacher"])
    total_exams = len(exams)
    total_marks = len(marks)

    # Performance metrics
    avg_score = 0.0
    pass_rate = 0.0
    if marks:
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        avg_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Calculate pass rate
        unique_students = set(mark.student_id for mark in marks)
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

    return {
        "overview": {
            "total_users": total_users,
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_exams": total_exams,
            "total_marks": total_marks
        },
        "performance": {
            "average_score": float(avg_score),
            "pass_rate": float(pass_rate),
            "grade_distribution": grade_distribution
        },
        "filters_applied": {
            "department_id": department_id,
            "semester_id": semester_id,
            "class_id": class_id,
            "subject_id": subject_id
        }
    }

@app.get("/api/analytics/co-attainment")
async def get_co_attainment_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    co_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get CO attainment analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Get teacher's subjects
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        if not teacher_subjects:
            return {"message": "No subjects assigned to teacher"}
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_id and subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this subject")

    # Build CO query
    co_query = db.query(CO)
    if subject_id:
        co_query = co_query.filter(CO.subject_id == subject_id)
    elif department_id:
        co_query = co_query.join(Subject).filter(Subject.department_id == department_id)

    if co_id:
        co_query = co_query.filter(CO.id == co_id)

    cos = co_query.all()

    results = []
    for co in cos:
        # Get questions for this CO
        questions = db.query(Question).filter(Question.co_id == co.id).all()
        question_ids = [q.id for q in questions]

        if not question_ids:
            results.append({
                "co_id": co.id,
                "co_name": co.name,
                "co_description": co.description,
                "subject_name": co.subject.name if co.subject else None,
                "attainment_percentage": 0.0,
                "attainment_level": "Not Attained",
                "students_count": 0,
                "students_above_threshold": 0,
                "questions_count": 0
            })
            continue

        # Get marks for these questions
        marks_query = db.query(Mark).filter(Mark.question_id.in_(question_ids))

        # Apply additional filters
        if class_id:
            marks_query = marks_query.join(Exam).filter(Exam.class_id == class_id)
        if semester_id:
            marks_query = marks_query.join(Exam).join(Class).filter(Class.semester_id == semester_id)

        marks = marks_query.all()

        if not marks:
            results.append({
                "co_id": co.id,
                "co_name": co.name,
                "co_description": co.description,
                "subject_name": co.subject.name if co.subject else None,
                "attainment_percentage": 0.0,
                "attainment_level": "Not Attained",
                "students_count": 0,
                "students_above_threshold": 0,
                "questions_count": len(questions)
            })
            continue

        # Calculate attainment
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        attainment_percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Count students above threshold (60%)
        unique_students = set(mark.student_id for mark in marks)
        students_above_threshold = 0

        for student_id in unique_students:
            student_marks = [mark for mark in marks if mark.student_id == student_id]
            if student_marks:
                student_obtained = sum(mark.marks_obtained for mark in student_marks)
                student_max = sum(mark.max_marks for mark in student_marks)
                student_percentage = (student_obtained / student_max * 100) if student_max > 0 else 0
                if student_percentage >= 60:
                    students_above_threshold += 1

        results.append({
            "co_id": co.id,
            "co_name": co.name,
            "co_description": co.description,
            "subject_name": co.subject.name if co.subject else None,
            "attainment_percentage": float(attainment_percentage),
            "attainment_level": "Attained" if attainment_percentage >= 60 else "Not Attained",
            "students_count": len(unique_students),
            "students_above_threshold": students_above_threshold,
            "questions_count": len(questions)
        })

    return results

@app.get("/api/analytics/po-attainment")
async def get_po_attainment_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get PO attainment analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id

    # Build PO query
    po_query = db.query(PO)
    if department_id:
        po_query = po_query.filter(PO.department_id == department_id)

    pos = po_query.all()

    results = []
    for po in pos:
        # Get CO-PO mappings for this PO
        co_po_mappings = db.query(COPOMapping).filter(COPOMapping.po_id == po.id).all()
        co_ids = [mapping.co_id for mapping in co_po_mappings]

        if not co_ids:
            results.append({
                "po_id": po.id,
                "po_name": po.name,
                "po_description": po.description,
                "attainment_percentage": 0.0,
                "attainment_level": "Not Attained",
                "mapped_cos_count": 0
            })
            continue

        # Get questions for these COs
        questions = db.query(Question).filter(Question.co_id.in_(co_ids)).all()
        question_ids = [q.id for q in questions]

        if not question_ids:
            results.append({
                "po_id": po.id,
                "po_name": po.name,
                "po_description": po.description,
                "attainment_percentage": 0.0,
                "attainment_level": "Not Attained",
                "mapped_cos_count": len(co_ids)
            })
            continue

        # Get marks for these questions
        marks_query = db.query(Mark).filter(Mark.question_id.in_(question_ids))

        # Apply additional filters
        if class_id:
            marks_query = marks_query.join(Exam).filter(Exam.class_id == class_id)
        if semester_id:
            marks_query = marks_query.join(Exam).join(Class).filter(Class.semester_id == semester_id)

        marks = marks_query.all()

        if not marks:
            results.append({
                "po_id": po.id,
                "po_name": po.name,
                "po_description": po.description,
                "attainment_percentage": 0.0,
                "attainment_level": "Not Attained",
                "mapped_cos_count": len(co_ids)
            })
            continue

        # Calculate attainment
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        attainment_percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        results.append({
            "po_id": po.id,
            "po_name": po.name,
            "po_description": po.description,
            "attainment_percentage": float(attainment_percentage),
            "attainment_level": "Attained" if attainment_percentage >= 60 else "Not Attained",
            "mapped_cos_count": len(co_ids)
        })

    return results

@app.get("/api/analytics/co-po")
async def get_co_po_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get combined CO/PO analytics"""
    # Get CO attainment
    co_results = await get_co_attainment_analytics(department_id, semester_id, class_id, subject_id, None, db, current_user_id)
    
    # Get PO attainment  
    po_results = await get_po_attainment_analytics(department_id, semester_id, class_id, db, current_user_id)
    
    return {
        "co_attainment": co_results,
        "po_attainment": po_results
    }

@app.get("/api/analytics/student-performance")
async def get_student_performance_analytics(
    student_id: Optional[int] = None,
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get student performance analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "student":
        student_id = current_user_id
    elif current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Get teacher's subjects
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        if not teacher_subjects:
            return {"message": "No subjects assigned to teacher"}
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_id and subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this subject")

    # Build student query
    students_query = db.query(User).filter(User.role == "student")

    if student_id:
        students_query = students_query.filter(User.id == student_id)
    if department_id:
        students_query = students_query.filter(User.department_id == department_id)
    if class_id:
        students_query = students_query.filter(User.class_id == class_id)

    students = students_query.all()

    results = []
    for student in students:
        # Get marks for this student
        marks_query = db.query(Mark).filter(Mark.student_id == student.id)

        # Apply additional filters
        if subject_id:
            marks_query = marks_query.join(Exam).filter(Exam.subject_id == subject_id)
        if semester_id:
            marks_query = marks_query.join(Exam).join(Class).filter(Class.semester_id == semester_id)

        marks = marks_query.all()

        if not marks:
            results.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "student_roll": student.student_id,
                "class_name": student.class_assigned.name if student.class_assigned else None,
                "department_name": student.department.name if student.department else None,
                "average_score": 0.0,
                "total_exams": 0,
                "exams_attempted": 0,
                "grade": "F"
            })
            continue

        # Calculate performance
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        average_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Get exam counts
        unique_exams = set(mark.exam_id for mark in marks)

        # Determine grade
        if average_score >= 90:
            grade = "A+"
        elif average_score >= 80:
            grade = "A"
        elif average_score >= 70:
            grade = "B+"
        elif average_score >= 60:
            grade = "B"
        elif average_score >= 50:
            grade = "C+"
        elif average_score >= 40:
            grade = "C"
        elif average_score >= 30:
            grade = "D"
        else:
            grade = "F"

        results.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "student_roll": student.student_id,
            "class_name": student.class_assigned.name if student.class_assigned else None,
            "department_name": student.department.name if student.department else None,
            "average_score": float(average_score),
            "total_exams": len(unique_exams),
            "exams_attempted": len(unique_exams),
            "grade": grade
        })

    return results

@app.get("/api/analytics/bloom-taxonomy")
async def get_bloom_taxonomy_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get Bloom's taxonomy analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Get teacher's subjects
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        if not teacher_subjects:
            return {"message": "No subjects assigned to teacher"}
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_id and subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this subject")

    # Build questions query
    questions_query = db.query(Question)

    if subject_id:
        questions_query = questions_query.join(Exam).filter(Exam.subject_id == subject_id)
    elif department_id:
        questions_query = questions_query.join(Exam).join(Subject).filter(Subject.department_id == department_id)

    if class_id:
        questions_query = questions_query.join(Exam).filter(Exam.class_id == class_id)
    if semester_id:
        questions_query = questions_query.join(Exam).join(Class).filter(Class.semester_id == semester_id)

    questions = questions_query.all()

    # Group by Bloom's level
    bloom_distribution = {}
    difficulty_distribution = {}

    for question in questions:
        bloom_level = question.bloom_level
        difficulty_level = question.difficulty_level

        bloom_distribution[bloom_level] = bloom_distribution.get(bloom_level, 0) + 1
        difficulty_distribution[difficulty_level] = difficulty_distribution.get(difficulty_level, 0) + 1

    # Calculate performance by Bloom's level
    bloom_performance = {}
    for bloom_level in bloom_distribution.keys():
        level_questions = [q for q in questions if q.bloom_level == bloom_level]
        level_question_ids = [q.id for q in level_questions]

        if level_question_ids:
            level_marks = db.query(Mark).filter(Mark.question_id.in_(level_question_ids)).all()

            if level_marks:
                level_obtained = sum(mark.marks_obtained for mark in level_marks)
                level_max = sum(mark.max_marks for mark in level_marks)
                level_percentage = (level_obtained / level_max * 100) if level_max > 0 else 0.0

                bloom_performance[bloom_level] = {
                    "questions_count": len(level_questions),
                    "average_performance": float(level_percentage),
                    "attempts_count": len(level_marks)
                }
            else:
                bloom_performance[bloom_level] = {
                    "questions_count": len(level_questions),
                    "average_performance": 0.0,
                    "attempts_count": 0
                }

    return {
        "bloom_distribution": bloom_distribution,
        "difficulty_distribution": difficulty_distribution,
        "bloom_performance": bloom_performance
    }

@app.get("/api/analytics/attendance-performance")
async def get_attendance_performance_correlation(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get attendance vs performance correlation analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Get teacher's subjects
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        if not teacher_subjects:
            return {"message": "No subjects assigned to teacher"}
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        if subject_id and subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this subject")

    # Get students
    students_query = db.query(User).filter(User.role == "student")
    if department_id:
        students_query = students_query.filter(User.department_id == department_id)
    if class_id:
        students_query = students_query.filter(User.class_id == class_id)

    students = students_query.all()

    results = []
    for student in students:
        # Get attendance for this student
        attendance_query = db.query(Attendance).filter(Attendance.student_id == student.id)
        if subject_id:
            attendance_query = attendance_query.filter(Attendance.subject_id == subject_id)
        if semester_id:
            attendance_query = attendance_query.join(Subject).join(Class).filter(Class.semester_id == semester_id)

        attendance_records = attendance_query.all()

        if not attendance_records:
            continue

        # Calculate attendance percentage
        total_classes = len(attendance_records)
        present_classes = len([r for r in attendance_records if r.status == "present"])
        attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0.0

        # Get performance for this student
        marks_query = db.query(Mark).filter(Mark.student_id == student.id)
        if subject_id:
            marks_query = marks_query.join(Exam).filter(Exam.subject_id == subject_id)
        if semester_id:
            marks_query = marks_query.join(Exam).join(Class).filter(Class.semester_id == semester_id)

        marks = marks_query.all()

        if not marks:
            continue

        # Calculate performance
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        performance_percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        results.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "student_roll": student.student_id,
            "attendance_percentage": float(attendance_percentage),
            "performance_percentage": float(performance_percentage),
            "total_classes": total_classes,
            "present_classes": present_classes,
            "total_exams": len(set(mark.exam_id for mark in marks))
        })

    # Calculate correlation
    if len(results) > 1:
        attendance_values = [r["attendance_percentage"] for r in results]
        performance_values = [r["performance_percentage"] for r in results]

        # Simple correlation calculation
        n = len(results)
        sum_x = sum(attendance_values)
        sum_y = sum(performance_values)
        sum_xy = sum(x * y for x, y in zip(attendance_values, performance_values))
        sum_x2 = sum(x * x for x in attendance_values)
        sum_y2 = sum(y * y for y in performance_values)

        correlation = (n * sum_xy - sum_x * sum_y) / ((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y)) ** 0.5 if (n * sum_x2 - sum_x * sum_x) > 0 and (n * sum_y2 - sum_y * sum_y) > 0 else 0.0
    else:
        correlation = 0.0

    return {
        "correlation": float(correlation),
        "correlation_strength": "Strong" if abs(correlation) > 0.7 else "Moderate" if abs(correlation) > 0.3 else "Weak",
        "student_data": results
    }

@app.get("/api/analytics/students/{student_id}")
async def get_student_analytics(
    student_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get detailed analytics for a specific student"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the target student
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Role-based access control
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Can only view your own analytics")
    elif current_user.role == "teacher":
        # Teachers can only see students in their classes
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        class_ids = [subject.class_id for subject in teacher_subjects]
        if student.class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student")
    elif current_user.role == "hod":
        if current_user.department_id != student.department_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this student")
    
    # Get student's marks
    marks = db.query(Mark).filter(Mark.student_id == student_id).all()
    
    # Calculate performance metrics
    total_marks = sum(mark.marks_obtained for mark in marks)
    max_marks = sum(mark.max_marks for mark in marks)
    average_percentage = (total_marks / max_marks * 100) if max_marks > 0 else 0.0
    
    # Grade distribution
    grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C+": 0, "C": 0, "D": 0, "F": 0}
    for mark in marks:
        percentage = (mark.marks_obtained / mark.max_marks * 100) if mark.max_marks > 0 else 0
        if percentage >= 90:
            grade_distribution["A+"] += 1
        elif percentage >= 80:
            grade_distribution["A"] += 1
        elif percentage >= 70:
            grade_distribution["B+"] += 1
        elif percentage >= 60:
            grade_distribution["B"] += 1
        elif percentage >= 50:
            grade_distribution["C+"] += 1
        elif percentage >= 40:
            grade_distribution["C"] += 1
        elif percentage >= 30:
            grade_distribution["D"] += 1
        else:
            grade_distribution["F"] += 1
    
    # Subject-wise performance
    subject_performance = []
    # Get unique exam IDs from marks
    exam_ids = list(set([mark.exam_id for mark in marks]))
    if exam_ids:
        # Get exams and their subjects
        exams = db.query(Exam).filter(Exam.id.in_(exam_ids)).all()
        subject_ids = list(set([exam.subject_id for exam in exams]))
        subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
        
        for subject in subjects:
            # Get marks for this subject through exams
            subject_exam_ids = [exam.id for exam in exams if exam.subject_id == subject.id]
            subject_marks = [mark for mark in marks if mark.exam_id in subject_exam_ids]
            if subject_marks:
                total_obtained = sum(mark.marks_obtained for mark in subject_marks)
                total_max = sum(mark.max_marks for mark in subject_marks)
                percentage = (total_obtained / total_max * 100) if total_max > 0 else 0
                subject_performance.append({
                    "subject_id": subject.id,
                    "subject_name": subject.name,
                    "subject_code": subject.code,
                    "marks_obtained": total_obtained,
                    "max_marks": total_max,
                    "percentage": round(percentage, 2),
                    "grade": "A+" if percentage >= 90 else "A" if percentage >= 80 else "B+" if percentage >= 70 else "B" if percentage >= 60 else "C+" if percentage >= 50 else "C" if percentage >= 40 else "D" if percentage >= 30 else "F"
                })
    
    return {
        "student": {
            "id": student.id,
            "name": student.full_name,
            "email": student.email,
            "student_id": student.student_id,
            "department_id": student.department_id,
            "class_id": student.class_id
        },
        "performance": {
            "total_marks_obtained": total_marks,
            "total_max_marks": max_marks,
            "average_percentage": round(average_percentage, 2),
            "grade_distribution": grade_distribution,
            "subjects_count": len(subject_performance),
            "exams_count": len(marks)
        },
        "subject_performance": subject_performance
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics"}
