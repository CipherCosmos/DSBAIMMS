from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, case, text
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timedelta
import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error
import pandas as pd
from typing import Dict, List
import numpy as np
import kafka

from shared.database import get_db
from shared.models import (
    User, Department, Subject, Exam, Question, Mark, CO, PO, COPOMapping,
    Class, ExamSection
)
from shared.auth import RoleChecker
from pydantic import BaseModel

app = FastAPI(title="Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Kafka consumer for real-time analytics (simplified for demo)
try:
    consumer = kafka.KafkaConsumer(
        'marks-events',
        bootstrap_servers=['kafka:9092'],
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
except:
    consumer = None

# Analytics schemas
from shared.schemas import COAttainmentResponse, POAttainmentResponse, StudentPerformanceResponse, QuestionAnalyticsResponse, ExamAnalyticsResponse

# Root endpoint for health check
@app.get("/")
async def root():
    return {"message": "Analytics Service is running", "status": "healthy"}

def calculate_difficulty_index(marks_obtained: float, max_marks: float) -> float:
    """Calculate difficulty index (percentage of students who got it right)"""
    return (marks_obtained / max_marks) if max_marks > 0 else 0

def calculate_discrimination_index(high_group_avg: float, low_group_avg: float, max_marks: float) -> float:
    """Calculate discrimination index (difference between high and low performers)"""
    return ((high_group_avg - low_group_avg) / max_marks) if max_marks > 0 else 0

def calculate_reliability_coefficient(question_scores: List[List[float]]) -> float:
    """Calculate Cronbach's alpha for internal consistency"""
    if len(question_scores) < 2: 
        return 0.0
    try:
        # Convert to numpy array
        scores_array = np.array(question_scores)
        
        # Calculate variances
        item_variances = np.var(scores_array, axis=0)
        total_variance = np.var(np.sum(scores_array, axis=1))
        
        # Cronbach's alpha formula
        k = len(question_scores[0])  # number of questions
        alpha = (k / (k - 1)) * (1 - (np.sum(item_variances) / total_variance))
        
        return max(0.0, min(1.0, alpha))  # Clamp between 0 and 1
    except:
        return 0.0

# CO/PO Analytics
@app.get("/co-attainment", response_model=List[COAttainmentResponse])
async def get_co_attainment(
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    department_id: Optional[int] = None,
    threshold: float = Query(50.0, description="Minimum percentage for attainment"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for CO attainment
    query = db.query(
        CO.id.label('co_id'),
        CO.name.label('co_name'),
        CO.description.label('co_description'),
        Subject.name.label('subject_name'),
        func.sum(Mark.marks_obtained).label('total_marks_obtained'),
        func.sum(Mark.max_marks).label('total_max_marks'),
        func.count(func.distinct(Mark.student_id)).label('students_count')
    ).join(Question, Question.co_id == CO.id
    ).join(Mark, Mark.question_id == Question.id
    ).join(Subject, Subject.id == CO.subject_id)
    
    # Apply role-based filters
    if current_user.role == "student":
        query = query.filter(Mark.student_id == current_user_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if subject_id:
        query = query.filter(CO.subject_id == subject_id)
    if class_id:
        query = query.join(Exam, Exam.subject_id == Subject.id).filter(Exam.class_id == class_id)
    if department_id:
        query = query.filter(CO.department_id == department_id)
    
    query = query.group_by(CO.id, CO.name, CO.description, Subject.name)
    
    co_results = query.all()
    
    co_attainment = []
    for co in co_results:
        attainment_percentage = (co.total_marks_obtained / co.total_max_marks * 100) if co.total_max_marks > 0 else 0
        attainment_level = "Exceeds" if attainment_percentage >= 75 else "Meets" if attainment_percentage >= threshold else "Below"
        
        # Count students above threshold
        students_above_threshold = db.query(
            func.count(func.distinct(Mark.student_id))
        ).join(Question).filter(
            and_(
                Question.co_id == co.co_id,
                (Mark.marks_obtained / Mark.max_marks * 100) >= threshold
            )
        ).scalar() or 0
        
        co_attainment.append(COAttainmentResponse(
            co_id=co.co_id,
            co_name=co.co_name,
            co_description=co.co_description,
            subject_name=co.subject_name,
            total_marks_obtained=float(co.total_marks_obtained or 0),
            total_max_marks=float(co.total_max_marks or 0),
            attainment_percentage=round(attainment_percentage, 2),
            attainment_level=attainment_level,
            students_count=co.students_count or 0,
            students_above_threshold=students_above_threshold
        ))
    
    return co_attainment

@app.get("/po-attainment", response_model=List[POAttainmentResponse])
async def get_po_attainment(
    department_id: Optional[int] = None,
    threshold: float = Query(50.0, description="Minimum percentage for attainment"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get PO attainment through CO-PO mappings
    po_query = db.query(
        PO.id.label('po_id'),
        PO.name.label('po_name'),
        PO.description.label('po_description'),
        Department.name.label('department_name'),
        func.avg(
            COPOMapping.mapping_strength * 
            (Mark.marks_obtained / Mark.max_marks * 100)
        ).label('weighted_attainment'),
        func.count(func.distinct(CO.id)).label('contributing_cos')
    ).join(COPOMapping, COPOMapping.po_id == PO.id
    ).join(CO, CO.id == COPOMapping.co_id
    ).join(Question, Question.co_id == CO.id
    ).join(Mark, Mark.question_id == Question.id
    ).join(Department, Department.id == PO.department_id)
    
    # Apply role-based filters
    if current_user.role == "hod":
        po_query = po_query.filter(PO.department_id == current_user.department_id)
    elif department_id:
        po_query = po_query.filter(PO.department_id == department_id)
    
    po_query = po_query.group_by(PO.id, PO.name, PO.description, Department.name)
    
    po_results = po_query.all()
    
    po_attainment = []
    for po in po_results:
        weighted_attainment = float(po.weighted_attainment or 0)
        attainment_level = "Exceeds" if weighted_attainment >= 75 else "Meets" if weighted_attainment >= threshold else "Below"
        
        # Get involved subjects
        subjects_involved = db.query(func.distinct(Subject.name)).join(
            CO, CO.subject_id == Subject.id
        ).join(COPOMapping, COPOMapping.co_id == CO.id).filter(
            COPOMapping.po_id == po.po_id
        ).all()
        
        po_attainment.append(POAttainmentResponse(
            po_id=po.po_id,
            po_name=po.po_name,
            po_description=po.po_description,
            department_name=po.department_name,
            weighted_attainment=round(weighted_attainment, 2),
            attainment_level=attainment_level,
            contributing_cos=po.contributing_cos or 0,
            subjects_involved=[s[0] for s in subjects_involved]
        ))
    
    return po_attainment

# Student Analytics
@app.get("/student-performance", response_model=List[StudentPerformanceResponse])
async def get_student_performance(
    student_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for students
    students_query = db.query(User).filter(User.role == "student")
    
    # Apply role-based filters
    if current_user.role == "student":
        students_query = students_query.filter(User.id == current_user_id)
    elif current_user.role == "teacher":
        # Get students from classes the teacher teaches
        teacher_classes = db.query(Subject.class_id).filter(Subject.teacher_id == current_user_id).distinct().subquery()
        students_query = students_query.filter(User.class_id.in_(teacher_classes))
    elif current_user.role == "hod":
        students_query = students_query.filter(User.department_id == current_user.department_id)
    
    # Apply additional filters
    if student_id:
        students_query = students_query.filter(User.id == student_id)
    if class_id:
        students_query = students_query.filter(User.class_id == class_id)
    
    students = students_query.all()
    
    student_performance = []
    for student in students:
        # Get overall performance
        overall_marks = db.query(
            func.sum(Mark.marks_obtained).label('total_obtained'),
            func.sum(Mark.max_marks).label('total_max')
        ).filter(Mark.student_id == student.id).first()
        
        overall_percentage = 0
        if overall_marks.total_max and overall_marks.total_max > 0:
            overall_percentage = (overall_marks.total_obtained / overall_marks.total_max) * 100
        
        # Get CO-wise performance
        co_performance = db.query(
            CO.id,
            CO.name,
            CO.description,
            func.sum(Mark.marks_obtained).label('obtained'),
            func.sum(Mark.max_marks).label('maximum')
        ).join(Question, Question.co_id == CO.id
        ).join(Mark, Mark.question_id == Question.id
        ).filter(Mark.student_id == student.id
        ).group_by(CO.id, CO.name, CO.description).all()
        
        co_attainments = []
        weak_areas = []
        for co in co_performance:
            co_percentage = (co.obtained / co.maximum * 100) if co.maximum > 0 else 0
            co_attainments.append({
                'co_id': co.id,
                'co_name': co.name,
                'co_description': co.description,
                'percentage': round(co_percentage, 2),
                'attainment_level': "Exceeds" if co_percentage >= 75 else "Meets" if co_percentage >= 50 else "Below"
            })
            
            if co_percentage < 50: 
                weak_areas.append(co.name)
        
        # Generate recommendations
        recommendations = []
        if len(weak_areas) > 0:
            recommendations.append(f"Focus on improving {', '.join(weak_areas[:3])}")
        if overall_percentage < 60:
            recommendations.append("Consider additional practice in fundamental concepts")
        elif overall_percentage > 85:
            recommendations.append("Excellent performance! Consider advanced topics")
        
        student_performance.append(StudentPerformanceResponse(
            student_id=student.id,
            student_name=student.full_name,
            student_number=student.student_id or "",
            class_name=student.class_assigned.name if student.class_assigned else "",
            overall_percentage=round(overall_percentage, 2),
            co_attainments=co_attainments,
            weak_areas=weak_areas,
            recommendations=recommendations
        ))
    
    return student_performance

# Question Analytics
@app.get("/question-analytics", response_model=List[QuestionAnalyticsResponse])
async def get_question_analytics(
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    bloom_level: Optional[str] = None,
    difficulty_level: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for question analytics
    query = db.query(
        Question.id.label('question_id'),
        Question.question_number,
        Question.question_text,
        Question.bloom_level,
        Question.difficulty_level,
        Question.marks.label('max_marks'),
        CO.name.label('co_name'),
        func.avg(Mark.marks_obtained).label('avg_marks'),
        func.count(Mark.id).label('attempts_count')
    ).join(Mark, Mark.question_id == Question.id
    ).join(CO, CO.id == Question.co_id)
    
    # Apply role-based filters
    if current_user.role == "teacher":
        query = query.join(ExamSection, ExamSection.id == Question.section_id
        ).join(Exam, Exam.id == ExamSection.exam_id
        ).join(Subject, Subject.id == Exam.subject_id
        ).filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "hod":
        query = query.join(ExamSection, ExamSection.id == Question.section_id
        ).join(Exam, Exam.id == ExamSection.exam_id
        ).join(Subject, Subject.id == Exam.subject_id
        ).filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if exam_id:
        query = query.join(ExamSection, ExamSection.id == Question.section_id).filter(ExamSection.exam_id == exam_id)
    if subject_id:
        query = query.join(ExamSection, ExamSection.id == Question.section_id
        ).join(Exam, Exam.id == ExamSection.exam_id).filter(Exam.subject_id == subject_id)
    if bloom_level:
        query = query.filter(Question.bloom_level == bloom_level)
    if difficulty_level:
        query = query.filter(Question.difficulty_level == difficulty_level)
    
    query = query.group_by(
        Question.id, Question.question_number, Question.question_text,
        Question.bloom_level, Question.difficulty_level, Question.marks, CO.name
    )
    
    question_results = query.all()
    
    question_analytics = []
    for q in question_results:
        difficulty_index = calculate_difficulty_index(float(q.avg_marks or 0), float(q.max_marks))
        
        # Calculate discrimination index (simplified)
        # Get top 27% and bottom 27% performers for this question
        top_performers = db.query(Mark.marks_obtained).filter(
            Mark.question_id == q.question_id
        ).order_by(Mark.marks_obtained.desc()).limit(max(1, int(q.attempts_count * 0.27))).all()
        
        bottom_performers = db.query(Mark.marks_obtained).filter(
            Mark.question_id == q.question_id
        ).order_by(Mark.marks_obtained.asc()).limit(max(1, int(q.attempts_count * 0.27))).all()
        
        high_avg = sum(p[0] for p in top_performers) / len(top_performers) if top_performers else 0
        low_avg = sum(p[0] for p in bottom_performers) / len(bottom_performers) if bottom_performers else 0
        
        discrimination_index = calculate_discrimination_index(high_avg, low_avg, float(q.max_marks))
        
        question_analytics.append(QuestionAnalyticsResponse(
            question_id=q.question_id,
            question_number=q.question_number or "",
            question_text=q.question_text[:100] + "..." if len(q.question_text) > 100 else q.question_text,
            bloom_level=q.bloom_level.value,
            difficulty_level=q.difficulty_level.value,
            co_name=q.co_name,
            max_marks=float(q.max_marks),
            avg_marks=round(float(q.avg_marks or 0), 2),
            difficulty_index=round(difficulty_index, 2),
            discrimination_index=round(discrimination_index, 2),
            attempts_count=q.attempts_count or 0
        ))
    
    return question_analytics

# Exam Analytics
@app.get("/exam-analytics", response_model=List[ExamAnalyticsResponse])
async def get_exam_analytics(
    exam_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for exams
    exams_query = db.query(Exam).options(
        joinedload(Exam.subject),
        joinedload(Exam.class_ref)
    )
    
    # Apply role-based filters
    if current_user.role == "teacher":
        exams_query = exams_query.join(Subject).filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "hod":
        exams_query = exams_query.join(Subject).filter(Subject.department_id == current_user.department_id)
    
    # Apply additional filters
    if exam_id:
        exams_query = exams_query.filter(Exam.id == exam_id)
    if subject_id:
        exams_query = exams_query.filter(Exam.subject_id == subject_id)
    if class_id:
        exams_query = exams_query.filter(Exam.class_id == class_id)
    
    exams = exams_query.all()
    
    exam_analytics = []
    for exam in exams:
        # Get basic statistics
        exam_stats = db.query(
            func.count(func.distinct(Mark.student_id)).label('total_students'),
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('average_score')
        ).join(Question).join(ExamSection).filter(ExamSection.exam_id == exam.id).first()
        
        total_students = exam_stats.total_students or 0
        average_score = float(exam_stats.average_score or 0)
        
        # Calculate pass rate (assuming 40% is passing)
        passing_students = db.query(
            func.count(func.distinct(Mark.student_id))
        ).select_from(
            db.query(
                Mark.student_id,
                (func.sum(Mark.marks_obtained) / func.sum(Mark.max_marks) * 100).label('student_percentage')
            ).join(Question).join(ExamSection).filter(
                ExamSection.exam_id == exam.id
            ).group_by(Mark.student_id).having(
                text('student_percentage >= 40')
            ).subquery()
        ).scalar() or 0
        
        pass_rate = (passing_students / total_students * 100) if total_students > 0 else 0
        
        # Get Bloom's taxonomy distribution
        bloom_dist = db.query(
            Question.bloom_level,
            func.count(Question.id)
        ).join(ExamSection).filter(ExamSection.exam_id == exam.id).group_by(Question.bloom_level).all()
        
        bloom_distribution = {level.value: count for level, count in bloom_dist}
        
        # Get difficulty distribution
        diff_dist = db.query(
            Question.difficulty_level,
            func.count(Question.id)
        ).join(ExamSection).filter(ExamSection.exam_id == exam.id).group_by(Question.difficulty_level).all()
        
        difficulty_distribution = {level.value: count for level, count in diff_dist}
        
        # Calculate reliability coefficient (simplified Cronbach's alpha)
        # Get all student scores for all questions in this exam
        student_question_scores = db.query(
            Mark.student_id,
            Mark.question_id,
            (Mark.marks_obtained / Mark.max_marks).label('score_ratio')
        ).join(Question).join(ExamSection).filter(ExamSection.exam_id == exam.id).all()
        
        # Organize scores by student
        student_scores = {}
        for score in student_question_scores:
            if score.student_id not in student_scores:
                student_scores[score.student_id] = []
            student_scores[score.student_id].append(float(score.score_ratio))
        
        # Calculate reliability if we have enough data
        reliability_coefficient = 0.0
        if len(student_scores) >= 2:
            scores_matrix = list(student_scores.values())
            if all(len(scores) == len(scores_matrix[0]) for scores in scores_matrix):
                reliability_coefficient = calculate_reliability_coefficient(scores_matrix)
        
        exam_analytics.append(ExamAnalyticsResponse(
            exam_id=exam.id,
            exam_title=exam.title,
            subject_name=exam.subject.name,
            class_name=exam.class_ref.name,
            total_students=total_students,
            average_score=round(average_score, 2),
            pass_rate=round(pass_rate, 2),
            reliability_coefficient=round(reliability_coefficient, 2),
            bloom_distribution=bloom_distribution,
            difficulty_distribution=difficulty_distribution
        ))
    
    return exam_analytics

# Dashboard Analytics
@app.get("/dashboard-stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    stats = {}
    
    if current_user.role == "admin":
        # Overall system statistics
        stats = {
            'total_users': db.query(User).count(),
            'total_departments': db.query(Department).count(),
            'total_subjects': db.query(Subject).count(),
            'total_exams': db.query(Exam).count(),
            'active_students': db.query(User).filter(and_(User.role == "student", User.is_active == True)).count(),
            'active_teachers': db.query(User).filter(and_(User.role == "teacher", User.is_active == True)).count(),
            'completed_exams': db.query(Exam).filter(Exam.status == 'completed').count(),
            'avg_co_attainment': db.query(
                func.avg(Mark.marks_obtained / Mark.max_marks * 100)
            ).join(Question).scalar() or 0
        }
    
    elif current_user.role == "hod":
        # Department-specific statistics
        dept_id = current_user.department_id
        stats = {
            'department_users': db.query(User).filter(User.department_id == dept_id).count(),
            'department_subjects': db.query(Subject).filter(Subject.department_id == dept_id).count(),
            'department_classes': db.query(Class).filter(Class.department_id == dept_id).count(),
            'department_exams': db.query(Exam).join(Subject).filter(Subject.department_id == dept_id).count(),
            'department_students': db.query(User).filter(
                and_(User.department_id == dept_id, User.role == "student")
            ).count(),
            'department_teachers': db.query(User).filter(
                and_(User.department_id == dept_id, User.role == "teacher")
            ).count(),
            'avg_department_attainment': db.query(
                func.avg(Mark.marks_obtained / Mark.max_marks * 100)
            ).join(Question).join(CO).filter(CO.department_id == dept_id).scalar() or 0
        }
    
    elif current_user.role == "teacher":
        # Teacher-specific statistics
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        stats = {
            'my_subjects': db.query(Subject).filter(Subject.teacher_id == current_user_id).count(),
            'my_exams': db.query(Exam).filter(Exam.subject_id.in_(teacher_subjects)).count(),
            'my_students': db.query(func.count(func.distinct(User.id))).join(
                Class, User.class_id == Class.id
            ).join(Subject, Subject.class_id == Class.id).filter(
                Subject.teacher_id == current_user_id
            ).scalar() or 0,
            'avg_class_performance': db.query(
                func.avg(Mark.marks_obtained / Mark.max_marks * 100)
            ).join(Question).join(ExamSection).join(Exam).filter(
                Exam.subject_id.in_(teacher_subjects)
            ).scalar() or 0
        }
    
    elif current_user.role == "student":
        # Student-specific statistics
        student_marks = db.query(
            func.sum(Mark.marks_obtained).label('total_obtained'),
            func.sum(Mark.max_marks).label('total_max'),
            func.count(func.distinct(Mark.exam_id)).label('exams_taken')
        ).filter(Mark.student_id == current_user_id).first()
        
        overall_percentage = 0
        if student_marks.total_max and student_marks.total_max > 0:
            overall_percentage = (student_marks.total_obtained / student_marks.total_max) * 100
        
        stats = {
            'my_subjects': db.query(Subject).filter(Subject.class_id == current_user.class_id).count(),
            'exams_taken': student_marks.exams_taken or 0,
            'overall_percentage': round(overall_percentage, 2),
            'class_rank': 1,  # Placeholder - would need complex query
            'co_attainments_above_threshold': db.query(
                func.count(func.distinct(CO.id))
            ).join(Question).join(Mark).filter(
                and_(
                    Mark.student_id == current_user_id,
                    (Mark.marks_obtained / Mark.max_marks * 100) >= 50
                )
            ).scalar() or 0
        }
    
    return stats

# Trend Analytics
@app.get("/trends")
async def get_trend_analytics(
    period_days: int = Query(30, description="Number of days to analyze"),
    metric: str = Query("co_attainment", description="Metric to analyze: co_attainment, po_attainment, student_performance"),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=period_days)
    
    if metric == "co_attainment":
        # CO attainment trends
        trend_data = db.query(
            func.date(Mark.created_at).label('date'),
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_attainment')
        ).join(Question).join(CO)
        
        if current_user.role == "hod":
            trend_data = trend_data.filter(CO.department_id == current_user.department_id)
        elif current_user.role == "teacher":
            trend_data = trend_data.join(Subject).filter(Subject.teacher_id == current_user_id)
        
        trend_data = trend_data.filter(
            Mark.created_at.between(start_date, end_date)
        ).group_by(func.date(Mark.created_at)).order_by(func.date(Mark.created_at)).all()
        
        return {
            'metric': 'CO Attainment Trend',
            'period_days': period_days,
            'data_points': [
                {
                    'date': point.date.isoformat(),
                    'value': round(float(point.avg_attainment), 2)
                } for point in trend_data
            ]
        }
    
    elif metric == "student_performance":
        # Student performance trends
        trend_data = db.query(
            func.date(Mark.created_at).label('date'),
            func.count(func.distinct(Mark.student_id)).label('active_students'),
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
        ).filter(Mark.created_at.between(start_date, end_date))
        
        if current_user.role == "hod":
            trend_data = trend_data.join(User, User.id == Mark.student_id).filter(
                User.department_id == current_user.department_id
            )
        elif current_user.role == "teacher":
            teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
            trend_data = trend_data.join(Question).join(ExamSection).join(Exam).filter(
                Exam.subject_id.in_(teacher_subjects)
            )
        
        trend_data = trend_data.group_by(func.date(Mark.created_at)).order_by(func.date(Mark.created_at)).all()
        
        return {
            'metric': 'Student Performance Trend',
            'period_days': period_days,
            'data_points': [
                {
                    'date': point.date.isoformat(),
                    'active_students': point.active_students,
                    'avg_performance': round(float(point.avg_performance), 2)
                } for point in trend_data
            ]
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid metric")

# ML-based Student Recommendations
@app.get("/ml-recommendations")
async def get_ml_recommendations(
    student_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get students to analyze
    students_query = db.query(User).filter(User.role == "student")
    
    if current_user.role == "student":
        students_query = students_query.filter(User.id == current_user_id)
    elif current_user.role == "teacher":
        teacher_classes = db.query(Subject.class_id).filter(Subject.teacher_id == current_user_id).distinct().subquery()
        students_query = students_query.filter(User.class_id.in_(teacher_classes))
    elif current_user.role == "hod":
        students_query = students_query.filter(User.department_id == current_user.department_id)
    
    if student_id: 
        students_query = students_query.filter(User.id == student_id)
    if class_id:
        students_query = students_query.filter(User.class_id == class_id)
    
    students = students_query.all()
    
    recommendations = []
    
    for student in students:
        # Get student's performance data
        student_marks = db.query(
            Mark.marks_obtained,
            Mark.max_marks,
            Question.bloom_level,
            Question.difficulty_level,
            CO.name.label('co_name'),
            Subject.name.label('subject_name')
        ).join(Question).join(CO).join(ExamSection).join(Exam).join(Subject).filter(
            Mark.student_id == student.id
        ).all()
        
        if not student_marks:
            continue
        
        # Prepare data for ML model
        features = []
        scores = []
        
        for mark in student_marks:
            percentage = (mark.marks_obtained / mark.max_marks * 100) if mark.max_marks > 0 else 0
            
            # Feature engineering
            bloom_numeric = {'remember': 1, 'understand': 2, 'apply': 3, 'analyze': 4, 'evaluate': 5, 'create': 6}
            difficulty_numeric = {'easy': 1, 'medium': 2, 'hard': 3}
            
            features.append([
                bloom_numeric.get(mark.bloom_level.value, 1),
                difficulty_numeric.get(mark.difficulty_level.value, 2),
                mark.max_marks
            ])
            scores.append(percentage)
        
        if len(features) < 5: # Need minimum data for ML
            recommendations.append({
                'student_id': student.id,
                'student_name': student.full_name,
                'recommendations': ['Insufficient data for ML analysis'],
                'predicted_performance': None,
                'risk_level': 'Unknown'
            })
            continue
        
        # Train ML model
        X = np.array(features)
        y = np.array(scores)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = LinearRegression()
        model.fit(X_train_scaled, y_train)
        
        # Make predictions
        y_pred = model.predict(X_test_scaled)
        mse = mean_squared_error(y_test, y_pred)
        
        # Generate recommendations based on model
        student_recommendations = []
        
        # Analyze weak areas
        weak_cos = {}
        for mark in student_marks:
            percentage = (mark.marks_obtained / mark.max_marks * 100) if mark.max_marks > 0 else 0
            if percentage < 60:
                if mark.co_name not in weak_cos:
                    weak_cos[mark.co_name] = []
                weak_cos[mark.co_name].append(percentage)
        
        if weak_cos:
            student_recommendations.append(f"Focus on improving COs: {', '.join(weak_cos.keys())}")
        
        # Bloom level analysis
        bloom_performance = {}
        for mark in student_marks:
            percentage = (mark.marks_obtained / mark.max_marks * 100) if mark.max_marks > 0 else 0
            level = mark.bloom_level.value
            if level not in bloom_performance:
                bloom_performance[level] = []
            bloom_performance[level].append(percentage)
        
        # Find weakest bloom level
        avg_bloom_scores = {level: np.mean(scores) for level, scores in bloom_performance.items()}
        weakest_bloom = min(avg_bloom_scores.items(), key=lambda x: x[1])[0] if avg_bloom_scores else None
        
        if weakest_bloom:
            student_recommendations.append(f"Strengthen {weakest_bloom} level cognitive skills")
        
        # Difficulty analysis
        difficulty_performance = {}
        for mark in student_marks:
            percentage = (mark.marks_obtained / mark.max_marks * 100) if mark.max_marks > 0 else 0
            level = mark.difficulty_level.value
            if level not in difficulty_performance:
                difficulty_performance[level] = []
            difficulty_performance[level].append(percentage)
        
        # Check if struggling with harder questions
        if 'hard' in difficulty_performance:
            hard_avg = np.mean(difficulty_performance['hard'])
            if hard_avg < 50:
                student_recommendations.append("Practice more challenging problems")
        
        # Overall performance prediction
        overall_avg = np.mean(scores)
        predicted_performance = model.predict(scaler.transform([[
            np.mean([bloom_numeric.get(mark.bloom_level.value, 1) for mark in student_marks]),
            np.mean([difficulty_numeric.get(mark.difficulty_level.value, 2) for mark in student_marks]),
            np.mean([mark.max_marks for mark in student_marks])
        ]]))[0]
        
        # Risk assessment
        risk_level = "Low"
        if overall_avg < 50:
            risk_level = "High"
        elif overall_avg < 70:
            risk_level = "Medium"
        
        # Add general recommendations
        if overall_avg > 85:
            student_recommendations.append("Excellent performance! Consider advanced topics")
        elif overall_avg < 60:
            student_recommendations.append("Consider additional tutoring or practice sessions")
        
        recommendations.append({
            'student_id': student.id,
            'student_name': student.full_name,
            'current_performance': round(overall_avg, 2),
            'predicted_performance': round(predicted_performance, 2),
            'model_accuracy': round(100 - mse, 2),  # Simplified accuracy metric
            'risk_level': risk_level,
            'recommendations': student_recommendations[:5],  # Limit to 5 recommendations
            'weak_areas': list(weak_cos.keys()),
            'strong_areas': [co for co, scores in weak_cos.items() if np.mean(scores) >= 75]
        })
    
    return {
        'total_students': len(recommendations),
        'recommendations': recommendations
    }

@app.get("/dashboard-stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get dashboard statistics"""
    try:
        # Get basic counts
        total_users = db.query(User).count()
        total_departments = db.query(Department).count()
        total_subjects = db.query(Subject).count()
        total_classes = db.query(Class).count()
        total_exams = db.query(Exam).count()
        
        # Get recent activity (last 7 days)
        week_ago = datetime.now() - timedelta(days=7)
        recent_exams = db.query(Exam).filter(Exam.created_at >= week_ago).count()
        recent_marks = db.query(Mark).filter(Mark.created_at >= week_ago).count()
        
        return {
            "total_users": total_users,
            "total_departments": total_departments,
            "total_subjects": total_subjects,
            "total_classes": total_classes,
            "total_exams": total_exams,
            "recent_exams": recent_exams,
            "recent_marks": recent_marks,
            "avg_co_attainment": 0.0  # Placeholder
        }
    except Exception as e:
        return {
            "total_users": 0,
            "total_departments": 0,
            "total_subjects": 0,
            "total_classes": 0,
            "total_exams": 0,
            "recent_exams": 0,
            "recent_marks": 0,
            "avg_co_attainment": 0.0
        }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)