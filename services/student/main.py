# Student Dashboard Service
# Personal performance tracking and profile management

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
    UserUpdate, UserResponse
)
from shared.auth import RoleChecker
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Student Dashboard Service", version="1.0.0")

def get_student_info(db: Session, user_id: int) -> User:
    """Get student information and verify access"""
    student = db.query(User).filter(User.id == user_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=403, detail="Student access required")
    return student


@app.get("/")
async def root():
    return {"message": "Student Dashboard Service is running"}

@app.get("/api/student/dashboard-stats")
async def get_student_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Get student dashboard statistics"""
    student = get_student_info(db, current_user_id)

    # Get student's class and subjects
    class_info = None
    if student.class_assigned:
        class_info = {
            "class_id": student.class_assigned.id,
            "class_name": student.class_assigned.name,
            "semester_name": student.class_assigned.semester.name if student.class_assigned.semester else None,
            "department_name": student.department.name if student.department else None
        }

    # Get subjects for student's class
    subjects = []
    if student.class_id:
        subjects = db.query(Subject).filter(Subject.class_id == student.class_id).all()

    # Get exams for student's subjects
    subject_ids = [s.id for s in subjects]
    exams = []
    if subject_ids:
        exams = db.query(Exam).filter(Exam.subject_id.in_(subject_ids)).all()

    # Get marks for student
    exam_ids = [e.id for e in exams]
    marks = []
    if exam_ids:
        marks = db.query(Mark).filter(
            Mark.student_id == current_user_id,
            Mark.exam_id.in_(exam_ids)
        ).all()

    # Calculate performance metrics
    total_exams_attempted = len(set(mark.exam_id for mark in marks))
    total_questions_attempted = len(marks)

    avg_score = 0.0
    if marks:
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        avg_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_marks = len([m for m in marks if m.created_at >= week_ago])

    # Upcoming exams (next 7 days)
    upcoming_exams = []
    if exam_ids:
        upcoming_exams = db.query(Exam).filter(
            Exam.id.in_(exam_ids),
            Exam.start_time > datetime.utcnow(),
            Exam.start_time <= datetime.utcnow() + timedelta(days=7)
        ).all()

    # Subject-wise performance
    subject_performance = []
    for subject in subjects:
        subject_exams = [e for e in exams if e.subject_id == subject.id]
        subject_marks = [m for m in marks if m.exam_id in [e.id for e in subject_exams]]

        if subject_marks:
            subject_obtained = sum(mark.marks_obtained for mark in subject_marks)
            subject_max = sum(mark.max_marks for mark in subject_marks)
            subject_avg = (subject_obtained / subject_max * 100) if subject_max > 0 else 0.0

            subject_performance.append({
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "credits": subject.credits,
                "average_score": float(subject_avg),
                "exams_attempted": len(set(mark.exam_id for mark in subject_marks)),
                "total_exams": len(subject_exams)
            })
        else:
            subject_performance.append({
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "credits": subject.credits,
                "average_score": 0.0,
                "exams_attempted": 0,
                "total_exams": len(subject_exams)
            })

    return {
        "student": {
            "id": student.id,
            "name": student.full_name,
            "student_id": student.student_id,
            "email": student.email
        },
        "class_info": class_info,
        "overview": {
            "total_subjects": len(subjects),
            "total_exams": len(exams),
            "exams_attempted": total_exams_attempted,
            "questions_attempted": total_questions_attempted,
            "average_score": float(avg_score)
        },
        "recent_activity": {
            "marks_entered_week": recent_marks
        },
        "upcoming_exams": [
            {
                "exam_id": exam.id,
                "title": exam.title,
                "subject_name": exam.subject.name,
                "start_time": exam.start_time,
                "duration_minutes": exam.duration_minutes,
                "total_marks": exam.total_marks
            }
            for exam in upcoming_exams
        ],
        "subject_performance": subject_performance
    }

@app.get("/api/student/subjects")
async def get_student_subjects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Get subjects for the student's class"""
    student = get_student_info(db, current_user_id)

    if not student.class_id:
        return []

    subjects = db.query(Subject).filter(
        Subject.class_id == student.class_id
    ).offset(skip).limit(limit).all()

    results = []
    for subject in subjects:
        # Get teacher information
        teacher_subject = db.query(TeacherSubject).filter(
            TeacherSubject.subject_id == subject.id
        ).first()

        teacher_info = None
        if teacher_subject:
            teacher_info = {
                "teacher_id": teacher_subject.teacher.id,
                "teacher_name": teacher_subject.teacher.full_name,
                "employee_id": teacher_subject.teacher.employee_id
            }

        # Get exam count
        exams_count = db.query(Exam).filter(Exam.subject_id == subject.id).count()

        # Get student's performance in this subject
        subject_marks = db.query(Mark).join(Exam).filter(
            Mark.student_id == current_user_id,
            Exam.subject_id == subject.id
        ).all()

        avg_score = 0.0
        if subject_marks:
            total_obtained = sum(mark.marks_obtained for mark in subject_marks)
            total_max = sum(mark.max_marks for mark in subject_marks)
            avg_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        results.append({
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "description": subject.description,
            "credits": subject.credits,
            "is_active": subject.is_active,
            "teacher_info": teacher_info,
            "exams_count": exams_count,
            "average_score": float(avg_score),
            "marks_entered": len(subject_marks)
        })

    return results

@app.get("/api/student/exams")
async def get_student_exams(
    skip: int = 0,
    limit: int = 100,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    exam_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Get exams for the student's subjects"""
    student = get_student_info(db, current_user_id)

    if not student.class_id:
        return []

    # Get subjects for student's class
    subjects = db.query(Subject).filter(Subject.class_id == student.class_id).all()
    subject_ids = [s.id for s in subjects]

    if not subject_ids:
        return []

    query = db.query(Exam).filter(Exam.subject_id.in_(subject_ids))

    # Apply filters
    if subject_id and subject_id in subject_ids:
        query = query.filter(Exam.subject_id == subject_id)
    if status:
        query = query.filter(Exam.status == status)
    if exam_type:
        query = query.filter(Exam.exam_type == exam_type)

    exams = query.order_by(desc(Exam.start_time)).offset(skip).limit(limit).all()

    results = []
    for exam in exams:
        # Get student's marks for this exam
        exam_marks = db.query(Mark).filter(
            Mark.student_id == current_user_id,
            Mark.exam_id == exam.id
        ).all()

        total_obtained = sum(mark.marks_obtained for mark in exam_marks)
        total_max = sum(mark.max_marks for mark in exam_marks)
        percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Determine exam status for student
        student_exam_status = "not_attempted"
        if exam_marks:
            student_exam_status = "attempted"
        elif exam.start_time <= datetime.utcnow() and exam.end_time >= datetime.utcnow():
            student_exam_status = "in_progress"
        elif exam.start_time > datetime.utcnow():
            student_exam_status = "upcoming"
        elif exam.end_time < datetime.utcnow():
            student_exam_status = "expired"

        results.append({
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "exam_type": exam.exam_type,
            "status": exam.status,
            "total_marks": exam.total_marks,
            "duration_minutes": exam.duration_minutes,
            "start_time": exam.start_time,
            "end_time": exam.end_time,
            "subject_name": exam.subject.name,
            "subject_code": exam.subject.code,
            "student_status": student_exam_status,
            "marks_obtained": float(total_obtained),
            "percentage": float(percentage),
            "questions_attempted": len(exam_marks)
        })

    return results

@app.get("/api/student/exams/{exam_id}/marks")
async def get_student_exam_marks(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Get student's marks for a specific exam"""
    student = get_student_info(db, current_user_id)

    # Verify exam belongs to student's class
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if not student.class_id or exam.subject.class_id != student.class_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this exam")

    # Get student's marks for this exam
    marks = db.query(Mark).filter(
        Mark.student_id == current_user_id,
        Mark.exam_id == exam_id
    ).all()

    results = []
    for mark in marks:
        results.append({
            "id": mark.id,
            "question_id": mark.question_id,
            "question_text": mark.question.question_text[:200] if mark.question else None,
            "question_type": mark.question.question_type if mark.question else None,
            "marks_obtained": mark.marks_obtained,
            "max_marks": mark.max_marks,
            "is_attempted": mark.is_attempted,
            "created_at": mark.created_at
        })

    # Calculate summary
    total_obtained = sum(mark.marks_obtained for mark in marks)
    total_max = sum(mark.max_marks for mark in marks)
    percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

    return {
        "exam": {
            "id": exam.id,
            "title": exam.title,
            "subject_name": exam.subject.name,
            "total_marks": exam.total_marks,
            "start_time": exam.start_time,
            "end_time": exam.end_time
        },
        "summary": {
            "total_obtained": float(total_obtained),
            "total_max": float(total_max),
            "percentage": float(percentage),
            "questions_attempted": len(marks)
        },
        "marks": results
    }

@app.get("/api/student/performance")
async def get_student_performance(
    semester_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Get detailed performance analytics for the student"""
    student = get_student_info(db, current_user_id)

    if not student.class_id:
        return {
            "student": {
                "id": student.id,
                "name": student.full_name,
                "student_id": student.student_id
            },
            "overall_performance": {
                "average_score": 0.0,
                "total_exams": 0,
                "exams_attempted": 0,
                "grade_distribution": {}
            },
            "subject_performance": [],
            "co_attainment": [],
            "improvement_suggestions": []
        }

    # Get subjects for student's class
    subjects_query = db.query(Subject).filter(Subject.class_id == student.class_id)
    if subject_id:
        subjects_query = subjects_query.filter(Subject.id == subject_id)

    subjects = subjects_query.all()
    subject_ids = [s.id for s in subjects]

    if not subject_ids:
        return {
            "student": {
                "id": student.id,
                "name": student.full_name,
                "student_id": student.student_id
            },
            "overall_performance": {
                "average_score": 0.0,
                "total_exams": 0,
                "exams_attempted": 0,
                "grade_distribution": {}
            },
            "subject_performance": [],
            "co_attainment": [],
            "improvement_suggestions": []
        }

    # Get exams for these subjects
    exams_query = db.query(Exam).filter(Exam.subject_id.in_(subject_ids))
    if semester_id:
        exams_query = exams_query.join(Class).filter(Class.semester_id == semester_id)

    exams = exams_query.all()
    exam_ids = [e.id for e in exams]

    # Get all marks for student
    marks = []
    if exam_ids:
        marks = db.query(Mark).filter(
            Mark.student_id == current_user_id,
            Mark.exam_id.in_(exam_ids)
        ).all()

    # Calculate overall performance
    total_obtained = sum(mark.marks_obtained for mark in marks)
    total_max = sum(mark.max_marks for mark in marks)
    overall_avg = (total_obtained / total_max * 100) if total_max > 0 else 0.0

    # Grade distribution
    grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C+": 0, "C": 0, "D": 0, "F": 0}

    # Calculate grade for each exam
    exam_scores = []
    for exam in exams:
        exam_marks = [mark for mark in marks if mark.exam_id == exam.id]
        if exam_marks:
            exam_obtained = sum(mark.marks_obtained for mark in exam_marks)
            exam_max = sum(mark.max_marks for mark in exam_marks)
            exam_percentage = (exam_obtained / exam_max * 100) if exam_max > 0 else 0

            exam_scores.append(exam_percentage)

            # Assign grade
            if exam_percentage >= 90:
                grade_distribution["A+"] += 1
            elif exam_percentage >= 80:
                grade_distribution["A"] += 1
            elif exam_percentage >= 70:
                grade_distribution["B+"] += 1
            elif exam_percentage >= 60:
                grade_distribution["B"] += 1
            elif exam_percentage >= 50:
                grade_distribution["C+"] += 1
            elif exam_percentage >= 40:
                grade_distribution["C"] += 1
            elif exam_percentage >= 30:
                grade_distribution["D"] += 1
            else:
                grade_distribution["F"] += 1

    # Subject-wise performance
    subject_performance = []
    for subject in subjects:
        subject_exams = [e for e in exams if e.subject_id == subject.id]
        subject_marks = [m for m in marks if m.exam_id in [e.id for e in subject_exams]]

        if subject_marks:
            subject_obtained = sum(mark.marks_obtained for mark in subject_marks)
            subject_max = sum(mark.max_marks for mark in subject_marks)
            subject_avg = (subject_obtained / subject_max * 100) if subject_max > 0 else 0.0

            subject_performance.append({
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "credits": subject.credits,
                "average_score": float(subject_avg),
                "exams_attempted": len(set(mark.exam_id for mark in subject_marks)),
                "total_exams": len(subject_exams),
                "improvement_needed": subject_avg < 60
            })

    # CO attainment
    co_attainment = []
    for subject in subjects:
        subject_cos = db.query(CO).filter(CO.subject_id == subject.id).all()
        for co in subject_cos:
            co_questions = db.query(Question).join(Exam).filter(
                Exam.subject_id == subject.id,
                Question.co_id == co.id
            ).all()

            if co_questions:
                co_question_ids = [q.id for q in co_questions]
                co_marks = [mark for mark in marks if mark.question_id in co_question_ids]

                if co_marks:
                    co_obtained = sum(mark.marks_obtained for mark in co_marks)
                    co_max = sum(mark.max_marks for mark in co_marks)
                    co_attainment_pct = (co_obtained / co_max * 100) if co_max > 0 else 0.0

                    co_attainment.append({
                        "co_id": co.id,
                        "co_name": co.name,
                        "co_description": co.description,
                        "subject_name": subject.name,
                        "attainment_percentage": float(co_attainment_pct),
                        "attainment_level": "Attained" if co_attainment_pct >= 60 else "Not Attained"
                    })

    # Improvement suggestions
    improvement_suggestions = []
    if overall_avg < 60:
        improvement_suggestions.append("Overall performance is below 60%. Focus on regular study and practice.")

    weak_subjects = [sp for sp in subject_performance if sp["average_score"] < 60]
    if weak_subjects:
        improvement_suggestions.append(f"Focus on improving performance in: {', '.join([s['subject_name'] for s in weak_subjects])}")

    weak_cos = [co for co in co_attainment if co["attainment_percentage"] < 60]
    if weak_cos:
        improvement_suggestions.append(f"Work on Course Outcomes: {', '.join([co['co_name'] for co in weak_cos])}")

    if not improvement_suggestions:
        improvement_suggestions.append("Keep up the good work! Continue maintaining your performance.")

    return {
        "student": {
            "id": student.id,
            "name": student.full_name,
            "student_id": student.student_id
        },
        "overall_performance": {
            "average_score": float(overall_avg),
            "total_exams": len(exams),
            "exams_attempted": len(set(mark.exam_id for mark in marks)),
            "grade_distribution": grade_distribution
        },
        "subject_performance": subject_performance,
        "co_attainment": co_attainment,
        "improvement_suggestions": improvement_suggestions
    }

@app.put("/api/student/profile")
async def update_student_profile(
    profile_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Update student profile"""
    student = get_student_info(db, current_user_id)

    # Store old values for audit
    old_values = {
        "full_name": student.full_name,
        "email": student.email,
        "phone": student.phone,
        "address": student.address
    }

    # Update allowed fields
    if profile_data.full_name is not None:
        student.full_name = profile_data.full_name
    if profile_data.email is not None:
        student.email = profile_data.email
    if profile_data.phone is not None:
        student.phone = profile_data.phone
    if profile_data.address is not None:
        student.address = profile_data.address

    student.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(student)

    # Log audit
    new_values = {
        "full_name": student.full_name,
        "email": student.email,
        "phone": student.phone,
        "address": student.address
    }
    log_audit(db, current_user_id, "UPDATE", "users", student.id, old_values, new_values)

    return {
        "id": student.id,
        "username": student.username,
        "email": student.email,
        "full_name": student.full_name,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "student_id": student.student_id,
        "phone": student.phone,
        "address": student.address,
        "updated_at": student.updated_at
    }

@app.get("/api/student/attendance")
async def get_student_attendance(
    subject_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["student"]))
):
    """Get student attendance records"""
    student = get_student_info(db, current_user_id)

    query = db.query(Attendance).filter(Attendance.student_id == current_user_id)

    # Apply filters
    if subject_id:
        query = query.filter(Attendance.subject_id == subject_id)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    attendance_records = query.order_by(desc(Attendance.date)).all()

    results = []
    for record in attendance_records:
        results.append({
            "id": record.id,
            "date": record.date,
            "status": record.status,
            "subject_name": record.subject.name if record.subject else None,
            "subject_code": record.subject.code if record.subject else None,
            "remarks": record.remarks,
            "created_at": record.created_at
        })

    # Calculate attendance summary
    total_classes = len(attendance_records)
    present_classes = len([r for r in attendance_records if r.status == "present"])
    attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0.0

    return {
        "summary": {
            "total_classes": total_classes,
            "present_classes": present_classes,
            "absent_classes": total_classes - present_classes,
            "attendance_percentage": float(attendance_percentage)
        },
        "records": results
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "student"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8017)



