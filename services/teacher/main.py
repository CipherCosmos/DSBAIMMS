# Teacher Dashboard Service
# Subject-scoped functionality with exam management and marks entry

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
    ExamCreate, QuestionCreate, MarkCreate, QuestionAttemptCreate
)
from shared.auth import RoleChecker
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Teacher Dashboard Service", version="1.0.0")

def get_teacher_subjects(db: Session, user_id: int) -> List[Subject]:
    """Get subjects assigned to the teacher"""
    teacher = db.query(User).filter(User.id == user_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=403, detail="Teacher access required")

    teacher_subjects = db.query(TeacherSubject).filter(
        TeacherSubject.teacher_id == user_id
    ).all()

    return [ts.subject for ts in teacher_subjects]


@app.get("/")
async def root():
    return {"message": "Teacher Dashboard Service is running"}

@app.get("/api/teacher/dashboard-stats")
async def get_teacher_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get teacher dashboard statistics for their assigned subjects"""
    teacher = db.query(User).filter(User.id == current_user_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=403, detail="Teacher access required")

    # Get assigned subjects
    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if not subject_ids:
        return {
            "teacher": {
                "id": teacher.id,
                "name": teacher.full_name,
                "employee_id": teacher.employee_id
            },
            "assigned_subjects": 0,
            "total_classes": 0,
            "total_exams": 0,
            "total_questions": 0,
            "pending_marks_entry": 0,
            "recent_activity": {
                "exams_created_week": 0,
                "marks_entered_week": 0
            }
        }

    # Basic counts
    total_classes = db.query(Class).filter(Class.id.in_([s.class_id for s in teacher_subjects])).count()
    total_exams = db.query(Exam).filter(Exam.subject_id.in_(subject_ids)).count()
    total_questions = db.query(Question).join(Exam).filter(Exam.subject_id.in_(subject_ids)).count()

    # Pending marks entry (exams with no marks entered)
    pending_exams = db.query(Exam).filter(
        Exam.subject_id.in_(subject_ids),
        Exam.status == "published",
        ~Exam.id.in_(
            db.query(Mark.exam_id).filter(Mark.exam_id == Exam.id).distinct()
        )
    ).count()

    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_exams = db.query(Exam).filter(
        Exam.subject_id.in_(subject_ids),
        Exam.created_at >= week_ago
    ).count()

    recent_marks = db.query(Mark).join(Exam).filter(
        Exam.subject_id.in_(subject_ids),
        Mark.created_at >= week_ago
    ).count()

    # Subject-wise statistics
    subject_stats = []
    for subject in teacher_subjects:
        subject_exams = db.query(Exam).filter(Exam.subject_id == subject.id).count()
        subject_questions = db.query(Question).join(Exam).filter(Exam.subject_id == subject.id).count()
        subject_marks = db.query(Mark).join(Exam).filter(Exam.subject_id == subject.id).count()

        # Get class information
        class_info = None
        if subject.class_assigned:
            class_info = {
                "class_id": subject.class_assigned.id,
                "class_name": subject.class_assigned.name,
                "semester_name": subject.class_assigned.semester.name if subject.class_assigned.semester else None
            }

        subject_stats.append({
            "subject_id": subject.id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "credits": subject.credits,
            "exams_count": subject_exams,
            "questions_count": subject_questions,
            "marks_entered": subject_marks,
            "class_info": class_info
        })

    return {
        "teacher": {
            "id": teacher.id,
            "name": teacher.full_name,
            "employee_id": teacher.employee_id,
            "department_name": teacher.department.name if teacher.department else None
        },
        "assigned_subjects": len(teacher_subjects),
        "total_classes": total_classes,
        "total_exams": total_exams,
        "total_questions": total_questions,
        "pending_marks_entry": pending_exams,
        "recent_activity": {
            "exams_created_week": recent_exams,
            "marks_entered_week": recent_marks
        },
        "subject_stats": subject_stats
    }

@app.get("/api/teacher/subjects")
async def get_teacher_subjects_list(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get subjects assigned to the teacher"""
    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if not subject_ids:
        return []

    query = db.query(Subject).filter(Subject.id.in_(subject_ids))

    # Apply filters
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
        # Get class information
        class_info = None
        if subject.class_assigned:
            class_info = {
                "class_id": subject.class_assigned.id,
                "class_name": subject.class_assigned.name,
                "semester_name": subject.class_assigned.semester.name if subject.class_assigned.semester else None
            }

        # Get exam and question counts
        exams_count = db.query(Exam).filter(Exam.subject_id == subject.id).count()
        questions_count = db.query(Question).join(Exam).filter(Exam.subject_id == subject.id).count()
        marks_count = db.query(Mark).join(Exam).filter(Exam.subject_id == subject.id).count()

        results.append({
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "description": subject.description,
            "credits": subject.credits,
            "is_active": subject.is_active,
            "created_at": subject.created_at,
            "updated_at": subject.updated_at,
            "class_info": class_info,
            "exams_count": exams_count,
            "questions_count": questions_count,
            "marks_count": marks_count
        })

    return results

@app.get("/api/teacher/exams")
async def get_teacher_exams(
    skip: int = 0,
    limit: int = 100,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    exam_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get exams for teacher's assigned subjects"""
    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

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
    if search:
        query = query.filter(
            or_(
                Exam.title.ilike(f"%{search}%"),
                Exam.description.ilike(f"%{search}%")
            )
        )

    exams = query.order_by(desc(Exam.created_at)).offset(skip).limit(limit).all()

    results = []
    for exam in exams:
        # Get question count
        questions_count = db.query(Question).filter(Question.exam_id == exam.id).count()

        # Get marks count
        marks_count = db.query(Mark).filter(Mark.exam_id == exam.id).count()

        # Get subject and class info
        subject_info = {
            "subject_id": exam.subject.id,
            "subject_name": exam.subject.name,
            "subject_code": exam.subject.code
        }

        class_info = None
        if exam.class_assigned:
            class_info = {
                "class_id": exam.class_assigned.id,
                "class_name": exam.class_assigned.name,
                "semester_name": exam.class_assigned.semester.name if exam.class_assigned.semester else None
            }

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
            "created_at": exam.created_at,
            "updated_at": exam.updated_at,
            "subject_info": subject_info,
            "class_info": class_info,
            "questions_count": questions_count,
            "marks_count": marks_count
        })

    return results

@app.post("/api/teacher/exams")
async def create_teacher_exam(
    exam_data: ExamCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Create a new exam for teacher's assigned subject"""
    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if exam_data.subject_id not in subject_ids:
        raise HTTPException(status_code=403, detail="Not authorized to create exam for this subject")

    # Verify subject exists and is active
    subject = db.query(Subject).filter(
        Subject.id == exam_data.subject_id,
        Subject.is_active == True
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found or inactive")

    # Create exam
    new_exam = Exam(
        title=exam_data.title,
        description=exam_data.description,
        exam_type=exam_data.exam_type,
        status=exam_data.status,
        total_marks=exam_data.total_marks,
        duration_minutes=exam_data.duration_minutes,
        start_time=exam_data.start_time,
        end_time=exam_data.end_time,
        subject_id=exam_data.subject_id,
        class_id=exam_data.class_id,
        semester_id=exam_data.semester_id,
        created_by=current_user_id
    )

    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "exams", new_exam.id,
              None, {"title": new_exam.title, "subject_id": new_exam.subject_id})

    return {
        "id": new_exam.id,
        "title": new_exam.title,
        "description": new_exam.description,
        "exam_type": new_exam.exam_type,
        "status": new_exam.status,
        "total_marks": new_exam.total_marks,
        "duration_minutes": new_exam.duration_minutes,
        "start_time": new_exam.start_time,
        "end_time": new_exam.end_time,
        "subject_id": new_exam.subject_id,
        "class_id": new_exam.class_id,
        "semester_id": new_exam.semester_id,
        "created_at": new_exam.created_at
    }

@app.get("/api/teacher/exams/{exam_id}/questions")
async def get_exam_questions(
    exam_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get questions for a specific exam"""
    # Verify teacher has access to this exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if exam.subject_id not in subject_ids:
        raise HTTPException(status_code=403, detail="Not authorized to access this exam")

    questions = db.query(Question).filter(
        Question.exam_id == exam_id
    ).offset(skip).limit(limit).all()

    results = []
    for question in questions:
        results.append({
            "id": question.id,
            "question_text": question.question_text,
            "question_type": question.question_type,
            "marks": question.marks,
            "difficulty_level": question.difficulty_level,
            "bloom_level": question.bloom_level,
            "co_id": question.co_id,
            "co_name": question.co.name if question.co else None,
            "is_optional": question.is_optional,
            "created_at": question.created_at,
            "updated_at": question.updated_at
        })

    return results

@app.post("/api/teacher/exams/{exam_id}/questions")
async def create_exam_question(
    exam_id: int,
    question_data: QuestionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Create a new question for an exam"""
    # Verify teacher has access to this exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if exam.subject_id not in subject_ids:
        raise HTTPException(status_code=403, detail="Not authorized to add questions to this exam")

    # Create question
    new_question = Question(
        question_text=question_data.question_text,
        question_type=question_data.question_type,
        marks=question_data.marks,
        difficulty_level=question_data.difficulty_level,
        bloom_level=question_data.bloom_level,
        co_id=question_data.co_id,
        exam_id=exam_id,
        is_optional=question_data.is_optional,
        created_by=current_user_id
    )

    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "questions", new_question.id,
              None, {"question_text": new_question.question_text[:100], "exam_id": exam_id})

    return {
        "id": new_question.id,
        "question_text": new_question.question_text,
        "question_type": new_question.question_type,
        "marks": new_question.marks,
        "difficulty_level": new_question.difficulty_level,
        "bloom_level": new_question.bloom_level,
        "co_id": new_question.co_id,
        "exam_id": new_question.exam_id,
        "is_optional": new_question.is_optional,
        "created_at": new_question.created_at
    }

@app.get("/api/teacher/exams/{exam_id}/marks")
async def get_exam_marks(
    exam_id: int,
    skip: int = 0,
    limit: int = 100,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get marks for a specific exam"""
    # Verify teacher has access to this exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if exam.subject_id not in subject_ids:
        raise HTTPException(status_code=403, detail="Not authorized to access this exam")

    query = db.query(Mark).filter(Mark.exam_id == exam_id)

    if student_id:
        query = query.filter(Mark.student_id == student_id)

    marks = query.offset(skip).limit(limit).all()

    results = []
    for mark in marks:
        results.append({
            "id": mark.id,
            "student_id": mark.student_id,
            "student_name": mark.student.full_name if mark.student else None,
            "student_roll": mark.student.student_id if mark.student else None,
            "question_id": mark.question_id,
            "question_text": mark.question.question_text[:100] if mark.question else None,
            "marks_obtained": mark.marks_obtained,
            "max_marks": mark.max_marks,
            "is_attempted": mark.is_attempted,
            "created_at": mark.created_at,
            "updated_at": mark.updated_at
        })

    return results

@app.post("/api/teacher/exams/{exam_id}/marks")
async def create_exam_marks(
    exam_id: int,
    marks_data: List[MarkCreate],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Create or update marks for an exam"""
    # Verify teacher has access to this exam
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if exam.subject_id not in subject_ids:
        raise HTTPException(status_code=403, detail="Not authorized to enter marks for this exam")

    created_marks = []
    updated_marks = []

    for mark_data in marks_data:
        # Check if mark already exists
        existing_mark = db.query(Mark).filter(
            Mark.exam_id == exam_id,
            Mark.student_id == mark_data.student_id,
            Mark.question_id == mark_data.question_id
        ).first()

        if existing_mark:
            # Update existing mark
            old_values = {
                "marks_obtained": existing_mark.marks_obtained,
                "is_attempted": existing_mark.is_attempted
            }

            existing_mark.marks_obtained = mark_data.marks_obtained
            existing_mark.is_attempted = mark_data.is_attempted
            existing_mark.updated_at = datetime.utcnow()

            updated_marks.append(existing_mark.id)

            # Log audit
            log_audit(db, current_user_id, "UPDATE", "marks", existing_mark.id,
                      old_values, {"marks_obtained": mark_data.marks_obtained, "is_attempted": mark_data.is_attempted})
        else:
            # Create new mark
            new_mark = Mark(
                exam_id=exam_id,
                student_id=mark_data.student_id,
                question_id=mark_data.question_id,
                marks_obtained=mark_data.marks_obtained,
                max_marks=mark_data.max_marks,
                is_attempted=mark_data.is_attempted,
                created_by=current_user_id
            )

            db.add(new_mark)
            created_marks.append(new_mark.id)

            # Log audit
            log_audit(db, current_user_id, "CREATE", "marks", new_mark.id,
                      None, {"exam_id": exam_id, "student_id": mark_data.student_id, "marks_obtained": mark_data.marks_obtained})

    db.commit()

    return {
        "created_count": len(created_marks),
        "updated_count": len(updated_marks),
        "created_ids": created_marks,
        "updated_ids": updated_marks
    }

@app.get("/api/teacher/analytics/subject/{subject_id}")
async def get_subject_analytics(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get analytics for a specific subject"""
    teacher_subjects = get_teacher_subjects(db, current_user_id)
    subject_ids = [s.id for s in teacher_subjects]

    if subject_id not in subject_ids:
        raise HTTPException(status_code=403, detail="Not authorized to access this subject")

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get all exams for this subject
    exams = db.query(Exam).filter(Exam.subject_id == subject_id).all()
    exam_ids = [e.id for e in exams]

    if not exam_ids:
        return {
            "subject": {
                "id": subject.id,
                "name": subject.name,
                "code": subject.code
            },
            "total_exams": 0,
            "total_questions": 0,
            "total_marks_entered": 0,
            "average_score": 0.0,
            "question_analysis": [],
            "bloom_level_distribution": {},
            "difficulty_distribution": {},
            "co_attainment": []
        }

    # Get all questions for these exams
    questions = db.query(Question).filter(Question.exam_id.in_(exam_ids)).all()
    question_ids = [q.id for q in questions]

    # Get all marks for these questions
    marks = db.query(Mark).filter(Mark.question_id.in_(question_ids)).all()

    # Calculate statistics
    total_questions = len(questions)
    total_marks_entered = len(marks)

    avg_score = 0.0
    if marks:
        total_obtained = sum(mark.marks_obtained for mark in marks)
        total_max = sum(mark.max_marks for mark in marks)
        avg_score = (total_obtained / total_max * 100) if total_max > 0 else 0.0

    # Question analysis
    question_analysis = []
    for question in questions:
        question_marks = [mark for mark in marks if mark.question_id == question.id]
        if question_marks:
            q_obtained = sum(mark.marks_obtained for mark in question_marks)
            q_max = sum(mark.max_marks for mark in question_marks)
            q_avg = (q_obtained / q_max * 100) if q_max > 0 else 0.0

            question_analysis.append({
                "question_id": question.id,
                "question_text": question.question_text[:100],
                "marks": question.marks,
                "difficulty_level": question.difficulty_level,
                "bloom_level": question.bloom_level,
                "average_score": float(q_avg),
                "attempts_count": len(question_marks)
            })

    # Bloom level distribution
    bloom_distribution = {}
    for question in questions:
        level = question.bloom_level
        bloom_distribution[level] = bloom_distribution.get(level, 0) + 1

    # Difficulty distribution
    difficulty_distribution = {}
    for question in questions:
        level = question.difficulty_level
        difficulty_distribution[level] = difficulty_distribution.get(level, 0) + 1

    # CO attainment
    co_attainment = []
    cos = db.query(CO).filter(CO.subject_id == subject_id).all()
    for co in cos:
        co_questions = [q for q in questions if q.co_id == co.id]
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
                    "attainment_percentage": float(co_attainment_pct),
                    "questions_count": len(co_questions),
                    "attempts_count": len(co_marks)
                })

    return {
        "subject": {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code
        },
        "total_exams": len(exams),
        "total_questions": total_questions,
        "total_marks_entered": total_marks_entered,
        "average_score": float(avg_score),
        "question_analysis": question_analysis,
        "bloom_level_distribution": bloom_distribution,
        "difficulty_distribution": difficulty_distribution,
        "co_attainment": co_attainment
    }

@app.get("/api/teacher/bulk-operations/template")
async def get_bulk_template(
    operation_type: str = Query(..., description="Type of bulk operation: questions, marks"),
    exam_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher"]))
):
    """Get bulk operation template for teacher"""
    if operation_type == "questions" and exam_id:
        # Verify teacher has access to this exam
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        teacher_subjects = get_teacher_subjects(db, current_user_id)
        subject_ids = [s.id for s in teacher_subjects]

        if exam.subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this exam")

        return {
            "template": {
                "headers": ["question_text", "question_type", "marks", "difficulty_level", "bloom_level", "co_id", "is_optional"],
                "required_fields": ["question_text", "marks"],
                "question_type_options": ["multiple_choice", "short_answer", "essay", "true_false"],
                "difficulty_level_options": ["easy", "medium", "hard"],
                "bloom_level_options": ["remember", "understand", "apply", "analyze", "evaluate", "create"],
                "co_options": [
                    {"id": co.id, "name": co.name}
                    for co in db.query(CO).filter(CO.subject_id == exam.subject_id).all()
                ]
            }
        }
    elif operation_type == "marks" and exam_id:
        # Verify teacher has access to this exam
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        teacher_subjects = get_teacher_subjects(db, current_user_id)
        subject_ids = [s.id for s in teacher_subjects]

        if exam.subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this exam")

        # Get students for this exam's class
        students = db.query(User).filter(
            User.class_id == exam.class_id,
            User.role == "student"
        ).all()

        # Get questions for this exam
        questions = db.query(Question).filter(Question.exam_id == exam_id).all()

        return {
            "template": {
                "headers": ["student_id", "question_id", "marks_obtained", "max_marks", "is_attempted"],
                "required_fields": ["student_id", "question_id", "marks_obtained"],
                "student_options": [
                    {"id": s.id, "name": s.full_name, "student_id": s.student_id}
                    for s in students
                ],
                "question_options": [
                    {"id": q.id, "question_text": q.question_text[:50], "marks": q.marks}
                    for q in questions
                ]
            }
        }
    else:
        raise HTTPException(status_code=400, detail="Unsupported operation type or missing exam_id")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "teacher"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8016)



