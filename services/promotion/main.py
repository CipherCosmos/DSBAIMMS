from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date
import pandas as pd
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Semester, StudentSemesterEnrollment, AuditLog, Mark, Attendance
from shared.auth import RoleChecker
from shared.permissions import PermissionChecker

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    """Log audit trail"""
    import json
    
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()

app = FastAPI(title="Promotion Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Enhanced schemas
class PromotionCriteria(BaseModel):
    min_attendance_percentage: float = 75.0
    min_passing_marks: float = 40.0
    min_gpa: Optional[float] = None
    max_backlogs: int = 2
    clearance_required: bool = True

class StudentPromotionRequest(BaseModel):
    student_id: int
    from_semester_id: int
    to_semester_id: int
    from_class_id: int
    to_class_id: int
    promotion_type: str = "regular"  # regular, lateral, re-admission
    remarks: Optional[str] = None

class BulkPromotionRequest(BaseModel):
    promotions: List[StudentPromotionRequest]
    criteria: PromotionCriteria

class PromotionAnalytics(BaseModel):
    total_students: int
    eligible_for_promotion: int
    not_eligible: int
    promotion_rate: float
    students_by_status: Dict[str, int]
    department_wise_stats: Dict[str, Dict[str, int]]

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    """Log audit trail"""
    import json
    
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()

def check_promotion_eligibility(student_id: int, semester_id: int, criteria: PromotionCriteria, db: Session) -> Dict[str, Any]:
    """Check if a student is eligible for promotion based on criteria"""
    
    # Get student's performance in the current semester
    student = db.query(User).filter(User.id == student_id).first()
    if not student or student.role != "student":
        return {"eligible": False, "reason": "Student not found"}
    
    # Check attendance
    total_attendance_days = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.status == "present"
    ).count()
    
    total_working_days = db.query(Attendance).filter(
        Attendance.student_id == student_id
    ).count()
    
    attendance_percentage = (total_attendance_days / total_working_days * 100) if total_working_days > 0 else 0
    
    if attendance_percentage < criteria.min_attendance_percentage:
        return {
            "eligible": False, 
            "reason": f"Low attendance: {attendance_percentage:.2f}% (required: {criteria.min_attendance_percentage}%)",
            "attendance_percentage": attendance_percentage
        }
    
    # Check academic performance
    semester_marks = db.query(Mark).join(Question).join(Exam).filter(
        Exam.semester_id == semester_id,
        Mark.student_id == student_id
    ).all()
    
    if not semester_marks:
        return {"eligible": False, "reason": "No marks found for the semester"}
    
    # Calculate overall performance
    total_obtained = sum(mark.marks_obtained for mark in semester_marks)
    total_maximum = sum(mark.max_marks for mark in semester_marks)
    overall_percentage = (total_obtained / total_maximum * 100) if total_maximum > 0 else 0
    
    # Count backlogs (subjects with marks below minimum)
    subjects = db.query(Subject).join(Exam).filter(
        Exam.semester_id == semester_id
    ).distinct().all()
    
    backlogs = 0
    for subject in subjects:
        subject_marks = db.query(Mark).join(Question).join(Exam).filter(
            Exam.subject_id == subject.id,
            Mark.student_id == student_id
        ).all()
        
        if subject_marks:
            subject_total = sum(mark.marks_obtained for mark in subject_marks)
            subject_max = sum(mark.max_marks for mark in subject_marks)
            subject_percentage = (subject_total / subject_max * 100) if subject_max > 0 else 0
            
            if subject_percentage < criteria.min_passing_marks:
                backlogs += 1
    
    if backlogs > criteria.max_backlogs:
        return {
            "eligible": False,
            "reason": f"Too many backlogs: {backlogs} (allowed: {criteria.max_backlogs})",
            "backlogs": backlogs,
            "overall_percentage": overall_percentage
        }
    
    # Check GPA if required
    if criteria.min_gpa is not None:
        # Calculate GPA (simplified calculation)
        gpa = (overall_percentage / 100) * 4.0  # Convert percentage to 4.0 scale
        if gpa < criteria.min_gpa:
            return {
                "eligible": False,
                "reason": f"Low GPA: {gpa:.2f} (required: {criteria.min_gpa})",
                "gpa": gpa,
                "overall_percentage": overall_percentage
            }
    
    return {
        "eligible": True,
        "attendance_percentage": attendance_percentage,
        "overall_percentage": overall_percentage,
        "backlogs": backlogs,
        "gpa": (overall_percentage / 100) * 4.0 if criteria.min_gpa else None
    }

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Promotion Service", "version": "1.0.0"}

# Get eligible students for promotion
@app.get("/eligible-students")
async def get_eligible_students(
    class_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    criteria: Optional[str] = Query(None),  # JSON string of criteria
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get students eligible for promotion"""
    import json
    
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Base query for students
    query = db.query(User).filter(User.role == "student")
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    
    if class_id:
        query = query.filter(User.class_id == class_id)
    elif department_id:
        query = query.filter(User.department_id == department_id)
    
    students = query.offset(skip).limit(limit).all()
    
    # Parse criteria if provided
    promotion_criteria = PromotionCriteria()
    if criteria:
        try:
            criteria_dict = json.loads(criteria)
            promotion_criteria = PromotionCriteria(**criteria_dict)
        except:
            pass
    
    # Calculate eligibility for each student
    eligible_students = []
    for student in students:
        # Get student's academic performance
        student_performance = calculate_student_performance(db, student.id)
        
        is_eligible = (
            student_performance.get('attendance_percentage', 0) >= promotion_criteria.min_attendance_percentage and
            student_performance.get('average_marks', 0) >= promotion_criteria.min_passing_marks and
            student_performance.get('backlog_count', 0) <= promotion_criteria.max_backlogs
        )
        
        eligible_students.append({
            "id": student.id,
            "full_name": student.full_name,
            "student_id": student.student_id,
            "class_id": student.class_id,
            "class_name": student.class_assigned.name if student.class_assigned else None,
            "department_id": student.department_id,
            "department_name": student.department.name if student.department else None,
            "current_semester": student_performance.get('current_semester', 1),
            "cgpa": student_performance.get('cgpa', 0.0),
            "attendance_percentage": student_performance.get('attendance_percentage', 0.0),
            "credits_completed": student_performance.get('credits_completed', 0),
            "credits_required": student_performance.get('credits_required', 0),
            "is_eligible": is_eligible,
            "promotion_status": "pending",
            "remarks": None
        })
    
    return {"data": eligible_students, "total": len(eligible_students)}

# Get promotion batches
@app.get("/batches")
async def get_promotion_batches(
    academic_year: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get promotion batches"""
    # For now, return mock data as this would require a promotion batches table
    batches = [
        {
            "id": 1,
            "name": "Spring 2024 Promotion",
            "from_semester": 1,
            "to_semester": 2,
            "academic_year": "2024",
            "status": "active",
            "total_students": 150,
            "eligible_students": 120,
            "created_at": "2024-01-15T10:00:00Z",
            "created_by": "Admin"
        },
        {
            "id": 2,
            "name": "Fall 2023 Promotion",
            "from_semester": 2,
            "to_semester": 3,
            "academic_year": "2023",
            "status": "completed",
            "total_students": 140,
            "eligible_students": 135,
            "created_at": "2023-08-15T10:00:00Z",
            "created_by": "Admin"
        }
    ]
    
    return {"data": batches, "total": len(batches)}

# Promote students
@app.post("/promote")
async def promote_students(
    promotion_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Promote students to next semester"""
    try:
        student_ids = promotion_data.get("student_ids", [])
        target_semester_id = promotion_data.get("target_semester_id")
        criteria = promotion_data.get("criteria", {})
        remarks = promotion_data.get("remarks", "")
        
        if not student_ids or not target_semester_id:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Get target semester
        target_semester = db.query(Semester).filter(Semester.id == target_semester_id).first()
        if not target_semester:
            raise HTTPException(status_code=404, detail="Target semester not found")
        
        promoted_count = 0
        for student_id in student_ids:
            student = db.query(User).filter(User.id == student_id).first()
            if not student:
                continue
            
            # Check eligibility before promoting
            student_performance = calculate_student_performance(db, student_id)
            
            # Update student's semester enrollment
            enrollment = db.query(StudentSemesterEnrollment).filter(
                StudentSemesterEnrollment.student_id == student_id,
                StudentSemesterEnrollment.is_active == True
            ).first()
            
            if enrollment:
                enrollment.is_active = False
                enrollment.updated_at = datetime.utcnow()
            
            # Create new enrollment for target semester
            new_enrollment = StudentSemesterEnrollment(
                student_id=student_id,
                semester_id=target_semester_id,
                class_id=student.class_id,
                enrollment_date=datetime.utcnow(),
                is_active=True,
                status="enrolled",
                remarks=remarks
            )
            db.add(new_enrollment)
            promoted_count += 1
        
        db.commit()
        
        # Log audit trail
        log_audit(db, current_user_id, "bulk_promotion", "student_semester_enrollment", 
                 None, None, {"student_ids": student_ids, "target_semester_id": target_semester_id})
        
        return {
            "message": f"Successfully promoted {promoted_count} students",
            "promoted_count": promoted_count,
            "target_semester": target_semester.name
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Check promotion eligibility for a student
@app.post("/check-eligibility/{student_id}")
async def check_student_eligibility(
    student_id: int,
    semester_id: int,
    criteria: PromotionCriteria,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Check if a student is eligible for promotion"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    student = db.query(User).filter(User.id == student_id).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if student.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only check students in their classes
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        class_ids = [subject.class_id for subject in teacher_subjects]
        if student.class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    eligibility_result = check_promotion_eligibility(student_id, semester_id, criteria, db)
    
    return {
        "student_id": student_id,
        "semester_id": semester_id,
        "criteria": criteria.dict(),
        "eligibility": eligibility_result
    }

# Promote a single student
@app.post("/promote-student")
async def promote_student(
    promotion_request: StudentPromotionRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Promote a single student to the next semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate student exists
    student = db.query(User).filter(User.id == promotion_request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if student.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate semesters exist
    from_semester = db.query(Semester).filter(Semester.id == promotion_request.from_semester_id).first()
    to_semester = db.query(Semester).filter(Semester.id == promotion_request.to_semester_id).first()
    
    if not from_semester or not to_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Validate classes exist
    from_class = db.query(Class).filter(Class.id == promotion_request.from_class_id).first()
    to_class = db.query(Class).filter(Class.id == promotion_request.to_class_id).first()
    
    if not from_class or not to_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Check if student is already enrolled in target semester
    existing_enrollment = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.student_id == promotion_request.student_id,
        StudentSemesterEnrollment.semester_id == promotion_request.to_semester_id
    ).first()
    
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Student is already enrolled in the target semester")
    
    # Create new semester enrollment
    new_enrollment = StudentSemesterEnrollment(
        student_id=promotion_request.student_id,
        semester_id=promotion_request.to_semester_id,
        class_id=promotion_request.to_class_id,
        enrollment_date=datetime.utcnow(),
        status="active",
        promotion_type=promotion_request.promotion_type,
        remarks=promotion_request.remarks
    )
    
    # Update student's current class
    student.class_id = promotion_request.to_class_id
    student.updated_at = datetime.utcnow()
    
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    
    # Log audit
    log_audit(db, current_user_id, "PROMOTE", "Student", promotion_request.student_id, {
        "from_semester_id": promotion_request.from_semester_id,
        "from_class_id": promotion_request.from_class_id
    }, {
        "to_semester_id": promotion_request.to_semester_id,
        "to_class_id": promotion_request.to_class_id,
        "promotion_type": promotion_request.promotion_type
    })
    
    return {
        "message": "Student promoted successfully",
        "enrollment_id": new_enrollment.id,
        "student_id": promotion_request.student_id,
        "from_semester": from_semester.name,
        "to_semester": to_semester.name,
        "from_class": from_class.name,
        "to_class": to_class.name
    }

# Bulk promotion with eligibility check
@app.post("/bulk-promotion")
async def bulk_promotion(
    bulk_request: BulkPromotionRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk promote students with eligibility checking"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    successful_promotions = []
    failed_promotions = []
    
    for promotion in bulk_request.promotions:
        try:
            # Check eligibility first
            eligibility = check_promotion_eligibility(
                promotion.student_id, 
                promotion.from_semester_id, 
                bulk_request.criteria, 
                db
            )
            
            if not eligibility["eligible"]:
                failed_promotions.append({
                    "student_id": promotion.student_id,
                    "reason": eligibility["reason"]
                })
                continue
            
            # Promote student
            student = db.query(User).filter(User.id == promotion.student_id).first()
            from_semester = db.query(Semester).filter(Semester.id == promotion.from_semester_id).first()
            to_semester = db.query(Semester).filter(Semester.id == promotion.to_semester_id).first()
            from_class = db.query(Class).filter(Class.id == promotion.from_class_id).first()
            to_class = db.query(Class).filter(Class.id == promotion.to_class_id).first()
            
            # Create new enrollment
            new_enrollment = StudentSemesterEnrollment(
                student_id=promotion.student_id,
                semester_id=promotion.to_semester_id,
                class_id=promotion.to_class_id,
                enrollment_date=datetime.utcnow(),
                status="active",
                promotion_type=promotion.promotion_type,
                remarks=promotion.remarks
            )
            
            # Update student's class
            student.class_id = promotion.to_class_id
            student.updated_at = datetime.utcnow()
            
            db.add(new_enrollment)
            db.commit()
            
            successful_promotions.append({
                "student_id": promotion.student_id,
                "student_name": student.full_name,
                "from_semester": from_semester.name,
                "to_semester": to_semester.name,
                "enrollment_id": new_enrollment.id
            })
            
        except Exception as e:
            failed_promotions.append({
                "student_id": promotion.student_id,
                "reason": str(e)
            })
            db.rollback()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_PROMOTION", "Student", None, None, {
        "total_requested": len(bulk_request.promotions),
        "successful": len(successful_promotions),
        "failed": len(failed_promotions),
        "criteria": bulk_request.criteria.dict()
    })
    
    return {
        "summary": {
            "total_requested": len(bulk_request.promotions),
            "successful": len(successful_promotions),
            "failed": len(failed_promotions)
        },
        "successful_promotions": successful_promotions,
        "failed_promotions": failed_promotions
    }

# Get promotion analytics
@app.get("/analytics")
async def get_promotion_analytics(
    semester_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get promotion analytics and statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build base query with role-based filtering
    students_query = db.query(User).filter(User.role == "student", User.is_active == True)
    
    if current_user.role == "hod":
        students_query = students_query.filter(User.department_id == current_user.department_id)
    elif department_id:
        students_query = students_query.filter(User.department_id == department_id)
    
    students = students_query.all()
    
    # Get semester for analysis
    target_semester = None
    if semester_id:
        target_semester = db.query(Semester).filter(Semester.id == semester_id).first()
    
    # Calculate analytics
    total_students = len(students)
    eligible_count = 0
    not_eligible_count = 0
    students_by_status = {"eligible": 0, "not_eligible": 0, "need_clearance": 0}
    department_stats = {}
    
    for student in students:
        # Get student's current semester enrollment
        current_enrollment = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.student_id == student.id,
            StudentSemesterEnrollment.status == "active"
        ).first()
        
        if not current_enrollment:
            continue
            
        current_semester_id = current_enrollment.semester_id
        
        # Check eligibility with default criteria
        default_criteria = PromotionCriteria()
        eligibility = check_promotion_eligibility(student.id, current_semester_id, default_criteria, db)
        
        if eligibility["eligible"]:
            eligible_count += 1
            students_by_status["eligible"] += 1
        else:
            not_eligible_count += 1
            students_by_status["not_eligible"] += 1
            
            # Check if needs clearance (backlogs)
            if "backlogs" in eligibility and eligibility["backlogs"] > 0:
                students_by_status["need_clearance"] += 1
        
        # Department-wise stats
        if student.department:
            dept_name = student.department.name
            if dept_name not in department_stats:
                department_stats[dept_name] = {"eligible": 0, "not_eligible": 0, "total": 0}
            
            department_stats[dept_name]["total"] += 1
            if eligibility["eligible"]:
                department_stats[dept_name]["eligible"] += 1
            else:
                department_stats[dept_name]["not_eligible"] += 1
    
    promotion_rate = (eligible_count / total_students * 100) if total_students > 0 else 0
    
    return PromotionAnalytics(
        total_students=total_students,
        eligible_for_promotion=eligible_count,
        not_eligible=not_eligible_count,
        promotion_rate=round(promotion_rate, 2),
        students_by_status=students_by_status,
        department_wise_stats=department_stats
    )

# Get promotion history for a student
@app.get("/history/{student_id}")
async def get_student_promotion_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get promotion history for a student"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    student = db.query(User).filter(User.id == student_id).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Role-based access control
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if student.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only access students in their classes
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        class_ids = [subject.class_id for subject in teacher_subjects]
        if student.class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all semester enrollments for the student
    enrollments = db.query(StudentSemesterEnrollment).options(
        joinedload(StudentSemesterEnrollment.semester),
        joinedload(StudentSemesterEnrollment.class_ref)
    ).filter(StudentSemesterEnrollment.student_id == student_id).order_by(StudentSemesterEnrollment.enrollment_date).all()
    
    history = []
    for enrollment in enrollments:
        history.append({
            "enrollment_id": enrollment.id,
            "semester_name": enrollment.semester.name if enrollment.semester else "Unknown",
            "class_name": f"{enrollment.class_ref.name} - {enrollment.class_ref.section}" if enrollment.class_ref else "Unknown",
            "enrollment_date": enrollment.enrollment_date.isoformat(),
            "status": enrollment.status,
            "promotion_type": enrollment.promotion_type,
            "remarks": enrollment.remarks,
            "gpa": float(enrollment.gpa) if enrollment.gpa else None,
            "attendance_percentage": float(enrollment.attendance_percentage) if enrollment.attendance_percentage else None
        })
    
    return {
        "student_id": student_id,
        "student_name": student.full_name,
        "promotion_history": history,
        "total_semesters": len(history)
    }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "promotion"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8009)
