from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc
from typing import List, Optional, Dict, Any
import json
import pandas as pd
from io import BytesIO, StringIO
from datetime import datetime, timedelta
import uuid

from shared.database import get_db
from shared.models import (
    Exam, ExamSection, Question, Mark, User, Subject, Class, CO, PO, 
    COPOMapping, AuditLog, QuestionAttempt, ExamAnalytics
)
from shared.auth import RoleChecker
from shared.schemas import (
    ExamCreate, ExamUpdate, ExamResponse, ExamSectionCreate, ExamSectionResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, MarkCreate, MarkUpdate, MarkResponse,
    ExamAnalyticsResponse, QuestionAttemptCreate, QuestionAttemptResponse,
    SmartMarksCalculation, BulkQuestionUpload, BulkMarksUpload, BulkOperationResult
)

app = FastAPI(title="Enhanced Exam Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
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

def calculate_smart_marks(exam_id: int, student_id: int, section_id: int, db: Session) -> Dict[str, Any]:
    """Calculate smart marks for optional questions (best attempt selection)"""
    section = db.query(ExamSection).filter(ExamSection.id == section_id).first()
    if not section:
        return {"error": "Section not found"}
    
    # Get all questions in the section
    questions = db.query(Question).filter(Question.section_id == section_id).all()
    
    # Separate mandatory and optional questions
    mandatory_questions = [q for q in questions if not q.is_optional]
    optional_questions = [q for q in questions if q.is_optional]
    
    # Get student's attempts for all questions
    attempts = db.query(QuestionAttempt).filter(
        QuestionAttempt.student_id == student_id,
        QuestionAttempt.question_id.in_([q.id for q in questions])
    ).all()
    
    # Calculate marks for mandatory questions
    mandatory_marks = 0
    for question in mandatory_questions:
        best_attempt = db.query(QuestionAttempt).filter(
            QuestionAttempt.student_id == student_id,
            QuestionAttempt.question_id == question.id,
            QuestionAttempt.is_best_attempt == True
        ).first()
        
        if best_attempt:
            mandatory_marks += best_attempt.marks_obtained
    
    # Calculate marks for optional questions (best attempts only)
    optional_marks = 0
    if optional_questions and section.questions_to_attempt:
        # Get best attempts for optional questions
        optional_attempts = []
        for question in optional_questions:
            best_attempt = db.query(QuestionAttempt).filter(
                QuestionAttempt.student_id == student_id,
                QuestionAttempt.question_id == question.id,
                QuestionAttempt.is_best_attempt == True
            ).first()
            
            if best_attempt:
                optional_attempts.append({
                    'question_id': question.id,
                    'marks': best_attempt.marks_obtained,
                    'max_marks': best_attempt.max_marks
                })
        
        # Sort by marks (descending) and take best attempts
        optional_attempts.sort(key=lambda x: x['marks'], reverse=True)
        selected_attempts = optional_attempts[:section.questions_to_attempt]
        
        optional_marks = sum(attempt['marks'] for attempt in selected_attempts)
    
    total_marks = mandatory_marks + optional_marks
    max_possible = sum(q.marks for q in mandatory_questions)
    
    if section.questions_to_attempt and optional_questions:
        # Calculate max possible for optional questions
        optional_max = sum(q.marks for q in optional_questions[:section.questions_to_attempt])
        max_possible += optional_max
    
    percentage = (total_marks / max_possible * 100) if max_possible > 0 else 0
    
    return {
        "mandatory_marks": mandatory_marks,
        "optional_marks": optional_marks,
        "total_marks": total_marks,
        "max_possible": max_possible,
        "percentage": percentage,
        "section_id": section_id,
        "questions_attempted": len(mandatory_questions) + min(len(optional_questions), section.questions_to_attempt or 0)
    }

def calculate_co_po_attainment(exam_id: int, student_id: int, db: Session) -> Dict[str, Any]:
    """Calculate CO/PO attainment for a student in an exam"""
    # Get all marks for the student in this exam
    marks = db.query(Mark).filter(
        Mark.student_id == student_id,
        Mark.exam_id == exam_id,
        Mark.is_best_attempt == True
    ).all()
    
    co_attainment = {}
    po_attainment = {}
    
    for mark in marks:
        question = db.query(Question).filter(Question.id == mark.question_id).first()
        if not question:
            continue
        
        # Calculate CO contribution
        co_contribution = (mark.marks_obtained / mark.max_marks) * question.co_weight
        if question.co_id not in co_attainment:
            co_attainment[question.co_id] = {
                'total_marks': 0,
                'obtained_marks': 0,
                'weighted_contribution': 0
            }
        
        co_attainment[question.co_id]['total_marks'] += mark.max_marks
        co_attainment[question.co_id]['obtained_marks'] += mark.marks_obtained
        co_attainment[question.co_id]['weighted_contribution'] += co_contribution
        
        # Get PO mapping for this CO
        po_mappings = db.query(COPOMapping).filter(COPOMapping.co_id == question.co_id).all()
        for mapping in po_mappings:
            po_contribution = co_contribution * mapping.mapping_strength / 3.0  # Normalize to 0-1
            
            if mapping.po_id not in po_attainment:
                po_attainment[mapping.po_id] = {
                    'total_contribution': 0,
                    'mappings_count': 0
                }
            
            po_attainment[mapping.po_id]['total_contribution'] += po_contribution
            po_attainment[mapping.po_id]['mappings_count'] += 1
    
    # Calculate final attainment percentages
    for co_id, data in co_attainment.items():
        data['attainment_percentage'] = (data['obtained_marks'] / data['total_marks'] * 100) if data['total_marks'] > 0 else 0
        data['weighted_attainment'] = data['weighted_contribution'] * 100
    
    for po_id, data in po_attainment.items():
        data['attainment_percentage'] = (data['total_contribution'] / data['mappings_count'] * 100) if data['mappings_count'] > 0 else 0
    
    return {
        'co_attainment': co_attainment,
        'po_attainment': po_attainment
    }

def generate_exam_analytics(exam_id: int, db: Session) -> Dict[str, Any]:
    """Generate comprehensive analytics for an exam"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return {}
    
    # Get all students who attempted this exam
    students = db.query(User).join(Mark).filter(
        Mark.exam_id == exam_id,
        User.role == "student"
    ).distinct().all()
    
    # Get all questions in this exam
    questions = db.query(Question).join(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    
    # Calculate section-wise analysis
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    section_analysis = {}
    
    for section in sections:
        section_questions = [q for q in questions if q.section_id == section.id]
        section_marks = db.query(Mark).join(Question).filter(
            Question.section_id == section.id,
            Mark.exam_id == exam_id,
            Mark.is_best_attempt == True
        ).all()
        
        if section_marks:
            avg_marks = sum(m.marks_obtained for m in section_marks) / len(section_marks)
            max_marks = sum(m.max_marks for m in section_marks) / len(section_marks)
            percentage = (avg_marks / max_marks * 100) if max_marks > 0 else 0
        else:
            avg_marks = max_marks = percentage = 0
        
        section_analysis[section.name] = {
            'total_questions': len(section_questions),
            'optional_questions': len([q for q in section_questions if q.is_optional]),
            'mandatory_questions': len([q for q in section_questions if not q.is_optional]),
            'questions_to_attempt': section.questions_to_attempt,
            'average_marks': round(avg_marks, 2),
            'max_marks': round(max_marks, 2),
            'percentage': round(percentage, 2)
        }
    
    # Calculate Bloom's taxonomy distribution
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
    po_analysis = {}
    
    for question in questions:
        # CO analysis
        if question.co_id not in co_analysis:
            co_analysis[question.co_id] = {
                'question_count': 0,
                'total_marks': 0,
                'co_name': question.co.name if question.co else "Unknown"
            }
        
        co_analysis[question.co_id]['question_count'] += 1
        co_analysis[question.co_id]['total_marks'] += float(question.marks)
        
        # PO analysis through CO mapping
        po_mappings = db.query(COPOMapping).filter(COPOMapping.co_id == question.co_id).all()
        for mapping in po_mappings:
            if mapping.po_id not in po_analysis:
                po_analysis[mapping.po_id] = {
                    'co_count': 0,
                    'total_marks': 0,
                    'po_name': mapping.po.name if mapping.po else "Unknown"
                }
            
            po_analysis[mapping.po_id]['co_count'] += 1
            po_analysis[mapping.po_id]['total_marks'] += float(question.marks)
    
    # Calculate class-wise performance
    class_wise_performance = []
    if exam.class_ref:
        class_students = [s for s in students if s.class_id == exam.class_id]
        if class_students:
            class_marks = db.query(Mark).filter(
                Mark.exam_id == exam_id,
                Mark.student_id.in_([s.id for s in class_students]),
                Mark.is_best_attempt == True
            ).all()
            
            if class_marks:
                total_marks = sum(m.marks_obtained for m in class_marks)
                max_total = sum(m.max_marks for m in class_marks)
                avg_percentage = (total_marks / max_total * 100) if max_total > 0 else 0
                
                class_wise_performance.append({
                    'class_id': exam.class_id,
                    'class_name': exam.class_ref.name,
                    'student_count': len(class_students),
                    'average_percentage': round(avg_percentage, 2),
                    'total_marks': round(total_marks, 2),
                    'max_marks': round(max_total, 2)
                })
    
    # Calculate individual student performance
    individual_performance = []
    for student in students:
        student_marks = db.query(Mark).filter(
            Mark.student_id == student.id,
            Mark.exam_id == exam_id,
            Mark.is_best_attempt == True
        ).all()
        
        if student_marks:
            total_marks = sum(m.marks_obtained for m in student_marks)
            max_total = sum(m.max_marks for m in student_marks)
            percentage = (total_marks / max_total * 100) if max_total > 0 else 0
            
            individual_performance.append({
                'student_id': student.id,
                'student_name': student.full_name or student.username,
                'student_id_number': student.student_id,
                'total_marks': round(total_marks, 2),
                'max_marks': round(max_total, 2),
                'percentage': round(percentage, 2),
                'rank': 0  # Will be calculated after sorting
            })
    
    # Sort and rank students
    individual_performance.sort(key=lambda x: x['percentage'], reverse=True)
    for i, student in enumerate(individual_performance):
        student['rank'] = i + 1
    
    # Calculate overall statistics
    all_marks = db.query(Mark).filter(
        Mark.exam_id == exam_id,
        Mark.is_best_attempt == True
    ).all()
    
    if all_marks:
        total_marks = sum(m.marks_obtained for m in all_marks)
        max_total = sum(m.max_marks for m in all_marks)
        average_score = (total_marks / max_total * 100) if max_total > 0 else 0
        
        # Calculate pass rate (assuming 40% is passing)
        passing_students = 0
        for student in students:
            student_marks = db.query(Mark).filter(
                Mark.student_id == student.id,
                Mark.exam_id == exam_id,
                Mark.is_best_attempt == True
            ).all()
            
            if student_marks:
                student_total = sum(m.marks_obtained for m in student_marks)
                student_max = sum(m.max_marks for m in student_marks)
                student_percentage = (student_total / student_max * 100) if student_max > 0 else 0
                
                if student_percentage >= 40:
                    passing_students += 1
        
        pass_rate = (passing_students / len(students) * 100) if students else 0
    else:
        average_score = pass_rate = 0
    
    return {
        'exam_id': exam_id,
        'exam_title': exam.title,
        'total_students': len(students),
        'average_score': round(average_score, 2),
        'pass_rate': round(pass_rate, 2),
        'section_analysis': section_analysis,
        'co_po_analysis': {
            'co_analysis': co_analysis,
            'po_analysis': po_analysis
        },
        'bloom_distribution': bloom_distribution,
        'difficulty_analysis': difficulty_distribution,
        'class_wise_performance': class_wise_performance,
        'individual_performance': individual_performance
    }

# Enhanced Exam Endpoints
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

@app.post("/", response_model=ExamResponse)
async def create_exam(
    exam: ExamCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new exam with enhanced structure"""
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
    
    # Create sections
    for section_data in exam.sections:
        section = ExamSection(
            exam_id=db_exam.id,
            name=section_data.name,
            instructions=section_data.instructions,
            total_marks=section_data.total_marks,
            total_questions=section_data.total_questions,
            questions_to_attempt=section_data.questions_to_attempt,
            section_type=section_data.section_type,
            optional_questions=section_data.optional_questions,
            mandatory_questions=section_data.mandatory_questions,
            question_marks=section_data.question_marks,
            is_optional_section=section_data.is_optional_section
        )
        db.add(section)
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Exam", db_exam.id, None, {
        "title": exam.title,
        "subject_id": exam.subject_id,
        "class_id": exam.class_id
    })
    
    return db_exam

@app.get("/{exam_id}/analytics", response_model=ExamAnalyticsResponse)
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
    
    # Generate analytics
    analytics_data = generate_exam_analytics(exam_id, db)
    
    return ExamAnalyticsResponse(**analytics_data)

@app.post("/{exam_id}/smart-marks", response_model=Dict[str, Any])
async def calculate_smart_marks(
    exam_id: int,
    calculation_data: SmartMarksCalculation,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Calculate smart marks for optional questions with best attempt selection"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if not validate_exam_permissions(current_user, exam.subject_id, exam.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate smart marks
    result = calculate_smart_marks(exam_id, calculation_data.student_id, calculation_data.section_id, db)
    
    return result

@app.post("/{exam_id}/bulk-questions", response_model=BulkOperationResult)
async def bulk_create_questions(
    exam_id: int,
    bulk_data: BulkQuestionUpload,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create multiple questions in bulk for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if not validate_exam_permissions(current_user, exam.subject_id, exam.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    created_questions = []
    errors = []
    
    for i, question_data in enumerate(bulk_data.questions):
        try:
            # Create question
            db_question = Question(
                section_id=bulk_data.section_id,
                question_text=question_data.question_text,
                marks=question_data.marks,
                bloom_level=question_data.bloom_level,
                difficulty_level=question_data.difficulty_level,
                co_id=question_data.co_id,
                parent_question_id=question_data.parent_question_id,
                question_number=question_data.question_number,
                order_index=question_data.order_index,
                is_optional=question_data.is_optional,
                is_sub_question=question_data.is_sub_question,
                sub_question_text=question_data.sub_question_text,
                sub_question_marks=question_data.sub_question_marks,
                co_weight=question_data.co_weight,
                po_auto_mapped=question_data.po_auto_mapped,
                created_by=current_user_id
            )
            
            db.add(db_question)
            created_questions.append(db_question)
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    
    if created_questions:
        db.commit()
        
        # Log audit
        log_audit(db, current_user_id, "BULK_CREATE", "Question", None, None, {
            "count": len(created_questions),
            "exam_id": exam_id,
            "section_id": bulk_data.section_id
        })
    
    return BulkOperationResult(
        success=len(errors) == 0,
        processed_count=len(created_questions),
        error_count=len(errors),
        errors=errors,
        created_ids=[q.id for q in created_questions]
    )

@app.post("/{exam_id}/bulk-marks", response_model=BulkOperationResult)
async def bulk_create_marks(
    exam_id: int,
    bulk_data: BulkMarksUpload,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create multiple marks in bulk for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if not validate_exam_permissions(current_user, exam.subject_id, exam.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    created_marks = []
    errors = []
    
    for i, mark_data in enumerate(bulk_data.marks_data):
        try:
            # Check if question exists and belongs to this exam
            question = db.query(Question).join(ExamSection).filter(
                Question.id == mark_data.question_id,
                ExamSection.exam_id == exam_id
            ).first()
            
            if not question:
                errors.append(f"Row {i+1}: Question not found or doesn't belong to this exam")
                continue
            
            # Create mark
            db_mark = Mark(
                student_id=mark_data.student_id,
                exam_id=exam_id,
                question_id=mark_data.question_id,
                marks_obtained=mark_data.marks_obtained,
                max_marks=mark_data.max_marks,
                remarks=mark_data.remarks,
                is_attempted=mark_data.is_attempted,
                attempt_number=mark_data.attempt_number,
                is_best_attempt=mark_data.is_best_attempt,
                graded_by=current_user_id
            )
            
            db.add(db_mark)
            created_marks.append(db_mark)
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    
    if created_marks:
        db.commit()
        
        # Log audit
        log_audit(db, current_user_id, "BULK_CREATE", "Mark", None, None, {
            "count": len(created_marks),
            "exam_id": exam_id
        })
    
    return BulkOperationResult(
        success=len(errors) == 0,
        processed_count=len(created_marks),
        error_count=len(errors),
        errors=errors,
        created_ids=[m.id for m in created_marks]
    )

@app.get("/{exam_id}/export/analytics")
async def export_exam_analytics(
    exam_id: int,
    format: str = Query("csv", description="Export format: csv, excel, pdf"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export exam analytics in various formats"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    if not validate_exam_permissions(current_user, exam.subject_id, exam.class_id, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate analytics
    analytics_data = generate_exam_analytics(exam_id, db)
    
    # Create DataFrame for export
    data = []
    
    # Add exam overview
    data.append({
        'Metric': 'Exam Title',
        'Value': analytics_data['exam_title'],
        'Category': 'Overview'
    })
    data.append({
        'Metric': 'Total Students',
        'Value': analytics_data['total_students'],
        'Category': 'Overview'
    })
    data.append({
        'Metric': 'Average Score (%)',
        'Value': analytics_data['average_score'],
        'Category': 'Overview'
    })
    data.append({
        'Metric': 'Pass Rate (%)',
        'Value': analytics_data['pass_rate'],
        'Category': 'Overview'
    })
    
    # Add section analysis
    for section_name, section_data in analytics_data['section_analysis'].items():
        data.append({
            'Metric': f'{section_name} - Average Marks',
            'Value': section_data['average_marks'],
            'Category': 'Section Analysis'
        })
        data.append({
            'Metric': f'{section_name} - Percentage',
            'Value': section_data['percentage'],
            'Category': 'Section Analysis'
        })
    
    # Add individual performance
    for student in analytics_data['individual_performance']:
        data.append({
            'Metric': f"Student {student['student_name']} - Percentage",
            'Value': student['percentage'],
            'Category': 'Individual Performance'
        })
    
    df = pd.DataFrame(data)
    
    if format.lower() == "excel":
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Exam Analytics', index=False)
        output.seek(0)
        
        return StreamingResponse(
            BytesIO(output.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_analytics.xlsx"}
        )
    elif format.lower() == "pdf":
        # For PDF, we'll use a simple CSV approach for now
        # In production, you'd want to use reportlab or similar
        csv_output = StringIO()
        df.to_csv(csv_output, index=False)
        csv_content = csv_output.getvalue()
        
        return StreamingResponse(
            BytesIO(csv_content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_analytics.csv"}
        )
    else:  # CSV
        csv_output = StringIO()
        df.to_csv(csv_output, index=False)
        csv_content = csv_output.getvalue()
        
        return StreamingResponse(
            BytesIO(csv_content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_analytics.csv"}
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "enhanced-exam"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)

