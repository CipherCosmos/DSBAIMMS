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
from shared.audit import log_audit, log_bulk_audit

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

# Using MarkResponse from shared.schemas

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

# Enhanced Grade Calculation and Analytics
@app.get("/api/marks/grade-distribution")
async def get_grade_distribution(
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get grade distribution analytics"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        # Build query with role-based filtering
        query = db.query(Mark)

        if current_user.role == "hod":
            query = query.join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
        elif current_user.role == "teacher":
            query = query.join(Exam).filter(Exam.created_by == current_user_id)

        if exam_id:
            query = query.filter(Mark.exam_id == exam_id)
        if subject_id:
            query = query.join(Exam).filter(Exam.subject_id == subject_id)
        if class_id:
            query = query.join(Exam).filter(Exam.class_id == class_id)
        if semester_id:
            query = query.join(Exam).join(Subject).filter(Subject.semester_id == semester_id)

        marks = query.all()

        # Calculate grade distribution
        grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        total_students = len(marks)

        for mark in marks:
            percentage = (float(mark.marks_obtained) / float(mark.max_marks) * 100) if mark.max_marks > 0 else 0

            if percentage >= 90:
                grade_distribution["A+"] += 1
            elif percentage >= 80:
                grade_distribution["A"] += 1
            elif percentage >= 70:
                grade_distribution["B+"] += 1
            elif percentage >= 60:
                grade_distribution["B"] += 1
            elif percentage >= 50:
                grade_distribution["C"] += 1
            elif percentage >= 40:
                grade_distribution["D"] += 1
            else:
                grade_distribution["F"] += 1

        # Calculate percentages
        grade_percentages = {}
        for grade, count in grade_distribution.items():
            grade_percentages[grade] = round((count / total_students * 100), 2) if total_students > 0 else 0

        return {
            "total_students": total_students,
            "grade_distribution": grade_distribution,
            "grade_percentages": grade_percentages,
            "pass_rate": round((grade_distribution["A+"] + grade_distribution["A"] + grade_distribution["B+"] + grade_distribution["B"] + grade_distribution["C+"] + grade_distribution["C"]) / total_students * 100, 2) if total_students > 0 else 0.0
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching grade distribution: {str(e)}")

@app.get("/api/marks/performance-trends")
async def get_performance_trends(
    student_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get performance trends over time"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        # Check permissions for student
        if current_user.role == "student" and student_id != current_user_id:
            raise HTTPException(status_code=403, detail="Students can only view their own performance trends")

        # Build query with role-based filtering
        query = db.query(Mark)

        if current_user.role == "hod":
            query = query.join(Exam).join(Subject).filter(Subject.department_id == current_user.department_id)
        elif current_user.role == "teacher":
            query = query.join(Exam).filter(Exam.created_by == current_user_id)
        elif current_user.role == "student":
            query = query.filter(Mark.student_id == current_user_id)

        if student_id:
            query = query.filter(Mark.student_id == student_id)
        if subject_id:
            query = query.join(Exam).filter(Exam.subject_id == subject_id)
        if class_id:
            query = query.join(Exam).filter(Exam.class_id == class_id)
        if semester_id:
            query = query.join(Exam).join(Subject).filter(Subject.semester_id == semester_id)

        # Order by exam date for trends
        marks = query.join(Exam).order_by(Exam.exam_date).all()

        trends = []
        for mark in marks:
            percentage = (float(mark.marks_obtained) / float(mark.max_marks) * 100) if mark.max_marks > 0 else 0
            trends.append({
                "exam_id": mark.exam_id,
                "exam_name": mark.exam.name if mark.exam else "Unknown",
                "subject_name": mark.exam.subject.name if mark.exam and mark.exam.subject else "Unknown",
                "marks_obtained": mark.marks_obtained,
                "max_marks": mark.max_marks,
                "percentage": round(percentage, 2),
                "grade": calculate_grade(percentage),
                "exam_date": mark.exam.exam_date.isoformat() if mark.exam and mark.exam.exam_date else None,
                "created_at": mark.created_at.isoformat()
            })

        return {
            "performance_trends": trends,
            "total_exams": len(trends),
            "average_performance": round(sum(t["percentage"] for t in trends) / len(trends), 2) if trends else 0,
            "improvement_trend": "improving" if len(trends) >= 2 and trends[-1]["percentage"] > trends[0]["percentage"] else "declining" if len(trends) >= 2 and trends[-1]["percentage"] < trends[0]["percentage"] else "stable"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching performance trends: {str(e)}")

@app.get("/api/marks/class-rankings")
async def get_class_rankings(
    class_id: int,
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get class rankings for exams"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        # Validate class exists and permissions
        class_obj = db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            raise HTTPException(status_code=404, detail="Class not found")

        if current_user.role == "hod" and class_obj.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied to class")

        # Build query
        query = db.query(Mark).join(Exam).filter(Exam.class_id == class_id)

        if exam_id:
            query = query.filter(Mark.exam_id == exam_id)
        if subject_id:
            query = query.filter(Exam.subject_id == subject_id)

        marks = query.all()

        # Group marks by student
        student_marks = {}
        for mark in marks:
            if mark.student_id not in student_marks:
                student_marks[mark.student_id] = {
                    "student_id": mark.student_id,
                    "student_name": f"{mark.student.first_name} {mark.student.last_name}" if mark.student else "Unknown",
                    "total_obtained": 0,
                    "total_maximum": 0,
                    "exams_count": 0
                }

            student_marks[mark.student_id]["total_obtained"] += float(mark.marks_obtained)
            student_marks[mark.student_id]["total_maximum"] += float(mark.max_marks)
            student_marks[mark.student_id]["exams_count"] += 1

        # Calculate rankings
        rankings = []
        for student_id, data in student_marks.items():
            percentage = (data["total_obtained"] / data["total_maximum"] * 100) if data["total_maximum"] > 0 else 0
            rankings.append({
                "rank": 0,  # Will be calculated after sorting
                "student_id": student_id,
                "student_name": data["student_name"],
                "total_obtained": data["total_obtained"],
                "total_maximum": data["total_maximum"],
                "percentage": round(percentage, 2),
                "grade": calculate_grade(percentage),
                "exams_count": data["exams_count"]
            })

        # Sort by percentage and assign ranks
        rankings.sort(key=lambda x: x["percentage"], reverse=True)
        for i, ranking in enumerate(rankings):
            ranking["rank"] = i + 1

        return {
            "class_id": class_id,
            "class_name": class_obj.name,
            "total_students": len(rankings),
            "rankings": rankings
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching class rankings: {str(e)}")

@app.get("/api/marks/subject-analytics")
async def get_subject_analytics(
    subject_id: int,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive analytics for a subject"""
    try:
        current_user = db.query(User).filter(User.id == current_user_id).first()
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        # Validate subject exists and permissions
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")

        if current_user.role == "hod" and subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied to subject")
        elif current_user.role == "teacher" and subject.teacher_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied to subject")

        # Get all exams for this subject
        exams_query = db.query(Exam).filter(Exam.subject_id == subject_id)
        if semester_id:
            exams_query = exams_query.join(Subject).filter(Subject.semester_id == semester_id)

        exams = exams_query.all()
        exam_ids = [exam.id for exam in exams]

        # Get all marks for this subject
        marks = db.query(Mark).filter(Mark.exam_id.in_(exam_ids)).all()

        # Calculate analytics
        total_students = len(set(mark.student_id for mark in marks))
        total_exams = len(exams)
        total_marks = len(marks)

        if marks:
            total_obtained = sum(float(mark.marks_obtained) for mark in marks)
            total_maximum = sum(float(mark.max_marks) for mark in marks)
            average_performance = round((total_obtained / total_maximum * 100), 2)

            # Pass rate (40% and above)
            passing_marks = len([m for m in marks if float(m.marks_obtained) >= float(m.max_marks) * 0.4])
            pass_rate = round((passing_marks / total_marks * 100), 2)

            # Grade distribution
            grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
            for mark in marks:
                percentage = (float(mark.marks_obtained) / float(mark.max_marks) * 100) if mark.max_marks > 0 else 0
                if percentage >= 90:
                    grade_distribution["A+"] += 1
                elif percentage >= 80:
                    grade_distribution["A"] += 1
                elif percentage >= 70:
                    grade_distribution["B+"] += 1
                elif percentage >= 60:
                    grade_distribution["B"] += 1
                elif percentage >= 50:
                    grade_distribution["C"] += 1
                elif percentage >= 40:
                    grade_distribution["D"] += 1
                else:
                    grade_distribution["F"] += 1
        else:
            average_performance = 0.0
            pass_rate = 0.0
            grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}

        # Exam-wise performance
        exam_performance = []
        for exam in exams:
            exam_marks = [m for m in marks if m.exam_id == exam.id]
            if exam_marks:
                total_obtained = sum(float(mark.marks_obtained) for mark in exam_marks)
                total_maximum = sum(float(mark.max_marks) for mark in exam_marks)
                avg_performance = round((total_obtained / total_maximum * 100), 2) if total_maximum > 0 else 0
                passing_count = len([m for m in exam_marks if float(m.marks_obtained) >= float(m.max_marks) * 0.4])
                exam_pass_rate = round((passing_count / len(exam_marks) * 100), 2) if exam_marks else 0
            else:
                avg_performance = 0.0
                exam_pass_rate = 0.0

            exam_performance.append({
                "exam_id": exam.id,
                "exam_name": exam.name,
                "exam_date": exam.exam_date.isoformat() if exam.exam_date else None,
                "total_marks": exam.total_marks,
                "students_attempted": len(exam_marks),
                "average_performance": avg_performance,
                "pass_rate": exam_pass_rate
            })

        return {
            "subject_id": subject.id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "department_name": subject.department.name if subject.department else "Unknown",
            "total_students": total_students,
            "total_exams": total_exams,
            "total_marks": total_marks,
            "average_performance": average_performance,
            "pass_rate": pass_rate,
            "grade_distribution": grade_distribution,
            "exam_performance": exam_performance
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching subject analytics: {str(e)}")

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
        return "C"
    elif percentage >= 40:
        return "D"
    else:
        return "F"

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "marks"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8014)