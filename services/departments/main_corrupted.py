from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import pandas as pd
from io import BytesIO, StringIO

from shared.database import get_db
from shared.models import Department, User, AuditLog, Class, Subject, PO, CO, COPOMapping, Question, Mark, Semester, StudentSemesterEnrollment
from shared.auth import require_any_role, require_admin, require_admin_or_hod, require_admin_hod_or_teacher, RoleChecker
from shared.permissions import PermissionChecker, Permission
from shared.audit import log_audit, log_bulk_audit
from shared.schemas import DepartmentResponse, DepartmentCreate, DepartmentUpdate, ClassResponse, ClassCreate, ClassUpdate, SubjectResponse, Subjec  # ...

# Enhanced schemas for smart CO/PO management
class SmartCOCreate(BaseModel):
    name: str
    description: str
    subject_id: int
    department_id: int
    auto_generate_mappings: bool = True
    suggested_pos: Optional[List[int]] = None

class SmartPOCreate(BaseModel):
    name: str
    description: str
    department_id: int
    auto_generate_mappings: bool = True
    suggested_cos: Optional[List[int]] = None

class COPOAnalytics(BaseModel):
    co_id: int
    co_name: str
    po_id: int
    po_name: str
    mapping_strength: float
    attainment_percentage: float
    student_count: int
    average_score: float
    bloom_distribution: Dict[str, int]
    difficulty_distribution: Dict[str, int]

class BulkCOCreate(BaseModel):
    cos: List[SmartCOCreate]

class BulkPOCreate(BaseModel):
    pos: List[SmartPOCreate]

class COPORecommendation(BaseModel):
    co_id: int
    po_id: int
    confidence_score: float
    reason: str
    suggested_strength: int

app = FastAPI(title="Department Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Using centralized audit system from shared.audit

# Smart CO/PO helper functions
def generate_smart_co_mappings(co_id: int, department_id: int, db: Session) -> List[Dict[str, Any]]:
    """Generate smart CO-PO mappings based on keywords and existing patterns"""
    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        return []

    # Get all POs in the department
    pos = db.query(PO).filter(PO.department_id == department_id).all()

    mappings = []
    co_keywords = extract_keywords(co.description.lower())

    for po in pos:
        po_keywords = extract_keywords(po.description.lower())
        similarity_score = calculate_keyword_similarity(co_keywords, po_keywords)

        if similarity_score > 0.3:  # Threshold for mapping
            strength = 1 if similarity_score < 0.5 else 2 if similarity_score < 0.7 else 3
            mappings.append({
                "co_id": co_id,
                "po_id": po.id,
                "mapping_strength": strength,
                "confidence": similarity_score
            })

    return mappings

def generate_smart_po_mappings(po_id: int, department_id: int, db: Session) -> List[Dict[str, Any]]:
    """Generate smart PO-CO mappings based on keywords and existing patterns"""
    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        return []

    # Get all COs in the department
    cos = db.query(CO).join(Subject).filter(Subject.department_id == department_id).all()

    mappings = []
    po_keywords = extract_keywords(po.description.lower())

    for co in cos:
        co_keywords = extract_keywords(co.description.lower())
        similarity_score = calculate_keyword_similarity(po_keywords, co_keywords)

        if similarity_score > 0.3:  # Threshold for mapping
            strength = 1 if similarity_score < 0.5 else 2 if similarity_score < 0.7 else 3
            mappings.append({
                "co_id": co.id,
                "po_id": po_id,
                "mapping_strength": strength,
                "confidence": similarity_score
            })

    return mappings

def extract_keywords(text: str) -> List[str]:
    """Extract meaningful keywords from text"""
    # Simple keyword extraction - can be enhanced with NLP
    import re
    # Remove common stop words
    stop_words = {'the',
        'a',
        'an',
        'and',
        'or',
        'but',
        'in',
        'on',
        'at',
        'to',
        'for',
        'of',
        'with',
        'by',
        'is',
        'are',
        'was',
        'were',
        'be',
        'been',
        'have',
        'has',
        'had',
        'do',
        'does',
        'did',
        'will',
        'would',
        'could',
        'should',
        'may',
        'might',
        'can',
        'must',
        'shall'}

    # Extract words (alphanumeric only)
    words = re.findall(r'\b\w+\b', text.lower())

    # Filter out stop words and short words
    keywords = [word for word in words if len(word) > 2 and word not in stop_words]

    return keywords

def calculate_keyword_similarity(keywords1: List[str], keywords2: List[str]) -> float:
    """Calculate similarity between two keyword lists"""
    if not keywords1 or not keywords2:
        return 0.0

    set1 = set(keywords1)
    set2 = set(keywords2)

    # Jaccard similarity
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))

    return intersection / union if union > 0 else 0.0

def calculate_co_po_analytics(co_id: int, po_id: int, db: Session) -> Dict[str, Any]:
    """Calculate comprehensive analytics for CO-PO mapping"""
    # Get questions mapped to this CO
    questions = db.query(Question).filter(Question.co_id == co_id).all()

    if not questions:
        return {
            "attainment_percentage": 0.0,
            "student_count": 0,
            "average_score": 0.0,
            "bloom_distribution": {},
            "difficulty_distribution": {}
        }

    # Calculate Bloom's distribution
    bloom_dist = {}
    difficulty_dist = {}

    for question in questions:
        bloom_level = question.bloom_level or "unknown"
        difficulty = question.difficulty_level or "unknown"

        bloom_dist[bloom_level] = bloom_dist.get(bloom_level, 0) + 1
        difficulty_dist[difficulty] = difficulty_dist.get(difficulty, 0) + 1

    # Get marks for these questions
    question_ids = [q.id for q in questions]
    marks_query = db.query(Mark).filter(Mark.question_id.in_(question_ids))

    total_marks = marks_query.count()
    if total_marks == 0:
        return {
            "attainment_percentage": 0.0,
            "student_count": 0,
            "average_score": 0.0,
            "bloom_distribution": bloom_dist,
            "difficulty_distribution": difficulty_dist
        }

    # Calculate average score
    avg_score = marks_query.with_entities(func.avg(Mark.marks_obtained / Mark.max_marks * 100)).scalar() or 0.0

    # Count unique students
    student_count = marks_query.with_entities(func.count(func.distinct(Mark.student_id))).scalar() or 0

    return {
        "attainment_percentage": float(avg_score),
        "student_count": student_count,
        "average_score": float(avg_score),
        "bloom_distribution": bloom_dist,
        "difficulty_distribution": difficulty_dist
    }

def get_co_po_recommendations(department_id: int, db: Session) -> List[COPORecommendation]:
    """Get AI-powered recommendations for CO-PO mappings"""
    recommendations = []

    # Get all COs and POs in the department
    cos = db.query(CO).join(Subject).filter(Subject.department_id == department_id).all()
    pos = db.query(PO).filter(PO.department_id == department_id).all()

    for co in cos:
        for po in pos:
            # Check if mapping already exists
            existing = db.query(COPOMapping).filter(
                and_(COPOMapping.co_id == co.id, COPOMapping.po_id == po.id)
            ).first()

            if not existing:
                # Calculate similarity
                co_keywords = extract_keywords(co.description.lower())
                po_keywords = extract_keywords(po.description.lower())
                similarity = calculate_keyword_similarity(co_keywords, po_keywords)

                if similarity > 0.2:  # Lower threshold for recommendations
                    strength = 1 if similarity < 0.4 else 2 if similarity < 0.6 else 3
                    recommendations.append(COPORecommendation(
                        co_id=co.id,
                        po_id=po.id,
                        confidence_score=similarity,
                        reason=f"Keyword similarity: {similarity:.2f}",
                        suggested_strength=strength
                    ))

    # Sort by confidence score
    recommendations.sort(key=lambda x: x.confidence_score, reverse=True)
    return recommendations[:20]  # Return top 20 recommendations

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Department Service is running", "status": "healthy"}

@app.get("/debug-auth")
async def debug_auth(request: Request):
    """Debug endpoint to test authentication"""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return {"error": "No Authorization header"}

        if not auth_header.startswith("Bearer "):
            return {"error": "Invalid Authorization header format"}

        token = auth_header.split(" ")[1]
        from shared.auth import verify_token
        payload = verify_token(token)
        return {"success": True, "payload": payload}
    except Exception as e:
        return {"error": str(e)}

# API Gateway routes (for Kong)
@app.get("/api/departments", response_model=List[DepartmentResponse])
async def get_departments_api(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(require_any_role)
):
    """Get departments through API gateway"""
    return await get_departments(skip, limit, db, current_user_id)

@app.post("/api/departments", response_model=DepartmentResponse)
async def create_department_api(
    request: Request,
    dept_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(require_admin)
):
    """Create department through API gateway"""
    return await create_department(dept_data, db, current_user_id)

@app.put("/api/departments/{department_id}", response_model=DepartmentResponse)
async def update_department_api(
    department_id: int,
    dept_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Update department through API gateway"""
    return await update_department(department_id, dept_data, db, current_user_id)

@app.delete("/api/departments/{department_id}")
async def delete_department_api(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Delete department through API gateway"""
    return await delete_department(department_id, db, current_user_id)

@app.get("/api/departments/available-hods")
async def get_available_hods_api(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get available HODs through API gateway"""
    try:
        return await get_available_hods(db, current_user_id)
    except Exception as e:
        print(f"Error in get_available_hods_api: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/departments/{department_id}", response_model=DepartmentResponse)
async def get_department_api(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get department through API gateway"""
    return await get_department(department_id, db, current_user_id)

# Department endpoints
@app.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(Department)

    # HOD can only see their own department
    if current_user.role == "hod":
        query = query.filter(Department.id == current_user.department_id)

    departments = query.offset(skip).limit(limit).all()

    result = []
    for dept in departments:
        result.append(DepartmentResponse(
            id=dept.id,
            name=dept.name,
            code=dept.code,
            description=dept.description,
            hod_id=dept.hod_id,
            duration_years=dept.duration_years,
            academic_year=dept.academic_year,
            semester_count=dept.semester_count,
            current_semester=dept.current_semester,
            is_active=dept.is_active,
            created_at=dept.created_at,
            updated_at=dept.updated_at,
            hod_name=None  # We'll handle this separately if needed
        ))

    return result

@app.post("/departments", response_model=DepartmentResponse)
async def create_department(
    dept_data: DepartmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not PermissionChecker.has_permission(str(current_user.role), Permission.CREATE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create departments")
    # Check if department name/code already exists
    existing = db.query(Department).filter(
        (Department.name == dept_data.name) | (Department.code == dept_data.code)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Department name or code already exists")

    new_dept = Department(**dept_data.dict())
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)

    # Log the creation
    log_audit(db, current_user_id, "create", "department", f"Created department: {new_dept.name}")

    return DepartmentResponse(
        id=new_dept.id,
        name=new_dept.name,
        code=new_dept.code,
        description=new_dept.description,
        hod_id=new_dept.hod_id,
        duration_years=new_dept.duration_years,
        academic_year=new_dept.academic_year,
        semester_count=new_dept.semester_count,
        current_semester=new_dept.current_semester,
        is_active=new_dept.is_active,
        created_at=new_dept.created_at,
        updated_at=new_dept.updated_at,
        hod_name=None
    )

@app.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    dept_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not PermissionChecker.has_permission(str(current_user.role), Permission.UPDATE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to update departments")
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check if new name/code conflicts with existing departments
    if dept_data.name or dept_data.code:
        existing = db.query(Department).filter(
            Department.id != department_id,
            (Department.name == dept_data.name) | (Department.code == dept_data.code)
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="Department name or code already exists")

    # Update department
    update_data = dept_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(department, field, value)

    # Handle HOD assignment
    if "hod_id" in update_data:
        hod_id = update_data["hod_id"]
        if hod_id:
            # Check if HOD is already assigned to another department
            existing_dept = db.query(Department).filter(Department.hod_id == hod_id).first()
            if existing_dept and existing_dept.id != department.id:
                # HOD is already assigned to another department
                hod_user = db.query(User).filter(User.id == hod_id).first()
                hod_name = hod_user.full_name or hod_user.username if hod_user else f"User {hod_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"HOD '{hod_name}' is already assigned to department '{existing_dept.name}'. Please reassign the HOD first."
                )

            # Assign HOD to this department
            department.hod_id = hod_id
        else:
            # Remove HOD from this department
            department.hod_id = None

    db.commit()
    db.refresh(department)

    # Log the update
    log_audit(db, current_user_id, "update", "department", f"Updated department: {department.name}")

    return DepartmentResponse(
        id=department.id,
        name=department.name,
        code=department.code,
        description=department.description,
        hod_id=department.hod_id,
        duration_years=department.duration_years,
        academic_year=department.academic_year,
        semester_count=department.semester_count,
        current_semester=department.current_semester,
        is_active=department.is_active,
        created_at=department.created_at,
        updated_at=department.updated_at,
        hod_name=None
    )

@app.delete("/departments/{department_id}")
async def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not PermissionChecker.has_permission(str(current_user.role), Permission.DELETE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete departments")
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check if department has users
    user_count = db.query(User).filter(User.department_id == department_id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete department with existing users")

    # Log the deletion
    log_audit(db, current_user_id, "delete", "department", f"Deleted department: {department.name}")

    db.delete(department)
    db.commit()

    return {"message": "Department deleted successfully"}

# Bulk operations for departments
@app.post("/departments/bulk-create")
async def bulk_create_departments(
    departments_data: List[DepartmentCreate],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk create departments - Admin only"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not PermissionChecker.has_permission(str(current_user.role), Permission.CREATE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create departments")

    try:
        created_departments = []
        for dept_data in departments_data:
            # Check if department name/code already exists
            existing = db.query(Department).filter(
                (Department.name == dept_data.name) | (Department.code == dept_data.code)
            ).first()

            if existing:
                continue  # Skip existing departments

            new_dept = Department(**dept_data.dict())
            db.add(new_dept)
            created_departments.append(new_dept)

        db.commit()

        # Refresh all departments to get their IDs
        for dept in created_departments:
            db.refresh(dept)

        return {
            "message": f"Successfully created {len(created_departments)} departments",
            "created_departments": [DepartmentResponse(
                id=dept.id,
                name=dept.name,
                code=dept.code,
                description=dept.description,
                hod_id=dept.hod_id,
                duration_years=dept.duration_years,
                academic_year=dept.academic_year,
                semester_count=dept.semester_count,
                current_semester=dept.current_semester,
                is_active=dept.is_active,
                created_at=dept.created_at,
                updated_at=dept.updated_at,
                hod_name=None
            ) for dept in created_departments]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating departments: {str(e)}")

@app.post("/departments/bulk-update")
async def bulk_update_departments(
    updates: List[dict],  # List of {id: int, data: DepartmentUpdate}
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk update departments - Admin only"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not PermissionChecker.has_permission(str(current_user.role), Permission.UPDATE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to update departments")

    try:
        updated_departments = []
        for update in updates:
            dept_id = update.get("id")
            dept_data = update.get("data", {})

            if not dept_id:
                continue

            department = db.query(Department).filter(Department.id == dept_id).first()
            if not department:
                continue

            # Update department
            for field, value in dept_data.items():
                if hasattr(department, field):
                    setattr(department, field, value)

            updated_departments.append(department)

        db.commit()

        return {
            "message": f"Successfully updated {len(updated_departments)} departments",
            "updated_count": len(updated_departments)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating departments: {str(e)}")

@app.post("/departments/bulk-delete")
async def bulk_delete_departments(
    department_ids: List[int],
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk delete departments - Admin only"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not PermissionChecker.has_permission(str(current_user.role), Permission.DELETE_DEPARTMENTS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete departments")

    try:
        deleted_count = 0
        for dept_id in department_ids:
            department = db.query(Department).filter(Department.id == dept_id).first()
            if not department:
                continue

            # Check if department has users
            user_count = db.query(User).filter(User.department_id == dept_id).count()
            if user_count > 0:
                continue  # Skip departments with users

            db.delete(department)
            deleted_count += 1

        db.commit()

        return {
            "message": f"Successfully deleted {deleted_count} departments",
            "deleted_count": deleted_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting departments: {str(e)}")

@app.get("/departments/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # HOD can only see their own department
    if current_user.role == "hod" and department.id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return DepartmentResponse(
        id=department.id,
        name=department.name,
        code=department.code,
        description=department.description,
        hod_id=department.hod_id,
        duration_years=department.duration_years,
        academic_year=department.academic_year,
        semester_count=department.semester_count,
        current_semester=department.current_semester,
        is_active=department.is_active,
        created_at=department.created_at,
        updated_at=department.updated_at,
        hod_name=None
    )

@app.get("/departments/{department_id}/users")
async def get_department_users(
    department_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department exists
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # HOD can only see users from their own department
    if current_user.role == "hod" and department.id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    users = db.query(User).filter(User.department_id == department_id).offset(skip).limit(limit).all()

    result = []
    for user in users:
        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None
        })

    return result

@app.get("/departments/{department_id}/stats")
async def get_department_stats(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department exists
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # HOD can only see stats for their own department
    if current_user.role == "hod" and department.id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get user counts by role
    total_users = db.query(User).filter(User.department_id == department_id).count()
    admin_count = db.query(User).filter(User.department_id == department_id, User.role == "admin").count()
    hod_count = db.query(User).filter(User.department_id == department_id, User.role == "hod").count()
    teacher_count = db.query(User).filter(User.department_id == department_id, User.role == "teacher").count()
    student_count = db.query(User).filter(User.department_id == department_id, User.role == "student").count()

    # Get active/inactive counts
    active_users = db.query(User).filter(User.department_id == department_id, User.is_active == True).count()
    inactive_users = total_users - active_users

    return {
        "department_id": department_id,
        "department_name": department.name,
        "total_users": total_users,
        "users_by_role": {
            "admin": admin_count,
            "hod": hod_count,
            "teacher": teacher_count,
            "student": student_count
        },
        "active_users": active_users,
        "inactive_users": inactive_users
    }

# ==================== PO (Program Outcomes) ENDPOINTS ====================

@app.get("/pos", response_model=List[POResponse])
async def get_pos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(PO).options(joinedload(PO.department))

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(PO.department_id == current_user.department_id)
    elif current_user.role in ["teacher", "student"]:
        query = query.filter(PO.department_id == current_user.department_id)
            (Class.subjects.any(Subject.teacher_id == current_user_id))
        )
    elif current_user.role == "student":
        # Students can only see their own class
        query = query.filter(Class.id == current_user.class_id)

    # Apply additional filters
    if department_id:
        query = query.filter(Class.department_id == department_id)
    if year:
        query = query.filter(Class.year == year)
    if semester_id:
        query = query.filter(Class.semester_id == semester_id)

    classes = query.offset(skip).limit(limit).all()

    result = []
    for cls in classes:
        # Get students count for this class
        students_count = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.class_id == cls.id
        ).count()

        result.append(ClassResponse(
            id=cls.id,
            name=cls.name,
            year=cls.year,
            semester_id=cls.semester_id,
            section=cls.section,
            department_id=cls.department_id,
            class_teacher_id=cls.class_teacher_id,
            cr_id=cls.cr_id,
            department_name=cls.department.name if cls.department else "",
            semester_name=cls.semester.name if cls.semester else "",
            class_teacher_name=cls.class_teacher.full_name if cls.class_teacher else None,
            cr_name=cls.cr.full_name if cls.cr else None,
            students_count=students_count,
            created_at=cls.created_at,
            updated_at=cls.updated_at
        ))

    return result

@app.post("/api/classes", response_model=ClassResponse)
async def create_class(
    class_data: ClassCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department exists
    department = db.query(Department).filter(Department.id == class_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # HOD can only create classes in their own department
    if current_user.role == "hod" and class_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if semester exists
    semester = db.query(Semester).filter(Semester.id == class_data.semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Check if class name already exists in the same department and semester
    existing = db.query(Class).filter(
        Class.name == class_data.name,
        Class.department_id == class_data.department_id,
        Class.year == class_data.year,
        Class.semester_id == class_data.semester_id,
        Class.section == class_data.section
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Class already exists")

    new_class = Class(**class_data.dict())
    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    # Log the creation
    log_audit(db, current_user_id, "create", "class", f"Created class: {new_class.name}")

    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        year=new_class.year,
        semester_id=new_class.semester_id,
        section=new_class.section,
        department_id=new_class.department_id,
        class_teacher_id=new_class.class_teacher_id,
        cr_id=new_class.cr_id,
        department_name=department.name,
        semester_name=semester.name,
        class_teacher_name=None,  # Will be populated if needed
        cr_name=None,  # Will be populated if needed
        students_count=0,
        created_at=new_class.created_at,
        updated_at=new_class.updated_at
    )

@app.get("/api/classes/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    class_obj = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.semester),
        joinedload(Class.class_teacher),
        joinedload(Class.cr)
    ).filter(Class.id == class_id).first()

    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # Apply role-based access control
    if current_user.role == "hod" and class_obj.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can see classes they teach or are class teachers of
        if (class_obj.class_teacher_id != current_user_id and
            not any(subject.teacher_id == current_user_id for subject in class_obj.subjects)):
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "student" and class_obj.id != current_user.class_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get students count for this class
    students_count = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.class_id == class_obj.id
    ).count()

    return ClassResponse(
        id=class_obj.id,
        name=class_obj.name,
        year=class_obj.year,
        semester_id=class_obj.semester_id,
        section=class_obj.section,
        department_id=class_obj.department_id,
        class_teacher_id=class_obj.class_teacher_id,
        cr_id=class_obj.cr_id,
        department_name=class_obj.department.name if class_obj.department else "",
        semester_name=class_obj.semester.name if class_obj.semester else "",
        class_teacher_name=class_obj.class_teacher.full_name if class_obj.class_teacher else None,
        cr_name=class_obj.cr.full_name if class_obj.cr else None,
        students_count=students_count,
        created_at=class_obj.created_at,
        updated_at=class_obj.updated_at
    )

@app.put("/api/classes/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: int,
    class_data: ClassUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # HOD can only update classes in their own department
    if current_user.role == "hod" and class_obj.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update class
    update_data = class_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(class_obj, field, value)

    db.commit()
    db.refresh(class_obj)

    # Log the update
    log_audit(db, current_user_id, "update", "class", f"Updated class: {class_obj.name}")

    return ClassResponse(
        id=class_obj.id,
        name=class_obj.name,
        year=class_obj.year,
        semester=class_obj.semester,
        section=class_obj.section,
        department_id=class_obj.department_id,
        class_teacher_id=class_obj.class_teacher_id,
        cr_id=class_obj.cr_id,
        department_name=class_obj.department.name if class_obj.department else "",
        class_teacher_name=class_obj.class_teacher.full_name if class_obj.class_teacher else None,
        cr_name=class_obj.cr.full_name if class_obj.cr else None,
        created_at=class_obj.created_at,
        updated_at=class_obj.updated_at
    )

@app.delete("/api/classes/{class_id}")
async def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # HOD can only delete classes in their own department
    if current_user.role == "hod" and class_obj.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if class has students
    student_count = db.query(User).filter(User.class_id == class_id).count()
    if student_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete class with existing students")

    # Log the deletion
    log_audit(db, current_user_id, "delete", "class", f"Deleted class: {class_obj.name}")

    db.delete(class_obj)
    db.commit()

    return {"message": "Class deleted successfully"}

# ==================== SUBJECT ENDPOINTS ====================

@app.get("/api/subjects", response_model=List[SubjectResponse])
async def get_subjects(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(require_any_role)
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.class_ref).joinedload(Class.semester),
        joinedload(Subject.teacher)
    )

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can see subjects they teach
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        # Students can see subjects in their enrolled classes
        student_enrollments = db.query(StudentSemesterEnrollment.class_id).filter(
            StudentSemesterEnrollment.student_id == current_user_id
        ).subquery()
        query = query.filter(Subject.class_id.in_(student_enrollments))

    # Apply additional filters
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    if class_id:
        query = query.filter(Subject.class_id == class_id)
    if semester_id:
        query = query.join(Class).filter(Class.semester_id == semester_id)
    if teacher_id:
        query = query.filter(Subject.teacher_id == teacher_id)
    if is_active is not None:
        query = query.filter(Subject.is_active == is_active)

    subjects = query.offset(skip).limit(limit).all()

    result = []
    for subject in subjects:
        result.append(SubjectResponse(
            id=subject.id,
            name=subject.name,
            code=subject.code,
            department_id=subject.department_id,
            description=subject.description,
            credits=subject.credits,
            theory_marks=subject.theory_marks,
            practical_marks=subject.practical_marks,
            class_id=subject.class_id,
            teacher_id=subject.teacher_id,
            is_active=subject.is_active,
            created_at=subject.created_at,
            updated_at=subject.updated_at,
            department_name=subject.department.name if subject.department else "",
            class_name=subject.class_ref.name if subject.class_ref else None,
            teacher_name=subject.teacher.full_name if subject.teacher else None
        ))

    return result

@app.post("/api/subjects", response_model=SubjectResponse)
async def create_subject(
    subject_data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department exists
    department = db.query(Department).filter(Department.id == subject_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check if class exists and belongs to the same department
    class_obj = db.query(Class).filter(Class.id == subject_data.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    if class_obj.department_id != subject_data.department_id:
        raise HTTPException(status_code=400, detail="Class does not belong to the specified department")

    # HOD can only create subjects in their own department
    if current_user.role == "hod" and subject_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if subject code already exists in the same department
    existing = db.query(Subject).filter(
        Subject.code == subject_data.code,
        Subject.department_id == subject_data.department_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists in this department")

    new_subject = Subject(**subject_data.dict())
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)

    # Log the creation
    log_audit(db, current_user_id, "create", "subject", f"Created subject: {new_subject.name}")

    return SubjectResponse(
        id=new_subject.id,
        name=new_subject.name,
        code=new_subject.code,
        department_id=new_subject.department_id,
        description=new_subject.description,
        credits=new_subject.credits,
        theory_marks=new_subject.theory_marks,
        practical_marks=new_subject.practical_marks,
        class_id=new_subject.class_id,
        teacher_id=new_subject.teacher_id,
        is_active=new_subject.is_active,
        created_at=new_subject.created_at,
        updated_at=new_subject.updated_at,
        department_name=department.name,
        class_name=class_obj.name,
        teacher_name=class_obj.class_teacher.full_name if class_obj.class_teacher else None
    )

@app.get("/api/subjects/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    subject = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.class_ref),
        joinedload(Subject.teacher)
    ).filter(Subject.id == subject_id).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Apply role-based access control
    if current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher" and subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "student" and subject.class_id != current_user.class_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        code=subject.code,
        department_id=subject.department_id,
        description=subject.description,
        credits=subject.credits,
        theory_marks=subject.theory_marks,
        practical_marks=subject.practical_marks,
        class_id=subject.class_id,
        teacher_id=subject.teacher_id,
        is_active=subject.is_active,
        created_at=subject.created_at,
        updated_at=subject.updated_at,
        department_name=subject.department.name if subject.department else "",
        class_name=subject.class_ref.name if subject.class_ref else None,
        teacher_name=subject.teacher.full_name if subject.teacher else None
    )

@app.put("/api/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    subject_data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # HOD can only update subjects in their own department
    if current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update subject
    update_data = subject_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)

    # Log the update
    log_audit(db, current_user_id, "update", "subject", f"Updated subject: {subject.name}")

    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        code=subject.code,
        department_id=subject.department_id,
        description=subject.description,
        credits=subject.credits,
        theory_marks=subject.theory_marks,
        practical_marks=subject.practical_marks,
        class_id=subject.class_id,
        teacher_id=subject.teacher_id,
        is_active=subject.is_active,
        created_at=subject.created_at,
        updated_at=subject.updated_at,
        department_name=subject.department.name if subject.department else "",
        class_name=subject.class_ref.name if subject.class_ref else None,
        teacher_name=subject.teacher.full_name if subject.teacher else None
    )

@app.delete("/api/subjects/{subject_id}")
async def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # HOD can only delete subjects in their own department
    if current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Log the deletion
    log_audit(db, current_user_id, "delete", "subject", f"Deleted subject: {subject.name}")

    db.delete(subject)
    db.commit()

    return {"message": "Subject deleted successfully"}

# ==================== PO (Program Outcomes) ENDPOINTS ====================

@app.get("/pos", response_model=List[POResponse])
async def get_pos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(PO).options(joinedload(PO.department))

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(PO.department_id == current_user.department_id)
    elif current_user.role in ["teacher", "student"]:
        query = query.filter(PO.department_id == current_user.department_id)

    # Apply additional filters
    if department_id:
        query = query.filter(PO.department_id == department_id)

    pos = query.offset(skip).limit(limit).all()

    result = []
    for po in pos:
        result.append(POResponse(
            id=po.id,
            name=po.name,
            description=po.description,
            department_id=po.department_id,
            department_name=po.department.name if po.department else "",
            created_at=po.created_at,
            updated_at=po.updated_at
        ))

    return result

@app.post("/pos", response_model=POResponse)
async def create_po(
    po_data: POCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department exists
    department = db.query(Department).filter(Department.id == po_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # HOD can only create POs in their own department
    if current_user.role == "hod" and po_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if PO name already exists in the same department
    existing = db.query(PO).filter(
        PO.name == po_data.name,
        PO.department_id == po_data.department_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="PO name already exists in this department")

    new_po = PO(**po_data.dict())
    db.add(new_po)
    db.commit()
    db.refresh(new_po)

    # Log the creation
    log_audit(db, current_user_id, "create", "po", f"Created PO: {new_po.name}")

    return POResponse(
        id=new_po.id,
        name=new_po.name,
        description=new_po.description,
        department_id=new_po.department_id,
        department_name=department.name,
        created_at=new_po.created_at,
        updated_at=new_po.updated_at
    )

@app.get("/pos/{po_id}", response_model=POResponse)
async def get_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    po = db.query(PO).options(joinedload(PO.department)).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Apply role-based access control
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ["teacher", "student"] and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return POResponse(
        id=po.id,
        name=po.name,
        description=po.description,
        department_id=po.department_id,
        department_name=po.department.name if po.department else "",
        created_at=po.created_at,
        updated_at=po.updated_at
    )

@app.put("/pos/{po_id}", response_model=POResponse)
async def update_po(
    po_id: int,
    po_data: POUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # HOD can only update POs in their own department
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update PO
    update_data = po_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(po, field, value)

    db.commit()
    db.refresh(po)

    # Log the update
    log_audit(db, current_user_id, "update", "po", f"Updated PO: {po.name}")

    return POResponse(
        id=po.id,
        name=po.name,
        description=po.description,
        department_id=po.department_id,
        department_name=po.department.name if po.department else "",
        created_at=po.created_at,
        updated_at=po.updated_at
    )

@app.delete("/pos/{po_id}")
async def delete_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # HOD can only delete POs in their own department
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if PO has CO mappings
    mapping_count = db.query(COPOMapping).filter(COPOMapping.po_id == po_id).count()
    if mapping_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete PO with existing CO mappings")

    # Log the deletion
    log_audit(db, current_user_id, "delete", "po", f"Deleted PO: {po.name}")

    db.delete(po)
    db.commit()

    return {"message": "PO deleted successfully"}

# ==================== CO (Course Outcomes) ENDPOINTS ====================

@app.get("/cos", response_model=List[COResponse])
async def get_cos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(CO).options(
        joinedload(CO.department),
        joinedload(CO.subject)
    )

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can see COs for subjects they teach
        query = query.filter(CO.subject.has(Subject.teacher_id == current_user_id))
    elif current_user.role == "student":
        # Students can see COs for subjects in their class
        query = query.filter(CO.subject.has(Subject.class_id == current_user.class_id))

    # Apply additional filters
    if department_id:
        query = query.filter(CO.department_id == department_id)
    if subject_id:
        query = query.filter(CO.subject_id == subject_id)

    cos = query.offset(skip).limit(limit).all()

    result = []
    for co in cos:
        result.append(COResponse(
            id=co.id,
            name=co.name,
            description=co.description,
            subject_id=co.subject_id,
            department_id=co.department_id,
            subject_name=co.subject.name if co.subject else "",
            subject_code=co.subject.code if co.subject else "",
            created_at=co.created_at,
            updated_at=co.updated_at
        ))

    return result

@app.post("/cos", response_model=COResponse)
async def create_co(
    co_data: COCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department and subject exist
    department = db.query(Department).filter(Department.id == co_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    subject = db.query(Subject).filter(Subject.id == co_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # HOD can only create COs in their own department
    if current_user.role == "hod" and co_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if CO name already exists for the same subject
    existing = db.query(CO).filter(
        CO.name == co_data.name,
        CO.subject_id == co_data.subject_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="CO name already exists for this subject")

    new_co = CO(**co_data.dict())
    db.add(new_co)
    db.commit()
    db.refresh(new_co)

    # Log the creation
    log_audit(db, current_user_id, "create", "co", f"Created CO: {new_co.name}")

    return COResponse(
        id=new_co.id,
        name=new_co.name,
        description=new_co.description,
        subject_id=new_co.subject_id,
        department_id=new_co.department_id,
        subject_name=subject.name,
        subject_code=subject.code,
        created_at=new_co.created_at,
        updated_at=new_co.updated_at
    )

@app.get("/cos/{co_id}", response_model=COResponse)
async def get_co(
    co_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    co = db.query(CO).options(
        joinedload(CO.department),
        joinedload(CO.subject)
    ).filter(CO.id == co_id).first()

    if not co:
        raise HTTPException(status_code=404, detail="CO not found")

    # Apply role-based access control
    if current_user.role == "hod" and co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher" and co.subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "student" and co.subject.class_id != current_user.class_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return COResponse(
        id=co.id,
        name=co.name,
        description=co.description,
        subject_id=co.subject_id,
        department_id=co.department_id,
        subject_name=co.subject.name if co.subject else "",
        subject_code=co.subject.code if co.subject else "",
        created_at=co.created_at,
        updated_at=co.updated_at
    )

@app.put("/cos/{co_id}", response_model=COResponse)
async def update_co(
    co_id: int,
    co_data: COUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")

    # HOD can only update COs in their own department
    if current_user.role == "hod" and co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update CO
    update_data = co_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(co, field, value)

    db.commit()
    db.refresh(co)

    # Log the update
    log_audit(db, current_user_id, "update", "co", f"Updated CO: {co.name}")

    return COResponse(
        id=co.id,
        name=co.name,
        description=co.description,
        subject_id=co.subject_id,
        department_id=co.department_id,
        subject_name=co.subject.name if co.subject else "",
        subject_code=co.subject.code if co.subject else "",
        created_at=co.created_at,
        updated_at=co.updated_at
    )

@app.delete("/cos/{co_id}")
async def delete_co(
    co_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")

    # HOD can only delete COs in their own department
    if current_user.role == "hod" and co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if CO has PO mappings
    mapping_count = db.query(COPOMapping).filter(COPOMapping.co_id == co_id).count()
    if mapping_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete CO with existing PO mappings")

    # Log the deletion
    log_audit(db, current_user_id, "delete", "co", f"Deleted CO: {co.name}")

    db.delete(co)
    db.commit()

    return {"message": "CO deleted successfully"}

# CO-PO Mapping endpoints
@app.get("/co-po-mappings", response_model=List[COPOMappingResponse])
async def get_co_po_mappings(
    co_id: Optional[int] = Query(None),
    po_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all CO-PO mappings with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(COPOMapping).options(
        joinedload(COPOMapping.co),
        joinedload(COPOMapping.po)
    )

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.join(CO).filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.join(CO).join(Subject).filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        query = query.join(CO).join(Subject).filter(Subject.class_id == current_user.class_id)

    # Apply additional filters
    if co_id:
        query = query.filter(COPOMapping.co_id == co_id)
    if po_id:
        query = query.filter(COPOMapping.po_id == po_id)
    if department_id:
        query = query.join(CO).filter(CO.department_id == department_id)

    mappings = query.offset(skip).limit(limit).all()

    result = []
    for mapping in mappings:
        result.append(COPOMappingResponse(
            id=mapping.id,
            co_id=mapping.co_id,
            po_id=mapping.po_id,
            mapping_strength=float(mapping.mapping_strength),
            co_name=mapping.co.name,
            po_name=mapping.po.name,
            created_at=mapping.created_at,
            updated_at=mapping.updated_at
        ))

    return result

@app.get("/co-po-mappings/{mapping_id}", response_model=COPOMappingResponse)
async def get_co_po_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific CO-PO mapping by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    mapping = db.query(COPOMapping).options(
        joinedload(COPOMapping.co),
        joinedload(COPOMapping.po)
    ).filter(COPOMapping.id == mapping_id).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="CO-PO mapping not found")

    # Apply role-based access control
    if current_user.role == "hod" and mapping.co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher" and mapping.co.subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "student" and mapping.co.subject.class_id != current_user.class_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return COPOMappingResponse(
        id=mapping.id,
        co_id=mapping.co_id,
        po_id=mapping.po_id,
        mapping_strength=float(mapping.mapping_strength),
        co_name=mapping.co.name,
        po_name=mapping.po.name,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at
    )

@app.post("/co-po-mappings", response_model=COPOMappingResponse)
async def create_co_po_mapping(
    mapping_data: COPOMappingCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if CO exists
    co = db.query(CO).filter(CO.id == mapping_data.co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")

    # Check if PO exists
    po = db.query(PO).filter(PO.id == mapping_data.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Apply role-based access control
    if current_user.role == "teacher" and co.subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod" and co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if mapping already exists
    existing = db.query(COPOMapping).filter(
        COPOMapping.co_id == mapping_data.co_id,
        COPOMapping.po_id == mapping_data.po_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="CO-PO mapping already exists")

    # Create mapping
    new_mapping = COPOMapping(**mapping_data.dict())
    db.add(new_mapping)
    db.commit()
    db.refresh(new_mapping)

    # Log the creation
    log_audit(db, current_user_id, "create", "co_po_mapping", f"Created mapping: {co.name} -> {po.name}")

    return COPOMappingResponse(
        id=new_mapping.id,
        co_id=new_mapping.co_id,
        po_id=new_mapping.po_id,
        mapping_strength=float(new_mapping.mapping_strength),
        co_name=co.name,
        po_name=po.name,
        created_at=new_mapping.created_at,
        updated_at=new_mapping.updated_at
    )

@app.put("/co-po-mappings/{mapping_id}", response_model=COPOMappingResponse)
async def update_co_po_mapping(
    mapping_id: int,
    mapping_data: COPOMappingUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    mapping = db.query(COPOMapping).options(
        joinedload(COPOMapping.co),
        joinedload(COPOMapping.po)
    ).filter(COPOMapping.id == mapping_id).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="CO-PO mapping not found")

    # Apply role-based access control
    if current_user.role == "teacher" and mapping.co.subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod" and mapping.co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update mapping
    update_data = mapping_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mapping, field, value)

    db.commit()
    db.refresh(mapping)

    # Log the update
    log_audit(db, current_user_id, "update", "co_po_mapping", f"Updated mapping: {mapping.co.name} -> {mapping.po.name}")

    return COPOMappingResponse(
        id=mapping.id,
        co_id=mapping.co_id,
        po_id=mapping.po_id,
        mapping_strength=float(mapping.mapping_strength),
        co_name=mapping.co.name,
        po_name=mapping.po.name,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at
    )

@app.delete("/co-po-mappings/{mapping_id}")
async def delete_co_po_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    mapping = db.query(COPOMapping).options(
        joinedload(COPOMapping.co),
        joinedload(COPOMapping.po)
    ).filter(COPOMapping.id == mapping_id).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="CO-PO mapping not found")

    # Apply role-based access control
    if current_user.role == "teacher" and mapping.co.subject.teacher_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod" and mapping.co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Log the deletion
    log_audit(db, current_user_id, "delete", "co_po_mapping", f"Deleted mapping: {mapping.co.name} -> {mapping.po.name}")

    db.delete(mapping)
    db.commit()

    return {"message": "CO-PO mapping deleted successfully"}

# Get available HODs for department assignment
@app.get("/available-hods")
async def get_available_hods(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get available HODs for department assignment"""
    print(f"get_available_hods called with current_user_id: {current_user_id}")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        print(f"Current user not found for ID: {current_user_id}")
        raise HTTPException(status_code=404, detail="Current user not found")
    print(f"Current user found: {current_user.username}, role: {current_user.role}")

    # Get users with HOD role who don't have a department assigned yet
    query = db.query(User).filter(
        User.role == "hod",
        User.is_active == True
    )

    # If current user is HOD, only show themselves
    if current_user.role == "hod":
        query = query.filter(User.id == current_user_id)

    hods = query.all()

    result = []
    for hod in hods:
        result.append({
            "id": hod.id,
            "name": hod.full_name or f"{hod.first_name} {hod.last_name}".strip(),
            "email": hod.email,
            "username": hod.username,
            "department_id": hod.department_id,
            "has_department": hod.department_id is not None
        })

    return result

# ==================== SMART CO/PO MANAGEMENT ENDPOINTS ====================

@app.post("/smart-cos", response_model=COResponse)
async def create_smart_co(
    co_data: SmartCOCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create CO with smart mapping generation"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if subject exists and user has permission
    subject = db.query(Subject).filter(Subject.id == co_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Apply role-based access control
    if current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Create CO
    new_co = CO(
        name=co_data.name,
        description=co_data.description,
        subject_id=co_data.subject_id,
        department_id=co_data.department_id
    )

    db.add(new_co)
    db.commit()
    db.refresh(new_co)

    # Generate smart mappings if requested
    if co_data.auto_generate_mappings:
        mappings = generate_smart_co_mappings(new_co.id, co_data.department_id, db)
        for mapping_data in mappings:
            mapping = COPOMapping(
                co_id=mapping_data["co_id"],
                po_id=mapping_data["po_id"],
                mapping_strength=mapping_data["mapping_strength"]
            )
            db.add(mapping)
        db.commit()

    # Log the creation
    log_audit(db, current_user_id, "create", "co", f"Created smart CO: {new_co.name}")

    return COResponse(
        id=new_co.id,
        name=new_co.name,
        description=new_co.description,
        subject_id=new_co.subject_id,
        department_id=new_co.department_id,
        created_at=new_co.created_at,
        updated_at=new_co.updated_at
    )

@app.post("/smart-pos", response_model=POResponse)
async def create_smart_po(
    po_data: SmartPOCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create PO with smart mapping generation"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Apply role-based access control
    if current_user.role == "hod" and po_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Create PO
    new_po = PO(
        name=po_data.name,
        description=po_data.description,
        department_id=po_data.department_id
    )

    db.add(new_po)
    db.commit()
    db.refresh(new_po)

    # Generate smart mappings if requested
    if po_data.auto_generate_mappings:
        mappings = generate_smart_po_mappings(new_po.id, po_data.department_id, db)
        for mapping_data in mappings:
            mapping = COPOMapping(
                co_id=mapping_data["co_id"],
                po_id=mapping_data["po_id"],
                mapping_strength=mapping_data["mapping_strength"]
            )
            db.add(mapping)
        db.commit()

    # Log the creation
    log_audit(db, current_user_id, "create", "po", f"Created smart PO: {new_po.name}")

    return POResponse(
        id=new_po.id,
        name=new_po.name,
        description=new_po.description,
        department_id=new_po.department_id,
        created_at=new_po.created_at,
        updated_at=new_po.updated_at
    )

@app.post("/bulk-cos", response_model=List[COResponse])
async def bulk_create_cos(
    bulk_data: BulkCOCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create multiple COs with smart mapping generation"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    created_cos = []

    for co_data in bulk_data.cos:
        # Check permissions for each CO
        subject = db.query(Subject).filter(Subject.id == co_data.subject_id).first()
        if not subject:
            continue

        if current_user.role == "hod" and subject.department_id != current_user.department_id:
            continue

        try:
            # Create CO
            new_co = CO(
                name=co_data.name,
                description=co_data.description,
                subject_id=co_data.subject_id,
                department_id=co_data.department_id
            )

            db.add(new_co)
            db.commit()
            db.refresh(new_co)

            # Generate smart mappings if requested
            if co_data.auto_generate_mappings:
                mappings = generate_smart_co_mappings(new_co.id, co_data.department_id, db)
                for mapping_data in mappings:
                    mapping = COPOMapping(
                        co_id=mapping_data["co_id"],
                        po_id=mapping_data["po_id"],
                        mapping_strength=mapping_data["mapping_strength"]
                    )
                    db.add(mapping)
                db.commit()

            created_cos.append(COResponse(
                id=new_co.id,
                name=new_co.name,
                description=new_co.description,
                subject_id=new_co.subject_id,
                department_id=new_co.department_id,
                created_at=new_co.created_at,
                updated_at=new_co.updated_at
            ))

        except Exception as e:
            print(f"Error creating CO {co_data.name}: {str(e)}")
            continue

    return created_cos

@app.post("/bulk-pos", response_model=List[POResponse])
async def bulk_create_pos(
    bulk_data: BulkPOCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create multiple POs with smart mapping generation"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    created_pos = []

    for po_data in bulk_data.pos:
        # Check permissions for each PO
        if current_user.role == "hod" and po_data.department_id != current_user.department_id:
            continue

        try:
            # Create PO
            new_po = PO(
                name=po_data.name,
                description=po_data.description,
                department_id=po_data.department_id
            )

            db.add(new_po)
            db.commit()
            db.refresh(new_po)

            # Generate smart mappings if requested
            if po_data.auto_generate_mappings:
                mappings = generate_smart_po_mappings(new_po.id, po_data.department_id, db)
                for mapping_data in mappings:
                    mapping = COPOMapping(
                        co_id=mapping_data["co_id"],
                        po_id=mapping_data["po_id"],
                        mapping_strength=mapping_data["mapping_strength"]
                    )
                    db.add(mapping)
                db.commit()

            created_pos.append(POResponse(
                id=new_po.id,
                name=new_po.name,
                description=new_po.description,
                department_id=new_po.department_id,
                created_at=new_po.created_at,
                updated_at=new_po.updated_at
            ))

        except Exception as e:
            print(f"Error creating PO {po_data.name}: {str(e)}")
            continue

    return created_pos

@app.get("/co-po-analytics", response_model=List[COPOAnalytics])
async def get_co_po_analytics(
    department_id: Optional[int] = None,
    co_id: Optional[int] = None,
    po_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive CO-PO analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Build query for mappings
    query = db.query(COPOMapping).options(
        joinedload(COPOMapping.co),
        joinedload(COPOMapping.po)
    )

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.join(CO).filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.join(CO).join(Subject).filter(Subject.teacher_id == current_user_id)

    # Apply additional filters
    if department_id:
        query = query.join(CO).filter(CO.department_id == department_id)
    if co_id:
        query = query.filter(COPOMapping.co_id == co_id)
    if po_id:
        query = query.filter(COPOMapping.po_id == po_id)

    mappings = query.all()

    analytics = []
    for mapping in mappings:
        analytics_data = calculate_co_po_analytics(mapping.co_id, mapping.po_id, db)

        analytics.append(COPOAnalytics(
            co_id=mapping.co_id,
            co_name=mapping.co.name,
            po_id=mapping.po_id,
            po_name=mapping.po.name,
            mapping_strength=float(mapping.mapping_strength),
            attainment_percentage=analytics_data["attainment_percentage"],
            student_count=analytics_data["student_count"],
            average_score=analytics_data["average_score"],
            bloom_distribution=analytics_data["bloom_distribution"],
            difficulty_distribution=analytics_data["difficulty_distribution"]
        ))

    return analytics

@app.get("/api/co-po-recommendations", response_model=List[COPORecommendation])
async def get_co_po_recommendations_endpoint(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get AI-powered CO-PO mapping recommendations"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Apply role-based access control
    if current_user.role == "hod" and department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    recommendations = get_co_po_recommendations(department_id, db)
    return recommendations

# Semester Management Endpoints
@app.get("/api/semesters", response_model=List[SemesterResponse])
async def get_semesters(
    department_id: Optional[int] = None,
    academic_year: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all semesters with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(Semester).options(
        joinedload(Semester.department),
        joinedload(Semester.classes),
        joinedload(Semester.student_enrollments)
    )

    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(Semester.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        query = query.filter(Semester.department_id == current_user.department_id)
    elif current_user.role == "student":
        # Students can only see semesters they're enrolled in
        student_enrollments = db.query(StudentSemesterEnrollment.semester_id).filter(
            StudentSemesterEnrollment.student_id == current_user_id
        ).subquery()
        query = query.filter(Semester.id.in_(student_enrollments))

    # Apply additional filters
    if department_id:
        query = query.filter(Semester.department_id == department_id)
    if academic_year:
        query = query.filter(Semester.academic_year == academic_year)
    if is_active is not None:
        query = query.filter(Semester.is_active == is_active)

    semesters = query.offset(skip).limit(limit).all()

    # Build response with additional data
    semester_responses = []
    for semester in semesters:
        classes_count = len(semester.classes) if semester.classes else 0
        students_count = len(semester.student_enrollments) if semester.student_enrollments else 0

        semester_responses.append(SemesterResponse(
            id=semester.id,
            department_id=semester.department_id,
            semester_number=semester.semester_number,
            academic_year=semester.academic_year,
            name=semester.name,
            start_date=semester.start_date,
            end_date=semester.end_date,
            is_active=semester.is_active,
            is_completed=semester.is_completed,
            department_name=semester.department.name if semester.department else "",
            classes_count=classes_count,
            students_count=students_count,
            created_at=semester.created_at,
            updated_at=semester.updated_at
        ))

    return semester_responses

@app.get("/api/semesters/{semester_id}", response_model=SemesterResponse)
async def get_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific semester by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    semester = db.query(Semester).options(
        joinedload(Semester.department),
        joinedload(Semester.classes),
        joinedload(Semester.student_enrollments)
    ).filter(Semester.id == semester_id).first()

    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Apply role-based access control
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "student":
        # Check if student is enrolled in this semester
        enrollment = db.query(StudentSemesterEnrollment).filter(
            StudentSemesterEnrollment.student_id == current_user_id,
            StudentSemesterEnrollment.semester_id == semester_id
        ).first()
        if not enrollment:
            raise HTTPException(status_code=403, detail="Access denied")

    classes_count = len(semester.classes) if semester.classes else 0
    students_count = len(semester.student_enrollments) if semester.student_enrollments else 0

    return SemesterResponse(
        id=semester.id,
        department_id=semester.department_id,
        semester_number=semester.semester_number,
        academic_year=semester.academic_year,
        name=semester.name,
        start_date=semester.start_date,
        end_date=semester.end_date,
        is_active=semester.is_active,
        is_completed=semester.is_completed,
        department_name=semester.department.name if semester.department else "",
        classes_count=classes_count,
        students_count=students_count,
        created_at=semester.created_at,
        updated_at=semester.updated_at
    )

@app.post("/api/semesters", response_model=SemesterResponse)
async def create_semester(
    semester: SemesterCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if department exists
    department = db.query(Department).filter(Department.id == semester.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Apply role-based access control
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if semester already exists
    existing_semester = db.query(Semester).filter(
        Semester.department_id == semester.department_id,
        Semester.semester_number == semester.semester_number,
        Semester.academic_year == semester.academic_year
    ).first()

    if existing_semester:
        raise HTTPException(status_code=400, detail="Semester already exists for this department and academic year")

    # Create semester
    db_semester = Semester(
        department_id=semester.department_id,
        semester_number=semester.semester_number,
        academic_year=semester.academic_year,
        name=semester.name,
        start_date=semester.start_date,
        end_date=semester.end_date
    )

    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "semester", db_semester.id, None, {
        "name": db_semester.name,
        "department_id": db_semester.department_id,
        "semester_number": db_semester.semester_number
    })

    return SemesterResponse(
        id=db_semester.id,
        department_id=db_semester.department_id,
        semester_number=db_semester.semester_number,
        academic_year=db_semester.academic_year,
        name=db_semester.name,
        start_date=db_semester.start_date,
        end_date=db_semester.end_date,
        is_active=db_semester.is_active,
        is_completed=db_semester.is_completed,
        department_name=department.name,
        classes_count=0,
        students_count=0,
        created_at=db_semester.created_at,
        updated_at=db_semester.updated_at
    )

@app.put("/api/semesters/{semester_id}", response_model=SemesterResponse)
async def update_semester(
    semester_id: int,
    semester: SemesterUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    db_semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Apply role-based access control
    if current_user.role == "hod" and db_semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Store old values for audit
    old_values = {
        "name": db_semester.name,
        "is_active": db_semester.is_active,
        "is_completed": db_semester.is_completed
    }

    # Update semester
    update_data = semester.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_semester, field, value)

    db.commit()
    db.refresh(db_semester)

    # Log audit
    log_audit(db, current_user_id, "UPDATE", "semester", semester_id, old_values, update_data)

    # Get department name
    department = db.query(Department).filter(Department.id == db_semester.department_id).first()

    return SemesterResponse(
        id=db_semester.id,
        department_id=db_semester.department_id,
        semester_number=db_semester.semester_number,
        academic_year=db_semester.academic_year,
        name=db_semester.name,
        start_date=db_semester.start_date,
        end_date=db_semester.end_date,
        is_active=db_semester.is_active,
        is_completed=db_semester.is_completed,
        department_name=department.name if department else "",
        classes_count=0,
        students_count=0,
        created_at=db_semester.created_at,
        updated_at=db_semester.updated_at
    )

@app.delete("/api/semesters/{semester_id}")
async def delete_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    db_semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Apply role-based access control
    if current_user.role == "hod" and db_semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if semester has classes or enrollments
    classes_count = db.query(Class).filter(Class.semester_id == semester_id).count()
    enrollments_count = db.query(StudentSemesterEnrollment).filter(StudentSemesterEnrollment.semester_id == semester_id).count()

    if classes_count > 0 or enrollments_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete semester with existing classes or student enrollments")

    # Log audit
    log_audit(db, current_user_id, "DELETE", "semester", semester_id, {
        "name": db_semester.name,
        "department_id": db_semester.department_id
    }, None)

    db.delete(db_semester)
    db.commit()

    return {"message": "Semester deleted successfully"}

# Student Semester Enrollment Endpoints
@app.get("/api/semester-enrollments", response_model=List[StudentSemesterEnrollmentResponse])
async def get_semester_enrollments(
    student_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get student semester enrollments"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    query = db.query(StudentSemesterEnrollment).options(
        joinedload(StudentSemesterEnrollment.student),
        joinedload(StudentSemesterEnrollment.semester),
        joinedload(StudentSemesterEnrollment.class_ref)
    )

    # Apply role-based filters
    if current_user.role == "student":
        query = query.filter(StudentSemesterEnrollment.student_id == current_user_id)
    elif current_user.role == "teacher":
        # Teachers can see enrollments for their department
        query = query.join(Semester).filter(Semester.department_id == current_user.department_id)
    elif current_user.role == "hod":
        # HODs can see enrollments for their department
        query = query.join(Semester).filter(Semester.department_id == current_user.department_id)

    # Apply additional filters
    if student_id:
        query = query.filter(StudentSemesterEnrollment.student_id == student_id)
    if semester_id:
        query = query.filter(StudentSemesterEnrollment.semester_id == semester_id)
    if status:
        query = query.filter(StudentSemesterEnrollment.status == status)

    enrollments = query.offset(skip).limit(limit).all()

    enrollment_responses = []
    for enrollment in enrollments:
        enrollment_responses.append(StudentSemesterEnrollmentResponse(
            id=enrollment.id,
            student_id=enrollment.student_id,
            semester_id=enrollment.semester_id,
            class_id=enrollment.class_id,
            enrollment_date=enrollment.enrollment_date,
            status=enrollment.status,
            final_grade=enrollment.final_grade,
            gpa=enrollment.gpa,
            attendance_percentage=enrollment.attendance_percentage,
            student_name=enrollment.student.full_name if enrollment.student else "",
            semester_name=enrollment.semester.name if enrollment.semester else "",
            class_name=enrollment.class_ref.name if enrollment.class_ref else "",
            created_at=enrollment.created_at,
            updated_at=enrollment.updated_at
        ))

    return enrollment_responses

@app.post("/api/semester-enrollments", response_model=StudentSemesterEnrollmentResponse)
async def create_semester_enrollment(
    enrollment: StudentSemesterEnrollmentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Enroll a student in a semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Check if student exists
    student = db.query(User).filter(User.id == enrollment.student_id).first()
    if not student or student.role != "student":
        raise HTTPException(status_code=404, detail="Student not found")

    # Check if semester exists
    semester = db.query(Semester).filter(Semester.id == enrollment.semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Check if class exists
    class_obj = db.query(Class).filter(Class.id == enrollment.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # Apply role-based access control
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if student is already enrolled in this semester
    existing_enrollment = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.student_id == enrollment.student_id,
        StudentSemesterEnrollment.semester_id == enrollment.semester_id
    ).first()

    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this semester")

    # Create enrollment
    db_enrollment = StudentSemesterEnrollment(
        student_id=enrollment.student_id,
        semester_id=enrollment.semester_id,
        class_id=enrollment.class_id,
        status=enrollment.status
    )

    db.add(db_enrollment)
    db.commit()
    db.refresh(db_enrollment)

    # Log audit
    log_audit(db, current_user_id, "CREATE", "student_semester_enrollment", db_enrollment.id, None, {
        "student_id": enrollment.student_id,
        "semester_id": enrollment.semester_id,
        "class_id": enrollment.class_id
    })

    return StudentSemesterEnrollmentResponse(
        id=db_enrollment.id,
        student_id=db_enrollment.student_id,
        semester_id=db_enrollment.semester_id,
        class_id=db_enrollment.class_id,
        enrollment_date=db_enrollment.enrollment_date,
        status=db_enrollment.status,
        final_grade=db_enrollment.final_grade,
        gpa=db_enrollment.gpa,
        attendance_percentage=db_enrollment.attendance_percentage,
        student_name=student.full_name,
        semester_name=semester.name,
        class_name=class_obj.name,
        created_at=db_enrollment.created_at,
        updated_at=db_enrollment.updated_at
    )

# Student Promotion Workflow
@app.post("/api/semesters/{semester_id}/promote-students")
async def promote_students_to_next_semester(
    semester_id: int,
    next_semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Promote all students from current semester to next semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    # Get current semester
    current_semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not current_semester:
        raise HTTPException(status_code=404, detail="Current semester not found")

    # Get next semester
    next_semester = db.query(Semester).filter(Semester.id == next_semester_id).first()
    if not next_semester:
        raise HTTPException(status_code=404, detail="Next semester not found")

    # Apply role-based access control
    if current_user.role == "hod" and current_semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if semesters belong to same department
    if current_semester.department_id != next_semester.department_id:
        raise HTTPException(status_code=400, detail="Semesters must belong to the same department")

    # Get all active students in current semester
    current_enrollments = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.semester_id == semester_id,
        StudentSemesterEnrollment.status == "active"
    ).all()

    if not current_enrollments:
        raise HTTPException(status_code=400, detail="No active students found in current semester")

    # Get classes for next semester
    next_semester_classes = db.query(Class).filter(Class.semester_id == next_semester_id).all()
    if not next_semester_classes:
        raise HTTPException(status_code=400, detail="No classes found in next semester")

    promoted_count = 0
    errors = []

    try:
        # Mark current semester as completed
        current_semester.is_completed = True
        current_semester.is_active = False

        # Activate next semester
        next_semester.is_active = True

        # Promote each student
        for enrollment in current_enrollments:
            try:
                # Find appropriate class in next semester (same section if possible)
                next_class = next(
                    (c for c in next_semester_classes if c.section == enrollment.class_ref.section),
                    next_semester_classes[0]  # Default to first class if section not found
                )

                # Create new enrollment for next semester
                new_enrollment = StudentSemesterEnrollment(
                    student_id=enrollment.student_id,
                    semester_id=next_semester_id,
                    class_id=next_class.id,
                    status="active"
                )

                # Update current enrollment status
                enrollment.status = "promoted"

                db.add(new_enrollment)
                promoted_count += 1

            except Exception as e:
                errors.append(f"Failed to promote student {enrollment.student_id}: {str(e)}")

        db.commit()

        # Log audit
        log_audit(db, current_user_id, "PROMOTE", "semester", semester_id, {
            "current_semester": current_semester.name,
            "next_semester": next_semester.name
        }, {
            "promoted_count": promoted_count,
            "errors_count": len(errors)
        })

        return {
            "message": f"Successfully promoted {promoted_count} students",
            "promoted_count": promoted_count,
            "errors": errors,
            "current_semester": current_semester.name,
            "next_semester": next_semester.name
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to promote students: {str(e)}")

@app.get("/api/semesters/{semester_id}/promotion-status")
async def get_promotion_status(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get promotion status and statistics for a semester"""
    current_user = db.query(User).filter(User.id == current_user_id).first()

    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Apply role-based access control
    if current_user.role == "hod" and semester.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get enrollment statistics
    total_students = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.semester_id == semester_id
    ).count()

    active_students = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.semester_id == semester_id,
        StudentSemesterEnrollment.status == "active"
    ).count()

    completed_students = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.semester_id == semester_id,
        StudentSemesterEnrollment.status == "completed"
    ).count()

    promoted_students = db.query(StudentSemesterEnrollment).filter(
        StudentSemesterEnrollment.semester_id == semester_id,
        StudentSemesterEnrollment.status == "promoted"
    ).count()

    # Get next semester info
    next_semester = db.query(Semester).filter(
        Semester.department_id == semester.department_id,
        Semester.semester_number == semester.semester_number + 1,
        Semester.academic_year == semester.academic_year
    ).first()

    return {
        "semester": {
            "id": semester.id,
            "name": semester.name,
            "academic_year": semester.academic_year,
            "is_active": semester.is_active,
            "is_completed": semester.is_completed
        },
        "statistics": {
            "total_students": total_students,
            "active_students": active_students,
            "completed_students": completed_students,
            "promoted_students": promoted_students
        },
        "next_semester": {
            "id": next_semester.id if next_semester else None,
            "name": next_semester.name if next_semester else None,
            "exists": next_semester is not None
        } if next_semester else None
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "departments"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)