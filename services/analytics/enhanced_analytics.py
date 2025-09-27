# Enhanced Analytics Service for Real-time CO/PO Attainment Calculations
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc, text
from typing import List, Optional, Dict, Any
import json
import pandas as pd
from datetime import datetime, timedelta
import asyncio
import redis
import os

from shared.database import get_db
from shared.models import (
    User, Department, Class, Subject, Exam, Question, Mark, CO, PO, COPOMapping,
    Semester, StudentSemesterEnrollment, StudentPerformance, COAttainment, POAttainment
)
from shared.auth import RoleChecker
from shared.schemas_additional import (
    AnalyticsDashboardStats, COPOAnalytics, StudentPerformanceAnalytics,
    ExamAnalytics, COAttainmentResponse, POAttainmentResponse
)
from pydantic import BaseModel

app = FastAPI(title="Enhanced Analytics Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Redis client for caching
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))

class COPOAttainmentCalculator:
    """Calculator for CO/PO attainment percentages"""
    
    @staticmethod
    def calculate_co_attainment(db: Session, co_id: int, semester_id: int, class_id: int, subject_id: int) -> float:
        """Calculate CO attainment percentage for a specific CO in a class/subject"""
        
        # Get all questions for this CO in the subject
        questions = db.query(Question).join(Exam).filter(
            Question.co_id == co_id,
            Exam.subject_id == subject_id,
            Exam.class_id == class_id
        ).all()
        
        if not questions:
            return 0.0
        
        # Get all marks for these questions
        question_ids = [q.id for q in questions]
        marks = db.query(Mark).filter(
            Mark.question_id.in_(question_ids),
            Mark.exam_id.in_([q.section.exam_id for q in questions])
        ).all()
        
        if not marks:
            return 0.0
        
        # Calculate attainment
        total_possible_marks = sum(q.marks for q in questions)
        total_obtained_marks = sum(mark.marks_obtained for mark in marks)
        
        if total_possible_marks == 0:
            return 0.0
        
        attainment_percentage = (total_obtained_marks / total_possible_marks) * 100
        return min(attainment_percentage, 100.0)  # Cap at 100%
    
    @staticmethod
    def calculate_po_attainment(db: Session, po_id: int, semester_id: int, class_id: int, department_id: int) -> float:
        """Calculate PO attainment percentage based on CO contributions"""
        
        # Get all CO-PO mappings for this PO
        co_po_mappings = db.query(COPOMapping).filter(COPOMapping.po_id == po_id).all()
        
        if not co_po_mappings:
            return 0.0
        
        total_weighted_attainment = 0.0
        total_weight = 0.0
        
        for mapping in co_po_mappings:
            # Get CO attainment for this CO
            co_attainment = COPOAttainmentCalculator.calculate_co_attainment(
                db, mapping.co_id, semester_id, class_id, mapping.co.subject_id
            )
            
            # Weight by mapping strength
            weight = mapping.mapping_strength
            total_weighted_attainment += co_attainment * weight
            total_weight += weight
        
        if total_weight == 0:
            return 0.0
        
        return total_weighted_attainment / total_weight

class BloomTaxonomyAnalyzer:
    """Analyzer for Bloom's taxonomy distribution and attainment"""
    
    @staticmethod
    def get_bloom_distribution(db: Session, semester_id: int, class_id: int, subject_id: Optional[int] = None) -> Dict[str, int]:
        """Get Bloom's taxonomy distribution for questions"""
        
        query = db.query(Question.bloom_level, func.count(Question.id)).join(Exam)
        
        if subject_id:
            query = query.filter(Exam.subject_id == subject_id)
        
        query = query.filter(Exam.class_id == class_id).group_by(Question.bloom_level)
        
        results = query.all()
        return {level: count for level, count in results}
    
    @staticmethod
    def get_bloom_attainment(db: Session, semester_id: int, class_id: int, subject_id: Optional[int] = None) -> Dict[str, float]:
        """Get Bloom's taxonomy attainment percentages"""
        
        # Get questions by Bloom level
        query = db.query(Question).join(Exam)
        
        if subject_id:
            query = query.filter(Exam.subject_id == subject_id)
        
        query = query.filter(Exam.class_id == class_id)
        questions = query.all()
        
        bloom_attainment = {}
        
        for level in ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']:
            level_questions = [q for q in questions if q.bloom_level == level]
            
            if not level_questions:
                bloom_attainment[level] = 0.0
                continue
            
            # Get marks for these questions
            question_ids = [q.id for q in level_questions]
            marks = db.query(Mark).filter(Mark.question_id.in_(question_ids)).all()
            
            if not marks:
                bloom_attainment[level] = 0.0
                continue
            
            total_possible = sum(q.marks for q in level_questions)
            total_obtained = sum(mark.marks_obtained for mark in marks)
            
            if total_possible == 0:
                bloom_attainment[level] = 0.0
            else:
                bloom_attainment[level] = (total_obtained / total_possible) * 100
        
        return bloom_attainment

class DifficultyAnalyzer:
    """Analyzer for difficulty level distribution and mastery"""
    
    @staticmethod
    def get_difficulty_distribution(db: Session, semester_id: int, class_id: int, subject_id: Optional[int] = None) -> Dict[str, int]:
        """Get difficulty level distribution for questions"""
        
        query = db.query(Question.difficulty_level, func.count(Question.id)).join(Exam)
        
        if subject_id:
            query = query.filter(Exam.subject_id == subject_id)
        
        query = query.filter(Exam.class_id == class_id).group_by(Question.difficulty_level)
        
        results = query.all()
        return {level: count for level, count in results}
    
    @staticmethod
    def get_difficulty_mastery(db: Session, semester_id: int, class_id: int, subject_id: Optional[int] = None) -> Dict[str, float]:
        """Get difficulty level mastery percentages"""
        
        # Get questions by difficulty level
        query = db.query(Question).join(Exam)
        
        if subject_id:
            query = query.filter(Exam.subject_id == subject_id)
        
        query = query.filter(Exam.class_id == class_id)
        questions = query.all()
        
        difficulty_mastery = {}
        
        for level in ['easy', 'medium', 'hard']:
            level_questions = [q for q in questions if q.difficulty_level == level]
            
            if not level_questions:
                difficulty_mastery[level] = 0.0
                continue
            
            # Get marks for these questions
            question_ids = [q.id for q in level_questions]
            marks = db.query(Mark).filter(Mark.question_id.in_(question_ids)).all()
            
            if not marks:
                difficulty_mastery[level] = 0.0
                continue
            
            total_possible = sum(q.marks for q in level_questions)
            total_obtained = sum(mark.marks_obtained for mark in marks)
            
            if total_possible == 0:
                difficulty_mastery[level] = 0.0
            else:
                difficulty_mastery[level] = (total_obtained / total_possible) * 100
        
        return difficulty_mastery

@app.get("/dashboard-stats", response_model=AnalyticsDashboardStats)
async def get_dashboard_stats(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get comprehensive dashboard statistics"""
    
    # Get current user for role-based filtering
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Apply role-based filtering
    if current_user.role == "hod":
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Teachers see stats for their subjects
        teacher_subjects = db.query(Subject.id).filter(Subject.teacher_id == current_user_id).subquery()
        pass
    elif current_user.role == "student":
        # Students see their own stats only
        pass
    
    # Get basic counts
    total_users = db.query(User).count()
    total_departments = db.query(Department).count()
    total_classes = db.query(Class).count()
    total_subjects = db.query(Subject).count()
    total_exams = db.query(Exam).count()
    total_students = db.query(User).filter(User.role == "student").count()
    total_teachers = db.query(User).filter(User.role == "teacher").count()
    active_semesters = db.query(Semester).filter(Semester.is_active == True).count()
    
    # Get recent activities (simplified)
    recent_activities = []
    
    # Get recent exam activities
    recent_exams = db.query(Exam).order_by(desc(Exam.created_at)).limit(5).all()
    for exam in recent_exams:
        recent_activities.append({
            "type": "exam_created",
            "description": f"New exam '{exam.title}' created",
            "timestamp": exam.created_at.isoformat(),
            "user_id": exam.created_by if hasattr(exam, 'created_by') else None
        })
    
    return AnalyticsDashboardStats(
        total_users=total_users,
        total_departments=total_departments,
        total_classes=total_classes,
        total_subjects=total_subjects,
        total_exams=total_exams,
        total_students=total_students,
        total_teachers=total_teachers,
        active_semesters=active_semesters,
        recent_activities=recent_activities
    )

@app.get("/co-attainment", response_model=List[COAttainmentResponse])
async def get_co_attainment(
    semester_id: int,
    class_id: int,
    subject_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get CO attainment analytics"""
    
    # Get COs for the specified parameters
    query = db.query(CO)
    
    if subject_id:
        query = query.filter(CO.subject_id == subject_id)
    if department_id:
        query = query.filter(CO.department_id == department_id)
    
    cos = query.all()
    
    co_attainments = []
    
    for co in cos:
        # Calculate attainment
        attainment_percentage = COPOAttainmentCalculator.calculate_co_attainment(
            db, co.id, semester_id, class_id, co.subject_id
        )
        
        # Get student count
        student_count = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.semester_id == semester_id,
            StudentSemesterEnrollment.class_id == class_id
        ).count()
        
        # Get Bloom's distribution
        bloom_distribution = BloomTaxonomyAnalyzer.get_bloom_distribution(
            db, semester_id, class_id, co.subject_id
        )
        
        # Get difficulty distribution
        difficulty_distribution = DifficultyAnalyzer.get_difficulty_distribution(
            db, semester_id, class_id, co.subject_id
        )
        
        # Get or create CO attainment record
        co_attainment = db.query(COAttainment).filter(
            COAttainment.co_id == co.id,
            COAttainment.semester_id == semester_id,
            COAttainment.class_id == class_id,
            COAttainment.subject_id == co.subject_id
        ).first()
        
        if not co_attainment:
            co_attainment = COAttainment(
                co_id=co.id,
                semester_id=semester_id,
                class_id=class_id,
                subject_id=co.subject_id,
                attainment_percentage=attainment_percentage,
                student_count=student_count,
                bloom_distribution=bloom_distribution,
                difficulty_distribution=difficulty_distribution
            )
            db.add(co_attainment)
            db.commit()
        else:
            co_attainment.attainment_percentage = attainment_percentage
            co_attainment.student_count = student_count
            co_attainment.bloom_distribution = bloom_distribution
            co_attainment.difficulty_distribution = difficulty_distribution
            db.commit()
        
        co_attainments.append(co_attainment)
    
    return co_attainments

@app.get("/po-attainment", response_model=List[POAttainmentResponse])
async def get_po_attainment(
    semester_id: int,
    class_id: int,
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get PO attainment analytics"""
    
    # Get POs for the department
    pos = db.query(PO).filter(PO.department_id == department_id).all()
    
    po_attainments = []
    
    for po in pos:
        # Calculate attainment
        attainment_percentage = COPOAttainmentCalculator.calculate_po_attainment(
            db, po.id, semester_id, class_id, department_id
        )
        
        # Get student count
        student_count = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.semester_id == semester_id,
            StudentSemesterEnrollment.class_id == class_id
        ).count()
        
        # Get CO contributions
        co_contributions = {}
        co_po_mappings = db.query(COPOMapping).filter(COPOMapping.po_id == po.id).all()
        
        for mapping in co_po_mappings:
            co_attainment = COPOAttainmentCalculator.calculate_co_attainment(
                db, mapping.co_id, semester_id, class_id, mapping.co.subject_id
            )
            co_contributions[f"CO{mapping.co_id}"] = {
                "attainment": co_attainment,
                "weight": mapping.mapping_strength
            }
        
        # Get or create PO attainment record
        po_attainment = db.query(POAttainment).filter(
            POAttainment.po_id == po.id,
            POAttainment.semester_id == semester_id,
            POAttainment.class_id == class_id,
            POAttainment.department_id == department_id
        ).first()
        
        if not po_attainment:
            po_attainment = POAttainment(
                po_id=po.id,
                semester_id=semester_id,
                class_id=class_id,
                department_id=department_id,
                attainment_percentage=attainment_percentage,
                student_count=student_count,
                co_contributions=co_contributions
            )
            db.add(po_attainment)
            db.commit()
        else:
            po_attainment.attainment_percentage = attainment_percentage
            po_attainment.student_count = student_count
            po_attainment.co_contributions = co_contributions
            db.commit()
        
        po_attainments.append(po_attainment)
    
    return po_attainments

@app.get("/student-performance", response_model=List[StudentPerformanceAnalytics])
async def get_student_performance(
    semester_id: int,
    class_id: int,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get student performance analytics"""
    
    # Get current user for role-based filtering
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Apply role-based filtering
    if current_user.role == "student":
        student_id = current_user_id
    
    # Get students
    if student_id:
        students = [db.query(User).filter(User.id == student_id).first()]
    else:
        students = db.query(User).join(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.semester_id == semester_id,
            StudentSemesterEnrollment.class_id == class_id,
            User.role == "student"
        ).all()
    
    performance_analytics = []
    
    for student in students:
        if not student:
            continue
        
        # Get semester and class info
        semester = db.query(Semester).filter(Semester.id == semester_id).first()
        class_info = db.query(Class).filter(Class.id == class_id).first()
        
        # Get subjects for this class
        subjects = db.query(Subject).filter(Subject.class_id == class_id).all()
        
        # Calculate performance metrics
        total_subjects = len(subjects)
        completed_subjects = 0
        total_marks = 0.0
        obtained_marks = 0.0
        
        co_attainment = {}
        po_attainment = {}
        bloom_mastery = {}
        difficulty_mastery = {}
        
        for subject in subjects:
            # Get marks for this subject
            subject_marks = db.query(Mark).join(Exam).filter(
                Mark.student_id == student.id,
                Exam.subject_id == subject.id,
                Exam.class_id == class_id
            ).all()
            
            if subject_marks:
                completed_subjects += 1
                subject_total = sum(m.max_marks for m in subject_marks)
                subject_obtained = sum(m.marks_obtained for m in subject_marks)
                
                total_marks += subject_total
                obtained_marks += subject_obtained
        
        # Calculate overall percentage
        overall_percentage = (obtained_marks / total_marks * 100) if total_marks > 0 else 0.0
        
        # Calculate grade
        if overall_percentage >= 90:
            grade = "A+"
        elif overall_percentage >= 80:
            grade = "A"
        elif overall_percentage >= 70:
            grade = "B+"
        elif overall_percentage >= 60:
            grade = "B"
        elif overall_percentage >= 50:
            grade = "C+"
        elif overall_percentage >= 40:
            grade = "C"
        elif overall_percentage >= 30:
            grade = "D"
        else:
            grade = "F"
        
        # Calculate GPA
        gpa = (overall_percentage / 100) * 4.0 if overall_percentage > 0 else 0.0
        
        # Get attendance percentage from attendance records
        total_attendance = db.query(Attendance).filter(
            Attendance.student_id == student.id,
            Attendance.status == "present"
        ).count()
        
        total_days = db.query(Attendance).filter(
            Attendance.student_id == student.id
        ).count()
        
        attendance_percentage = (total_attendance / total_days * 100) if total_days > 0 else 0.0
        
        # Get CO/PO attainment for this student
        student_cos = db.query(CO).join(Subject).filter(Subject.class_id == class_id).all()
        for co in student_cos:
            co_attainment[f"CO{co.id}"] = COPOAttainmentCalculator.calculate_co_attainment(
                db, co.id, semester_id, class_id, co.subject_id
            )
        
        # Get Bloom's mastery
        bloom_mastery = BloomTaxonomyAnalyzer.get_bloom_attainment(
            db, semester_id, class_id
        )
        
        # Get difficulty mastery
        difficulty_mastery = DifficultyAnalyzer.get_difficulty_mastery(
            db, semester_id, class_id
        )
        
        performance_analytics.append(StudentPerformanceAnalytics(
            student_id=student.id,
            student_name=student.full_name,
            semester_id=semester_id,
            semester_name=semester.name if semester else "Unknown",
            class_id=class_id,
            class_name=class_info.name if class_info else "Unknown",
            total_subjects=total_subjects,
            completed_subjects=completed_subjects,
            overall_percentage=overall_percentage,
            overall_grade=grade,
            gpa=gpa,
            attendance_percentage=attendance_percentage,
            co_attainment=co_attainment,
            po_attainment=po_attainment,
            bloom_mastery=bloom_mastery,
            difficulty_mastery=difficulty_mastery
        ))
    
    return performance_analytics

@app.post("/recalculate-attainment")
async def recalculate_attainment(
    semester_id: int,
    class_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Recalculate CO/PO attainment for a class (background task)"""
    
    # This would be implemented as a background task
    # For now, just trigger the calculation
    co_attainments = await get_co_attainment(semester_id, class_id, db=db, current_user_id=current_user_id)
    po_attainments = await get_po_attainment(semester_id, class_id, class_id, db=db, current_user_id=current_user_id)
    
    return {
        "message": "Attainment recalculation completed",
        "co_attainments_calculated": len(co_attainments),
        "po_attainments_calculated": len(po_attainments)
    }

@app.get("/")
async def root():
    return {"message": "Enhanced Analytics Service is running", "version": "2.0.0"}
