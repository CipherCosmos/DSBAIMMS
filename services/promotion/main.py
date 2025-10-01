# Student Promotion Service
# Handles student promotion between semesters and classes

from fastapi import FastAPI, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc, asc
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
import json

from shared.database import get_db
from shared.models import (
    User, Department, Semester, Class, Subject, Exam, Question, Mark,
    CO, PO, COPOMapping, StudentSemesterEnrollment, Attendance,
    TeacherSubject, ExamAnalytics, AuditLog
)
from shared.schemas import (
    DashboardStats, BulkOperationResult, ExportRequest
)
from shared.auth import RoleChecker
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Student Promotion Service", version="1.0.0")


@app.get("/")
async def root():
    return {"message": "Student Promotion Service is running"}

@app.get("/api/promotion/eligible-students")
async def get_eligible_students_for_promotion(
    current_semester_id: int,
    target_semester_id: int,
    class_id: Optional[int] = None,
    department_id: Optional[int] = None,
    min_attendance_percentage: float = 75.0,
    min_pass_percentage: float = 40.0,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get students eligible for promotion to next semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id

    # Verify semesters exist and are sequential
    current_semester = db.query(Semester).filter(Semester.id == current_semester_id).first()
    target_semester = db.query(Semester).filter(Semester.id == target_semester_id).first()

    if not current_semester or not target_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    if current_semester.department_id != target_semester.department_id:
        raise HTTPException(status_code=400, detail="Semesters must be from the same department")

    # Get students in current semester
    students_query = db.query(User).filter(
        User.role == "student",
        User.class_id.in_(
            db.query(Class.id).filter(Class.semester_id == current_semester_id)
        )
    )

    if department_id:
        students_query = students_query.filter(User.department_id == department_id)
    if class_id:
        students_query = students_query.filter(User.class_id == class_id)

    students = students_query.all()

    eligible_students = []
    ineligible_students = []

    for student in students:
        # Check attendance
        attendance_records = db.query(Attendance).filter(
            Attendance.student_id == student.id,
            Attendance.semester_id == current_semester_id
        ).all()

        attendance_percentage = 0.0
        if attendance_records:
            present_days = len([r for r in attendance_records if r.status == "present"])
            total_days = len(attendance_records)
            attendance_percentage = (present_days / total_days * 100) if total_days > 0 else 0.0

        # Check academic performance
        student_marks = db.query(Mark).join(Exam).join(Class).filter(
            Mark.student_id == student.id,
            Class.semester_id == current_semester_id
        ).all()

        pass_percentage = 0.0
        if student_marks:
            total_obtained = sum(mark.marks_obtained for mark in student_marks)
            total_max = sum(mark.max_marks for mark in student_marks)
            pass_percentage = (total_obtained / total_max * 100) if total_max > 0 else 0.0

        # Check if student meets promotion criteria
        is_eligible = (
            attendance_percentage >= min_attendance_percentage and
            pass_percentage >= min_pass_percentage
        )

        student_data = {
            "student_id": student.id,
            "student_name": student.full_name,
            "student_roll": student.student_id,
            "class_name": student.class_assigned.name if student.class_assigned else None,
            "department_name": student.department.name if student.department else None,
            "attendance_percentage": float(attendance_percentage),
            "pass_percentage": float(pass_percentage),
            "total_subjects": len(set(mark.exam.subject_id for mark in student_marks)),
            "total_exams": len(set(mark.exam_id for mark in student_marks)),
            "is_eligible": is_eligible,
            "reasons": []
        }

        if not is_eligible:
            if attendance_percentage < min_attendance_percentage:
                student_data["reasons"].append(f"Low attendance: {attendance_percentage:.1f}% (required: {min_attendance_percentage}%)")
            if pass_percentage < min_pass_percentage:
                student_data["reasons"].append(f"Low performance: {pass_percentage:.1f}% (required: {min_pass_percentage}%)")

        if is_eligible:
            eligible_students.append(student_data)
        else:
            ineligible_students.append(student_data)

    return {
        "current_semester": {
            "id": current_semester.id,
            "name": current_semester.name,
            "department_name": current_semester.department.name if current_semester.department else None
        },
        "target_semester": {
            "id": target_semester.id,
            "name": target_semester.name,
            "department_name": target_semester.department.name if target_semester.department else None
        },
        "criteria": {
            "min_attendance_percentage": min_attendance_percentage,
            "min_pass_percentage": min_pass_percentage
        },
        "eligible_students": eligible_students,
        "ineligible_students": ineligible_students,
        "summary": {
            "total_students": len(students),
            "eligible_count": len(eligible_students),
            "ineligible_count": len(ineligible_students),
            "promotion_rate": (len(eligible_students) / len(students) * 100) if students else 0.0
        }
    }

@app.post("/api/promotion/promote-students")
async def promote_students(
    promotion_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Promote students to next semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    student_ids = promotion_data.get("student_ids", [])
    target_semester_id = promotion_data.get("target_semester_id")
    target_class_id = promotion_data.get("target_class_id")

    if not student_ids or not target_semester_id:
        raise HTTPException(status_code=400, detail="student_ids and target_semester_id are required")

    # Verify target semester exists
    target_semester = db.query(Semester).filter(Semester.id == target_semester_id).first()
    if not target_semester:
        raise HTTPException(status_code=404, detail="Target semester not found")

    # Verify target class exists if provided
    if target_class_id:
        target_class = db.query(Class).filter(
            Class.id == target_class_id,
            Class.semester_id == target_semester_id
        ).first()
        if not target_class:
            raise HTTPException(status_code=404, detail="Target class not found")

    promoted_students = []
    failed_promotions = []

    for student_id in student_ids:
        try:
            student = db.query(User).filter(User.id == student_id, User.role == "student").first()
            if not student:
                failed_promotions.append({
                    "student_id": student_id,
                    "error": "Student not found"
                })
                continue

            # Get current semester enrollment
            current_enrollment = db.query(StudentSemesterEnrollment).filter(
                StudentSemesterEnrollment.student_id == student_id,
                StudentSemesterEnrollment.status == "active"
            ).first()

            if current_enrollment:
                # Mark current enrollment as completed
                current_enrollment.status = "completed"
                current_enrollment.completed_at = datetime.utcnow()

            # Create new enrollment for target semester
            new_enrollment = StudentSemesterEnrollment(
                student_id=student_id,
                semester_id=target_semester_id,
                class_id=target_class_id,
                status="active",
                enrolled_at=datetime.utcnow(),
                enrolled_by=current_user_id
            )
            db.add(new_enrollment)

            # Update student's class if target class is provided
            if target_class_id:
                old_class_id = student.class_id
                student.class_id = target_class_id
                student.updated_at = datetime.utcnow()

                # Log audit
                log_audit(db, current_user_id, "PROMOTE", "users", student_id,
                         {"class_id": old_class_id, "semester_id": current_enrollment.semester_id if current_enrollment else None},
                         {"class_id": target_class_id, "semester_id": target_semester_id})

            promoted_students.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "student_roll": student.student_id,
                "old_class_id": student.class_id,
                "new_class_id": target_class_id,
                "target_semester_id": target_semester_id
            })

        except Exception as e:
            failed_promotions.append({
                "student_id": student_id,
                "error": str(e)
            })

    if promoted_students:
        db.commit()

    return {
        "success": len(failed_promotions) == 0,
        "promoted_count": len(promoted_students),
        "failed_count": len(failed_promotions),
        "promoted_students": promoted_students,
        "failed_promotions": failed_promotions
    }

@app.get("/api/promotion/promotion-history")
async def get_promotion_history(
    student_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    department_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get promotion history for students"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id
    elif current_user.role == "teacher":
        # Teachers can only see students from their subjects
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user_id).all()
        if not teacher_subjects:
            return {"message": "No subjects assigned to teacher"}
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        class_ids = db.query(Class.id).join(Subject).filter(Subject.id.in_(subject_ids)).all()
        class_ids = [c[0] for c in class_ids]

    # Build query for enrollments
    enrollments_query = db.query(StudentSemesterEnrollment).join(User).filter(
        User.role == "student"
    )

    if student_id:
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.student_id == student_id)
    if semester_id:
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.semester_id == semester_id)
    if department_id:
        enrollments_query = enrollments_query.join(Semester).filter(Semester.department_id == department_id)
    if current_user.role == "teacher":
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.class_id.in_(class_ids))

    enrollments = enrollments_query.order_by(desc(StudentSemesterEnrollment.enrolled_at)).offset(skip).limit(limit).all()

    results = []
    for enrollment in enrollments:
        results.append({
            "enrollment_id": enrollment.id,
            "student_id": enrollment.student_id,
            "student_name": enrollment.student.full_name,
            "student_roll": enrollment.student.student_id,
            "semester_id": enrollment.semester_id,
            "semester_name": enrollment.semester.name if enrollment.semester else None,
            "class_id": enrollment.class_id,
            "class_name": enrollment.class_assigned.name if enrollment.class_assigned else None,
            "status": enrollment.status,
            "enrolled_at": enrollment.enrolled_at,
            "completed_at": enrollment.completed_at,
            "enrolled_by": enrollment.enrolled_by,
            "enrolled_by_name": enrollment.enrolled_by_user.full_name if enrollment.enrolled_by_user else None
        })

    return results

@app.get("/api/promotion/analytics")
async def get_promotion_analytics(
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get promotion analytics and statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")

    # Role-based filtering
    if current_user.role == "hod":
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="No department assigned to HOD")
        department_id = current_user.department_id

    # Build query for enrollments
    enrollments_query = db.query(StudentSemesterEnrollment).join(User).filter(
        User.role == "student"
    )

    if department_id:
        enrollments_query = enrollments_query.join(Semester).filter(Semester.department_id == department_id)
    if semester_id:
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.semester_id == semester_id)
    if start_date:
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.enrolled_at >= start_date)
    if end_date:
        enrollments_query = enrollments_query.filter(StudentSemesterEnrollment.enrolled_at <= end_date)

    enrollments = enrollments_query.all()

    # Calculate statistics
    total_enrollments = len(enrollments)
    active_enrollments = len([e for e in enrollments if e.status == "active"])
    completed_enrollments = len([e for e in enrollments if e.status == "completed"])
    dropped_enrollments = len([e for e in enrollments if e.status == "dropped"])

    # Promotion rate
    promotion_rate = (completed_enrollments / total_enrollments * 100) if total_enrollments > 0 else 0.0

    # Department-wise statistics
    dept_stats = {}
    for enrollment in enrollments:
        dept_id = enrollment.semester.department_id if enrollment.semester else None
        dept_name = enrollment.semester.department.name if enrollment.semester and enrollment.semester.department else "Unknown"

        if dept_id not in dept_stats:
            dept_stats[dept_id] = {
                "department_id": dept_id,
                "department_name": dept_name,
                "total_enrollments": 0,
                "active_enrollments": 0,
                "completed_enrollments": 0,
                "dropped_enrollments": 0
            }

        dept_stats[dept_id]["total_enrollments"] += 1
        if enrollment.status == "active":
            dept_stats[dept_id]["active_enrollments"] += 1
        elif enrollment.status == "completed":
            dept_stats[dept_id]["completed_enrollments"] += 1
        elif enrollment.status == "dropped":
            dept_stats[dept_id]["dropped_enrollments"] += 1

    # Calculate promotion rates for each department
    for dept_id, stats in dept_stats.items():
        stats["promotion_rate"] = (stats["completed_enrollments"] / stats["total_enrollments"] * 100) if stats["total_enrollments"] > 0 else 0.0

    return {
        "overview": {
            "total_enrollments": total_enrollments,
            "active_enrollments": active_enrollments,
            "completed_enrollments": completed_enrollments,
            "dropped_enrollments": dropped_enrollments,
            "promotion_rate": float(promotion_rate)
        },
        "department_stats": list(dept_stats.values()),
        "filters_applied": {
            "department_id": department_id,
            "semester_id": semester_id,
            "start_date": start_date,
            "end_date": end_date
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "promotion"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8018)
