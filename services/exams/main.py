from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json
from datetime import datetime

from shared.database import get_db
from shared.models import Exam, ExamSection, Question, Subject, User, CO, BloomLevel, DifficultyLevel, AuditLog
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

# Exam endpoints
@app.get("/", response_model=List[ExamResponse])
async def get_exams(
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all exams with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
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
    
    exams = query.offset(skip).limit(limit).all()
    
    return exams

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
    """Create a new question for an exam"""
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
    
    # Check if section exists
    section = db.query(ExamSection).filter(ExamSection.id == question.section_id).first()
    if not section or section.exam_id != exam_id:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Create question
    db_question = Question(
        section_id=question.section_id,
        question_number=question.question_number,
        question_text=question.question_text,
        question_type=question.question_type,
        marks=question.marks,
        co_id=question.co_id,
        bloom_level=question.bloom_level,
        difficulty_level=question.difficulty_level,
        created_by=current_user_id
    )
    
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Question", db_question.id, None, {
        "question_text": question.question_text[:100],
        "section_id": question.section_id
    })
    
    return db_question

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

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "exam"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)