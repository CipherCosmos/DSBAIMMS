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
    Mark, Question, User, Exam, ExamSection, Subject, Class, CO, PO, 
    COPOMapping, AuditLog, QuestionAttempt, ExamAnalytics
)
from shared.auth import RoleChecker
from shared.schemas import (
    MarkCreate, MarkUpdate, MarkResponse, QuestionAttemptCreate, QuestionAttemptResponse,
    SmartMarksCalculation, BulkMarksUpload, BulkOperationResult, ExamAnalyticsResponse
)

app = FastAPI(title="Enhanced Marks Service", version="2.0.0")

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

def calculate_smart_marks_for_section(exam_id: int, student_id: int, section_id: int, db: Session) -> Dict[str, Any]:
    """Calculate smart marks for a section with optional questions (best attempt selection)"""
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
    mandatory_details = []
    
    for question in mandatory_questions:
        best_attempt = db.query(QuestionAttempt).filter(
            QuestionAttempt.student_id == student_id,
            QuestionAttempt.question_id == question.id,
            QuestionAttempt.is_best_attempt == True
        ).first()
        
        if best_attempt:
            mandatory_marks += best_attempt.marks_obtained
            mandatory_details.append({
                'question_id': question.id,
                'question_number': question.question_number,
                'marks_obtained': best_attempt.marks_obtained,
                'max_marks': best_attempt.max_marks,
                'is_optional': False
            })
        else:
            # No attempt made
            mandatory_details.append({
                'question_id': question.id,
                'question_number': question.question_number,
                'marks_obtained': 0,
                'max_marks': question.marks,
                'is_optional': False
            })
    
    # Calculate marks for optional questions (best attempts only)
    optional_marks = 0
    optional_details = []
    
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
                    'question_number': question.question_number,
                    'marks': best_attempt.marks_obtained,
                    'max_marks': best_attempt.max_marks,
                    'question': question
                })
            else:
                # No attempt made
                optional_attempts.append({
                    'question_id': question.id,
                    'question_number': question.question_number,
                    'marks': 0,
                    'max_marks': question.marks,
                    'question': question
                })
        
        # Sort by marks (descending) and take best attempts
        optional_attempts.sort(key=lambda x: x['marks'], reverse=True)
        selected_attempts = optional_attempts[:section.questions_to_attempt]
        
        for attempt in selected_attempts:
            optional_marks += attempt['marks']
            optional_details.append({
                'question_id': attempt['question_id'],
                'question_number': attempt['question_number'],
                'marks_obtained': attempt['marks'],
                'max_marks': attempt['max_marks'],
                'is_optional': True,
                'is_selected': True
            })
        
        # Add non-selected optional questions
        non_selected = optional_attempts[section.questions_to_attempt:]
        for attempt in non_selected:
            optional_details.append({
                'question_id': attempt['question_id'],
                'question_number': attempt['question_number'],
                'marks_obtained': attempt['marks'],
                'max_marks': attempt['max_marks'],
                'is_optional': True,
                'is_selected': False
            })
    
    total_marks = mandatory_marks + optional_marks
    max_possible = sum(q.marks for q in mandatory_questions)
    
    if section.questions_to_attempt and optional_questions:
        # Calculate max possible for optional questions
        optional_max = sum(q.marks for q in optional_questions[:section.questions_to_attempt])
        max_possible += optional_max
    
    percentage = (total_marks / max_possible * 100) if max_possible > 0 else 0
    
    return {
        "section_id": section_id,
        "section_name": section.name,
        "mandatory_marks": mandatory_marks,
        "optional_marks": optional_marks,
        "total_marks": total_marks,
        "max_possible": max_possible,
        "percentage": round(percentage, 2),
        "mandatory_questions": len(mandatory_questions),
        "optional_questions": len(optional_questions),
        "questions_attempted": len(mandatory_questions) + min(len(optional_questions), section.questions_to_attempt or 0),
        "mandatory_details": mandatory_details,
        "optional_details": optional_details
    }

def calculate_co_po_attainment_for_student(exam_id: int, student_id: int, db: Session) -> Dict[str, Any]:
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
                'co_name': question.co.name if question.co else "Unknown",
                'total_marks': 0,
                'obtained_marks': 0,
                'weighted_contribution': 0,
                'question_count': 0
            }
        
        co_attainment[question.co_id]['total_marks'] += mark.max_marks
        co_attainment[question.co_id]['obtained_marks'] += mark.marks_obtained
        co_attainment[question.co_id]['weighted_contribution'] += co_contribution
        co_attainment[question.co_id]['question_count'] += 1
        
        # Get PO mapping for this CO
        po_mappings = db.query(COPOMapping).filter(COPOMapping.co_id == question.co_id).all()
        for mapping in po_mappings:
            po_contribution = co_contribution * mapping.mapping_strength / 3.0  # Normalize to 0-1
            
            if mapping.po_id not in po_attainment:
                po_attainment[mapping.po_id] = {
                    'po_name': mapping.po.name if mapping.po else "Unknown",
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

def generate_comprehensive_analytics(exam_id: int, db: Session) -> Dict[str, Any]:
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
            
            # Calculate CO/PO attainment for this student
            co_po_attainment = calculate_co_po_attainment_for_student(exam_id, student.id, db)
            
            individual_performance.append({
                'student_id': student.id,
                'student_name': student.full_name or student.username,
                'student_id_number': student.student_id,
                'total_marks': round(total_marks, 2),
                'max_marks': round(max_total, 2),
                'percentage': round(percentage, 2),
                'co_attainment': co_po_attainment['co_attainment'],
                'po_attainment': co_po_attainment['po_attainment'],
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
        'individual_performance': individual_performance
    }

# Enhanced Marks Endpoints
@app.get("/", response_model=List[MarkResponse])
async def get_marks(
    student_id: Optional[int] = None,
    exam_id: Optional[int] = None,
    question_id: Optional[int] = None,
    section_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all marks with enhanced filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Mark).options(
        joinedload(Mark.question),
        joinedload(Mark.student),
        joinedload(Mark.exam)
    )
    
    # Apply role-based filters
    if current_user.role == "student":
        query = query.filter(Mark.student_id == current_user_id)
    elif current_user.role == "teacher":
        # Teachers can only see marks for their subjects
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        # HODs can see marks for their department
        query = query.join(Question).join(ExamSection).join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if student_id:
        query = query.filter(Mark.student_id == student_id)
    if exam_id:
        query = query.filter(Mark.exam_id == exam_id)
    if question_id:
        query = query.filter(Mark.question_id == question_id)
    if section_id:
        query = query.join(Question).filter(Question.section_id == section_id)
    
    marks = query.offset(skip).limit(limit).all()
    return marks

@app.post("/", response_model=MarkResponse)
async def create_mark(
    mark: MarkCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new mark entry with enhanced tracking"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check if question exists and user has permission
    question = db.query(Question).filter(Question.id == mark.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check permissions through exam
    exam = db.query(Exam).join(ExamSection).filter(ExamSection.id == question.section_id).first()
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if student exists
    student = db.query(User).filter(User.id == mark.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check if mark already exists
    existing_mark = db.query(Mark).filter(
        Mark.student_id == mark.student_id,
        Mark.question_id == mark.question_id
    ).first()
    
    if existing_mark:
        raise HTTPException(status_code=400, detail="Mark already exists for this student and question")
    
    # Create mark
    db_mark = Mark(
        student_id=mark.student_id,
        exam_id=mark.exam_id,
        question_id=mark.question_id,
        marks_obtained=mark.marks_obtained,
        max_marks=mark.max_marks,
        remarks=mark.remarks,
        is_attempted=mark.is_attempted,
        attempt_number=mark.attempt_number,
        is_best_attempt=mark.is_best_attempt,
        graded_by=current_user_id,
        bloom_level=question.bloom_level,
        difficulty_level=question.difficulty_level
    )
    
    db.add(db_mark)
    db.commit()
    db.refresh(db_mark)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Mark", db_mark.id, None, {
        "student_id": mark.student_id,
        "question_id": mark.question_id,
        "marks_obtained": mark.marks_obtained
    })
    
    return db_mark

@app.post("/smart-calculation", response_model=Dict[str, Any])
async def calculate_smart_marks(
    calculation_data: SmartMarksCalculation,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Calculate smart marks for optional questions with best attempt selection"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    exam = db.query(Exam).filter(Exam.id == calculation_data.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate smart marks
    result = calculate_smart_marks_for_section(
        calculation_data.exam_id, 
        calculation_data.student_id, 
        calculation_data.section_id, 
        db
    )
    
    return result

@app.post("/bulk", response_model=BulkOperationResult)
async def bulk_create_marks(
    bulk_data: BulkMarksUpload,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create multiple marks in bulk with enhanced validation"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    created_marks = []
    errors = []
    
    for i, mark_data in enumerate(bulk_data.marks_data):
        try:
            # Check if question exists and user has permission
            question = db.query(Question).filter(Question.id == mark_data.question_id).first()
            if not question:
                errors.append(f"Row {i+1}: Question not found")
                continue
            
            # Check permissions through exam
            exam = db.query(Exam).join(ExamSection).filter(ExamSection.id == question.section_id).first()
            subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
            
            if current_user.role == "teacher":
                if subject.teacher_id != current_user_id:
                    errors.append(f"Row {i+1}: Access denied")
                    continue
            elif current_user.role == "hod":
                if subject.department_id != current_user.department_id:
                    errors.append(f"Row {i+1}: Access denied")
                    continue
            
            # Check if student exists
            student = db.query(User).filter(User.id == mark_data.student_id).first()
            if not student:
                errors.append(f"Row {i+1}: Student not found")
                continue
            
            # Check if mark already exists
            existing_mark = db.query(Mark).filter(
                Mark.student_id == mark_data.student_id,
                Mark.question_id == mark_data.question_id
            ).first()
            
            if existing_mark:
                errors.append(f"Row {i+1}: Mark already exists")
                continue
            
            # Create mark
            db_mark = Mark(
                student_id=mark_data.student_id,
                exam_id=mark_data.exam_id,
                question_id=mark_data.question_id,
                marks_obtained=mark_data.marks_obtained,
                max_marks=mark_data.max_marks,
                remarks=mark_data.remarks,
                is_attempted=mark_data.is_attempted,
                attempt_number=mark_data.attempt_number,
                is_best_attempt=mark_data.is_best_attempt,
                graded_by=current_user_id,
                bloom_level=question.bloom_level,
                difficulty_level=question.difficulty_level
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
            "total_attempted": len(bulk_data.marks_data)
        })
    
    return BulkOperationResult(
        success=len(errors) == 0,
        processed_count=len(created_marks),
        error_count=len(errors),
        errors=errors,
        created_ids=[m.id for m in created_marks]
    )

@app.get("/analytics/{exam_id}", response_model=ExamAnalyticsResponse)
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
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate analytics
    analytics_data = generate_comprehensive_analytics(exam_id, db)
    
    return ExamAnalyticsResponse(**analytics_data)

@app.get("/export/{exam_id}")
async def export_marks(
    exam_id: int,
    format: str = Query("csv", description="Export format: csv, excel, pdf"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export marks and analytics in various formats"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check permissions
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get marks data
    marks = db.query(Mark).options(
        joinedload(Mark.question),
        joinedload(Mark.student)
    ).filter(Mark.exam_id == exam_id).all()
    
    # Create DataFrame
    data = []
    for mark in marks:
        data.append({
            'Student ID': mark.student.student_id,
            'Student Name': mark.student.full_name,
            'Question ID': mark.question_id,
            'Question Number': mark.question.question_number,
            'Marks Obtained': mark.marks_obtained,
            'Max Marks': mark.max_marks,
            'Percentage': (mark.marks_obtained / mark.max_marks * 100) if mark.max_marks > 0 else 0,
            'Bloom Level': mark.bloom_level,
            'Difficulty Level': mark.difficulty_level,
            'Is Best Attempt': mark.is_best_attempt,
            'Graded By': mark.graded_by,
            'Created At': mark.created_at.isoformat()
        })
    
    df = pd.DataFrame(data)
    
    if format.lower() == "excel":
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Marks Export', index=False)
        output.seek(0)
        
        return StreamingResponse(
            BytesIO(output.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_marks.xlsx"}
        )
    elif format.lower() == "pdf":
        # For PDF, we'll use a simple CSV approach for now
        csv_output = StringIO()
        df.to_csv(csv_output, index=False)
        csv_content = csv_output.getvalue()
        
        return StreamingResponse(
            BytesIO(csv_content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_marks.csv"}
        )
    else:  # CSV
        csv_output = StringIO()
        df.to_csv(csv_output, index=False)
        csv_content = csv_output.getvalue()
        
        return StreamingResponse(
            BytesIO(csv_content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_marks.csv"}
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "enhanced-marks"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8014)

