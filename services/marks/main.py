from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import List, Optional, Dict
import json
import pandas as pd
from io import BytesIO
from datetime import datetime
import kafka

from shared.database import get_db
from shared.models import Mark, Question, User, Exam, ExamSection, Subject, AuditLog
from shared.auth import RoleChecker
from pydantic import BaseModel

app = FastAPI(title="Marks Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Kafka producer for real-time analytics
try:
    producer = kafka.KafkaProducer(
        bootstrap_servers=['kafka:9092'],
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
except:
    producer = None

# Mark schemas
from shared.schemas import MarkCreate, MarkUpdate, MarkResponse, BulkMarkEntry

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

def publish_marks_event(event_type: str, data: dict):
    if producer:
        try:
            producer.send('marks-events', {
                'event_type': event_type,
                'timestamp': datetime.utcnow().isoformat(),
                'data': data
            })
        except Exception as e:
            print(f"Failed to publish event: {e}")

async def auto_calculate_optional_marks(db: Session, exam_id: int, student_id: int):
    """Auto-calculate marks for optional questions using best-attempt logic"""
    try:
        # Get all sections with optional questions for this exam
        sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
        
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
            
            if not student_marks:
                continue
            
            # Group questions by marks value for auto-calculation
            questions_by_marks = {}
            for question in optional_questions:
                marks_value = question.marks
                if marks_value not in questions_by_marks:
                    questions_by_marks[marks_value] = []
                questions_by_marks[marks_value].append(question)
            
            # Calculate best attempts for each marks group
            for marks_value, questions in questions_by_marks.items():
                # Get marks for this group
                group_marks = [m for m in student_marks if m.question_id in [q.id for q in questions]]
                
                if not group_marks:
                    continue
                
                # Sort by marks obtained (descending) to get best attempts
                group_marks.sort(key=lambda x: x.marks_obtained, reverse=True)
                
                # Determine how many questions to count based on section rules
                questions_to_count = section.questions_to_attempt or len(questions)
                
                # Take the best attempts
                best_attempts = group_marks[:questions_to_count]
                
                # Mark the best attempts as counted
                for i, mark in enumerate(group_marks):
                    if i < questions_to_count:
                        # This is a best attempt - mark it as counted
                        mark.is_counted_for_total = True
                    else:
                        # This is not counted - mark it as not counted
                        mark.is_counted_for_total = False
                
                # Calculate total marks for this group
                total_marks = sum(mark.marks_obtained for mark in best_attempts)
                
                # Log the calculation
                print(f"Auto-calculated optional marks for student {student_id} in exam {exam_id}: "
                      f"Section {section.name}, {len(best_attempts)}/{len(questions)} questions counted, "
                      f"Total: {total_marks}/{questions_to_count * marks_value} marks")
        
        db.commit()
        
    except Exception as e:
        print(f"Error in auto_calculate_optional_marks: {e}")
        db.rollback()

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Marks Service is running", "status": "healthy"}

# Mark endpoints
@app.get("/marks", response_model=List[MarkResponse])
async def get_marks(
    student_id: Optional[int] = None,
    exam_id: Optional[int] = None,
    question_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all marks with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Mark).options(
        joinedload(Mark.question),
        joinedload(Mark.student)
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
        query = query.join(Question).join(ExamSection).filter(ExamSection.exam_id == exam_id)
    if question_id:
        query = query.filter(Mark.question_id == question_id)
    
    marks = query.offset(skip).limit(limit).all()
    return marks

@app.get("/marks/{mark_id}", response_model=MarkResponse)
async def get_mark(
    mark_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific mark by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    mark = db.query(Mark).options(
        joinedload(Mark.question),
        joinedload(Mark.student)
    ).filter(Mark.id == mark_id).first()
    
    if not mark:
        raise HTTPException(status_code=404, detail="Mark not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if mark.student_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Check if teacher teaches the subject
        exam = db.query(Exam).join(ExamSection).join(Question).filter(Question.id == mark.question_id).first()
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        # Check if mark is from HOD's department
        exam = db.query(Exam).join(ExamSection).join(Question).filter(Question.id == mark.question_id).first()
        subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return mark

@app.post("/marks", response_model=MarkResponse)
async def create_mark(
    mark: MarkCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new mark entry"""
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
        question_id=mark.question_id,
        marks_obtained=mark.marks_obtained,
        max_marks=mark.max_marks,
        graded_by=current_user_id
    )
    
    db.add(db_mark)
    db.commit()
    db.refresh(db_mark)
    
    # Auto-calculate optional questions marks if this is an optional question
    question = db.query(Question).filter(Question.id == mark.question_id).first()
    if question and question.is_optional:
        await auto_calculate_optional_marks(db, mark.exam_id, mark.student_id)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Mark", db_mark.id, None, {
        "student_id": mark.student_id,
        "question_id": mark.question_id,
        "marks_obtained": mark.marks_obtained
    })
    
    # Publish event
    publish_marks_event("mark_created", {
        "mark_id": db_mark.id,
        "student_id": mark.student_id,
        "question_id": mark.question_id,
        "marks_obtained": mark.marks_obtained
    })
    
    return db_mark

@app.put("/marks/{mark_id}", response_model=MarkResponse)
async def update_mark(
    mark_id: int,
    mark: MarkUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update an existing mark"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_mark = db.query(Mark).filter(Mark.id == mark_id).first()
    if not db_mark:
        raise HTTPException(status_code=404, detail="Mark not found")
    
    # Check permissions through exam
    exam = db.query(Exam).join(ExamSection).join(Question).filter(Question.id == db_mark.question_id).first()
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "marks_obtained": db_mark.marks_obtained,
        "max_marks": db_mark.max_marks
    }
    
    # Update mark
    update_data = mark.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_mark, field, value)
    
    db.commit()
    db.refresh(db_mark)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Mark", mark_id, old_values, update_data)
    
    # Publish event
    publish_marks_event("mark_updated", {
        "mark_id": mark_id,
        "student_id": db_mark.student_id,
        "question_id": db_mark.question_id,
        "marks_obtained": db_mark.marks_obtained
    })
    
    return db_mark

@app.delete("/marks/{mark_id}")
async def delete_mark(
    mark_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a mark"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_mark = db.query(Mark).filter(Mark.id == mark_id).first()
    if not db_mark:
        raise HTTPException(status_code=404, detail="Mark not found")
    
    # Check permissions through exam
    exam = db.query(Exam).join(ExamSection).join(Question).filter(Question.id == db_mark.question_id).first()
    subject = db.query(Subject).filter(Subject.id == exam.subject_id).first()
    
    if current_user.role == "teacher":
        if subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "student_id": db_mark.student_id,
        "question_id": db_mark.question_id,
        "marks_obtained": db_mark.marks_obtained
    }
    
    db.delete(db_mark)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Mark", mark_id, old_values, None)
    
    # Publish event
    publish_marks_event("mark_deleted", {
        "mark_id": mark_id,
        "student_id": db_mark.student_id,
        "question_id": db_mark.question_id
    })
    
    return {"message": "Mark deleted successfully"}

# Bulk operations
@app.post("/marks/bulk", response_model=Dict)
async def bulk_create_marks(
    marks: List[BulkMarkEntry],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create multiple marks in bulk"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    created_marks = []
    errors = []
    
    for i, mark_data in enumerate(marks):
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
                question_id=mark_data.question_id,
                marks_obtained=mark_data.marks_obtained,
                max_marks=mark_data.max_marks,
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
            "total_attempted": len(marks)
        })
        
        # Publish event
        publish_marks_event("bulk_marks_created", {
            "count": len(created_marks),
            "graded_by": current_user_id
        })
    
    return {
        "created_count": len(created_marks),
        "error_count": len(errors),
        "errors": errors
    }

@app.get("/marks/export")
async def export_marks(
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Export marks to CSV"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Mark).options(
        joinedload(Mark.question),
        joinedload(Mark.student)
    )
    
    # Apply role-based filters
    if current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        query = query.join(Question).join(ExamSection).join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if exam_id:
        query = query.join(Question).join(ExamSection).filter(ExamSection.exam_id == exam_id)
    if subject_id:
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.subject_id == subject_id)
    if class_id:
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.class_id == class_id)
    
    marks = query.all()
    
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
            'Graded By': mark.graded_by,
            'Created At': mark.created_at.isoformat()
        })
    
    df = pd.DataFrame(data)
    
    # Create CSV
    output = BytesIO()
    df.to_csv(output, index=False)
    output.seek(0)
    
    return StreamingResponse(
        BytesIO(output.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=marks_export.csv"}
    )

@app.get("/marks/statistics")
async def get_marks_statistics(
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get marks statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Mark)
    
    # Apply role-based filters
    if current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        query = query.join(Question).join(ExamSection).join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if exam_id:
        query = query.join(Question).join(ExamSection).filter(ExamSection.exam_id == exam_id)
    if subject_id:
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.subject_id == subject_id)
    if class_id:
        query = query.join(Question).join(ExamSection).join(Exam).filter(Exam.class_id == class_id)
    
    # Calculate statistics
    total_marks = query.count()
    avg_marks = query.with_entities(func.avg(Mark.marks_obtained)).scalar() or 0
    max_marks = query.with_entities(func.max(Mark.marks_obtained)).scalar() or 0
    min_marks = query.with_entities(func.min(Mark.marks_obtained)).scalar() or 0
    
    # Pass rate (assuming 40% is passing)
    passing_marks = query.filter(Mark.marks_obtained >= Mark.max_marks * 0.4).count()
    pass_rate = (passing_marks / total_marks * 100) if total_marks > 0 else 0
    
    return {
        "total_marks": total_marks,
        "average_marks": round(avg_marks, 2),
        "max_marks": max_marks,
        "min_marks": min_marks,
        "pass_rate": round(pass_rate, 2),
        "passing_marks": passing_marks
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "marks"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8014)