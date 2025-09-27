from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date
import json

from shared.database import get_db
from shared.models import Mark, User, Exam, Question, Subject, Class, AuditLog, ExamSection
from shared.auth import RoleChecker
from shared.permissions import PermissionChecker, Permission

app = FastAPI(title="Marks Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class MarkEntry(BaseModel):
    question_id: int
    marks_obtained: float
    feedback: Optional[str] = None

class StudentMarks(BaseModel):
    student_id: int
    marks: List[MarkEntry]
    total_marks: float
    attendance_marks: Optional[float] = None
    bonus_marks: Optional[float] = None
    remarks: Optional[str] = None

class BulkMarksEntry(BaseModel):
    exam_id: int
    student_marks: List[StudentMarks]

class MarkResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    exam_id: int
    exam_name: str
    question_id: int
    question_text: str
    max_marks: float
    marks_obtained: float
    feedback: Optional[str]
    graded_by: int
    graded_by_name: str
    graded_at: str
    subject_id: int
    subject_name: str
    class_id: int
    class_name: str

class ExamMarksSummary(BaseModel):
    exam_id: int
    exam_name: str
    subject_name: str
    class_name: str
    total_students: int
    graded_students: int
    pending_students: int
    average_marks: float
    highest_marks: float
    lowest_marks: float
    passing_count: int
    failing_count: int
    passing_percentage: float

class StudentPerformance(BaseModel):
    student_id: int
    student_name: str
    total_exams: int
    attempted_exams: int
    average_marks: float
    total_marks: float
    grade: str
    rank: int
    improvement_trend: str  # improving, declining, stable

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None, request: Request = None):
    """Log audit trail"""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()

def format_mark_response(mark: Mark) -> Dict[str, Any]:
    """Format mark response"""
    return {
        "id": mark.id,
        "student_id": mark.student_id,
        "student_name": mark.student.full_name if mark.student else None,
        "exam_id": mark.exam_id,
        "exam_name": mark.exam.exam_name if mark.exam else None,
        "question_id": mark.question_id,
        "question_text": mark.question.question_text if mark.question else None,
        "max_marks": float(mark.max_marks),
        "marks_obtained": float(mark.marks_obtained),
        "feedback": mark.feedback,
        "graded_by": mark.graded_by,
        "graded_by_name": mark.grader.full_name if mark.grader else None,
        "graded_at": mark.graded_at.isoformat() if mark.graded_at else None,
        "subject_id": mark.exam.subject_id if mark.exam else None,
        "subject_name": mark.exam.subject.name if mark.exam and mark.exam.subject else None,
        "class_id": mark.exam.class_id if mark.exam else None,
        "class_name": mark.exam.class_.name if mark.exam and mark.exam.class_ else None
    }

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
    elif percentage >= 33:
        return "D"
    else:
        return "F"

@app.get("/", response_model=Dict[str, str])
async def root():
    """Service health check"""
    return {"message": "Marks Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/marks", response_model=List[MarkResponse])
async def get_marks(
    exam_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get marks with role-based filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    query = db.query(Mark).options(
        joinedload(Mark.student),
        joinedload(Mark.exam).joinedload(Exam.subject),
        joinedload(Mark.exam).joinedload(Exam.class_),
        joinedload(Mark.question),
        joinedload(Mark.grader)
    )
    
    # Apply role-based filtering
    if current_user.role == "student":
        # Students can only see their own marks
        query = query.filter(Mark.student_id == current_user_id)
    elif current_user.role == "teacher":
        # Teachers can see marks for subjects they teach
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_ids.contains([current_user.id]))
        query = query.join(Exam).filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "hod":
        # HODs can see marks from their department
        query = query.join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
    
    # Apply filters
    if exam_id:
        query = query.filter(Mark.exam_id == exam_id)
    
    if student_id:
        query = query.filter(Mark.student_id == student_id)
    
    if subject_id:
        query = query.join(Exam).filter(Exam.subject_id == subject_id)
    
    if class_id:
        query = query.join(Exam).filter(Exam.class_id == class_id)
    
    marks = query.offset(skip).limit(limit).all()
    
    result = []
    for mark in marks:
        result.append(format_mark_response(mark))
    
    return result

@app.post("/api/marks/bulk")
async def bulk_marks_entry(
    bulk_data: BulkMarksEntry,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk entry of marks for an exam"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Validate exam exists
    exam = db.query(Exam).filter(Exam.id == bulk_data.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check permissions
    if current_user.role == "teacher" and current_user.id not in (exam.subject.teacher_ids or []):
        raise HTTPException(status_code=403, detail="You can only enter marks for exams you manage")
    elif current_user.role == "hod" and exam.subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="You can only enter marks for exams in your department")
    
    # Validate all questions exist and belong to the exam
    all_question_ids = []
    for student_mark in bulk_data.student_marks:
        for mark_entry in student_mark.marks:
            all_question_ids.append(mark_entry.question_id)
    
    exam_questions = db.query(Question).join(ExamSection).filter(
        ExamSection.exam_id == bulk_data.exam_id,
        Question.id.in_(all_question_ids)
    ).all()
    
    exam_question_ids = [q.id for q in exam_questions]
    
    # Validate all students exist and belong to the exam class
    all_student_ids = [sm.student_id for sm in bulk_data.student_marks]
    class_students = db.query(User).filter(
        User.id.in_(all_student_ids),
        User.class_id == exam.class_id,
        User.role == "student",
        User.is_active == True
    ).all()
    
    class_student_ids = [s.id for s in class_students]
    
    created_marks = []
    
    for student_mark in bulk_data.student_marks:
        if student_mark.student_id not in class_student_ids:
            continue  # Skip invalid students
        
        for mark_entry in student_mark.marks:
            if mark_entry.question_id not in exam_question_ids:
                continue  # Skip invalid questions
            
            # Check if mark already exists
            existing_mark = db.query(Mark).filter(
                Mark.student_id == student_mark.student_id,
                Mark.exam_id == bulk_data.exam_id,
                Mark.question_id == mark_entry.question_id
            ).first()
            
            if existing_mark:
                # Update existing mark
                existing_mark.marks_obtained = mark_entry.marks_obtained
                existing_mark.feedback = mark_entry.feedback
                existing_mark.graded_by = current_user_id
                existing_mark.graded_at = datetime.utcnow()
                existing_mark.updated_at = datetime.utcnow()
                created_marks.append(existing_mark)
            else:
                # Create new mark
                question = next((q for q in exam_questions if q.id == mark_entry.question_id), None)
                if not question:
                    continue
                
                mark = Mark(
                    student_id=student_mark.student_id,
                    exam_id=bulk_data.exam_id,
                    question_id=mark_entry.question_id,
                    max_marks=question.marks,
                    marks_obtained=mark_entry.marks_obtained,
                    feedback=mark_entry.feedback,
                    graded_by=current_user_id,
                    graded_at=datetime.utcnow(),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(mark)
                created_marks.append(mark)
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_MARKS_ENTRY", "marks", None,
              new_values={"exam_id": bulk_data.exam_id, "marks_count": len(created_marks)}, request=request)
    
    return {"message": f"Successfully entered {len(created_marks)} marks", "marks_count": len(created_marks)}

@app.get("/api/marks/exam/{exam_id}/summary", response_model=ExamMarksSummary)
async def get_exam_marks_summary(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get exam marks summary"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Check permissions
    if current_user.role == "teacher" and current_user.id not in (exam.subject.teacher_ids or []):
        raise HTTPException(status_code=403, detail="Cannot access marks for exams you don't manage")
    elif current_user.role == "hod" and exam.subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot access marks from other departments")
    
    # Get class students
    class_students = db.query(User).filter(
        User.class_id == exam.class_id,
        User.role == "student",
        User.is_active == True
    ).all()
    
    total_students = len(class_students)
    
    # Get marks for this exam
    exam_marks = db.query(Mark).filter(Mark.exam_id == exam_id).all()
    
    # Group marks by student
    student_marks = {}
    for mark in exam_marks:
        if mark.student_id not in student_marks:
            student_marks[mark.student_id] = []
        student_marks[mark.student_id].append(mark)
    
    graded_students = len(student_marks)
    pending_students = total_students - graded_students
    
    # Calculate statistics
    total_marks_list = []
    passing_count = 0
    
    for student_id, marks in student_marks.items():
        total_obtained = sum(float(mark.marks_obtained) for mark in marks)
        total_marks_list.append(total_obtained)
        
        if total_obtained >= exam.passing_marks:
            passing_count += 1
    
    average_marks = sum(total_marks_list) / len(total_marks_list) if total_marks_list else 0
    highest_marks = max(total_marks_list) if total_marks_list else 0
    lowest_marks = min(total_marks_list) if total_marks_list else 0
    failing_count = graded_students - passing_count
    passing_percentage = (passing_count / graded_students * 100) if graded_students > 0 else 0
    
    return ExamMarksSummary(
        exam_id=exam.id,
        exam_name=exam.exam_name,
        subject_name=exam.subject.name if exam.subject else None,
        class_name=exam.class_.name if exam.class_ else None,
        total_students=total_students,
        graded_students=graded_students,
        pending_students=pending_students,
        average_marks=average_marks,
        highest_marks=highest_marks,
        lowest_marks=lowest_marks,
        passing_count=passing_count,
        failing_count=failing_count,
        passing_percentage=passing_percentage
    )

@app.get("/api/marks/student/{student_id}/performance", response_model=StudentPerformance)
async def get_student_performance(
    student_id: int,
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get student performance analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Check permissions
    if current_user.role == "student" and current_user_id != student_id:
        raise HTTPException(status_code=403, detail="Students can only view their own performance")
    
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get student's marks
    query = db.query(Mark).filter(Mark.student_id == student_id)
    
    if subject_id:
        query = query.join(Exam).filter(Exam.subject_id == subject_id)
    
    marks = query.all()
    
    # Group marks by exam
    exam_marks = {}
    for mark in marks:
        if mark.exam_id not in exam_marks:
            exam_marks[mark.exam_id] = []
        exam_marks[mark.exam_id].append(mark)
    
    total_exams = len(exam_marks)
    attempted_exams = len([exam_id for exam_id, marks_list in exam_marks.items() if marks_list])
    
    # Calculate total and average marks
    total_marks = 0
    total_max_marks = 0
    
    for exam_id, marks_list in exam_marks.items():
        exam_total = sum(float(mark.marks_obtained) for mark in marks_list)
        exam_max = sum(float(mark.max_marks) for mark in marks_list)
        total_marks += exam_total
        total_max_marks += exam_max
    
    average_marks = (total_marks / total_max_marks * 100) if total_max_marks > 0 else 0
    grade = calculate_grade(average_marks)
    
    # Calculate rank (simplified - would need more complex logic for accurate ranking)
    rank = 1  # This would need to be calculated against all students
    
    # Determine improvement trend (simplified)
    improvement_trend = "stable"  # This would need historical data analysis
    
    return StudentPerformance(
        student_id=student.id,
        student_name=student.full_name,
        total_exams=total_exams,
        attempted_exams=attempted_exams,
        average_marks=average_marks,
        total_marks=total_marks,
        grade=grade,
        rank=rank,
        improvement_trend=improvement_trend
    )

@app.get("/api/marks/analytics", response_model=Dict[str, Any])
async def get_marks_analytics(
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    exam_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive marks analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Build query based on user role and filters
    query = db.query(Mark).join(Exam).join(Subject)
    
    if current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_ids.contains([current_user.id]))
        query = query.filter(Subject.id.in_(teacher_subjects))
    elif current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    
    if subject_id:
        query = query.filter(Exam.subject_id == subject_id)
    
    if class_id:
        query = query.filter(Exam.class_id == class_id)
    
    if exam_type:
        query = query.filter(Exam.exam_type == exam_type)
    
    marks = query.all()
    
    # Calculate analytics
    if not marks:
        return {
            "total_marks": 0,
            "average_marks": 0,
            "grade_distribution": {},
            "performance_trends": {},
            "subject_wise_performance": {},
            "difficulty_analysis": {}
        }
    
    # Grade distribution
    grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C+": 0, "C": 0, "D": 0, "F": 0}
    
    # Group by student and calculate grades
    student_grades = {}
    for mark in marks:
        if mark.student_id not in student_grades:
            student_grades[mark.student_id] = {"total": 0, "max": 0}
        
        student_grades[mark.student_id]["total"] += float(mark.marks_obtained)
        student_grades[mark.student_id]["max"] += float(mark.max_marks)
    
    for student_id, grade_data in student_grades.items():
        percentage = (grade_data["total"] / grade_data["max"] * 100) if grade_data["max"] > 0 else 0
        grade = calculate_grade(percentage)
        grade_distribution[grade] += 1
    
    total_marks = len(marks)
    average_marks = sum(float(mark.marks_obtained) for mark in marks) / total_marks if total_marks > 0 else 0
    
    return {
        "total_marks": total_marks,
        "average_marks": average_marks,
        "grade_distribution": grade_distribution,
        "performance_trends": {},  # Would need historical data
        "subject_wise_performance": {},  # Would need grouping by subject
        "difficulty_analysis": {}  # Would need question difficulty data
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "marks"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8014)