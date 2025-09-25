# Enhanced Exam Service with Optional Questions and Auto-calculation
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc
from typing import List, Optional, Dict, Any
import json
import pandas as pd
from datetime import datetime, timedelta
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import Exam, ExamSection, Question, Subject, User, CO, BloomLevel, DifficultyLevel, AuditLog, Class, Department, Mark
from shared.auth import RoleChecker
from shared.schemas_additional import (
    ExamAnalytics, BulkQuestionsUpload, BulkMarksUpload, BulkUploadResponse
)
from pydantic import BaseModel

app = FastAPI(title="Enhanced Exam Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas for optional questions and auto-calculation
class OptionalQuestionCreate(BaseModel):
    question_text: str
    marks: float
    bloom_level: str
    difficulty_level: str = "medium"
    co_id: int
    parent_question_id: Optional[int] = None
    is_optional: bool = True
    question_number: Optional[str] = None
    order_index: int = 0

class OptionalQuestionResponse(BaseModel):
    id: int
    question_text: str
    marks: float
    bloom_level: str
    difficulty_level: str
    co_id: int
    parent_question_id: Optional[int] = None
    is_optional: bool
    question_number: Optional[str] = None
    order_index: int
    section_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ExamSectionWithOptional(BaseModel):
    id: int
    name: str
    instructions: Optional[str] = None
    total_marks: int
    total_questions: int
    questions_to_attempt: int
    question_type: str
    optional_questions: List[OptionalQuestionResponse] = []
    required_questions: List[OptionalQuestionResponse] = []

class AutoCalculationRequest(BaseModel):
    exam_id: int
    student_id: int
    section_id: int
    attempted_questions: List[int]  # List of question IDs attempted

class AutoCalculationResponse(BaseModel):
    total_marks: float
    obtained_marks: float
    percentage: float
    grade: str
    best_attempts: List[int]
    calculation_details: Dict[str, Any]

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

def calculate_best_attempts(questions: List[Question], attempted_question_ids: List[int], 
                           questions_to_attempt: int) -> List[int]:
    """Calculate best attempts for optional questions"""
    if len(attempted_question_ids) <= questions_to_attempt:
        return attempted_question_ids
    
    # Get attempted questions with their marks
    attempted_questions = [q for q in questions if q.id in attempted_question_ids]
    
    # Sort by marks (descending) and take the best ones
    attempted_questions.sort(key=lambda x: x.marks, reverse=True)
    best_attempts = [q.id for q in attempted_questions[:questions_to_attempt]]
    
    return best_attempts

def calculate_grade(percentage: float) -> str:
    """Calculate grade based on percentage"""
    if percentage >= 90:
        return "A+"
    elif percentage >= 80:
        return "A"
    elif percentage >= 70:
        return "B+"
    elif percentage >= 60:
        return "B"
    elif percentage >= 50:
        return "C+"
    elif percentage >= 40:
        return "C"
    elif percentage >= 30:
        return "D"
    else:
        return "F"

@app.post("/exams/{exam_id}/sections/{section_id}/optional-questions", response_model=OptionalQuestionResponse)
async def create_optional_question(
    exam_id: int,
    section_id: int,
    question: OptionalQuestionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create an optional question for a specific exam section"""
    
    # Verify exam and section exist
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    section = db.query(ExamSection).filter(
        ExamSection.id == section_id,
        ExamSection.exam_id == exam_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Exam section not found")
    
    # Create the optional question
    db_question = Question(
        question_text=question.question_text,
        marks=question.marks,
        bloom_level=question.bloom_level,
        difficulty_level=question.difficulty_level,
        section_id=section_id,
        co_id=question.co_id,
        parent_question_id=question.parent_question_id,
        is_optional=question.is_optional,
        question_number=question.question_number,
        order_index=question.order_index
    )
    
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    
    log_audit(db, current_user_id, "CREATE", "questions", db_question.id, 
              new_values=question.dict())
    
    return db_question

@app.get("/exams/{exam_id}/sections/{section_id}/questions/optional", response_model=List[OptionalQuestionResponse])
async def get_optional_questions(
    exam_id: int,
    section_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all optional questions for a specific exam section"""
    
    # Verify exam and section exist
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    section = db.query(ExamSection).filter(
        ExamSection.id == section_id,
        ExamSection.exam_id == exam_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Exam section not found")
    
    # Get optional questions
    questions = db.query(Question).filter(
        Question.section_id == section_id,
        Question.is_optional == True
    ).order_by(Question.order_index).all()
    
    return questions

@app.post("/exams/{exam_id}/auto-calculation", response_model=AutoCalculationResponse)
async def calculate_exam_marks(
    exam_id: int,
    calculation_request: AutoCalculationRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Calculate exam marks with auto-calculation for optional questions"""
    
    # Get exam and section
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    section = db.query(ExamSection).filter(
        ExamSection.id == calculation_request.section_id,
        ExamSection.exam_id == exam_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Exam section not found")
    
    # Get all questions for the section
    questions = db.query(Question).filter(Question.section_id == calculation_request.section_id).all()
    
    # Calculate best attempts for optional questions
    best_attempts = calculate_best_attempts(
        questions, 
        calculation_request.attempted_questions,
        section.questions_to_attempt
    )
    
    # Calculate marks
    total_marks = sum(q.marks for q in questions if q.id in best_attempts)
    obtained_marks = 0.0  # This would be calculated from actual student answers
    
    # Get existing marks for the student
    existing_marks = db.query(Mark).filter(
        Mark.student_id == calculation_request.student_id,
        Mark.exam_id == exam_id,
        Mark.question_id.in_(best_attempts)
    ).all()
    
    obtained_marks = sum(mark.marks_obtained for mark in existing_marks)
    
    percentage = (obtained_marks / total_marks * 100) if total_marks > 0 else 0
    grade = calculate_grade(percentage)
    
    calculation_details = {
        "total_questions": len(questions),
        "attempted_questions": len(calculation_request.attempted_questions),
        "best_attempts": best_attempts,
        "total_marks": total_marks,
        "obtained_marks": obtained_marks,
        "percentage": percentage,
        "grade": grade
    }
    
    return AutoCalculationResponse(
        total_marks=total_marks,
        obtained_marks=obtained_marks,
        percentage=percentage,
        grade=grade,
        best_attempts=best_attempts,
        calculation_details=calculation_details
    )

@app.get("/exams/{exam_id}/sections/{section_id}/enhanced", response_model=ExamSectionWithOptional)
async def get_enhanced_section(
    exam_id: int,
    section_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get exam section with optional and required questions separated"""
    
    # Get section
    section = db.query(ExamSection).filter(
        ExamSection.id == section_id,
        ExamSection.exam_id == exam_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Exam section not found")
    
    # Get all questions for the section
    questions = db.query(Question).filter(Question.section_id == section_id).all()
    
    # Separate optional and required questions
    optional_questions = [q for q in questions if q.is_optional]
    required_questions = [q for q in questions if not q.is_optional]
    
    return ExamSectionWithOptional(
        id=section.id,
        name=section.name,
        instructions=section.instructions,
        total_marks=section.total_marks,
        total_questions=section.total_questions,
        questions_to_attempt=section.questions_to_attempt,
        question_type="mixed",
        optional_questions=optional_questions,
        required_questions=required_questions
    )

@app.post("/exams/{exam_id}/bulk-questions", response_model=BulkUploadResponse)
async def bulk_upload_questions(
    exam_id: int,
    bulk_data: BulkQuestionsUpload,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk upload questions for an exam"""
    
    # Verify exam exists
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    success_count = 0
    error_count = 0
    errors = []
    
    for question_data in bulk_data.questions_data:
        try:
            # Get section
            section = db.query(ExamSection).filter(
                ExamSection.exam_id == exam_id,
                ExamSection.name == question_data.get("section_name", "A")
            ).first()
            
            if not section:
                error_count += 1
                errors.append({
                    "question": question_data.get("question_text", "")[:50],
                    "error": "Section not found"
                })
                continue
            
            # Create question
            db_question = Question(
                question_text=question_data["question_text"],
                marks=question_data.get("marks", 1.0),
                bloom_level=question_data.get("bloom_level", "remember"),
                difficulty_level=question_data.get("difficulty_level", "medium"),
                section_id=section.id,
                co_id=question_data["co_id"],
                is_optional=question_data.get("is_optional", False),
                question_number=question_data.get("question_number"),
                order_index=question_data.get("order_index", 0)
            )
            
            db.add(db_question)
            db.commit()
            success_count += 1
            
        except Exception as e:
            error_count += 1
            errors.append({
                "question": question_data.get("question_text", "")[:50],
                "error": str(e)
            })
    
    log_audit(db, current_user_id, "BULK_CREATE", "questions", exam_id, 
              new_values={"count": success_count, "errors": error_count})
    
    return BulkUploadResponse(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        message=f"Successfully uploaded {success_count} questions, {error_count} errors"
    )

@app.post("/exams/{exam_id}/bulk-marks", response_model=BulkUploadResponse)
async def bulk_upload_marks(
    exam_id: int,
    bulk_data: BulkMarksUpload,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk upload marks for an exam with auto-calculation"""
    
    # Verify exam exists
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    success_count = 0
    error_count = 0
    errors = []
    
    for marks_data in bulk_data.marks_data:
        try:
            student_id = marks_data["student_id"]
            question_id = marks_data["question_id"]
            marks_obtained = marks_data["marks_obtained"]
            
            # Get or create mark record
            mark = db.query(Mark).filter(
                Mark.student_id == student_id,
                Mark.exam_id == exam_id,
                Mark.question_id == question_id
            ).first()
            
            if not mark:
                # Get question for max marks
                question = db.query(Question).filter(Question.id == question_id).first()
                if not question:
                    error_count += 1
                    errors.append({
                        "student_id": student_id,
                        "question_id": question_id,
                        "error": "Question not found"
                    })
                    continue
                
                mark = Mark(
                    student_id=student_id,
                    exam_id=exam_id,
                    question_id=question_id,
                    marks_obtained=marks_obtained,
                    max_marks=question.marks,
                    graded_by=current_user_id,
                    graded_at=datetime.utcnow()
                )
                db.add(mark)
            else:
                mark.marks_obtained = marks_obtained
                mark.graded_by = current_user_id
                mark.graded_at = datetime.utcnow()
            
            db.commit()
            success_count += 1
            
        except Exception as e:
            error_count += 1
            errors.append({
                "student_id": marks_data.get("student_id", "unknown"),
                "question_id": marks_data.get("question_id", "unknown"),
                "error": str(e)
            })
    
    log_audit(db, current_user_id, "BULK_UPDATE", "marks", exam_id, 
              new_values={"count": success_count, "errors": error_count})
    
    return BulkUploadResponse(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        message=f"Successfully uploaded {success_count} marks, {error_count} errors"
    )

@app.get("/exams/{exam_id}/analytics", response_model=ExamAnalytics)
async def get_exam_analytics(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive analytics for an exam"""
    
    # Get exam
    exam = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref)
    ).filter(Exam.id == exam_id).first()
    
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get all marks for this exam
    marks = db.query(Mark).filter(Mark.exam_id == exam_id).all()
    
    # Calculate analytics
    total_students = len(set(mark.student_id for mark in marks))
    attempted_students = len(set(mark.student_id for mark in marks if mark.marks_obtained > 0))
    
    if marks:
        average_score = sum(mark.marks_obtained for mark in marks) / len(marks)
        pass_rate = len([m for m in marks if m.marks_obtained >= m.max_marks * 0.4]) / len(marks) * 100
    else:
        average_score = 0.0
        pass_rate = 0.0
    
    # Get section analysis
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    section_analysis = {}
    
    for section in sections:
        section_marks = [m for m in marks if m.question_id in [q.id for q in section.questions]]
        if section_marks:
            section_analysis[section.name] = {
                "total_marks": section.total_marks,
                "average_score": sum(m.marks_obtained for m in section_marks) / len(section_marks),
                "pass_rate": len([m for m in section_marks if m.marks_obtained >= m.max_marks * 0.4]) / len(section_marks) * 100
            }
    
    # Get CO/PO analysis
    questions = db.query(Question).filter(Question.section_id.in_([s.id for s in sections])).all()
    co_po_analysis = {}
    
    for question in questions:
        co_id = question.co_id
        if co_id not in co_po_analysis:
            co_po_analysis[co_id] = {
                "co_name": f"CO{co_id}",
                "total_questions": 0,
                "average_score": 0.0
            }
        co_po_analysis[co_id]["total_questions"] += 1
    
    # Get Bloom's distribution
    bloom_distribution = {}
    for question in questions:
        bloom_level = question.bloom_level
        bloom_distribution[bloom_level] = bloom_distribution.get(bloom_level, 0) + 1
    
    # Get difficulty analysis
    difficulty_analysis = {}
    for question in questions:
        difficulty = question.difficulty_level
        difficulty_analysis[difficulty] = difficulty_analysis.get(difficulty, 0) + 1
    
    return ExamAnalytics(
        exam_id=exam_id,
        exam_title=exam.title,
        subject_name=exam.subject.name if exam.subject else "Unknown",
        class_name=exam.class_ref.name if exam.class_ref else "Unknown",
        total_students=total_students,
        attempted_students=attempted_students,
        average_score=average_score,
        pass_rate=pass_rate,
        section_analysis=section_analysis,
        co_po_analysis=co_po_analysis,
        bloom_distribution=bloom_distribution,
        difficulty_analysis=difficulty_analysis
    )

@app.get("/")
async def root():
    return {"message": "Enhanced Exam Service is running", "version": "2.0.0"}
