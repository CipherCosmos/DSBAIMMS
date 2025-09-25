from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
import json
import pandas as pd
from datetime import datetime, timedelta
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import Exam, ExamSection, Question, Subject, User, CO, BloomLevel, DifficultyLevel, AuditLog, Class, Department
from shared.auth import RoleChecker
from pydantic import BaseModel

app = FastAPI(title="Exam Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Import schemas from shared module
from shared.schemas import (
    ExamSectionCreate, ExamSectionResponse, ExamCreate, ExamUpdate, ExamResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionCreateEnhanced, QuestionResponseEnhanced
)

# Enhanced schemas for smart exam creation
class SmartExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject_id: int
    class_id: int
    exam_type: str = "internal"
    duration_minutes: int = 180
    exam_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    sections: List[Dict[str, Any]] = []  # Smart section configuration
    auto_generate_questions: bool = False
    question_distribution: Optional[Dict[str, Any]] = None

class ExamTemplate(BaseModel):
    name: str
    description: str
    exam_type: str
    duration_minutes: int
    sections: List[Dict[str, Any]]
    question_distribution: Dict[str, Any]

class BulkExamCreate(BaseModel):
    exams: List[SmartExamCreate]

class ExamAnalytics(BaseModel):
    exam_id: int
    total_students: int
    average_score: float
    pass_rate: float
    section_analysis: Dict[str, Any]
    co_po_analysis: Dict[str, Any]
    bloom_distribution: Dict[str, Any]
    difficulty_analysis: Dict[str, Any]

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None
    )
    db.add(audit_log)
    db.commit()

# Helper functions for smart exam creation
def generate_smart_sections(exam_type: str, total_marks: int, subject_id: int, db: Session) -> List[Dict[str, Any]]:
    """Generate smart exam sections based on exam type and subject"""
    sections = []
    
    if exam_type == "internal":
        # Internal exam: Section A (20%), Section B (40%), Section C (40%)
        sections = [
            {
                "name": "A",
                "instructions": "Answer all questions. Each question carries 2 marks.",
                "total_marks": int(total_marks * 0.2),
                "total_questions": int(total_marks * 0.1),  # 2 marks each
                "questions_to_attempt": int(total_marks * 0.1),
                "question_type": "short_answer"
            },
            {
                "name": "B", 
                "instructions": "Answer any 4 out of 6 questions. Each question carries 10 marks.",
                "total_marks": int(total_marks * 0.4),
                "total_questions": 6,
                "questions_to_attempt": 4,
                "question_type": "long_answer"
            },
            {
                "name": "C",
                "instructions": "Answer any 2 out of 4 questions. Each question carries 20 marks.",
                "total_marks": int(total_marks * 0.4),
                "total_questions": 4,
                "questions_to_attempt": 2,
                "question_type": "essay"
            }
        ]
    elif exam_type == "quiz":
        # Quiz: All questions mandatory
        sections = [
            {
                "name": "Quiz",
                "instructions": "Answer all questions. Each question carries equal marks.",
                "total_marks": total_marks,
                "total_questions": 20,
                "questions_to_attempt": 20,
                "question_type": "mcq"
            }
        ]
    elif exam_type == "assignment":
        # Assignment: Flexible structure
        sections = [
            {
                "name": "Assignment",
                "instructions": "Complete all tasks as specified.",
                "total_marks": total_marks,
                "total_questions": 5,
                "questions_to_attempt": 5,
                "question_type": "practical"
            }
        ]
    
    return sections

def calculate_exam_analytics(exam_id: int, db: Session) -> Dict[str, Any]:
    """Calculate comprehensive exam analytics"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return {}
    
    # Get all questions for this exam
    questions = db.query(Question).join(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    
    # Calculate Bloom's distribution
    bloom_distribution = {}
    for question in questions:
        bloom_level = question.bloom_level or "unknown"
        bloom_distribution[bloom_level] = bloom_distribution.get(bloom_level, 0) + 1
    
    # Calculate difficulty distribution
    difficulty_distribution = {}
    for question in questions:
        difficulty = question.difficulty_level or "unknown"
        difficulty_distribution[difficulty] = difficulty_distribution.get(difficulty, 0) + 1
    
    # Calculate CO/PO analysis
    co_analysis = {}
    for question in questions:
        if question.co_id:
            co = db.query(CO).filter(CO.id == question.co_id).first()
            if co:
                co_name = co.name
                co_analysis[co_name] = co_analysis.get(co_name, 0) + 1
    
    return {
        "bloom_distribution": bloom_distribution,
        "difficulty_distribution": difficulty_distribution,
        "co_analysis": co_analysis,
        "total_questions": len(questions),
        "sections_count": len(exam.sections)
    }

def validate_exam_permissions(user: User, subject_id: int, class_id: int, db: Session) -> bool:
    """Validate if user can create/modify exam for given subject and class"""
    if user.role == "admin":
        return True
    
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        return False
    
    if user.role == "hod":
        return subject.department_id == user.department_id
    
    if user.role == "teacher":
        return subject.teacher_id == user.id
    
    return False

# Exam endpoints
@app.get("/", response_model=List[ExamResponse])
async def get_exams(
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    status: Optional[str] = None,
    exam_type: Optional[str] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get exams with enhanced filtering and role-based access"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    query = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref),
        joinedload(Exam.sections)
    )
    
    # Apply role-based filters
    if current_user.role == "student":
        # Students can only see exams for their class
        query = query.filter(Exam.class_id == current_user.class_id)
    elif current_user.role == "teacher":
        # Teachers can only see exams for subjects they teach
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        # HODs can see exams for their department
        query = query.join(Subject).filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if subject_id:
        query = query.filter(Exam.subject_id == subject_id)
    if class_id:
        query = query.filter(Exam.class_id == class_id)
    if status:
        query = query.filter(Exam.status == status)
    if exam_type:
        query = query.filter(Exam.exam_type == exam_type)
    if department_id:
        query = query.join(Subject).filter(Subject.department_id == department_id)
    if search:
        query = query.filter(
            (Exam.title.ilike(f"%{search}%")) |
            (Exam.description.ilike(f"%{search}%"))
        )
    
    exams = query.offset(skip).limit(limit).all()
    
    # Format response with additional data
    result = []
    for exam in exams:
        exam_data = {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "subject_id": exam.subject_id,
            "class_id": exam.class_id,
            "exam_type": exam.exam_type,
            "status": exam.status,
            "total_marks": exam.total_marks,
            "duration_minutes": exam.duration_minutes,
            "exam_date": exam.exam_date,
            "start_time": exam.start_time,
            "end_time": exam.end_time,
            "created_at": exam.created_at,
            "updated_at": exam.updated_at,
            "subject_name": exam.subject.name if exam.subject else None,
            "class_name": exam.class_ref.name if exam.class_ref else None,
            "sections_count": len(exam.sections) if exam.sections else 0
        }
        result.append(exam_data)
    
    return result

@app.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific exam by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    exam = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref),
        joinedload(Exam.sections)
    ).filter(Exam.id == exam_id).first()
    
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if exam.class_id != current_user.class_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        if exam.subject_id not in teacher_subjects:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return exam

@app.post("/", response_model=ExamResponse)
async def create_exam(
    exam: ExamCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check if subject exists and user has permission
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Create exam
    db_exam = Exam(
        title=exam.title,
        description=exam.description,
        subject_id=exam.subject_id,
        class_id=exam.class_id,
        duration_minutes=exam.duration_minutes,
        total_marks=exam.total_marks,
        status=exam.status,
        start_time=exam.start_time,
        end_time=exam.end_time,
        created_by=current_user_id
    )
    
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Exam", db_exam.id, None, {
        "title": exam.title,
        "subject_id": exam.subject_id,
        "class_id": exam.class_id
    })
    
    return db_exam

@app.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: int,
    exam: ExamUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update an existing exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check permissions
    subject = db.query(Subject).filter(Subject.id == db_exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "title": db_exam.title,
        "description": db_exam.description,
        "status": db_exam.status
    }
    
    # Update exam
    update_data = exam.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_exam, field, value)
    
    db.commit()
    db.refresh(db_exam)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Exam", exam_id, old_values, update_data)
    
    return db_exam

@app.delete("/{exam_id}")
async def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check permissions
    subject = db.query(Subject).filter(Subject.id == db_exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "title": db_exam.title,
        "subject_id": db_exam.subject_id,
        "class_id": db_exam.class_id
    }
    
    db.delete(db_exam)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Exam", exam_id, old_values, None)
    
    return {"message": "Exam deleted successfully"}

# Exam Section endpoints
@app.get("/{exam_id}/sections", response_model=List[ExamSectionResponse])
async def get_exam_sections(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all sections for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check exam access
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if exam.class_id != current_user.class_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        if exam.subject_id not in teacher_subjects:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    return sections

@app.post("/{exam_id}/sections", response_model=ExamSectionResponse)
async def create_exam_section(
    exam_id: int,
    section: ExamSectionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new section for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check exam access
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Create section
    db_section = ExamSection(
        exam_id=exam_id,
        title=section.title,
        description=section.description,
        total_marks=section.total_marks,
        order=section.order
    )
    
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "ExamSection", db_section.id, None, {
        "title": section.title,
        "exam_id": exam_id
    })
    
    return db_section

# Question endpoints
@app.get("/{exam_id}/questions", response_model=List[QuestionResponse])
async def get_exam_questions(
    exam_id: int,
    section_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all questions for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check exam access
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if exam.class_id != current_user.class_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        if exam.subject_id not in teacher_subjects:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Question).join(ExamSection).filter(ExamSection.exam_id == exam_id)
    
    if section_id:
        query = query.filter(Question.section_id == section_id)
    
    questions = query.all()
    return questions

@app.post("/{exam_id}/questions", response_model=QuestionResponse)
async def create_exam_question(
    exam_id: int,
    question: QuestionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new question for an exam with optional question support"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check exam access
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Create question
    db_question = Question(
        exam_id=exam_id,
        section_id=question.section_id,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        correct_answer=question.correct_answer,
        max_marks=question.max_marks,
        bloom_level=question.bloom_level,
        difficulty_level=question.difficulty_level,
        co_id=question.co_id,
        is_optional=question.is_optional,
        parent_question_id=question.parent_question_id,
        order=question.order
    )
    
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Question", db_question.id, None, {
        "question_text": question.question_text[:50] + "...",
        "exam_id": exam_id,
        "is_optional": question.is_optional
    })
    
    return db_question

# Optional Question Auto-Calculation Logic
@app.post("/{exam_id}/calculate-optional-marks")
async def calculate_optional_marks(
    exam_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Calculate marks for optional questions using auto-best-attempt logic"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check exam access
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all sections with optional questions
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    calculation_results = []
    
    for section in sections:
        # Get optional questions for this section
        optional_questions = db.query(Question).filter(
            Question.section_id == section.id,
            Question.is_optional == True
        ).all()
        
        if not optional_questions:
            continue
            
        # Get student's marks for all optional questions in this section
        student_marks = db.query(Mark).filter(
            Mark.student_id == student_id,
            Mark.question_id.in_([q.id for q in optional_questions])
        ).all()
        
        # Group questions by marks value for auto-calculation
        questions_by_marks = {}
        for question in optional_questions:
            marks_value = question.max_marks
            if marks_value not in questions_by_marks:
                questions_by_marks[marks_value] = []
            questions_by_marks[marks_value].append(question)
        
        # Calculate best attempts for each marks group
        for marks_value, questions in questions_by_marks.items():
            # Get marks for this group
            group_marks = [m for m in student_marks if m.question_id in [q.id for q in questions]]
            
            # Sort by marks obtained (descending) to get best attempts
            group_marks.sort(key=lambda x: x.marks_obtained, reverse=True)
            
            # Determine how many questions to count based on section rules
            questions_to_count = section.questions_to_attempt if hasattr(section, 'questions_to_attempt') else len(questions)
            
            # Take the best attempts
            best_attempts = group_marks[:questions_to_count]
            
            # Calculate total marks for this group
            total_marks = sum(mark.marks_obtained for mark in best_attempts)
            
            calculation_results.append({
                "section_id": section.id,
                "section_name": section.title,
                "marks_value": marks_value,
                "total_questions": len(questions),
                "questions_to_count": questions_to_count,
                "best_attempts": len(best_attempts),
                "total_marks": total_marks,
                "max_possible_marks": questions_to_count * marks_value
            })
    
    return {
        "exam_id": exam_id,
        "student_id": student_id,
        "calculation_results": calculation_results,
        "total_optional_marks": sum(result["total_marks"] for result in calculation_results)
    }

@app.get("/{exam_id}/optional-questions-analysis")
async def get_optional_questions_analysis(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get analysis of optional questions performance"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check exam access
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Apply role-based access control
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all optional questions
    optional_questions = db.query(Question).join(ExamSection).filter(
        ExamSection.exam_id == exam_id,
        Question.is_optional == True
    ).all()
    
    analysis_results = []
    
    for question in optional_questions:
        # Get all marks for this question
        marks = db.query(Mark).filter(Mark.question_id == question.id).all()
        
        if marks:
            avg_marks = sum(mark.marks_obtained for mark in marks) / len(marks)
            max_marks = question.max_marks
            avg_percentage = (avg_marks / max_marks * 100) if max_marks > 0 else 0
            
            # Count how many students attempted this question
            attempted_count = len(marks)
            
            # Get total students in the class
            total_students = db.query(User).filter(
                User.class_id == exam.class_id,
                User.role == "student",
                User.is_active == True
            ).count()
            
            analysis_results.append({
                "question_id": question.id,
                "question_text": question.question_text[:100] + "..." if len(question.question_text) > 100 else question.question_text,
                "max_marks": max_marks,
                "avg_marks": round(avg_marks, 2),
                "avg_percentage": round(avg_percentage, 2),
                "attempted_count": attempted_count,
                "total_students": total_students,
                "attempt_rate": round((attempted_count / total_students * 100), 2) if total_students > 0 else 0,
                "difficulty_level": question.difficulty_level.value if question.difficulty_level else "medium",
                "bloom_level": question.bloom_level.value if question.bloom_level else "remember"
            })
    
    return {
        "exam_id": exam_id,
        "total_optional_questions": len(optional_questions),
        "analysis_results": analysis_results
    }

@app.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_exam_question(
    question_id: int,
    question: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update an existing question"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_question = db.query(Question).filter(Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check permissions through exam
    exam = db.query(Exam).join(ExamSection).filter(ExamSection.id == db_question.section_id).first()
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "question_text": db_question.question_text,
        "marks": db_question.marks
    }
    
    # Update question
    update_data = question.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_question, field, value)
    
    db.commit()
    db.refresh(db_question)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Question", question_id, old_values, update_data)
    
    return db_question

@app.delete("/questions/{question_id}")
async def delete_exam_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a question"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_question = db.query(Question).filter(Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check permissions through exam
    exam = db.query(Exam).join(ExamSection).filter(ExamSection.id == db_question.section_id).first()
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "question_text": db_question.question_text,
        "section_id": db_question.section_id
    }
    
    db.delete(db_question)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Question", question_id, old_values, None)
    
    return {"message": "Question deleted successfully"}

# Smart Exam Creation Endpoints
@app.post("/smart-create", response_model=ExamResponse)
async def create_smart_exam(
    exam_data: SmartExamCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create exam with smart section generation and auto-configuration"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate permissions
    if not validate_exam_permissions(current_user, exam_data.subject_id, exam_data.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if subject and class exist
    subject = db.query(Subject).filter(Subject.id == exam_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    class_ref = db.query(Class).filter(Class.id == exam_data.class_id).first()
    if not class_ref:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Generate smart sections if not provided
    sections = exam_data.sections
    if not sections and exam_data.auto_generate_questions:
        sections = generate_smart_sections(
            exam_data.exam_type, 
            exam_data.total_marks if hasattr(exam_data, 'total_marks') else 100, 
            exam_data.subject_id, 
            db
        )
    
    # Calculate total marks from sections if not provided
    total_marks = sum(section.get('total_marks', 0) for section in sections) if sections else 100
    
    # Create exam
    db_exam = Exam(
        title=exam_data.title,
        description=exam_data.description,
        subject_id=exam_data.subject_id,
        class_id=exam_data.class_id,
        exam_type=exam_data.exam_type,
        total_marks=total_marks,
        duration_minutes=exam_data.duration_minutes,
        exam_date=exam_data.exam_date,
        start_time=exam_data.start_time,
        end_time=exam_data.end_time,
        status="draft"
    )
    
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)
    
    # Create sections
    for section_data in sections:
        section = ExamSection(
            exam_id=db_exam.id,
            name=section_data.get('name', 'A'),
            instructions=section_data.get('instructions', ''),
            total_marks=section_data.get('total_marks', 0),
            total_questions=section_data.get('total_questions'),
            questions_to_attempt=section_data.get('questions_to_attempt')
        )
        db.add(section)
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Exam", db_exam.id, None, {
        "title": exam_data.title,
        "subject_id": exam_data.subject_id,
        "class_id": exam_data.class_id,
        "smart_creation": True
    })
    
    return db_exam

@app.post("/bulk-create", response_model=List[ExamResponse])
async def bulk_create_exams(
    bulk_data: BulkExamCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create multiple exams at once"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    created_exams = []
    
    for exam_data in bulk_data.exams:
        # Validate permissions for each exam
        if not validate_exam_permissions(current_user, exam_data.subject_id, exam_data.class_id, db):
            continue  # Skip exams user doesn't have permission for
        
        # Create exam (reuse smart creation logic)
        try:
            exam = await create_smart_exam(exam_data, db, current_user_id)
            created_exams.append(exam)
        except Exception as e:
            # Log error but continue with other exams
            print(f"Error creating exam {exam_data.title}: {str(e)}")
            continue
    
    return created_exams

@app.get("/templates", response_model=List[ExamTemplate])
async def get_exam_templates(
    exam_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get available exam templates"""
    templates = [
        {
            "name": "Internal Exam",
            "description": "Standard internal exam with sections A, B, C",
            "exam_type": "internal",
            "duration_minutes": 180,
            "sections": [
                {
                    "name": "A",
                    "instructions": "Answer all questions. Each question carries 2 marks.",
                    "total_marks": 20,
                    "total_questions": 10,
                    "questions_to_attempt": 10,
                    "question_type": "short_answer"
                },
                {
                    "name": "B",
                    "instructions": "Answer any 4 out of 6 questions. Each question carries 10 marks.",
                    "total_marks": 40,
                    "total_questions": 6,
                    "questions_to_attempt": 4,
                    "question_type": "long_answer"
                },
                {
                    "name": "C",
                    "instructions": "Answer any 2 out of 4 questions. Each question carries 20 marks.",
                    "total_marks": 40,
                    "total_questions": 4,
                    "questions_to_attempt": 2,
                    "question_type": "essay"
                }
            ],
            "question_distribution": {
                "bloom_levels": {"remember": 20, "understand": 30, "apply": 30, "analyze": 20},
                "difficulty": {"easy": 30, "medium": 50, "hard": 20}
            }
        },
        {
            "name": "Quiz",
            "description": "Quick quiz with multiple choice questions",
            "exam_type": "quiz",
            "duration_minutes": 30,
            "sections": [
                {
                    "name": "Quiz",
                    "instructions": "Answer all questions. Each question carries equal marks.",
                    "total_marks": 100,
                    "total_questions": 20,
                    "questions_to_attempt": 20,
                    "question_type": "mcq"
                }
            ],
            "question_distribution": {
                "bloom_levels": {"remember": 40, "understand": 40, "apply": 20},
                "difficulty": {"easy": 50, "medium": 30, "hard": 20}
            }
        },
        {
            "name": "Assignment",
            "description": "Practical assignment with flexible structure",
            "exam_type": "assignment",
            "duration_minutes": 0,  # No time limit
            "sections": [
                {
                    "name": "Assignment",
                    "instructions": "Complete all tasks as specified.",
                    "total_marks": 100,
                    "total_questions": 5,
                    "questions_to_attempt": 5,
                    "question_type": "practical"
                }
            ],
            "question_distribution": {
                "bloom_levels": {"apply": 30, "analyze": 40, "evaluate": 20, "create": 10},
                "difficulty": {"medium": 40, "hard": 60}
            }
        }
    ]
    
    if exam_type:
        templates = [t for t in templates if t["exam_type"] == exam_type]
    
    return templates

@app.get("/{exam_id}/analytics", response_model=ExamAnalytics)
async def get_exam_analytics(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive analytics for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check permissions
    if not validate_exam_permissions(current_user, exam.subject_id, exam.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate analytics
    analytics_data = calculate_exam_analytics(exam_id, db)
    
    # Get student count (placeholder - would need marks table)
    total_students = 0  # This would be calculated from marks table
    average_score = 0.0  # This would be calculated from marks table
    pass_rate = 0.0  # This would be calculated from marks table
    
    return ExamAnalytics(
        exam_id=exam_id,
        total_students=total_students,
        average_score=average_score,
        pass_rate=pass_rate,
        section_analysis=analytics_data,
        co_po_analysis=analytics_data.get("co_analysis", {}),
        bloom_distribution=analytics_data.get("bloom_distribution", {}),
        difficulty_analysis=analytics_data.get("difficulty_distribution", {})
    )

@app.post("/{exam_id}/publish")
async def publish_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Publish an exam (change status from draft to published)"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check permissions
    if not validate_exam_permissions(current_user, exam.subject_id, exam.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update status
    exam.status = "published"
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Exam", exam_id, 
              {"status": "draft"}, {"status": "published"})
    
    return {"message": "Exam published successfully"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "exam"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)