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
    Class, ExamSection, Semester, StudentSemesterEnrollment, Attendance
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
    semester_id: Optional[int] = None,
    academic_year: Optional[str] = None,
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
    if semester_id:
        # Filter by semester through classes
        query = query.join(Exam, Exam.subject_id == Subject.id
        ).join(Class, Class.id == Exam.class_id
        ).filter(Class.semester_id == semester_id)
    if academic_year:
        # Filter by academic year through semesters
        query = query.join(Exam, Exam.subject_id == Subject.id
        ).join(Class, Class.id == Exam.class_id
        ).join(Semester, Semester.id == Class.semester_id
        ).filter(Semester.academic_year == academic_year)
    
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
    semester_id: Optional[int] = None,
    academic_year: Optional[str] = None,
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
    
    # Apply semester context filters
    if semester_id:
        po_query = po_query.join(Exam, Exam.subject_id == Subject.id
        ).join(Class, Class.id == Exam.class_id
        ).filter(Class.semester_id == semester_id)
    if academic_year:
        po_query = po_query.join(Exam, Exam.subject_id == Subject.id
        ).join(Class, Class.id == Exam.class_id
        ).join(Semester, Semester.id == Class.semester_id
        ).filter(Semester.academic_year == academic_year)
    
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
    semester_id: Optional[int] = None,
    academic_year: Optional[str] = None,
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
    if semester_id:
        # Filter students by semester through their class
        students_query = students_query.join(Class, Class.id == User.class_id
        ).filter(Class.semester_id == semester_id)
    if academic_year:
        # Filter students by academic year through semester
        students_query = students_query.join(Class, Class.id == User.class_id
        ).join(Semester, Semester.id == Class.semester_id
        ).filter(Semester.academic_year == academic_year)
    
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

# Cross-Semester Analytics
@app.get("/cross-semester-performance")
async def get_cross_semester_performance(
    student_id: Optional[int] = None,
    department_id: Optional[int] = None,
    academic_year: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get performance trends across semesters for students"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for student semester enrollments
    enrollments_query = db.query(StudentSemesterEnrollment).options(
        joinedload(StudentSemesterEnrollment.student),
        joinedload(StudentSemesterEnrollment.semester),
        joinedload(StudentSemesterEnrollment.class_ref)
    )
    
    # Apply role-based filters
    if current_user.role == "student":
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.student_id == current_user_id)
    elif current_user.role == "teacher":
        # Get enrollments for classes the teacher teaches
        teacher_classes = db.query(Subject.class_id).filter(Subject.teacher_id == current_user_id).distinct().subquery()
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.class_id.in_(teacher_classes))
    elif current_user.role == "hod":
        enrollments_query = enrollments_query.join(Semester).filter(Semester.department_id == current_user.department_id)
    
    # Apply additional filters
    if student_id:
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.student_id == student_id)
    if department_id:
        enrollments_query = enrollments_query.join(Semester).filter(Semester.department_id == department_id)
    if academic_year:
        enrollments_query = enrollments_query.join(Semester).filter(Semester.academic_year == academic_year)
    
    enrollments = enrollments_query.order_by(
        StudentSemesterEnrollment.student_id,
        Semester.semester_number
    ).all()
    
    # Group by student and semester
    student_semester_data = {}
    for enrollment in enrollments:
        student_id = enrollment.student_id
        semester_num = enrollment.semester.semester_number
        
        if student_id not in student_semester_data:
            student_semester_data[student_id] = {
                'student': enrollment.student,
                'semesters': {}
            }
        
        # Get marks for this student in this semester
        semester_marks = db.query(
            func.sum(Mark.marks_obtained).label('total_obtained'),
            func.sum(Mark.max_marks).label('total_max')
        ).join(Question).join(ExamSection).join(Exam).join(Class).filter(
            Mark.student_id == student_id,
            Class.semester_id == enrollment.semester_id
        ).first()
        
        semester_percentage = 0
        if semester_marks.total_max and semester_marks.total_max > 0:
            semester_percentage = (semester_marks.total_obtained / semester_marks.total_max) * 100
        
        student_semester_data[student_id]['semesters'][semester_num] = {
            'semester_number': semester_num,
            'semester_name': enrollment.semester.name,
            'gpa': enrollment.gpa,
            'attendance_percentage': enrollment.attendance_percentage,
            'performance_percentage': round(semester_percentage, 2),
            'final_grade': enrollment.final_grade,
            'status': enrollment.status
        }
    
    # Convert to response format
    cross_semester_data = []
    for student_id, data in student_semester_data.items():
        semesters = []
        for sem_num in sorted(data['semesters'].keys()):
            semesters.append(data['semesters'][sem_num])
        
        # Calculate trends
        performance_trend = "stable"
        if len(semesters) >= 2:
            first_perf = semesters[0]['performance_percentage']
            last_perf = semesters[-1]['performance_percentage']
            if last_perf > first_perf + 5:
                performance_trend = "improving"
            elif last_perf < first_perf - 5:
                performance_trend = "declining"
        
        cross_semester_data.append({
            'student_id': student_id,
            'student_name': data['student'].full_name,
            'student_username': data['student'].username,
            'semesters': semesters,
            'performance_trend': performance_trend,
            'overall_gpa': round(sum(s['gpa'] or 0 for s in semesters) / len(semesters), 2) if semesters else 0,
            'average_attendance': round(sum(s['attendance_percentage'] or 0 for s in semesters) / len(semesters), 2) if semesters else 0
        })
    
    return cross_semester_data

# Role-Specific Analytics
@app.get("/role-analytics")
async def get_role_specific_analytics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get analytics specific to the user's role"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if current_user.role == "admin":
        # Admin gets institution-wide analytics
        return {
            "role": "admin",
            "scope": "institution",
            "analytics": {
                "total_departments": db.query(Department).filter(Department.is_active == True).count(),
                "total_faculty": db.query(User).filter(User.role.in_(["hod", "teacher"]), User.is_active == True).count(),
                "total_students": db.query(User).filter(User.role == "student", User.is_active == True).count(),
                "active_semesters": db.query(Semester).filter(Semester.is_active == True).count(),
                "total_exams": db.query(Exam).count(),
                "department_performance": await get_department_performance_comparison(db),
                "institution_trends": await get_institution_trends(db)
            }
        }
    
    elif current_user.role == "hod":
        # HOD gets department-specific analytics
        department = db.query(Department).filter(Department.id == current_user.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        
        return {
            "role": "hod",
            "scope": "department",
            "department_id": current_user.department_id,
            "department_name": department.name,
            "analytics": {
                "department_stats": await get_department_stats(db, current_user.department_id),
                "semester_breakdown": await get_department_semester_breakdown(db, current_user.department_id),
                "teacher_performance": await get_department_teacher_performance(db, current_user.department_id),
                "student_progression": await get_department_student_progression(db, current_user.department_id),
                "co_po_attainment": await get_department_copo_attainment(db, current_user.department_id)
            }
        }
    
    elif current_user.role == "teacher":
        # Teacher gets subject-specific analytics
        teacher_subjects = db.query(Subject).filter(
            Subject.teacher_id == current_user_id,
            Subject.is_active == True
        ).all()
        
        return {
            "role": "teacher",
            "scope": "subjects",
            "teacher_id": current_user_id,
            "teacher_name": current_user.full_name,
            "analytics": {
                "assigned_subjects": len(teacher_subjects),
                "subject_performance": await get_teacher_subject_performance(db, current_user_id),
                "class_analytics": await get_teacher_class_analytics(db, current_user_id),
                "question_effectiveness": await get_teacher_question_effectiveness(db, current_user_id),
                "student_feedback": await get_teacher_student_feedback(db, current_user_id)
            }
        }
    
    elif current_user.role == "student":
        # Student gets personal analytics
        return {
            "role": "student",
            "scope": "personal",
            "student_id": current_user_id,
            "student_name": current_user.full_name,
            "analytics": {
                "academic_performance": await get_student_academic_performance(db, current_user_id),
                "subject_breakdown": await get_student_subject_breakdown(db, current_user_id),
                "co_po_progress": await get_student_copo_progress(db, current_user_id),
                "attendance_summary": await get_student_attendance_summary(db, current_user_id),
                "improvement_areas": await get_student_improvement_areas(db, current_user_id),
                "recommendations": await get_student_recommendations(db, current_user_id)
            }
        }
    
    else:
        raise HTTPException(status_code=403, detail="Invalid role")

# Helper functions for role-specific analytics
async def get_department_performance_comparison(db: Session):
    """Get performance comparison across departments"""
    departments = db.query(Department).filter(Department.is_active == True).all()
    comparison = []
    
    for dept in departments:
        # Get average performance for this department
        dept_performance = db.query(
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
        ).join(Question).join(ExamSection).join(Exam).join(Subject).filter(
            Subject.department_id == dept.id
        ).scalar() or 0
        
        comparison.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "average_performance": round(float(dept_performance), 2),
            "total_students": db.query(User).filter(
                User.department_id == dept.id,
                User.role == "student"
            ).count()
        })
    
    return sorted(comparison, key=lambda x: x["average_performance"], reverse=True)

async def get_institution_trends(db: Session):
    """Get institution-wide trends"""
    # Get performance trends over time
    monthly_performance = db.query(
        func.date_trunc('month', Mark.created_at).label('month'),
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
    ).group_by(func.date_trunc('month', Mark.created_at)).order_by('month').all()
    
    return {
        "monthly_performance": [
            {"month": month.strftime('%Y-%m'), "performance": round(float(avg), 2)}
            for month, avg in monthly_performance
        ],
        "total_exams_conducted": db.query(Exam).count(),
        "active_academic_year": db.query(Semester.academic_year).distinct().count()
    }

async def get_department_stats(db: Session, department_id: int):
    """Get department-specific statistics"""
    return {
        "total_students": db.query(User).filter(
            User.department_id == department_id,
            User.role == "student"
        ).count(),
        "total_teachers": db.query(User).filter(
            User.department_id == department_id,
            User.role == "teacher"
        ).count(),
        "total_classes": db.query(Class).join(Semester).filter(
            Semester.department_id == department_id
        ).count(),
        "total_subjects": db.query(Subject).filter(
            Subject.department_id == department_id
        ).count(),
        "active_semesters": db.query(Semester).filter(
            Semester.department_id == department_id,
            Semester.is_active == True
        ).count()
    }

async def get_department_semester_breakdown(db: Session, department_id: int):
    """Get semester-wise breakdown for department"""
    semesters = db.query(Semester).filter(
        Semester.department_id == department_id
    ).order_by(Semester.semester_number).all()
    
    breakdown = []
    for semester in semesters:
        # Get student count and performance for this semester
        student_count = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.semester_id == semester.id
        ).count()
        
        semester_performance = db.query(
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
        ).join(Question).join(ExamSection).join(Exam).join(Class).filter(
            Class.semester_id == semester.id
        ).scalar() or 0
        
        breakdown.append({
            "semester_id": semester.id,
            "semester_number": semester.semester_number,
            "semester_name": semester.name,
            "student_count": student_count,
            "average_performance": round(float(semester_performance), 2),
            "is_active": semester.is_active
        })
    
    return breakdown

async def get_department_teacher_performance(db: Session, department_id: int):
    """Get teacher performance within department"""
    teachers = db.query(User).filter(
        User.department_id == department_id,
        User.role == "teacher"
    ).all()
    
    teacher_performance = []
    for teacher in teachers:
        # Get teacher's subjects and their performance
        subjects = db.query(Subject).filter(Subject.teacher_id == teacher.id).all()
        total_subjects = len(subjects)
        
        # Calculate average performance across all teacher's subjects
        teacher_avg_performance = db.query(
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
        ).join(Question).join(ExamSection).join(Exam).filter(
            Exam.subject_id.in_([s.id for s in subjects])
        ).scalar() or 0
        
        teacher_performance.append({
            "teacher_id": teacher.id,
            "teacher_name": teacher.full_name,
            "total_subjects": total_subjects,
            "average_performance": round(float(teacher_avg_performance), 2),
            "total_students": db.query(User).filter(
                User.class_id.in_([c.id for c in db.query(Class).join(Subject).filter(Subject.teacher_id == teacher.id).all()])
            ).count()
        })
    
    return sorted(teacher_performance, key=lambda x: x["average_performance"], reverse=True)

async def get_department_student_progression(db: Session, department_id: int):
    """Get student progression within department"""
    # Get students who have completed multiple semesters
    student_progressions = db.query(
        StudentSemesterEnrollment.student_id,
        func.count(StudentSemesterEnrollment.semester_id).label('semesters_completed'),
        func.avg(StudentSemesterEnrollment.gpa).label('avg_gpa')
    ).join(Semester).filter(
        Semester.department_id == department_id,
        StudentSemesterEnrollment.status == 'completed'
    ).group_by(StudentSemesterEnrollment.student_id).all()
    
    return {
        "total_students_with_progression": len(student_progressions),
        "average_semesters_completed": round(
            sum(p.semesters_completed for p in student_progressions) / len(student_progressions) if student_progressions else 0, 2
        ),
        "average_gpa": round(
            sum(p.avg_gpa for p in student_progressions) / len(student_progressions) if student_progressions else 0, 2
        )
    }

async def get_department_copo_attainment(db: Session, department_id: int):
    """Get CO/PO attainment for department"""
    # Get CO attainment
    co_attainment = db.query(
        CO.name.label('co_name'),
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('attainment')
    ).join(Question).join(Mark).join(Subject).filter(
        Subject.department_id == department_id
    ).group_by(CO.id, CO.name).all()
    
    # Get PO attainment
    po_attainment = db.query(
        PO.name.label('po_name'),
        func.avg(
            COPOMapping.mapping_strength * (Mark.marks_obtained / Mark.max_marks * 100)
        ).label('attainment')
    ).join(COPOMapping).join(CO).join(Question).join(Mark).join(Subject).filter(
        Subject.department_id == department_id
    ).group_by(PO.id, PO.name).all()
    
    return {
        "co_attainment": [
            {"co_name": co.co_name, "attainment": round(float(co.attainment), 2)}
            for co in co_attainment
        ],
        "po_attainment": [
            {"po_name": po.po_name, "attainment": round(float(po.attainment), 2)}
            for po in po_attainment
        ]
    }

async def get_teacher_subject_performance(db: Session, teacher_id: int):
    """Get performance for teacher's subjects"""
    subjects = db.query(Subject).filter(Subject.teacher_id == teacher_id).all()
    subject_performance = []
    
    for subject in subjects:
        # Get average performance for this subject
        avg_performance = db.query(
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
        ).join(Question).join(ExamSection).join(Exam).filter(
            Exam.subject_id == subject.id
        ).scalar() or 0
        
        # Get student count
        student_count = db.query(User).filter(User.class_id == subject.class_id).count()
        
        subject_performance.append({
            "subject_id": subject.id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "average_performance": round(float(avg_performance), 2),
            "student_count": student_count
        })
    
    return subject_performance

async def get_teacher_class_analytics(db: Session, teacher_id: int):
    """Get class analytics for teacher"""
    classes = db.query(Class).join(Subject).filter(Subject.teacher_id == teacher_id).distinct().all()
    class_analytics = []
    
    for class_obj in classes:
        # Get class performance
        class_performance = db.query(
            func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
        ).join(Question).join(ExamSection).join(Exam).filter(
            Exam.class_id == class_obj.id
        ).scalar() or 0
        
        class_analytics.append({
            "class_id": class_obj.id,
            "class_name": class_obj.name,
            "semester": class_obj.semester.semester_number,
            "average_performance": round(float(class_performance), 2),
            "student_count": db.query(User).filter(User.class_id == class_obj.id).count()
        })
    
    return class_analytics

async def get_teacher_question_effectiveness(db: Session, teacher_id: int):
    """Get question effectiveness for teacher"""
    questions = db.query(Question).join(ExamSection).join(Exam).join(Subject).filter(
        Subject.teacher_id == teacher_id
    ).all()
    
    question_stats = []
    for question in questions:
        # Get question performance
        avg_marks = db.query(func.avg(Mark.marks_obtained)).filter(
            Mark.question_id == question.id
        ).scalar() or 0
        
        difficulty_index = float(avg_marks) / float(question.marks) if question.marks > 0 else 0
        
        question_stats.append({
            "question_id": question.id,
            "question_number": question.question_number,
            "difficulty_index": round(difficulty_index, 2),
            "bloom_level": question.bloom_level,
            "average_marks": round(float(avg_marks), 2),
            "max_marks": float(question.marks)
        })
    
    return question_stats

async def get_teacher_student_feedback(db: Session, teacher_id: int):
    """Get student feedback for teacher (mock data for now)"""
    # This would typically come from a feedback system
    return {
        "total_feedback_responses": 0,
        "average_rating": 0.0,
        "feedback_summary": "No feedback available"
    }

async def get_student_academic_performance(db: Session, student_id: int):
    """Get student's academic performance"""
    # Get overall performance
    overall_performance = db.query(
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
    ).filter(Mark.student_id == student_id).scalar() or 0
    
    # Get performance by semester
    semester_performance = db.query(
        Semester.semester_number,
        Semester.name,
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
    ).join(Class).join(Exam).join(ExamSection).join(Question).join(Mark).filter(
        Mark.student_id == student_id
    ).group_by(Semester.id, Semester.semester_number, Semester.name).order_by(Semester.semester_number).all()
    
    return {
        "overall_performance": round(float(overall_performance), 2),
        "semester_breakdown": [
            {
                "semester_number": sem.semester_number,
                "semester_name": sem.name,
                "performance": round(float(sem.avg_performance), 2)
            }
            for sem in semester_performance
        ]
    }

async def get_student_subject_breakdown(db: Session, student_id: int):
    """Get student's performance by subject"""
    subject_performance = db.query(
        Subject.name,
        Subject.code,
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance')
    ).join(Exam).join(ExamSection).join(Question).join(Mark).filter(
        Mark.student_id == student_id
    ).group_by(Subject.id, Subject.name, Subject.code).all()
    
    return [
        {
            "subject_name": subj.name,
            "subject_code": subj.code,
            "performance": round(float(subj.avg_performance), 2)
        }
        for subj in subject_performance
    ]

async def get_student_copo_progress(db: Session, student_id: int):
    """Get student's CO/PO progress"""
    # Get CO progress
    co_progress = db.query(
        CO.name,
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('attainment')
    ).join(Question).join(Mark).filter(
        Mark.student_id == student_id
    ).group_by(CO.id, CO.name).all()
    
    return {
        "co_progress": [
            {"co_name": co.name, "attainment": round(float(co.attainment), 2)}
            for co in co_progress
        ]
    }

async def get_student_attendance_summary(db: Session, student_id: int):
    """Get student's attendance summary"""
    attendance_records = db.query(Attendance).filter(Attendance.student_id == student_id).all()
    
    if not attendance_records:
        return {"attendance_percentage": 0, "total_days": 0, "present_days": 0}
    
    present_days = len([a for a in attendance_records if a.status == "present"])
    total_days = len(attendance_records)
    attendance_percentage = (present_days / total_days * 100) if total_days > 0 else 0
    
    return {
        "attendance_percentage": round(attendance_percentage, 2),
        "total_days": total_days,
        "present_days": present_days
    }

async def get_student_improvement_areas(db: Session, student_id: int):
    """Get areas where student needs improvement"""
    # Get subjects with low performance
    low_performance_subjects = db.query(Subject.name).join(Exam).join(ExamSection).join(Question).join(Mark).filter(
        Mark.student_id == student_id,
        Mark.marks_obtained / Mark.max_marks < 0.5
    ).distinct().all()
    
    return [
        {"area": subj.name, "reason": "Below 50% performance"}
        for subj in low_performance_subjects
    ]

async def get_student_recommendations(db: Session, student_id: int):
    """Get personalized recommendations for student"""
    # This would typically use ML or rule-based recommendations
    return [
        "Focus on improving performance in subjects with low scores",
        "Increase attendance to improve overall performance",
        "Practice more questions in areas with low CO attainment"
    ]

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
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get dashboard statistics with role-based filtering using real data"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build base queries with role-based filtering
    users_query = db.query(User).filter(User.is_active == True)
    departments_query = db.query(Department).filter(Department.is_active == True)
    subjects_query = db.query(Subject).filter(Subject.is_active == True)
    classes_query = db.query(Class).filter(Class.is_active == True)
    exams_query = db.query(Exam)
    
    # Apply role-based filtering
    if current_user.role == "hod":
        users_query = users_query.filter(User.department_id == current_user.department_id)
        departments_query = departments_query.filter(Department.id == current_user.department_id)
        subjects_query = subjects_query.filter(Subject.department_id == current_user.department_id)
        classes_query = classes_query.join(Department).filter(Department.id == current_user.department_id)
        exams_query = exams_query.join(Subject).filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see data for their subjects
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        users_query = users_query.join(Class).join(Subject).filter(Subject.id.in_(teacher_subjects))
        subjects_query = subjects_query.filter(Subject.teacher_id == current_user_id)
        classes_query = classes_query.join(Subject).filter(Subject.teacher_id == current_user_id)
        exams_query = exams_query.filter(Exam.subject_id.in_(teacher_subjects))
    elif current_user.role == "student":
        # Students can only see their own data
        users_query = users_query.filter(User.id == current_user_id)
        subjects_query = subjects_query.join(Class).filter(Class.id == current_user.class_id)
        classes_query = classes_query.filter(Class.id == current_user.class_id)
        exams_query = exams_query.filter(Exam.class_id == current_user.class_id)
    
    # Apply additional filters
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            users_query = users_query.filter(User.department_id == department_id)
            subjects_query = subjects_query.filter(Subject.department_id == department_id)
            classes_query = classes_query.join(Department).filter(Department.id == department_id)
            exams_query = exams_query.join(Subject).filter(Subject.department_id == department_id)
    
    if semester_id:
        classes_query = classes_query.filter(Class.semester_id == semester_id)
        subjects_query = subjects_query.filter(Subject.semester_id == semester_id)
    
    # Calculate statistics from real data
    total_users = users_query.count()
    total_departments = departments_query.count()
    total_subjects = subjects_query.count()
    total_classes = classes_query.count()
    total_exams = exams_query.count()
    
    # Get recent activity (last 7 days)
    week_ago = datetime.now() - timedelta(days=7)
    recent_exams = exams_query.filter(Exam.created_at >= week_ago).count()
    
    # Get recent marks entries
    recent_marks = db.query(Mark).filter(Mark.created_at >= week_ago).count()
    
    # Calculate average CO attainment from real marks data
    co_attainments = db.query(
        func.avg((Mark.marks_obtained / Mark.max_marks) * 100)
    ).join(Question).filter(
        Question.co_id.isnot(None),
        Mark.marks_obtained.isnot(None),
        Mark.max_marks > 0
    ).scalar()
    
    avg_co_attainment = round(co_attainments, 2) if co_attainments else 0.0
    
    # Calculate real attendance statistics
    total_attendance_records = db.query(Attendance).count()
    present_attendance = db.query(Attendance).filter(Attendance.status == "present").count()
    attendance_percentage = (present_attendance / total_attendance_records * 100) if total_attendance_records > 0 else 0
    
    # Role-specific additional stats from real data
    additional_stats = {}
    
    if current_user.role == "admin":
        # Admin gets institution-wide stats
        additional_stats = {
            "total_hods": users_query.filter(User.role == "hod").count(),
            "total_teachers": users_query.filter(User.role == "teacher").count(),
            "total_students": users_query.filter(User.role == "student").count(),
            "active_semesters": db.query(Semester).filter(Semester.is_active == True).count(),
            "attendance_percentage": round(attendance_percentage, 2),
            "total_attendance_records": total_attendance_records,
            "completed_exams": db.query(Exam).filter(Exam.status == 'completed').count()
        }
    elif current_user.role == "hod":
        # HOD gets department-specific stats
        dept_attendance = db.query(Attendance).join(User).filter(
            User.department_id == current_user.department_id
        ).count()
        dept_present = db.query(Attendance).join(User).filter(
            User.department_id == current_user.department_id,
            Attendance.status == "present"
        ).count()
        dept_attendance_percentage = (dept_present / dept_attendance * 100) if dept_attendance > 0 else 0
        
        additional_stats = {
            "department_teachers": users_query.filter(User.role == "teacher").count(),
            "department_students": users_query.filter(User.role == "student").count(),
            "department_classes": total_classes,
            "active_semesters": db.query(Semester).filter(
                Semester.department_id == current_user.department_id,
                Semester.is_active == True
            ).count(),
            "attendance_percentage": round(dept_attendance_percentage, 2)
        }
    elif current_user.role == "teacher":
        # Teacher gets subject-specific stats
        teacher_attendance = db.query(Attendance).join(Subject).filter(
            Subject.teacher_id == current_user_id
        ).count()
        teacher_present = db.query(Attendance).join(Subject).filter(
            Subject.teacher_id == current_user_id,
            Attendance.status == "present"
        ).count()
        teacher_attendance_percentage = (teacher_present / teacher_attendance * 100) if teacher_attendance > 0 else 0
        
        additional_stats = {
            "assigned_subjects": total_subjects,
            "assigned_classes": total_classes,
            "students_taught": users_query.filter(User.role == "student").count(),
            "attendance_percentage": round(teacher_attendance_percentage, 2)
        }
    elif current_user.role == "student":
        # Student gets personal stats
        student_attendance = db.query(Attendance).filter(
            Attendance.student_id == current_user_id
        ).count()
        student_present = db.query(Attendance).filter(
            Attendance.student_id == current_user_id,
            Attendance.status == "present"
        ).count()
        student_attendance_percentage = (student_present / student_attendance * 100) if student_attendance > 0 else 0
        
        # Get student's exam performance
        student_marks = db.query(Mark).filter(Mark.student_id == current_user_id).all()
        student_total_marks = sum(mark.marks_obtained for mark in student_marks)
        student_max_marks = sum(mark.max_marks for mark in student_marks)
        student_percentage = (student_total_marks / student_max_marks * 100) if student_max_marks > 0 else 0
        
        additional_stats = {
            "attendance_percentage": round(student_attendance_percentage, 2),
            "overall_percentage": round(student_percentage, 2),
            "total_exams_attempted": len(set(mark.exam_id for mark in student_marks)),
            "subjects_enrolled": total_subjects
        }
    
    return {
        "total_users": total_users,
        "total_departments": total_departments,
        "total_subjects": total_subjects,
        "total_classes": total_classes,
        "total_exams": total_exams,
        "recent_exams": recent_exams,
        "recent_marks": recent_marks,
        "avg_co_attainment": avg_co_attainment,
        **additional_stats
    }

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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics"}

# Advanced Analytics Endpoints for Frontend

@app.get("/predictive-insights")
async def get_predictive_insights(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get predictive insights for student performance"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get student performance data for predictions
    query = db.query(
        User.id,
        User.name,
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance'),
        func.count(Mark.id).label('total_assessments'),
        func.stddev(Mark.marks_obtained / Mark.max_marks * 100).label('performance_variance')
    ).join(Mark, Mark.student_id == User.id).filter(User.role == 'student')
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.join(Question).join(ExamSection).join(Exam).filter(
            Exam.subject_id.in_(teacher_subjects)
        )
    elif current_user.role == "student":
        query = query.filter(User.id == current_user_id)
    
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(User.department_id == department_id)
    
    query = query.group_by(User.id, User.name)
    students_data = query.all()
    
    insights = []
    for student in students_data:
        risk_level = "low"
        if student.avg_performance < 40:
            risk_level = "high"
        elif student.avg_performance < 60:
            risk_level = "medium"
        
        insights.append({
            "student_id": student.id,
            "student_name": student.name,
            "predicted_performance": round(student.avg_performance, 2),
            "risk_level": risk_level,
            "confidence": min(95, 70 + (student.total_assessments * 2)),
            "recommendations": [
                "Additional tutoring needed" if risk_level == "high" else "Monitor progress",
                "Focus on weaker subjects" if student.performance_variance and student.performance_variance > 20 else "Maintain current pace"
            ]
        })
    
    return {
        "insights": insights,
        "summary": {
            "total_students": len(insights),
            "high_risk": len([i for i in insights if i["risk_level"] == "high"]),
            "medium_risk": len([i for i in insights if i["risk_level"] == "medium"]),
            "low_risk": len([i for i in insights if i["risk_level"] == "low"])
        }
    }

@app.get("/advanced-copo")
async def get_advanced_copo_analytics(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get advanced CO/PO analytics with mapping insights"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get CO attainment with PO mappings
    query = db.query(
        CO.id,
        CO.code,
        CO.description,
        Subject.name.label('subject_name'),
        Department.name.label('department_name'),
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('attainment'),
        func.count(Mark.id).label('total_assessments')
    ).join(Question, Question.co_id == CO.id)\
     .join(Mark, Mark.question_id == Question.id)\
     .join(Subject, Subject.id == CO.subject_id)\
     .join(Department, Department.id == Subject.department_id)
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Department.id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.filter(Mark.student_id == current_user_id)
    
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(Department.id == department_id)
    
    query = query.group_by(CO.id, CO.code, CO.description, Subject.name, Department.name)
    co_data = query.all()
    
    # Get PO mappings for these COs
    po_mappings = db.query(COPOMapping, PO.code, PO.description)\
                    .join(PO, PO.id == COPOMapping.po_id)\
                    .filter(COPOMapping.co_id.in_([co.id for co in co_data]))\
                    .all()
    
    # Organize data
    co_analytics = []
    for co in co_data:
        mapped_pos = [
            {
                "po_code": mapping.code,
                "po_description": mapping.description,
                "mapping_level": mapping.COPOMapping.mapping_level
            }
            for mapping in po_mappings if mapping.COPOMapping.co_id == co.id
        ]
        
        co_analytics.append({
            "co_id": co.id,
            "co_code": co.code,
            "co_description": co.description,
            "subject_name": co.subject_name,
            "department_name": co.department_name,
            "attainment": round(co.attainment, 2),
            "total_assessments": co.total_assessments,
            "mapped_pos": mapped_pos,
            "status": "achieved" if co.attainment >= 60 else "not_achieved"
        })
    
    return {
        "co_analytics": co_analytics,
        "summary": {
            "total_cos": len(co_analytics),
            "achieved_cos": len([co for co in co_analytics if co["status"] == "achieved"]),
            "average_attainment": sum(co["attainment"] for co in co_analytics) / len(co_analytics) if co_analytics else 0
        }
    }

@app.get("/cross-semester-comparison")
async def get_cross_semester_comparison(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get cross-semester performance comparison"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get semester-wise performance data
    query = db.query(
        Semester.id,
        Semester.name,
        Semester.academic_year,
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance'),
        func.count(func.distinct(Mark.student_id)).label('students_count'),
        func.count(Mark.id).label('total_assessments')
    ).join(Class, Class.semester_id == Semester.id)\
     .join(Subject, Subject.semester_id == Semester.id)\
     .join(Exam, Exam.subject_id == Subject.id)\
     .join(Question, Question.exam_id == Exam.id)\
     .join(Mark, Mark.question_id == Question.id)
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Semester.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.filter(Mark.student_id == current_user_id)
    
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(Semester.department_id == department_id)
    
    query = query.group_by(Semester.id, Semester.name, Semester.academic_year)\
                 .order_by(Semester.academic_year, Semester.semester_number)
    
    semester_data = query.all()
    
    comparison_data = []
    for semester in semester_data:
        comparison_data.append({
            "semester_id": semester.id,
            "semester_name": semester.name,
            "academic_year": semester.academic_year,
            "avg_performance": round(semester.avg_performance, 2),
            "students_count": semester.students_count,
            "total_assessments": semester.total_assessments
        })
    
    return {
        "semester_comparison": comparison_data,
        "trends": {
            "performance_trend": "improving" if len(comparison_data) >= 2 and 
                                comparison_data[-1]["avg_performance"] > comparison_data[-2]["avg_performance"] 
                                else "declining" if len(comparison_data) >= 2 else "stable",
            "total_semesters": len(comparison_data)
        }
    }

@app.get("/performance-predictions")
async def get_performance_predictions(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get ML-based performance predictions"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get student performance history for prediction model
    query = db.query(
        User.id,
        User.name,
        Mark.marks_obtained,
        Mark.max_marks,
        Mark.created_at,
        Question.difficulty_level,
        CO.code.label('co_code'),
        Subject.name.label('subject_name')
    ).join(Mark, Mark.student_id == User.id)\
     .join(Question, Question.id == Mark.question_id)\
     .join(CO, CO.id == Question.co_id)\
     .join(Subject, Subject.id == CO.subject_id)\
     .filter(User.role == 'student')
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        query = query.filter(Subject.id.in_(teacher_subjects))
    elif current_user.role == "student":
        query = query.filter(User.id == current_user_id)
    
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(User.department_id == department_id)
    
    performance_data = query.all()
    
    # Simple prediction logic (can be enhanced with actual ML models)
    predictions = []
    student_groups = {}
    
    for record in performance_data:
        if record.id not in student_groups:
            student_groups[record.id] = {
                'name': record.name,
                'scores': [],
                'subjects': set(),
                'cos': set()
            }
        
        percentage = (record.marks_obtained / record.max_marks) * 100
        student_groups[record.id]['scores'].append(percentage)
        student_groups[record.id]['subjects'].add(record.subject_name)
        student_groups[record.id]['cos'].add(record.co_code)
    
    for student_id, data in student_groups.items():
        avg_score = sum(data['scores']) / len(data['scores']) if data['scores'] else 0
        trend = "improving" if len(data['scores']) >= 2 and data['scores'][-1] > data['scores'][-2] else "stable"
        
        # Simple prediction based on current trend
        predicted_score = avg_score
        if trend == "improving":
            predicted_score = min(100, avg_score + 5)
        elif avg_score < 50:
            predicted_score = max(0, avg_score - 2)
        
        predictions.append({
            "student_id": student_id,
            "student_name": data['name'],
            "current_avg": round(avg_score, 2),
            "predicted_performance": round(predicted_score, 2),
            "trend": trend,
            "confidence": min(95, 60 + len(data['scores']) * 3),
            "subjects_count": len(data['subjects']),
            "cos_covered": len(data['cos'])
        })
    
    return {
        "predictions": predictions,
        "model_info": {
            "algorithm": "Trend-based prediction",
            "data_points": len(performance_data),
            "accuracy": "85%"  # Placeholder
        }
    }

@app.get("/realtime-stats")
async def get_realtime_stats(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get real-time system statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get current timestamp
    now = datetime.now()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(days=1)
    
    # Base queries with role filtering
    base_query_filter = []
    if current_user.role == "hod":
        base_query_filter.append(User.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        base_query_filter.append(Subject.id.in_(teacher_subjects))
    elif current_user.role == "student":
        base_query_filter.append(User.id == current_user_id)
    
    if department_id and current_user.role in ["admin", "hod"]:
        base_query_filter.append(User.department_id == department_id)
    
    # Active users (based on recent marks/attendance)
    active_users_hour = db.query(func.count(func.distinct(Mark.student_id)))\
                         .filter(Mark.created_at >= hour_ago)
    if base_query_filter and current_user.role != "student":
        active_users_hour = active_users_hour.join(User).filter(and_(*base_query_filter))
    active_users_hour = active_users_hour.scalar() or 0
    
    # Recent activities
    recent_marks = db.query(func.count(Mark.id)).filter(Mark.created_at >= hour_ago)
    if current_user.role == "student":
        recent_marks = recent_marks.filter(Mark.student_id == current_user_id)
    recent_marks = recent_marks.scalar() or 0
    
    recent_attendance = db.query(func.count(Attendance.id)).filter(Attendance.created_at >= hour_ago)
    if current_user.role == "student":
        recent_attendance = recent_attendance.filter(Attendance.student_id == current_user_id)
    recent_attendance = recent_attendance.scalar() or 0
    
    # System health metrics
    total_students = db.query(func.count(User.id)).filter(User.role == 'student')
    if current_user.role == "hod":
        total_students = total_students.filter(User.department_id == current_user.department_id)
    elif current_user.role == "student":
        total_students = total_students.filter(User.id == current_user_id)
    total_students = total_students.scalar() or 0
    
    return {
        "timestamp": now.isoformat(),
        "active_users_last_hour": active_users_hour,
        "recent_activities": {
            "marks_entered": recent_marks,
            "attendance_marked": recent_attendance
        },
        "system_metrics": {
            "total_students": total_students,
            "response_time": 120,  # ms - placeholder
            "uptime": "99.9%",     # placeholder
            "cpu_usage": 45,       # % - placeholder
            "memory_usage": 68     # % - placeholder
        },
        "real_time_alerts": [
            {
                "type": "info",
                "message": f"System is operating normally",
                "timestamp": now.isoformat()
            }
        ]
    }

@app.get("/attendance-performance-correlation")
async def get_attendance_performance_correlation(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get correlation analysis between attendance and academic performance"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for attendance and performance data
    query = db.query(
        User.id.label('student_id'),
        User.name.label('student_name'),
        Subject.id.label('subject_id'),
        Subject.name.label('subject_name'),
        Department.name.label('department_name'),
        Class.name.label('class_name'),
        # Attendance metrics
        func.count(Attendance.id).label('total_attendance_records'),
        func.sum(case((Attendance.status == 'present', 1), else_=0)).label('present_count'),
        func.sum(case((Attendance.status == 'absent', 1), else_=0)).label('absent_count'),
        func.sum(case((Attendance.status == 'late', 1), else_=0)).label('late_count'),
        # Performance metrics
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance'),
        func.count(Mark.id).label('total_assessments'),
        func.sum(Mark.marks_obtained).label('total_marks_obtained'),
        func.sum(Mark.max_marks).label('total_max_marks')
    ).select_from(User)\
     .join(Attendance, Attendance.student_id == User.id)\
     .join(Subject, Subject.id == Attendance.subject_id)\
     .join(Class, Class.id == Attendance.class_id)\
     .join(Department, Department.id == Subject.department_id)\
     .join(Exam, Exam.subject_id == Subject.id)\
     .join(Question, Question.exam_id == Exam.id)\
     .join(Mark, and_(Mark.question_id == Question.id, Mark.student_id == User.id))\
     .filter(User.role == 'student')
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Department.id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.filter(User.id == current_user_id)
    
    # Apply additional filters
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(Department.id == department_id)
    if semester_id:
        query = query.filter(Subject.semester_id == semester_id)
    if subject_id:
        query = query.filter(Subject.id == subject_id)
    if class_id:
        query = query.filter(Class.id == class_id)
    
    # Group by student and subject
    query = query.group_by(
        User.id, User.name, Subject.id, Subject.name, 
        Department.name, Class.name
    )
    
    correlation_data = query.all()
    
    # Calculate correlation statistics
    student_stats = []
    attendance_rates = []
    performance_scores = []
    
    for record in correlation_data:
        # Calculate attendance percentage
        attendance_percentage = (record.present_count / record.total_attendance_records * 100) if record.total_attendance_records > 0 else 0
        
        # Calculate performance percentage
        performance_percentage = record.avg_performance if record.avg_performance else 0
        
        # Calculate late penalty impact
        late_impact = (record.late_count / record.total_attendance_records * 100) if record.total_attendance_records > 0 else 0
        
        student_stat = {
            "student_id": record.student_id,
            "student_name": record.student_name,
            "subject_id": record.subject_id,
            "subject_name": record.subject_name,
            "department_name": record.department_name,
            "class_name": record.class_name,
            "attendance_percentage": round(attendance_percentage, 2),
            "performance_percentage": round(performance_percentage, 2),
            "total_attendance_records": record.total_attendance_records,
            "present_count": record.present_count,
            "absent_count": record.absent_count,
            "late_count": record.late_count,
            "late_impact": round(late_impact, 2),
            "total_assessments": record.total_assessments,
            "correlation_category": "high" if attendance_percentage >= 80 and performance_percentage >= 75 else
                                  "medium" if attendance_percentage >= 60 and performance_percentage >= 60 else "low"
        }
        
        student_stats.append(student_stat)
        attendance_rates.append(attendance_percentage)
        performance_scores.append(performance_percentage)
    
    # Calculate correlation coefficient (simplified Pearson correlation)
    correlation_coefficient = 0.0
    if len(attendance_rates) > 1 and len(performance_scores) > 1:
        try:
            import numpy as np
            correlation_coefficient = np.corrcoef(attendance_rates, performance_scores)[0, 1]
            if np.isnan(correlation_coefficient):
                correlation_coefficient = 0.0
        except:
            # Fallback to simple correlation calculation
            n = len(attendance_rates)
            if n > 1:
                mean_attendance = sum(attendance_rates) / n
                mean_performance = sum(performance_scores) / n
                
                numerator = sum((attendance_rates[i] - mean_attendance) * (performance_scores[i] - mean_performance) for i in range(n))
                sum_sq_attendance = sum((attendance_rates[i] - mean_attendance) ** 2 for i in range(n))
                sum_sq_performance = sum((performance_scores[i] - mean_performance) ** 2 for i in range(n))
                
                denominator = (sum_sq_attendance * sum_sq_performance) ** 0.5
                correlation_coefficient = numerator / denominator if denominator != 0 else 0.0
    
    # Performance analysis by attendance ranges
    attendance_ranges = {
        "excellent": {"min": 90, "students": [], "avg_performance": 0},
        "good": {"min": 75, "max": 89, "students": [], "avg_performance": 0},
        "average": {"min": 60, "max": 74, "students": [], "avg_performance": 0},
        "poor": {"min": 0, "max": 59, "students": [], "avg_performance": 0}
    }
    
    for student in student_stats:
        attendance = student["attendance_percentage"]
        if attendance >= 90:
            attendance_ranges["excellent"]["students"].append(student)
        elif attendance >= 75:
            attendance_ranges["good"]["students"].append(student)
        elif attendance >= 60:
            attendance_ranges["average"]["students"].append(student)
        else:
            attendance_ranges["poor"]["students"].append(student)
    
    # Calculate average performance for each range
    for range_name, range_data in attendance_ranges.items():
        if range_data["students"]:
            range_data["avg_performance"] = round(
                sum(s["performance_percentage"] for s in range_data["students"]) / len(range_data["students"]), 2
            )
            range_data["student_count"] = len(range_data["students"])
        else:
            range_data["student_count"] = 0
    
    # Generate insights and recommendations
    insights = []
    if correlation_coefficient > 0.7:
        insights.append("Strong positive correlation between attendance and performance")
    elif correlation_coefficient > 0.4:
        insights.append("Moderate positive correlation between attendance and performance")
    elif correlation_coefficient > 0.1:
        insights.append("Weak positive correlation between attendance and performance")
    else:
        insights.append("No significant correlation between attendance and performance")
    
    # Identify at-risk students
    at_risk_students = [s for s in student_stats if s["attendance_percentage"] < 60 or s["performance_percentage"] < 50]
    
    recommendations = []
    if len(at_risk_students) > 0:
        recommendations.append(f"{len(at_risk_students)} students need immediate attention")
    if attendance_ranges["poor"]["student_count"] > 0:
        recommendations.append(f"Implement attendance improvement strategies for {attendance_ranges['poor']['student_count']} students")
    if correlation_coefficient > 0.5:
        recommendations.append("Enforce stricter attendance policies to improve academic performance")
    
    return {
        "correlation_analysis": {
            "correlation_coefficient": round(correlation_coefficient, 3),
            "strength": "strong" if abs(correlation_coefficient) > 0.7 else 
                       "moderate" if abs(correlation_coefficient) > 0.4 else
                       "weak" if abs(correlation_coefficient) > 0.1 else "none",
            "total_students": len(student_stats),
            "total_records": len(correlation_data)
        },
        "student_statistics": student_stats,
        "attendance_performance_ranges": attendance_ranges,
        "at_risk_students": at_risk_students,
        "insights": insights,
        "recommendations": recommendations,
        "summary": {
            "avg_attendance": round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else 0,
            "avg_performance": round(sum(performance_scores) / len(performance_scores), 2) if performance_scores else 0,
            "high_correlation_students": len([s for s in student_stats if s["correlation_category"] == "high"]),
            "medium_correlation_students": len([s for s in student_stats if s["correlation_category"] == "medium"]),
            "low_correlation_students": len([s for s in student_stats if s["correlation_category"] == "low"])
        }
    }

@app.get("/exam-weightage-analysis")
async def get_exam_weightage_analysis(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    exam_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Analyze exam weightage distribution and its impact on final results"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for exam weightage analysis
    query = db.query(
        Exam.id.label('exam_id'),
        Exam.title.label('exam_title'),
        Exam.exam_type,
        Exam.total_marks,
        Exam.weightage,
        Exam.status,
        Subject.id.label('subject_id'),
        Subject.name.label('subject_name'),
        Subject.total_marks.label('subject_total_marks'),
        Department.name.label('department_name'),
        Semester.name.label('semester_name'),
        # Calculate actual performance metrics
        func.count(func.distinct(Mark.student_id)).label('students_attempted'),
        func.avg(Mark.marks_obtained).label('avg_marks_obtained'),
        func.sum(Mark.marks_obtained).label('total_marks_obtained'),
        func.sum(Mark.max_marks).label('total_max_marks'),
        func.min(Mark.marks_obtained).label('min_marks'),
        func.max(Mark.marks_obtained).label('max_marks'),
        func.stddev(Mark.marks_obtained).label('marks_stddev')
    ).join(Subject, Subject.id == Exam.subject_id)\
     .join(Department, Department.id == Subject.department_id)\
     .join(Semester, Semester.id == Subject.semester_id)\
     .join(Question, Question.exam_id == Exam.id)\
     .join(Mark, Mark.question_id == Question.id)
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Department.id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.filter(Mark.student_id == current_user_id)
    
    # Apply additional filters
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(Department.id == department_id)
    if semester_id:
        query = query.filter(Semester.id == semester_id)
    if subject_id:
        query = query.filter(Subject.id == subject_id)
    if exam_id:
        query = query.filter(Exam.id == exam_id)
    
    query = query.group_by(
        Exam.id, Exam.title, Exam.exam_type, Exam.total_marks, Exam.weightage, Exam.status,
        Subject.id, Subject.name, Subject.total_marks, Department.name, Semester.name
    )
    
    exam_data = query.all()
    
    # Calculate weightage impact analysis
    weightage_analysis = []
    total_weightage_by_subject = {}
    
    for exam in exam_data:
        # Calculate performance percentage
        avg_percentage = (exam.avg_marks_obtained / exam.total_max_marks * 100) if exam.total_max_marks > 0 else 0
        
        # Calculate weightage contribution to final grade
        weighted_contribution = (avg_percentage * exam.weightage / 100) if exam.weightage else 0
        
        # Track total weightage per subject
        subject_key = f"{exam.subject_id}_{exam.subject_name}"
        if subject_key not in total_weightage_by_subject:
            total_weightage_by_subject[subject_key] = {
                "subject_id": exam.subject_id,
                "subject_name": exam.subject_name,
                "department_name": exam.department_name,
                "semester_name": exam.semester_name,
                "total_weightage": 0,
                "exams": [],
                "total_weighted_score": 0
            }
        
        total_weightage_by_subject[subject_key]["total_weightage"] += exam.weightage or 0
        total_weightage_by_subject[subject_key]["total_weighted_score"] += weighted_contribution
        total_weightage_by_subject[subject_key]["exams"].append({
            "exam_id": exam.exam_id,
            "exam_title": exam.exam_title,
            "exam_type": exam.exam_type,
            "weightage": exam.weightage,
            "avg_percentage": round(avg_percentage, 2),
            "weighted_contribution": round(weighted_contribution, 2)
        })
        
        exam_analysis = {
            "exam_id": exam.exam_id,
            "exam_title": exam.exam_title,
            "exam_type": exam.exam_type,
            "subject_name": exam.subject_name,
            "department_name": exam.department_name,
            "semester_name": exam.semester_name,
            "total_marks": exam.total_marks,
            "weightage": exam.weightage,
            "students_attempted": exam.students_attempted,
            "avg_marks_obtained": round(exam.avg_marks_obtained, 2) if exam.avg_marks_obtained else 0,
            "avg_percentage": round(avg_percentage, 2),
            "min_marks": exam.min_marks or 0,
            "max_marks": exam.max_marks or 0,
            "marks_stddev": round(exam.marks_stddev, 2) if exam.marks_stddev else 0,
            "weighted_contribution": round(weighted_contribution, 2),
            "status": exam.status,
            "difficulty_indicator": "high" if avg_percentage < 50 else "medium" if avg_percentage < 75 else "low"
        }
        
        weightage_analysis.append(exam_analysis)
    
    # Calculate subject-wise final grades
    subject_grades = []
    weightage_issues = []
    
    for subject_key, subject_data in total_weightage_by_subject.items():
        final_percentage = subject_data["total_weighted_score"]
        grade = "A+" if final_percentage >= 90 else \
                "A" if final_percentage >= 80 else \
                "B+" if final_percentage >= 70 else \
                "B" if final_percentage >= 60 else \
                "C" if final_percentage >= 50 else "F"
        
        # Check for weightage issues
        if subject_data["total_weightage"] != 100:
            weightage_issues.append({
                "subject_name": subject_data["subject_name"],
                "current_weightage": subject_data["total_weightage"],
                "issue": "over_weighted" if subject_data["total_weightage"] > 100 else "under_weighted",
                "difference": abs(100 - subject_data["total_weightage"])
            })
        
        subject_grades.append({
            "subject_id": subject_data["subject_id"],
            "subject_name": subject_data["subject_name"],
            "department_name": subject_data["department_name"],
            "semester_name": subject_data["semester_name"],
            "total_weightage": subject_data["total_weightage"],
            "final_percentage": round(final_percentage, 2),
            "grade": grade,
            "exams_count": len(subject_data["exams"]),
            "exams": subject_data["exams"]
        })
    
    # Generate insights and recommendations
    insights = []
    recommendations = []
    
    # Weightage distribution insights
    over_weighted_subjects = len([s for s in subject_grades if s["total_weightage"] > 100])
    under_weighted_subjects = len([s for s in subject_grades if s["total_weightage"] < 100])
    
    if over_weighted_subjects > 0:
        insights.append(f"{over_weighted_subjects} subjects have over-weighted exams (>100%)")
        recommendations.append("Adjust exam weightages to sum to exactly 100% per subject")
    
    if under_weighted_subjects > 0:
        insights.append(f"{under_weighted_subjects} subjects have under-weighted exams (<100%)")
        recommendations.append("Add more exams or increase existing exam weightages")
    
    # Performance insights
    low_performing_exams = len([e for e in weightage_analysis if e["avg_percentage"] < 50])
    high_impact_exams = len([e for e in weightage_analysis if e["weightage"] and e["weightage"] >= 30])
    
    if low_performing_exams > 0:
        insights.append(f"{low_performing_exams} exams have average performance below 50%")
        recommendations.append("Review difficulty level of low-performing exams")
    
    if high_impact_exams > 0:
        insights.append(f"{high_impact_exams} exams have high weightage (≥30%)")
        recommendations.append("Ensure high-weightage exams are comprehensive and fair")
    
    return {
        "exam_weightage_analysis": weightage_analysis,
        "subject_grades": subject_grades,
        "weightage_issues": weightage_issues,
        "summary_statistics": {
            "total_exams": len(weightage_analysis),
            "total_subjects": len(subject_grades),
            "avg_exam_weightage": sum(e["weightage"] for e in weightage_analysis if e["weightage"]) / len([e for e in weightage_analysis if e["weightage"]]) if weightage_analysis else 0,
            "over_weighted_subjects": over_weighted_subjects,
            "under_weighted_subjects": under_weighted_subjects,
            "correctly_weighted_subjects": len(subject_grades) - over_weighted_subjects - under_weighted_subjects
        },
        "insights": insights,
        "recommendations": recommendations
    }

@app.get("/result-calculation-rules")
async def get_result_calculation_rules(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Calculate results based on defined rules and weightages"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get student performance data with exam weightages
    query = db.query(
        User.id.label('student_id'),
        User.name.label('student_name'),
        Subject.id.label('subject_id'),
        Subject.name.label('subject_name'),
        Subject.passing_marks,
        Department.name.label('department_name'),
        Semester.name.label('semester_name'),
        Exam.id.label('exam_id'),
        Exam.title.label('exam_title'),
        Exam.exam_type,
        Exam.weightage,
        Exam.total_marks.label('exam_total_marks'),
        func.sum(Mark.marks_obtained).label('student_exam_marks'),
        func.sum(Mark.max_marks).label('student_exam_max_marks')
    ).join(Mark, Mark.student_id == User.id)\
     .join(Question, Question.id == Mark.question_id)\
     .join(Exam, Exam.id == Question.exam_id)\
     .join(Subject, Subject.id == Exam.subject_id)\
     .join(Department, Department.id == Subject.department_id)\
     .join(Semester, Semester.id == Subject.semester_id)\
     .filter(User.role == 'student')
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Department.id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.filter(User.id == current_user_id)
    
    # Apply additional filters
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(Department.id == department_id)
    if semester_id:
        query = query.filter(Semester.id == semester_id)
    if subject_id:
        query = query.filter(Subject.id == subject_id)
    if student_id:
        query = query.filter(User.id == student_id)
    
    query = query.group_by(
        User.id, User.name, Subject.id, Subject.name, Subject.passing_marks,
        Department.name, Semester.name, Exam.id, Exam.title, Exam.exam_type,
        Exam.weightage, Exam.total_marks
    )
    
    performance_data = query.all()
    
    # Organize data by student and subject
    student_results = {}
    
    for record in performance_data:
        student_key = f"{record.student_id}_{record.subject_id}"
        
        if student_key not in student_results:
            student_results[student_key] = {
                "student_id": record.student_id,
                "student_name": record.student_name,
                "subject_id": record.subject_id,
                "subject_name": record.subject_name,
                "department_name": record.department_name,
                "semester_name": record.semester_name,
                "passing_marks": record.passing_marks or 50,  # Default passing marks
                "exams": [],
                "total_weighted_score": 0,
                "total_weightage": 0
            }
        
        # Calculate exam percentage
        exam_percentage = (record.student_exam_marks / record.student_exam_max_marks * 100) if record.student_exam_max_marks > 0 else 0
        
        # Calculate weighted contribution
        weighted_score = (exam_percentage * record.weightage / 100) if record.weightage else 0
        
        exam_result = {
            "exam_id": record.exam_id,
            "exam_title": record.exam_title,
            "exam_type": record.exam_type,
            "weightage": record.weightage,
            "marks_obtained": record.student_exam_marks,
            "max_marks": record.student_exam_max_marks,
            "percentage": round(exam_percentage, 2),
            "weighted_score": round(weighted_score, 2),
            "status": "pass" if exam_percentage >= (record.passing_marks or 50) else "fail"
        }
        
        student_results[student_key]["exams"].append(exam_result)
        student_results[student_key]["total_weighted_score"] += weighted_score
        student_results[student_key]["total_weightage"] += record.weightage or 0
    
    # Calculate final results with grading rules
    final_results = []
    grade_distribution = {"A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    
    for student_key, student_data in student_results.items():
        final_percentage = student_data["total_weighted_score"]
        passing_marks = student_data["passing_marks"]
        
        # Apply grading rules
        if final_percentage >= 90:
            grade = "A+"
            grade_points = 10
        elif final_percentage >= 80:
            grade = "A"
            grade_points = 9
        elif final_percentage >= 70:
            grade = "B+"
            grade_points = 8
        elif final_percentage >= 60:
            grade = "B"
            grade_points = 7
        elif final_percentage >= 50:
            grade = "C"
            grade_points = 6
        elif final_percentage >= 40:
            grade = "D"
            grade_points = 5
        else:
            grade = "F"
            grade_points = 0
        
        # Determine overall status
        failed_exams = [e for e in student_data["exams"] if e["status"] == "fail"]
        overall_status = "fail" if final_percentage < passing_marks or len(failed_exams) > 0 else "pass"
        
        # Calculate SGPA contribution (assuming 4 credits per subject)
        credits = 4
        sgpa_contribution = grade_points * credits
        
        grade_distribution[grade] += 1
        
        result = {
            "student_id": student_data["student_id"],
            "student_name": student_data["student_name"],
            "subject_id": student_data["subject_id"],
            "subject_name": student_data["subject_name"],
            "department_name": student_data["department_name"],
            "semester_name": student_data["semester_name"],
            "exams": student_data["exams"],
            "total_weighted_score": round(student_data["total_weighted_score"], 2),
            "total_weightage": student_data["total_weightage"],
            "final_percentage": round(final_percentage, 2),
            "grade": grade,
            "grade_points": grade_points,
            "credits": credits,
            "sgpa_contribution": sgpa_contribution,
            "overall_status": overall_status,
            "failed_exams": len(failed_exams),
            "exam_count": len(student_data["exams"]),
            "needs_improvement": final_percentage < 60,
            "distinction": final_percentage >= 75
        }
        
        final_results.append(result)
    
    # Calculate statistics
    if final_results:
        avg_percentage = sum(r["final_percentage"] for r in final_results) / len(final_results)
        pass_rate = len([r for r in final_results if r["overall_status"] == "pass"]) / len(final_results) * 100
        distinction_rate = len([r for r in final_results if r["distinction"]]) / len(final_results) * 100
    else:
        avg_percentage = 0
        pass_rate = 0
        distinction_rate = 0
    
    # Generate insights
    insights = []
    recommendations = []
    
    if pass_rate < 70:
        insights.append(f"Low pass rate: {pass_rate:.1f}%")
        recommendations.append("Review teaching methods and exam difficulty")
    
    if distinction_rate > 50:
        insights.append(f"High distinction rate: {distinction_rate:.1f}%")
        recommendations.append("Consider increasing academic rigor")
    
    if avg_percentage < 60:
        insights.append(f"Below average performance: {avg_percentage:.1f}%")
        recommendations.append("Implement additional support programs")
    
    return {
        "final_results": final_results,
        "grade_distribution": grade_distribution,
        "statistics": {
            "total_students": len(final_results),
            "avg_percentage": round(avg_percentage, 2),
            "pass_rate": round(pass_rate, 2),
            "distinction_rate": round(distinction_rate, 2),
            "students_passed": len([r for r in final_results if r["overall_status"] == "pass"]),
            "students_failed": len([r for r in final_results if r["overall_status"] == "fail"]),
            "students_with_distinction": len([r for r in final_results if r["distinction"]])
        },
        "calculation_rules": {
            "grading_scale": {
                "A+": "90-100%",
                "A": "80-89%",
                "B+": "70-79%",
                "B": "60-69%",
                "C": "50-59%",
                "D": "40-49%",
                "F": "Below 40%"
            },
            "passing_criteria": "Minimum 50% overall and pass in all individual exams",
            "weightage_rule": "Final score = Σ(Exam Score × Weightage)",
            "sgpa_calculation": "Grade Points × Credits"
        },
        "insights": insights,
        "recommendations": recommendations
    }

@app.get("/bloom-taxonomy-attainment")
async def get_bloom_taxonomy_attainment(
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Analyze student performance across different Bloom's taxonomy levels"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Define Bloom's taxonomy levels and their cognitive complexity
    bloom_levels = {
        "remember": {"level": 1, "description": "Recall facts and basic concepts"},
        "understand": {"level": 2, "description": "Explain ideas or concepts"},
        "apply": {"level": 3, "description": "Use information in new situations"},
        "analyze": {"level": 4, "description": "Draw connections among ideas"},
        "evaluate": {"level": 5, "description": "Justify a stand or decision"},
        "create": {"level": 6, "description": "Produce new or original work"}
    }
    
    # Base query for Bloom taxonomy analysis
    query = db.query(
        Question.bloom_level,
        Question.difficulty_level,
        Subject.id.label('subject_id'),
        Subject.name.label('subject_name'),
        Department.name.label('department_name'),
        Semester.name.label('semester_name'),
        Class.name.label('class_name'),
        Exam.title.label('exam_title'),
        Exam.exam_type,
        # Performance metrics
        func.count(Mark.id).label('total_attempts'),
        func.count(func.distinct(Mark.student_id)).label('unique_students'),
        func.avg(Mark.marks_obtained / Mark.max_marks * 100).label('avg_performance'),
        func.sum(Mark.marks_obtained).label('total_marks_obtained'),
        func.sum(Mark.max_marks).label('total_max_marks'),
        func.stddev(Mark.marks_obtained / Mark.max_marks * 100).label('performance_stddev'),
        func.min(Mark.marks_obtained / Mark.max_marks * 100).label('min_performance'),
        func.max(Mark.marks_obtained / Mark.max_marks * 100).label('max_performance')
    ).join(Mark, Mark.question_id == Question.id)\
     .join(Exam, Exam.id == Question.exam_id)\
     .join(Subject, Subject.id == Exam.subject_id)\
     .join(Department, Department.id == Subject.department_id)\
     .join(Semester, Semester.id == Subject.semester_id)\
     .join(Class, Class.id == Exam.class_id)\
     .filter(Question.bloom_level.isnot(None))
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(Department.id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.filter(Mark.student_id == current_user_id)
    
    # Apply additional filters
    if department_id and current_user.role in ["admin", "hod"]:
        query = query.filter(Department.id == department_id)
    if semester_id:
        query = query.filter(Semester.id == semester_id)
    if subject_id:
        query = query.filter(Subject.id == subject_id)
    if class_id:
        query = query.filter(Class.id == class_id)
    
    query = query.group_by(
        Question.bloom_level, Question.difficulty_level, Subject.id, Subject.name,
        Department.name, Semester.name, Class.name, Exam.title, Exam.exam_type
    )
    
    bloom_data = query.all()
    
    # Organize data by Bloom level
    bloom_analysis = {}
    overall_stats = {
        "total_questions": 0,
        "total_attempts": 0,
        "unique_students": set(),
        "avg_performance_all": 0,
        "bloom_distribution": {}
    }
    
    for record in bloom_data:
        bloom_level = record.bloom_level.lower()
        
        if bloom_level not in bloom_analysis:
            bloom_analysis[bloom_level] = {
                "level_info": bloom_levels.get(bloom_level, {"level": 0, "description": "Unknown"}),
                "performance_data": [],
                "total_questions": 0,
                "total_attempts": 0,
                "unique_students": set(),
                "avg_performance": 0,
                "difficulty_breakdown": {},
                "subject_breakdown": {}
            }
        
        # Calculate performance metrics
        performance_percentage = record.avg_performance if record.avg_performance else 0
        
        bloom_analysis[bloom_level]["performance_data"].append({
            "subject_id": record.subject_id,
            "subject_name": record.subject_name,
            "department_name": record.department_name,
            "semester_name": record.semester_name,
            "class_name": record.class_name,
            "exam_title": record.exam_title,
            "exam_type": record.exam_type,
            "difficulty_level": record.difficulty_level,
            "avg_performance": round(performance_percentage, 2),
            "total_attempts": record.total_attempts,
            "unique_students": record.unique_students,
            "performance_stddev": round(record.performance_stddev, 2) if record.performance_stddev else 0,
            "min_performance": round(record.min_performance, 2) if record.min_performance else 0,
            "max_performance": round(record.max_performance, 2) if record.max_performance else 0
        })
        
        bloom_analysis[bloom_level]["total_attempts"] += record.total_attempts
        bloom_analysis[bloom_level]["total_questions"] += 1
        
        # Track difficulty breakdown
        difficulty = record.difficulty_level or "unknown"
        if difficulty not in bloom_analysis[bloom_level]["difficulty_breakdown"]:
            bloom_analysis[bloom_level]["difficulty_breakdown"][difficulty] = {
                "count": 0,
                "avg_performance": 0,
                "total_performance": 0
            }
        bloom_analysis[bloom_level]["difficulty_breakdown"][difficulty]["count"] += 1
        bloom_analysis[bloom_level]["difficulty_breakdown"][difficulty]["total_performance"] += performance_percentage
        
        # Track subject breakdown
        subject_name = record.subject_name
        if subject_name not in bloom_analysis[bloom_level]["subject_breakdown"]:
            bloom_analysis[bloom_level]["subject_breakdown"][subject_name] = {
                "count": 0,
                "avg_performance": 0,
                "total_performance": 0
            }
        bloom_analysis[bloom_level]["subject_breakdown"][subject_name]["count"] += 1
        bloom_analysis[bloom_level]["subject_breakdown"][subject_name]["total_performance"] += performance_percentage
        
        # Update overall stats
        overall_stats["total_questions"] += 1
        overall_stats["total_attempts"] += record.total_attempts
    
    # Calculate averages and finalize analysis
    for bloom_level, data in bloom_analysis.items():
        if data["performance_data"]:
            data["avg_performance"] = sum(p["avg_performance"] for p in data["performance_data"]) / len(data["performance_data"])
            
            # Finalize difficulty breakdown averages
            for difficulty, diff_data in data["difficulty_breakdown"].items():
                if diff_data["count"] > 0:
                    diff_data["avg_performance"] = diff_data["total_performance"] / diff_data["count"]
                    del diff_data["total_performance"]
            
            # Finalize subject breakdown averages
            for subject, subj_data in data["subject_breakdown"].items():
                if subj_data["count"] > 0:
                    subj_data["avg_performance"] = subj_data["total_performance"] / subj_data["count"]
                    del subj_data["total_performance"]
        
        # Calculate bloom distribution percentage
        overall_stats["bloom_distribution"][bloom_level] = {
            "question_count": data["total_questions"],
            "percentage": (data["total_questions"] / overall_stats["total_questions"] * 100) if overall_stats["total_questions"] > 0 else 0,
            "avg_performance": round(data["avg_performance"], 2)
        }
    
    # Calculate overall average performance
    if bloom_analysis:
        total_performance = sum(data["avg_performance"] * data["total_questions"] for data in bloom_analysis.values())
        overall_stats["avg_performance_all"] = total_performance / overall_stats["total_questions"] if overall_stats["total_questions"] > 0 else 0
    
    # Generate cognitive progression analysis
    cognitive_progression = []
    sorted_levels = sorted(bloom_analysis.items(), key=lambda x: bloom_levels.get(x[0], {"level": 0})["level"])
    
    for i, (level, data) in enumerate(sorted_levels):
        level_info = bloom_levels.get(level, {"level": 0, "description": "Unknown"})
        
        # Compare with previous level
        progression_trend = "baseline"
        if i > 0:
            prev_performance = sorted_levels[i-1][1]["avg_performance"]
            current_performance = data["avg_performance"]
            
            if current_performance > prev_performance + 5:
                progression_trend = "improving"
            elif current_performance < prev_performance - 5:
                progression_trend = "declining"
            else:
                progression_trend = "stable"
        
        cognitive_progression.append({
            "bloom_level": level,
            "cognitive_level": level_info["level"],
            "description": level_info["description"],
            "avg_performance": round(data["avg_performance"], 2),
            "question_count": data["total_questions"],
            "progression_trend": progression_trend,
            "difficulty_mastery": {
                diff: round(diff_data["avg_performance"], 2) 
                for diff, diff_data in data["difficulty_breakdown"].items()
            }
        })
    
    # Generate insights and recommendations
    insights = []
    recommendations = []
    
    # Identify strengths and weaknesses
    highest_level = max(bloom_analysis.items(), key=lambda x: x[1]["avg_performance"]) if bloom_analysis else None
    lowest_level = min(bloom_analysis.items(), key=lambda x: x[1]["avg_performance"]) if bloom_analysis else None
    
    if highest_level:
        insights.append(f"Strongest performance in {highest_level[0].title()} level ({highest_level[1]['avg_performance']:.1f}%)")
    
    if lowest_level:
        insights.append(f"Weakest performance in {lowest_level[0].title()} level ({lowest_level[1]['avg_performance']:.1f}%)")
        recommendations.append(f"Focus on improving {lowest_level[0].title()} level cognitive skills")
    
    # Check for cognitive progression issues
    high_level_performance = sum(data["avg_performance"] for level, data in bloom_analysis.items() 
                                if bloom_levels.get(level, {"level": 0})["level"] >= 4)
    low_level_performance = sum(data["avg_performance"] for level, data in bloom_analysis.items() 
                               if bloom_levels.get(level, {"level": 0})["level"] <= 2)
    
    high_level_count = len([level for level in bloom_analysis.keys() if bloom_levels.get(level, {"level": 0})["level"] >= 4])
    low_level_count = len([level for level in bloom_analysis.keys() if bloom_levels.get(level, {"level": 0})["level"] <= 2])
    
    if high_level_count > 0 and low_level_count > 0:
        avg_high = high_level_performance / high_level_count
        avg_low = low_level_performance / low_level_count
        
        if avg_high > avg_low + 10:
            insights.append("Students perform better on higher-order thinking questions")
            recommendations.append("Ensure foundation skills are solid before advancing")
        elif avg_low > avg_high + 10:
            insights.append("Students struggle with higher-order thinking skills")
            recommendations.append("Increase focus on analysis, evaluation, and creation activities")
    
    # Check bloom level distribution
    create_evaluate_percentage = sum(
        overall_stats["bloom_distribution"].get(level, {}).get("percentage", 0)
        for level in ["create", "evaluate"]
    )
    
    if create_evaluate_percentage < 20:
        insights.append("Limited assessment of highest cognitive levels (Create, Evaluate)")
        recommendations.append("Increase questions targeting Create and Evaluate levels")
    
    return {
        "bloom_taxonomy_analysis": bloom_analysis,
        "cognitive_progression": cognitive_progression,
        "overall_statistics": {
            "total_questions": overall_stats["total_questions"],
            "total_attempts": overall_stats["total_attempts"],
            "avg_performance_all": round(overall_stats["avg_performance_all"], 2),
            "bloom_distribution": overall_stats["bloom_distribution"],
            "cognitive_balance_score": round(len(bloom_analysis) / 6 * 100, 2)  # Percentage of Bloom levels covered
        },
        "insights": insights,
        "recommendations": recommendations,
        "bloom_levels_reference": bloom_levels
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)