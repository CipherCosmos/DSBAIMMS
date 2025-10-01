from fastapi import FastAPI, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date
import json

from shared.database import get_db
from shared.models import Exam, Question, ExamSection, Mark, User, Subject, Class, Department, AuditLog, CO
from shared.auth import RoleChecker
from shared.permissions import PermissionChecker, Permission
from shared.schemas import ExamResponse, ExamCreate, ExamUpdate, QuestionResponse, ExamSectionResponse
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Exams Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class SubQuestionCreate(BaseModel):
    sub_question_text: str
    sub_question_marks: float
    correct_answer: Optional[str] = None
    options: Optional[List[str]] = None

# Using QuestionCreate from shared.schemas

# Using ExamSectionCreate from shared.schemas

class ExamWeightageRule(BaseModel):
    rule_type: str  # "best_of", "average_of", "weighted_average", "minimum_required"
    parameters: Dict[str, Any]  # Rule-specific parameters
    description: str

class ExamCalculationRules(BaseModel):
    optional_questions_rule: Optional[ExamWeightageRule] = None
    section_weightage: Optional[Dict[str, float]] = None
    passing_criteria: Dict[str, Any]
    grade_calculation: Dict[str, Any]
    co_weightage: Optional[Dict[str, float]] = None

class ExamCreateEnhanced(BaseModel):
    exam_name: str
    exam_description: Optional[str] = None
    subject_id: int
    class_id: int
    exam_type: str  # internal, external, assignment, quiz, project
    exam_date: str
    duration_minutes: int
    total_marks: float
    passing_marks: float
    is_active: bool = True
    sections: List[ExamSectionCreate]
    weightage: float = 1.0
    calculation_rules: Optional[ExamCalculationRules] = None

# Using ExamResponse from shared.schemas

class BulkQuestionCreate(BaseModel):
    questions: List[QuestionCreate]

class ExamAnalytics(BaseModel):
    exam_id: int
    exam_name: str
    total_students: int
    attempted_students: int
    average_score: float
    highest_score: float
    lowest_score: float
    passing_rate: float
    difficulty_analysis: Dict[str, int]
    bloom_analysis: Dict[str, int]
    co_analysis: Dict[str, float]



def format_question_response(question: Question) -> Dict[str, Any]:
    """Format question response"""
    return {
        "id": question.id,
        "question_text": question.question_text,
        "question_type": question.question_type,
        "options": json.loads(question.options) if question.options else None,
        "correct_answer": question.correct_answer,
        "marks": float(question.marks),
        "difficulty_level": question.difficulty_level,
        "bloom_level": question.bloom_level,
        "co_id": question.co_id,
        "co_name": question.co.name if question.co else None,
        "subject_id": question.subject_id,
        "subject_name": question.subject.name if question.subject else None,
        "tags": json.loads(question.tags) if question.tags else None,
        "created_by": question.created_by,
        "created_by_name": question.creator.full_name if question.creator else None,
        "created_at": question.created_at.isoformat() if question.created_at else None,
        "is_active": question.is_active
    }

def format_exam_response(exam: Exam) -> Dict[str, Any]:
    """Format exam response with sections and questions"""
    sections = []
    if exam.sections:
        for section in exam.sections:
            questions = [format_question_response(q) for q in section.questions] if section.questions else []
            sections.append({
                "id": section.id,
                "section_name": section.section_name,
                "section_description": section.section_description,
                "total_questions": section.total_questions,
                "total_marks": float(section.total_marks),
                "questions": questions,
                "created_at": section.created_at.isoformat() if section.created_at else None
            })

    # Count students and completed exams
    student_count = 0
    completed_count = 0
    if exam.class_:
        student_count = len([s for s in exam.class_.students if s.role == "student" and s.is_active])
        # This would need to be calculated from marks table
        completed_count = 0

    return {
        "id": exam.id,
        "exam_name": exam.exam_name,
        "exam_description": exam.exam_description,
        "subject_id": exam.subject_id,
        "subject_name": exam.subject.name if exam.subject else None,
        "class_id": exam.class_id,
        "class_name": exam.class_.name if exam.class_ else None,
        "exam_type": exam.exam_type,
        "exam_date": exam.exam_date.isoformat() if exam.exam_date else None,
        "duration_minutes": exam.duration_minutes,
        "total_marks": float(exam.total_marks),
        "passing_marks": float(exam.passing_marks),
        "is_active": exam.is_active,
        "created_by": exam.created_by,
        "created_by_name": exam.creator.full_name if exam.creator else None,
        "sections": sections,
        "created_at": exam.created_at.isoformat() if exam.created_at else None,
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        "student_count": student_count,
        "completed_count": completed_count
    }

@app.get("/", response_model=Dict[str, str])
async def root():
    """Service health check"""
    return {"message": "Exams Service", "version": "1.0.0", "status": "healthy"}

# Question Bank Management
@app.get("/api/questions", response_model=List[QuestionResponse])
async def get_questions(
    subject_id: Optional[int] = Query(None),
    difficulty_level: Optional[str] = Query(None),
    bloom_level: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    co_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get questions from question bank"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    query = db.query(Question).options(
        joinedload(Question.subject),
        joinedload(Question.co),
        joinedload(Question.creator)
    )

    # Apply role-based filtering
    if current_user.role == "teacher":
        # Teachers can only see questions from subjects they teach
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_ids.contains([current_user.id]))
        query = query.filter(Question.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        # HODs can see questions from their department
        query = query.join(Subject).filter(Subject.department_id == current_user.department_id)

    # Apply filters
    if subject_id:
        query = query.filter(Question.subject_id == subject_id)

    if difficulty_level:
        query = query.filter(Question.difficulty_level == difficulty_level)

    if bloom_level:
        query = query.filter(Question.bloom_level == bloom_level)

    if question_type:
        query = query.filter(Question.question_type == question_type)

    if co_id:
        query = query.filter(Question.co_id == co_id)

    if search:
        query = query.filter(Question.question_text.ilike(f"%{search}%"))

    questions = query.offset(skip).limit(limit).all()

    result = []
    for question in questions:
        result.append(format_question_response(question))

    return result

@app.post("/api/questions", response_model=QuestionResponse)
async def create_question(
    question_data: QuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new question"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Validate subject exists and user has access
    subject = db.query(Subject).filter(Subject.id == question_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Check permissions
    if current_user.role == "teacher" and current_user.id not in (subject.teacher_ids or []):
        raise HTTPException(status_code=403, detail="You can only create questions for subjects you teach")
    elif current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="You can only create questions for subjects in your department")

    # Validate CO exists if provided
    if question_data.co_id:
        co = db.query(CO).filter(CO.id == question_data.co_id).first()
        if not co:
            raise HTTPException(status_code=404, detail="Course Outcome not found")

    # Create question
    question = Question(
        question_text=question_data.question_text,
        question_type=question_data.question_type,
        options=json.dumps(question_data.options) if question_data.options else None,
        correct_answer=question_data.correct_answer,
        marks=question_data.marks,
        difficulty_level=question_data.difficulty_level,
        bloom_level=question_data.bloom_level,
        co_id=question_data.co_id,
        subject_id=question_data.subject_id,
        tags=json.dumps(question_data.tags) if question_data.tags else None,
        created_by=current_user_id,
        created_at=datetime.utcnow(),
        is_active=True,
        is_optional=question_data.is_optional,
        is_sub_question=question_data.is_sub_question,
        parent_question_id=question_data.parent_question_id,
        co_weight=question_data.co_weight
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    # Create sub-questions if provided
    sub_questions = []
    if question_data.sub_questions:
        for sub_q_data in question_data.sub_questions:
            sub_question = Question(
                question_text=sub_q_data.sub_question_text,
                question_type=question_data.question_type,  # Inherit from parent
                options=json.dumps(sub_q_data.options) if sub_q_data.options else None,
                correct_answer=sub_q_data.correct_answer or "",
                marks=sub_q_data.sub_question_marks,
                difficulty_level=question_data.difficulty_level,  # Inherit from parent
                bloom_level=question_data.bloom_level,  # Inherit from parent
                co_id=question_data.co_id,  # Inherit from parent
                subject_id=question_data.subject_id,  # Inherit from parent
                created_by=current_user_id,
                created_at=datetime.utcnow(),
                is_active=True,
                is_sub_question=True,
                parent_question_id=question.id,
                co_weight=question_data.co_weight
            )
            db.add(sub_question)
            sub_questions.append(sub_question)

        db.commit()
        for sub_q in sub_questions:
            db.refresh(sub_q)

    # Log audit
    log_audit(db, current_user_id, "CREATE_QUESTION", "questions", question.id,
              new_values=question_data.dict(), request=request)

    return format_question_response(question)

@app.post("/api/questions/bulk", response_model=List[QuestionResponse])
async def create_questions_bulk(
    bulk_data: BulkQuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create multiple questions at once"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    created_questions = []

    for question_data in bulk_data.questions:
        # Validate subject exists and user has access
        subject = db.query(Subject).filter(Subject.id == question_data.subject_id).first()
        if not subject:
            continue  # Skip invalid subjects

        # Check permissions
        if current_user.role == "teacher" and current_user.id not in (subject.teacher_ids or []):
            continue
        elif current_user.role == "hod" and subject.department_id != current_user.department_id:
            continue

        # Create question
        question = Question(
            question_text=question_data.question_text,
            question_type=question_data.question_type,
            options=json.dumps(question_data.options) if question_data.options else None,
            correct_answer=question_data.correct_answer,
            marks=question_data.marks,
            difficulty_level=question_data.difficulty_level,
            bloom_level=question_data.bloom_level,
            co_id=question_data.co_id,
            subject_id=question_data.subject_id,
            tags=json.dumps(question_data.tags) if question_data.tags else None,
            created_by=current_user_id,
            created_at=datetime.utcnow(),
            is_active=True
        )

        db.add(question)
        created_questions.append(question)

    db.commit()

    # Refresh all questions to get IDs
    for question in created_questions:
        db.refresh(question)

    # Log audit
    log_audit(db, current_user_id, "BULK_CREATE_QUESTIONS", "questions", None,
              new_values={"count": len(created_questions)}, request=request)

    result = []
    for question in created_questions:
        result.append(format_question_response(question))

    return result

# Exam Management
@app.get("/api/exams", response_model=List[ExamResponseEnhanced])
async def get_exams(
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    exam_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get exams with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    query = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_),
        joinedload(Exam.creator),
        joinedload(Exam.sections).joinedload(ExamSection.questions)
    )

    # Apply role-based filtering
    if current_user.role == "student":
        # Students can only see exams for their class
        query = query.filter(Exam.class_id == current_user.class_id)
    elif current_user.role == "teacher":
        # Teachers can see exams for subjects they teach
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_ids.contains([current_user.id]))
        query = query.filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        # HODs can see exams from their department
        query = query.join(Subject).filter(Subject.department_id == current_user.department_id)

    # Apply filters
    if subject_id:
        query = query.filter(Exam.subject_id == subject_id)

    if class_id:
        query = query.filter(Exam.class_id == class_id)

    if exam_type:
        query = query.filter(Exam.exam_type == exam_type)

    if is_active is not None:
        query = query.filter(Exam.is_active == is_active)

    exams = query.offset(skip).limit(limit).all()

    result = []
    for exam in exams:
        result.append(format_exam_response(exam))

    return result

@app.post("/api/exams", response_model=ExamResponseEnhanced)
async def create_exam(
    exam_data: ExamCreateEnhanced,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Validate subject exists and user has access
    subject = db.query(Subject).filter(Subject.id == exam_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Validate class exists
    class_obj = db.query(Class).filter(Class.id == exam_data.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # Check permissions
    if current_user.role == "teacher" and current_user.id not in (subject.teacher_ids or []):
        raise HTTPException(status_code=403, detail="You can only create exams for subjects you teach")
    elif current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="You can only create exams for subjects in your department")

    # Parse exam date
    try:
        exam_date = datetime.strptime(exam_data.exam_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam date format. Use YYYY-MM-DD")

    # Calculate total marks from sections
    total_marks = sum(section.total_marks for section in exam_data.sections)

    # Create exam
    exam = Exam(
        exam_name=exam_data.exam_name,
        exam_description=exam_data.exam_description,
        subject_id=exam_data.subject_id,
        class_id=exam_data.class_id,
        exam_type=exam_data.exam_type,
        exam_date=exam_date,
        duration_minutes=exam_data.duration_minutes,
        total_marks=total_marks,
        passing_marks=exam_data.passing_marks,
        is_active=exam_data.is_active,
        created_by=current_user_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(exam)
    db.commit()
    db.refresh(exam)

    # Create sections
    for section_data in exam_data.sections:
        # Validate questions exist and belong to the subject
        questions = db.query(Question).filter(
            Question.id.in_(section_data.questions),
            Question.subject_id == exam_data.subject_id,
            Question.is_active == True
        ).all()

        if len(questions) != len(section_data.questions):
            raise HTTPException(status_code=400, detail="Some questions not found or don't belong to the subject")

        section = ExamSection(
            exam_id=exam.id,
            section_name=section_data.section_name,
            section_description=section_data.section_description,
            total_questions=len(questions),
            total_marks=section_data.total_marks,
            created_at=datetime.utcnow()
        )

        db.add(section)
        db.commit()
        db.refresh(section)

        # Associate questions with section
        for question in questions:
            question.exam_section_id = section.id

    db.commit()

    # Log audit
    log_audit(db, current_user_id, "CREATE_EXAM", "exams", exam.id,
              new_values=exam_data.dict(), request=request)

    return format_exam_response(exam)

@app.get("/api/exams/{exam_id}", response_model=ExamResponseEnhanced)
async def get_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get specific exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    exam = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_),
        joinedload(Exam.creator),
        joinedload(Exam.sections).joinedload(ExamSection.questions)
    ).filter(Exam.id == exam_id).first()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Check permissions
    if current_user.role == "student" and exam.class_id != current_user.class_id:
        raise HTTPException(status_code=403, detail="Cannot access exams from other classes")
    elif current_user.role == "teacher" and current_user.id not in (exam.subject.teacher_ids or []):
        raise HTTPException(status_code=403, detail="Cannot access exams for subjects you don't teach")
    elif current_user.role == "hod" and exam.subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot access exams from other departments")

    return format_exam_response(exam)

@app.get("/api/exams/{exam_id}/analytics", response_model=ExamAnalytics)
async def get_exam_analytics(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get exam analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Check permissions
    if current_user.role == "teacher" and current_user.id not in (exam.subject.teacher_ids or []):
        raise HTTPException(status_code=403, detail="Cannot access analytics for exams you don't manage")
    elif current_user.role == "hod" and exam.subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot access analytics from other departments")

    # Calculate analytics (this would need to be implemented with actual marks data)
    total_students = 0
    attempted_students = 0
    average_score = 0.0
    highest_score = 0.0
    lowest_score = 0.0
    passing_rate = 0.0

    # Calculate real analytics from marks table
    marks = db.query(Mark).join(Question).filter(Question.exam_id == exam_id).all()

    if marks:
        # Get unique students who attempted the exam
        student_ids = list(set(mark.student_id for mark in marks))
        total_students = len(student_ids)
        attempted_students = total_students

        # Calculate scores per student
        student_scores = {}
        for mark in marks:
            if mark.student_id not in student_scores:
                student_scores[mark.student_id] = {"total_obtained": 0, "total_max": 0}
            student_scores[mark.student_id]["total_obtained"] += mark.marks_obtained
            student_scores[mark.student_id]["total_max"] += mark.max_marks

        # Calculate statistics
        if student_scores:
            scores = []
            passing_count = 0

            for student_id, score_data in student_scores.items():
                if score_data["total_max"] > 0:
                    percentage = (score_data["total_obtained"] / score_data["total_max"]) * 100
                    scores.append(percentage)
                    if percentage >= exam.passing_marks:
                        passing_count += 1

            if scores:
                average_score = sum(scores) / len(scores)
                highest_score = max(scores)
                lowest_score = min(scores)
                passing_rate = (passing_count / len(scores)) * 100 if scores else 0

        # Calculate difficulty analysis
        difficulty_analysis = {}
        bloom_analysis = {}
        co_analysis = {}

        for mark in marks:
            question = db.query(Question).filter(Question.id == mark.question_id).first()
            if question:
                # Difficulty analysis
                diff = question.difficulty_level
                if diff not in difficulty_analysis:
                    difficulty_analysis[diff] = {"count": 0, "total_marks": 0, "obtained_marks": 0}
                difficulty_analysis[diff]["count"] += 1
                difficulty_analysis[diff]["total_marks"] += mark.max_marks
                difficulty_analysis[diff]["obtained_marks"] += mark.marks_obtained

                # Bloom analysis
                bloom = question.bloom_level
                if bloom not in bloom_analysis:
                    bloom_analysis[bloom] = {"count": 0, "total_marks": 0, "obtained_marks": 0}
                bloom_analysis[bloom]["count"] += 1
                bloom_analysis[bloom]["total_marks"] += mark.max_marks
                bloom_analysis[bloom]["obtained_marks"] += mark.marks_obtained

                # CO analysis
                if question.co_id:
                    co_id = question.co_id
                    if co_id not in co_analysis:
                        co_analysis[co_id] = {"count": 0, "total_marks": 0, "obtained_marks": 0}
                    co_analysis[co_id]["count"] += 1
                    co_analysis[co_id]["total_marks"] += mark.max_marks
                    co_analysis[co_id]["obtained_marks"] += mark.marks_obtained

    return ExamAnalytics(
        exam_id=exam.id,
        exam_name=exam.exam_name,
        total_students=total_students,
        attempted_students=attempted_students,
        average_score=average_score,
        highest_score=highest_score,
        lowest_score=lowest_score,
        passing_rate=passing_rate,
        difficulty_analysis=difficulty_analysis,
        bloom_analysis=bloom_analysis,
        co_analysis=co_analysis
    )

# Bulk Operations
@app.post("/api/exams/bulk-create-questions")
async def bulk_create_questions(
    bulk_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk create questions for exams"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    questions_data = bulk_data.get("questions", [])
    if not questions_data:
        raise HTTPException(status_code=400, detail="No questions data provided")

    created_questions = []
    errors = []

    for i, question_data in enumerate(questions_data):
        try:
            subject_id = question_data.get("subject_id")
            if not subject_id:
                errors.append(f"Row {i+1}: Subject ID is required")
                continue

            # Validate subject exists and permissions
            subject = db.query(Subject).filter(Subject.id == subject_id).first()
            if not subject:
                errors.append(f"Row {i+1}: Subject not found")
                continue

            # Check permissions
            if current_user.role == "hod" and subject.department_id != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied to subject")
                continue
            elif current_user.role == "teacher" and subject.teacher_id != current_user_id:
                errors.append(f"Row {i+1}: Access denied to subject")
                continue

            # Validate CO if provided
            co_id = question_data.get("co_id")
            if co_id:
                co = db.query(CO).filter(CO.id == co_id, CO.subject_id == subject_id).first()
                if not co:
                    errors.append(f"Row {i+1}: Invalid CO for this subject")
                    continue

            # Create question
            new_question = Question(
                question_text=question_data["question_text"],
                question_type=question_data.get("question_type", "short_answer"),
                options=json.dumps(question_data.get("options", [])) if question_data.get("options") else None,
                correct_answer=question_data["correct_answer"],
                marks=float(question_data.get("marks", 1.0)),
                difficulty_level=question_data.get("difficulty_level", "medium"),
                bloom_level=question_data.get("bloom_level", "understand"),
                co_id=co_id,
                subject_id=subject_id,
                tags=json.dumps(question_data.get("tags", [])),
                created_by=current_user_id,
                created_at=datetime.utcnow()
            )

            db.add(new_question)
            db.commit()
            db.refresh(new_question)

            created_questions.append({
                "id": new_question.id,
                "question_text": new_question.question_text,
                "question_type": new_question.question_type,
                "marks": new_question.marks,
                "difficulty_level": new_question.difficulty_level,
                "bloom_level": new_question.bloom_level,
                "subject_id": new_question.subject_id,
                "co_id": new_question.co_id
            })

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue

    return {
        "message": f"Created {len(created_questions)} questions successfully",
        "created_questions": created_questions,
        "errors": errors
    }

@app.post("/api/exams/bulk-create-exams")
async def bulk_create_exams(
    bulk_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk create exams"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    exams_data = bulk_data.get("exams", [])
    if not exams_data:
        raise HTTPException(status_code=400, detail="No exams data provided")

    created_exams = []
    errors = []

    for i, exam_data in enumerate(exams_data):
        try:
            subject_id = exam_data.get("subject_id")
            if not subject_id:
                errors.append(f"Row {i+1}: Subject ID is required")
                continue

            # Validate subject exists and permissions
            subject = db.query(Subject).filter(Subject.id == subject_id).first()
            if not subject:
                errors.append(f"Row {i+1}: Subject not found")
                continue

            # Check permissions
            if current_user.role == "hod" and subject.department_id != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied to subject")
                continue
            elif current_user.role == "teacher" and subject.teacher_id != current_user_id:
                errors.append(f"Row {i+1}: Access denied to subject")
                continue

            # Validate class if provided
            class_id = exam_data.get("class_id")
            if class_id:
                class_obj = db.query(Class).filter(Class.id == class_id).first()
                if not class_obj:
                    errors.append(f"Row {i+1}: Class not found")
                    continue

            # Create exam
            new_exam = Exam(
                name=exam_data["name"],
                description=exam_data.get("description"),
                subject_id=subject_id,
                class_id=class_id,
                exam_date=datetime.fromisoformat(exam_data["exam_date"]) if exam_data.get("exam_date") else datetime.utcnow(),
                duration_minutes=int(exam_data.get("duration_minutes", 120)),
                total_marks=float(exam_data.get("total_marks", 100.0)),
                passing_marks=float(exam_data.get("passing_marks", 40.0)),
                status=exam_data.get("status", "draft"),
                instructions=exam_data.get("instructions"),
                created_by=current_user_id,
                created_at=datetime.utcnow()
            )

            db.add(new_exam)
            db.commit()
            db.refresh(new_exam)

            created_exams.append({
                "id": new_exam.id,
                "name": new_exam.name,
                "subject_id": new_exam.subject_id,
                "class_id": new_exam.class_id,
                "exam_date": new_exam.exam_date,
                "total_marks": new_exam.total_marks,
                "status": new_exam.status
            })

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue

    return {
        "message": f"Created {len(created_exams)} exams successfully",
        "created_exams": created_exams,
        "errors": errors
    }

@app.post("/api/exams/bulk-upload-marks")
async def bulk_upload_marks(
    bulk_data: dict,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk upload marks for students"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    marks_data = bulk_data.get("marks", [])
    if not marks_data:
        raise HTTPException(status_code=400, detail="No marks data provided")

    uploaded_marks = []
    errors = []

    for i, mark_data in enumerate(marks_data):
        try:
            exam_id = mark_data.get("exam_id")
            student_id = mark_data.get("student_id")
            marks_obtained = mark_data.get("marks_obtained")
            max_marks = mark_data.get("max_marks")

            if not all([exam_id, student_id, marks_obtained, max_marks]):
                errors.append(f"Row {i+1}: Exam ID, Student ID, Marks Obtained, and Max Marks are required")
                continue

            # Validate exam exists and permissions
            exam = db.query(Exam).filter(Exam.id == exam_id).first()
            if not exam:
                errors.append(f"Row {i+1}: Exam not found")
                continue

            # Check permissions
            if current_user.role == "hod" and exam.subject.department_id != current_user.department_id:
                errors.append(f"Row {i+1}: Access denied to exam")
                continue
            elif current_user.role == "teacher" and exam.subject.teacher_id != current_user_id:
                errors.append(f"Row {i+1}: Access denied to exam")
                continue

            # Validate student exists
            student = db.query(User).filter(User.id == student_id, User.role == "student").first()
            if not student:
                errors.append(f"Row {i+1}: Student not found")
                continue

            # Check if mark already exists
            existing_mark = db.query(Mark).filter(
                Mark.exam_id == exam_id,
                Mark.student_id == student_id,
                Mark.attempt_number == mark_data.get("attempt_number", 1)
            ).first()

            if existing_mark:
                errors.append(f"Row {i+1}: Mark already exists for this attempt")
                continue

            # Create mark
            new_mark = Mark(
                exam_id=exam_id,
                student_id=student_id,
                marks_obtained=float(marks_obtained),
                max_marks=float(max_marks),
                attempt_number=int(mark_data.get("attempt_number", 1)),
                is_best_attempt=mark_data.get("is_best_attempt", True),
                feedback=mark_data.get("feedback"),
                graded_by=current_user_id,
                graded_at=datetime.utcnow(),
                created_at=datetime.utcnow()
            )

            db.add(new_mark)
            db.commit()
            db.refresh(new_mark)

            uploaded_marks.append({
                "id": new_mark.id,
                "exam_id": new_mark.exam_id,
                "student_id": new_mark.student_id,
                "marks_obtained": new_mark.marks_obtained,
                "max_marks": new_mark.max_marks,
                "percentage": round((new_mark.marks_obtained / new_mark.max_marks) * 100, 2)
            })

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            continue

    return {
        "message": f"Uploaded {len(uploaded_marks)} marks successfully",
        "uploaded_marks": uploaded_marks,
        "errors": errors
    }

@app.post("/api/exams/{exam_id}/optional-questions/calculate-marks")
async def calculate_optional_questions_marks(
    exam_id: int,
    student_attempts: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Calculate marks for optional questions (best attempts)"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Get all optional questions for this exam
    optional_questions = db.query(Question).filter(
        Question.exam_id == exam_id,
        Question.is_optional == True
    ).all()

    if not optional_questions:
        return {"message": "No optional questions found for this exam"}

    # Group questions by parent (if they have sub-questions)
    question_groups = {}
    for question in optional_questions:
        parent_id = question.parent_question_id or question.id
        if parent_id not in question_groups:
            question_groups[parent_id] = []
        question_groups[parent_id].append(question)

    calculated_marks = {}

    for group_id, questions in question_groups.items():
        # Get student attempts for this group
        group_attempts = student_attempts.get(str(group_id), {})

        # Calculate marks for each attempt
        attempt_scores = []
        for question in questions:
            question_id = str(question.id)
            if question_id in group_attempts:
                # Calculate score for this question
                student_answer = group_attempts[question_id].get("answer", "")
                is_correct = student_answer.lower().strip() == question.correct_answer.lower().strip()
                score = question.marks if is_correct else 0
                attempt_scores.append({
                    "question_id": question.id,
                    "question_text": question.question_text,
                    "marks": question.marks,
                    "score": score,
                    "is_correct": is_correct
                })

        # Sort by score (descending) and take the best attempts
        attempt_scores.sort(key=lambda x: x["score"], reverse=True)

        # Calculate total marks for this group
        total_marks = sum(q.marks for q in questions)
        best_score = sum(score["score"] for score in attempt_scores)

        calculated_marks[group_id] = {
            "total_available_marks": total_marks,
            "best_score": best_score,
            "percentage": (best_score / total_marks * 100) if total_marks > 0 else 0,
            "attempts": attempt_scores
        }

    return {
        "exam_id": exam_id,
        "calculated_marks": calculated_marks,
        "total_optional_marks": sum(group["best_score"] for group in calculated_marks.values())
    }

@app.get("/api/exams/{exam_id}/optional-questions")
async def get_optional_questions(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get optional questions for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Get optional questions
    optional_questions = db.query(Question).filter(
        Question.exam_id == exam_id,
        Question.is_optional == True
    ).all()

    # Group by parent question
    question_groups = {}
    for question in optional_questions:
        parent_id = question.parent_question_id or question.id
        if parent_id not in question_groups:
            question_groups[parent_id] = {
                "parent_question": None,
                "sub_questions": []
            }

        if question.parent_question_id:
            question_groups[parent_id]["sub_questions"].append(question)
        else:
            question_groups[parent_id]["parent_question"] = question

    results = []
    for group_id, group in question_groups.items():
        if group["parent_question"]:
            # This is a parent question with sub-questions
            parent = group["parent_question"]
            results.append({
                "group_id": group_id,
                "parent_question": {
                    "id": parent.id,
                    "question_text": parent.question_text,
                    "marks": parent.marks,
                    "difficulty_level": parent.difficulty_level,
                    "bloom_level": parent.bloom_level
                },
                "sub_questions": [
                    {
                        "id": sq.id,
                        "question_text": sq.question_text,
                        "marks": sq.marks,
                        "correct_answer": sq.correct_answer
                    }
                    for sq in group["sub_questions"]
                ],
                "total_marks": parent.marks + sum(sq.marks for sq in group["sub_questions"]),
                "instructions": f"Answer any {len(group['sub_questions']) + 1} questions from this group"
            })
        else:
            # Individual optional questions
            for question in group["sub_questions"]:
                results.append({
                    "group_id": group_id,
                    "question": {
                        "id": question.id,
                        "question_text": question.question_text,
                        "marks": question.marks,
                        "difficulty_level": question.difficulty_level,
                        "bloom_level": question.bloom_level,
                        "correct_answer": question.correct_answer
                    },
                    "total_marks": question.marks,
                    "instructions": "This is an optional question"
                })

    return {
        "exam_id": exam_id,
        "optional_questions": results,
        "total_groups": len(question_groups)
    }

@app.post("/api/exams/{exam_id}/calculate-results")
async def calculate_exam_results(
    exam_id: int,
    student_id: Optional[int] = None,
    apply_weightage: bool = True,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Calculate exam results with weightage and calculation rules"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Get exam calculation rules
    calculation_rules = exam.calculation_rules or {}

    # Get student marks for this exam
    marks_query = db.query(Mark).filter(Mark.exam_id == exam_id)
    if student_id:
        marks_query = marks_query.filter(Mark.student_id == student_id)

    marks = marks_query.all()

    if not marks:
        return {"message": "No marks found for this exam"}

    # Group marks by student
    student_marks = {}
    for mark in marks:
        if mark.student_id not in student_marks:
            student_marks[mark.student_id] = []
        student_marks[mark.student_id].append(mark)

    results = []

    for student_id, student_mark_list in student_marks.items():
        student = db.query(User).filter(User.id == student_id).first()
        if not student:
            continue

        # Calculate basic marks
        total_obtained = sum(mark.marks_obtained for mark in student_mark_list)
        total_max = sum(mark.max_marks for mark in student_mark_list)
        basic_percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Apply weightage if enabled
        if apply_weightage and exam.weightage:
            weighted_percentage = basic_percentage * exam.weightage
        else:
            weighted_percentage = basic_percentage

        # Apply calculation rules
        final_percentage = weighted_percentage
        applied_rules = []

        # Optional questions rule
        if calculation_rules.get("optional_questions_rule"):
            rule = calculation_rules["optional_questions_rule"]
            if rule["rule_type"] == "best_of":
                # Get optional questions and apply best of rule
                optional_marks = [m for m in student_mark_list if m.question.is_optional]
                if optional_marks:
                    # Sort by marks and take best attempts
                    optional_marks.sort(key=lambda x: x.marks_obtained, reverse=True)
                    best_count = rule["parameters"].get("count", len(optional_marks))
                    best_marks = optional_marks[:best_count]

                    # Recalculate with best marks
                    best_obtained = sum(m.marks_obtained for m in best_marks)
                    best_max = sum(m.max_marks for m in best_marks)
                    if best_max > 0:
                        optional_percentage = (best_obtained / best_max * 100)
                        final_percentage = optional_percentage
                        applied_rules.append(f"Best of {best_count} optional questions applied")

        # Section weightage
        if calculation_rules.get("section_weightage"):
            section_weights = calculation_rules["section_weightage"]
            weighted_section_marks = 0
            total_section_weight = 0

            for section_name, weight in section_weights.items():
                section_marks = [m for m in student_mark_list if m.question.section_name == section_name]
                if section_marks:
                    section_obtained = sum(m.marks_obtained for m in section_marks)
                    section_max = sum(m.max_marks for m in section_marks)
                    if section_max > 0:
                        section_percentage = (section_obtained / section_max * 100)
                        weighted_section_marks += section_percentage * weight
                        total_section_weight += weight

            if total_section_weight > 0:
                final_percentage = weighted_section_marks / total_section_weight
                applied_rules.append("Section weightage applied")

        # Determine grade based on calculation rules
        grade_calculation = calculation_rules.get("grade_calculation", {
            "A+": 90, "A": 80, "B+": 70, "B": 60, "C+": 50, "C": 40, "D": 30, "F": 0
        })

        grade = "F"
        for grade_name, threshold in sorted(grade_calculation.items(), key=lambda x: x[1], reverse=True):
            if final_percentage >= threshold:
                grade = grade_name
                break

        # Check passing criteria
        passing_criteria = calculation_rules.get("passing_criteria", {"minimum_percentage": 40})
        is_passed = final_percentage >= passing_criteria.get("minimum_percentage", 40)

        results.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "student_roll": student.student_id,
            "basic_percentage": float(basic_percentage),
            "weighted_percentage": float(weighted_percentage),
            "final_percentage": float(final_percentage),
            "grade": grade,
            "is_passed": is_passed,
            "total_obtained": float(total_obtained),
            "total_max": float(total_max),
            "applied_rules": applied_rules,
            "exam_weightage": float(exam.weightage) if exam.weightage else 1.0
        })

    return {
        "exam_id": exam_id,
        "exam_name": exam.name,
        "calculation_rules": calculation_rules,
        "results": results,
        "summary": {
            "total_students": len(results),
            "passed_students": len([r for r in results if r["is_passed"]]),
            "average_percentage": sum(r["final_percentage"] for r in results) / len(results) if results else 0,
            "pass_rate": (len([r for r in results if r["is_passed"]]) / len(results) * 100) if results else 0
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "exams"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)