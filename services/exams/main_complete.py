from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json
from datetime import datetime,

from shared.database import get_db
from shared.models import Exam, ExamSection, Question, Subject, User, UserRole, CO, BloomLevel, DifficultyLevel, AuditLog
from shared.auth import RoleChecker
from pydantic import BaseModel,

app = FastAPI(title="Exam Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import schemas from shared module
from shared.schemas import (
    ExamSectionCreate, ExamCreate, ExamUpdate, ExamResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionCreateEnhanced, QuestionResponseEnhanced
)

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int    = None ,
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
    subject_id: Optional[int]     = None,
    class_id: Optional[int]     = None,
    status: Optional[str]     = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref),
        joinedload(Exam.sections)
    )
    
    # Apply role-based filters,
    if current_user.role == UserRole.HOD:
        # HOD can see exams in their department,
        query = query.join(Subject).filter(Subject.department_id == current_user.department_id)
    elif current_user.role == UserRole.TEACHER:
        # Teacher can only see exams for subjects they teach,
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == UserRole.STUDENT:
        # Student can see exams for their class,
        query = query.filter(Exam.class_id == current_user.class_id)
    
    # Apply additional filters,
    if subject_id:
        query = query.filter(Exam.subject_id == subject_id)
    if class_id:
        query = query.filter(Exam.class_id == class_id)
    if status:
        query = query.filter(Exam.status == status)
    
    exams = query.offset(skip).limit(limit).all()
    
    result = []
    for exam in exams:
        result.append(ExamResponse(
            id=exam.id,
            title=exam.title,
            description=exam.description,
            subject_id=exam.subject_id,
            class_id=exam.class_id,
            exam_type=exam.exam_type.value,
            status=exam.status.value,
            total_marks=exam.total_marks,
            duration_minutes=exam.duration_minutes,
            exam_date=exam.exam_date,
            subject_name=exam.subject.name,
            class_name=exam.class_ref.name,
            sections_count=len(exam.sections)
        ))
    
    return result

@app.post("/", response_model=ExamResponse)
async def create_exam(
    exam_data: ExamCreate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check if teacher can create exam for this subject,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == exam_data.subject_id).first()
        if not subject or subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only create exams for your assigned subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == exam_data.subject_id).first()
        if not subject or subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create exams in your department")
    
    # Create exam,
    new_exam = Exam(
        title=exam_data.title,
        description=exam_data.description,
        subject_id=exam_data.subject_id,
        class_id=exam_data.class_id,
        exam_type=exam_data.exam_type,
        total_marks=exam_data.total_marks,
        duration_minutes=exam_data.duration_minutes,
        exam_date=exam_data.exam_date
    )
    
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)
    
    # Create sections,
    for section_data in exam_data.sections:
        new_section = ExamSection(
            exam_id=new_exam.id,
            name=section_data.name,
            instructions=section_data.instructions,
            total_marks=section_data.total_marks,
            total_questions=section_data.total_questions,
            questions_to_attempt=section_data.questions_to_attempt
        )
        db.add(new_section)
    
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "CREATE", "exams", new_exam.id, new_values=exam_data.dict())
    
    # Get exam with related data,
    new_exam = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref),
        joinedload(Exam.sections)
    ).filter(Exam.id == new_exam.id).first()
    
    return ExamResponse(
        id=new_exam.id,
        title=new_exam.title,
        description=new_exam.description,
        subject_id=new_exam.subject_id,
        class_id=new_exam.class_id,
        exam_type=new_exam.exam_type.value,
        status=new_exam.status.value,
        total_marks=new_exam.total_marks,
        duration_minutes=new_exam.duration_minutes,
        exam_date=new_exam.exam_date,
        subject_name=new_exam.subject.name,
        class_name=new_exam.class_ref.name,
        sections_count=len(new_exam.sections)
    )

@app.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: int,
    exam_data: ExamUpdate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only update exams for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only update exams in your department")
    
    # Store old values for audit,
    old_values = {
        "title": exam.title,
        "description": exam.description,
        "exam_type": exam.exam_type.value,
        "total_marks": exam.total_marks,
        "duration_minutes": exam.duration_minutes,
        "exam_date": exam.exam_date
    }
    
    update_data = exam_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exam, field, value)
    
    db.commit()
    db.refresh(exam)
    
    # Log audit,
    log_audit(db, current_user_id, "UPDATE", "exams", exam_id, old_values, update_data)
    
    # Get exam with related data,
    exam = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref),
        joinedload(Exam.sections)
    ).filter(Exam.id == exam_id).first()
    
    return ExamResponse(
        id=exam.id,
        title=exam.title,
        description=exam.description,
        subject_id=exam.subject_id,
        class_id=exam.class_id,
        exam_type=exam.exam_type.value,
        status=exam.status.value,
        total_marks=exam.total_marks,
        duration_minutes=exam.duration_minutes,
        exam_date=exam.exam_date,
        subject_name=exam.subject.name,
        class_name=exam.class_ref.name,
        sections_count=len(exam.sections)
    )

@app.delete("/{exam_id}")
async def delete_exam(
    exam_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only delete exams for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only delete exams in your department")
    
    # Soft delete or cascade; here direct delete assuming no marks/questions constraints,
    db.delete(exam)
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "DELETE", "exams", exam_id)
    
    return {"message": "Exam deleted successfully"}

@app.put("/{exam_id}/publish")
async def publish_exam(
    exam_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Permission check,
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    from shared.models import ExamStatus,
    exam.status = ExamStatus.PUBLISHED,
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "UPDATE", "exams", exam_id, {"status": "draft"}, {"status": "published"})
    
    return {"message": "Exam published successfully"}

# Question endpoints
@app.get("/questions", response_model=List[QuestionResponse])
async def get_questions(
    exam_id: Optional[int]     = None,
    section_id: Optional[int]     = None,
    co_id: Optional[int]     = None,
    bloom_level: Optional[BloomLevel]     = None,
    difficulty_level: Optional[DifficultyLevel]     = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Question).options(
        joinedload(Question.co),
        joinedload(Question.section),
        joinedload(Question.sub_questions)
    )
    
    # Apply role-based filters,
    if current_user.role == UserRole.TEACHER:
        # Teacher can see questions for exams they created,
        teacher_exams = db.query(Exam.id).join(Subject).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.join(ExamSection).filter(ExamSection.exam_id.in_(teacher_exams))
    elif current_user.role == UserRole.HOD:
        # HOD can see questions in their department,
        dept_exams = db.query(Exam.id).join(Subject).filter(Subject.department_id == current_user.department_id).subquery()
        query = query.join(ExamSection).filter(ExamSection.exam_id.in_(dept_exams))
    elif current_user.role == UserRole.STUDENT:
        # Student can see published questions for their class,
        student_exams = db.query(Exam.id).filter(
            Exam.class_id == current_user.class_id,
            Exam.status == "published"
        ).subquery()
        query = query.join(ExamSection).filter(ExamSection.exam_id.in_(student_exams))
    
    # Apply filters,
    if exam_id:
        query = query.join(ExamSection).filter(ExamSection.exam_id == exam_id)
    if section_id:
        query = query.filter(Question.section_id == section_id)
    if co_id:
        query = query.filter(Question.co_id == co_id)
    if bloom_level:
        query = query.filter(Question.bloom_level == bloom_level)
    if difficulty_level:
        query = query.filter(Question.difficulty_level == difficulty_level)
    
    questions = query.offset(skip).limit(limit).all()
    
    result = []
    for question in questions:
        result.append(QuestionResponse(
            id=question.id,
            question_text=question.question_text,
            marks=float(question.marks),
            bloom_level=question.bloom_level.value,
            difficulty_level=question.difficulty_level.value,
            section_id=question.section_id,
            co_id=question.co_id,
            parent_question_id=question.parent_question_id,
            question_number=question.question_number,
            order_index=question.order_index,
            co_name=question.co.name,
            section_name=question.section.name,
            sub_questions_count=len(question.sub_questions) if question.sub_questions else 0
        ))
    
    return result

@app.post("/questions", response_model=QuestionResponse)
async def create_question(
    question_data: QuestionCreate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get section and exam to check permissions,
    section = db.query(ExamSection).options(joinedload(ExamSection.exam)).filter(
        ExamSection.id == question_data.section_id
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only create questions for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Create question,
    new_question = Question(**question_data.dict())
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    
    # Log audit,
    log_audit(db, current_user_id, "CREATE", "questions", new_question.id, new_values=question_data.dict())
    
    # Get question with related data,
    new_question = db.query(Question).options(
        joinedload(Question.co),
        joinedload(Question.section),
        joinedload(Question.sub_questions)
    ).filter(Question.id == new_question.id).first()
    
    return QuestionResponse(
        id=new_question.id,
        question_text=new_question.question_text,
        marks=float(new_question.marks),
        bloom_level=new_question.bloom_level.value,
        difficulty_level=new_question.difficulty_level.value,
        section_id=new_question.section_id,
        co_id=new_question.co_id,
        parent_question_id=new_question.parent_question_id,
        question_number=new_question.question_number,
        order_index=new_question.order_index,
        co_name=new_question.co.name,
        section_name=new_question.section.name,
        sub_questions_count=len(new_question.sub_questions) if new_question.sub_questions else 0
    )

@app.post("/questions/enhanced", response_model=QuestionResponse)
async def create_enhanced_question(
    question_data: QuestionCreateEnhanced,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    """Create enhanced question with sub-questions support"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get section and exam to check permissions,
    section = db.query(ExamSection).options(joinedload(ExamSection.exam)).filter(
        ExamSection.id == question_data.section_id
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only create questions for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Create main question,
    main_question_data = question_data.dict(exclude={'sub_questions'})
    new_question = Question(**main_question_data)
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    
    # Create sub-questions if provided,
    if question_data.sub_questions:
        for sub_q in question_data.sub_questions:
            sub_question = Question(
                question_text=sub_q.sub_question_text,
                marks=sub_q.sub_question_marks,
                bloom_level=question_data.bloom_level,
                difficulty_level=question_data.difficulty_level,
                section_id=question_data.section_id,
                co_id=question_data.co_id,
                parent_question_id=new_question.id,
                is_sub_question=True,
                question_number=f"{question_data.question_number or ''}a",
                order_index=0
            )
            db.add(sub_question)
    
    db.commit()
    
    # Log audit,
    log_audit(db, current_user_id, "CREATE_ENHANCED", "questions", new_question.id, 
             new_values=question_data.dict())
    
    # Get question with related data,
    new_question = db.query(Question).options(
        joinedload(Question.co),
        joinedload(Question.section),
        joinedload(Question.sub_questions)
    ).filter(Question.id == new_question.id).first()
    
    return QuestionResponse(
        id=new_question.id,
        question_text=new_question.question_text,
        marks=float(new_question.marks),
        bloom_level=new_question.bloom_level.value,
        difficulty_level=new_question.difficulty_level.value,
        section_id=new_question.section_id,
        co_id=new_question.co_id,
        parent_question_id=new_question.parent_question_id,
        question_number=new_question.question_number,
        order_index=new_question.order_index,
        co_name=new_question.co.name,
        section_name=new_question.section.name,
        sub_questions_count=len(new_question.sub_questions) if new_question.sub_questions else 0
    )

@app.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: int,
    question_data: QuestionUpdate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get section and exam to check permissions,
    section = db.query(ExamSection).options(joinedload(ExamSection.exam)).filter(
        ExamSection.id == question.section_id
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only update questions for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit,
    old_values = {
        "question_text": question.question_text,
        "marks": float(question.marks),
        "bloom_level": question.bloom_level.value,
        "difficulty_level": question.difficulty_level.value,
        "co_id": question.co_id
    }
    
    update_data = question_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)
    
    db.commit()
    db.refresh(question)
    
    # Log audit,
    log_audit(db, current_user_id, "UPDATE", "questions", question_id, old_values, update_data)
    
    # Get question with related data,
    question = db.query(Question).options(
        joinedload(Question.co),
        joinedload(Question.section),
        joinedload(Question.sub_questions)
    ).filter(Question.id == question_id).first()
    
    return QuestionResponse(
        id=question.id,
        question_text=question.question_text,
        marks=float(question.marks),
        bloom_level=question.bloom_level.value,
        difficulty_level=question.difficulty_level.value,
        section_id=question.section_id,
        co_id=question.co_id,
        parent_question_id=question.parent_question_id,
        question_number=question.question_number,
        order_index=question.order_index,
        co_name=question.co.name,
        section_name=question.section.name,
        sub_questions_count=len(question.sub_questions) if question.sub_questions else 0
    )

@app.delete("/questions/{question_id}")
async def delete_question(
    question_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get section and exam to check permissions,
    section = db.query(ExamSection).options(joinedload(ExamSection.exam)).filter(
        ExamSection.id == question.section_id
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only delete questions for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Log audit,
    log_audit(db, current_user_id, "DELETE", "questions", question_id, 
              {"question_text": question.question_text, "marks": float(question.marks)}, None)
    
    db.delete(question)
    db.commit()
    
    return {"message": "Question deleted successfully"}

# Exam Section endpoints
@app.post("/sections", response_model=ExamSectionResponse)
async def create_exam_section(
    section_data: ExamSectionCreate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    """Create a new exam section"""
    # Verify exam exists and user has permission,
    exam = db.query(Exam).options(joinedload(Exam.subject)).filter(Exam.id == section_data.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Permission check,
    if current_user.role == UserRole.TEACHER and exam.subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Can only create sections for your subjects")
    elif current_user.role == UserRole.HOD and exam.subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create section,
    new_section = ExamSection(
        exam_id=section_data.exam_id,
        name=section_data.name,
        instructions=section_data.instructions,
        total_marks=section_data.total_marks,
        total_questions=section_data.total_questions,
        questions_to_attempt=section_data.questions_to_attempt
    )
    
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    
    # Log audit,
    log_audit(db, current_user_id, "CREATE", "exam_sections", new_section.id, 
              None, {"name": new_section.name, "exam_id": new_section.exam_id})
    
    return ExamSectionResponse(
        id=new_section.id,
        exam_id=new_section.exam_id,
        name=new_section.name,
        instructions=new_section.instructions,
        total_marks=new_section.total_marks,
        total_questions=new_section.total_questions,
        questions_to_attempt=new_section.questions_to_attempt,
        created_at=new_section.created_at
    )

@app.get("/sections", response_model=List[ExamSectionResponse])
async def get_exam_sections(
    exam_id: Optional[int]     = None,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get exam sections"""
    query = db.query(ExamSection)
    
    if exam_id:
        query = query.filter(ExamSection.exam_id == exam_id)
    
    sections = query.all()
    
    return [
        ExamSectionResponse(
            id=section.id,
            exam_id=section.exam_id,
            name=section.name,
            instructions=section.instructions,
            total_marks=section.total_marks,
            total_questions=section.total_questions,
            questions_to_attempt=section.questions_to_attempt,
            created_at=section.created_at
        )
        for section in sections
    ]

@app.put("/sections/{section_id}", response_model=ExamSectionResponse)
async def update_exam_section(
    section_id: int,
    section_data: ExamSectionCreate,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    """Update an exam section"""
    section = db.query(ExamSection).options(joinedload(ExamSection.exam)).filter(
        ExamSection.id == section_id
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if not subject or subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only update sections for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if not subject or subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit,
    old_values = {
        "name": section.name,
        "instructions": section.instructions,
        "total_marks": section.total_marks,
        "total_questions": section.total_questions,
        "questions_to_attempt": section.questions_to_attempt
    }
    
    # Update section,
    section.name = section_data.name,
    section.instructions = section_data.instructions,
    section.total_marks = section_data.total_marks,
    section.total_questions = section_data.total_questions,
    section.questions_to_attempt = section_data.questions_to_attempt,
    
    db.commit()
    db.refresh(section)
    
    # Log audit,
    new_values = {
        "name": section.name,
        "instructions": section.instructions,
        "total_marks": section.total_marks,
        "total_questions": section.total_questions,
        "questions_to_attempt": section.questions_to_attempt
    }
    log_audit(db, current_user_id, "UPDATE", "exam_sections", section.id, old_values, new_values)
    
    return ExamSectionResponse(
        id=section.id,
        exam_id=section.exam_id,
        name=section.name,
        instructions=section.instructions,
        total_marks=section.total_marks,
        total_questions=section.total_questions,
        questions_to_attempt=section.questions_to_attempt,
        created_at=section.created_at
    )

@app.delete("/sections/{section_id}")
async def delete_exam_section(
    section_id: int,
    db: Session    = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["teacher", "hod"]))
):
    """Delete an exam section"""
    section = db.query(ExamSection).options(joinedload(ExamSection.exam)).filter(
        ExamSection.id == section_id
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Permission check,
    if current_user.role == UserRole.TEACHER:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if not subject or subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Can only delete sections for your subjects")
    elif current_user.role == UserRole.HOD:
        subject = db.query(Subject).filter(Subject.id == section.exam.subject_id).first()
        if not subject or subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if section has questions,
    questions_count = db.query(Question).filter(Question.section_id == section_id).count()
    if questions_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete section with existing questions")
    
    # Log audit,
    log_audit(db, current_user_id, "DELETE", "exam_sections", section.id, 
              {"name": section.name, "exam_id": section.exam_id}, None)
    
    db.delete(section)
    db.commit()
    
    return {"message": "Section deleted successfully"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "exams"}
