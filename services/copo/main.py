# CO/PO Management Service
# Handles Course Outcomes and Program Outcomes with mapping and attainment tracking

from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc, asc
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

from shared.database import get_db
from shared.models import (
    User, Department, Subject, CO, PO, COPOMapping,
    Exam, Question, Mark, ExamAnalytics
)
from shared.schemas import (
    COCreate, COUpdate, COResponse, POCreate, POUpdate, POResponse,
    COPOMappingCreate, COPOMappingUpdate, COPOMappingResponse,
    COAttainmentResponse, POAttainmentResponse, BulkOperationResult
)
from shared.auth import RoleChecker

app = FastAPI(title="CO/PO Management Service", version="1.0.0")

def calculate_co_attainment(db: Session, co_id: int, semester_id: int = None, class_id: int = None) -> Dict[str, Any]:
    """Calculate CO attainment for a specific CO"""
    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        return None

    # Get all questions mapped to this CO
    questions = db.query(Question).filter(Question.co_id == co_id).all()
    question_ids = [q.id for q in questions]

    if not question_ids:
        return {
            "co_id": co_id,
            "co_name": co.name,
            "co_description": co.description,
            "total_marks_obtained": 0.0,
            "total_max_marks": 0.0,
            "attainment_percentage": 0.0,
            "attainment_level": "Not Attained",
            "students_count": 0,
            "students_above_threshold": 0
        }

    # Get all marks for these questions
    marks_query = db.query(Mark).filter(Mark.question_id.in_(question_ids))

    if semester_id:
        marks_query = marks_query.join(Exam).filter(Exam.semester_id == semester_id)

    if class_id:
        marks_query = marks_query.join(Exam).filter(Exam.class_id == class_id)

    marks = marks_query.all()

    if not marks:
        return {
            "co_id": co_id,
            "co_name": co.name,
            "co_description": co.description,
            "total_marks_obtained": 0.0,
            "total_max_marks": 0.0,
            "attainment_percentage": 0.0,
            "attainment_level": "Not Attained",
            "students_count": 0,
            "students_above_threshold": 0
        }

    # Calculate attainment
    total_obtained = sum(mark.marks_obtained for mark in marks)
    total_max = sum(mark.max_marks for mark in marks)
    attainment_percentage = (total_obtained / total_max * 100) if total_max > 0 else 0

    # Determine attainment level
    if attainment_percentage >= 80:
        attainment_level = "Highly Attained"
    elif attainment_percentage >= 70:
        attainment_level = "Attained"
    elif attainment_percentage >= 60:
        attainment_level = "Moderately Attained"
    else:
        attainment_level = "Not Attained"

    # Count unique students
    unique_students = set(mark.student_id for mark in marks)
    students_above_threshold = 0

    for student_id in unique_students:
        student_marks = [mark for mark in marks if mark.student_id == student_id]
        if student_marks:
            student_obtained = sum(mark.marks_obtained for mark in student_marks)
            student_max = sum(mark.max_marks for mark in student_marks)
            student_percentage = (student_obtained / student_max * 100) if student_max > 0 else 0
            if student_percentage >= 70:
                students_above_threshold += 1

    return {
        "co_id": co_id,
        "co_name": co.name,
        "co_description": co.description,
        "subject_name": co.subject.name if co.subject else None,
        "total_marks_obtained": float(total_obtained),
        "total_max_marks": float(total_max),
        "attainment_percentage": float(attainment_percentage),
        "attainment_level": attainment_level,
        "students_count": len(unique_students),
        "students_above_threshold": students_above_threshold
    }

def calculate_po_attainment(db: Session, po_id: int, department_id: int, semester_id: int = None) -> Dict[str, Any]:
    """Calculate PO attainment for a specific PO"""
    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        return None

    # Get all COs mapped to this PO
    co_mappings = db.query(COPOMapping).filter(COPOMapping.po_id == po_id).all()
    co_ids = [mapping.co_id for mapping in co_mappings]

    if not co_ids:
        return {
            "po_id": po_id,
            "po_name": po.name,
            "po_description": po.description,
            "weighted_attainment": 0.0,
            "attainment_level": "Not Attained",
            "contributing_cos": 0,
            "subjects_involved": []
        }

    # Calculate weighted attainment
    total_weighted_attainment = 0.0
    total_weight = 0.0
    contributing_cos = 0
    subjects_involved = set()

    for mapping in co_mappings:
        co_attainment = calculate_co_attainment(db, mapping.co_id, semester_id)
        if co_attainment and co_attainment["attainment_percentage"] > 0:
            weight = float(mapping.mapping_strength)
            total_weighted_attainment += co_attainment["attainment_percentage"] * weight
            total_weight += weight
            contributing_cos += 1

            # Get subject for this CO
            co = db.query(CO).filter(CO.id == mapping.co_id).first()
            if co and co.subject:
                subjects_involved.add(co.subject.name)

    weighted_attainment = (total_weighted_attainment / total_weight) if total_weight > 0 else 0.0

    # Determine attainment level
    if weighted_attainment >= 80:
        attainment_level = "Highly Attained"
    elif weighted_attainment >= 70:
        attainment_level = "Attained"
    elif weighted_attainment >= 60:
        attainment_level = "Moderately Attained"
    else:
        attainment_level = "Not Attained"

    return {
        "po_id": po_id,
        "po_name": po.name,
        "po_description": po.description,
        "department_name": po.department.name if po.department else None,
        "weighted_attainment": float(weighted_attainment),
        "attainment_level": attainment_level,
        "contributing_cos": contributing_cos,
        "subjects_involved": list(subjects_involved)
    }

@app.get("/")
async def root():
    return {"message": "CO/PO Management Service is running"}

# CO Management Endpoints
@app.get("/api/cos")
async def get_cos(
    skip: int = 0,
    limit: int = 100,
    subject_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get COs with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(CO)

    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.join(Subject).filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        from shared.models import TeacherSubject
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user.id).all()
        subject_ids = [ts.subject_id for ts in teacher_subjects]
        query = query.filter(CO.subject_id.in_(subject_ids))

    # Apply additional filters
    if subject_id:
        query = query.filter(CO.subject_id == subject_id)
    if department_id and current_user.role == "admin":
        query = query.join(Subject).filter(Subject.department_id == department_id)

    cos = query.offset(skip).limit(limit).all()

    results = []
    for co in cos:
        results.append({
            "id": co.id,
            "name": co.name,
            "description": co.description,
            "subject_id": co.subject_id,
            "department_id": co.department_id,
            "subject_name": co.subject.name if co.subject else None,
            "subject_code": co.subject.code if co.subject else None,
            "department_name": co.department.name if co.department else None,
            "created_at": co.created_at,
            "updated_at": co.updated_at
        })

    return results

@app.post("/api/cos", response_model=COResponse)
async def create_co(
    co_data: COCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate subject exists and user has access
    subject = db.query(Subject).filter(Subject.id == co_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if current_user.role == "hod" and subject.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot create CO for subject in other department")

    # Check if CO name already exists for this subject
    existing_co = db.query(CO).filter(
        CO.name == co_data.name,
        CO.subject_id == co_data.subject_id
    ).first()
    if existing_co:
        raise HTTPException(status_code=400, detail="CO with this name already exists for this subject")

    co = CO(
        name=co_data.name,
        description=co_data.description,
        subject_id=co_data.subject_id,
        department_id=co_data.department_id
    )

    db.add(co)
    db.commit()
    db.refresh(co)

    return COResponse(
        id=co.id,
        name=co.name,
        description=co.description,
        subject_id=co.subject_id,
        department_id=co.department_id,
        subject_name=co.subject.name if co.subject else None,
        subject_code=co.subject.code if co.subject else None,
        created_at=co.created_at,
        updated_at=co.updated_at
    )

@app.put("/api/cos/{co_id}", response_model=COResponse)
async def update_co(
    co_id: int,
    co_data: COUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")

    # Check permissions
    if current_user.role == "hod" and co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot update CO from other department")

    # Update fields
    update_data = co_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(co, field):
            setattr(co, field, value)

    db.commit()
    db.refresh(co)

    return COResponse(
        id=co.id,
        name=co.name,
        description=co.description,
        subject_id=co.subject_id,
        department_id=co.department_id,
        subject_name=co.subject.name if co.subject else None,
        subject_code=co.subject.code if co.subject else None,
        created_at=co.created_at,
        updated_at=co.updated_at
    )

@app.delete("/api/cos/{co_id}")
async def delete_co(
    co_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")

    # Check permissions
    if current_user.role == "hod" and co.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot delete CO from other department")

    # Check if CO is used in questions
    questions_count = db.query(Question).filter(Question.co_id == co_id).count()
    if questions_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete CO. It is used in {questions_count} questions")

    db.delete(co)
    db.commit()

    return {"message": "CO deleted successfully"}

# PO Management Endpoints
@app.get("/api/pos")
async def get_pos(
    skip: int = 0,
    limit: int = 100,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get POs with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(PO)

    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(PO.department_id == current_user.department_id)
    elif department_id and current_user.role == "admin":
        query = query.filter(PO.department_id == department_id)

    pos = query.offset(skip).limit(limit).all()

    results = []
    for po in pos:
        results.append({
            "id": po.id,
            "name": po.name,
            "description": po.description,
            "department_id": po.department_id,
            "department_name": po.department.name if po.department else None,
            "created_at": po.created_at,
            "updated_at": po.updated_at
        })

    return results

@app.post("/api/pos", response_model=POResponse)
async def create_po(
    po_data: POCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new PO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate department exists and user has access
    department = db.query(Department).filter(Department.id == po_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    if current_user.role == "hod" and po_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot create PO for other department")

    # Check if PO name already exists for this department
    existing_po = db.query(PO).filter(
        PO.name == po_data.name,
        PO.department_id == po_data.department_id
    ).first()
    if existing_po:
        raise HTTPException(status_code=400, detail="PO with this name already exists for this department")

    po = PO(
        name=po_data.name,
        description=po_data.description,
        department_id=po_data.department_id
    )

    db.add(po)
    db.commit()
    db.refresh(po)

    return POResponse(
        id=po.id,
        name=po.name,
        description=po.description,
        department_id=po.department_id,
        department_name=po.department.name if po.department else None,
        created_at=po.created_at,
        updated_at=po.updated_at
    )

@app.put("/api/pos/{po_id}", response_model=POResponse)
async def update_po(
    po_id: int,
    po_data: POUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a PO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Check permissions
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot update PO from other department")

    # Update fields
    update_data = po_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(po, field):
            setattr(po, field, value)

    db.commit()
    db.refresh(po)

    return POResponse(
        id=po.id,
        name=po.name,
        description=po.description,
        department_id=po.department_id,
        department_name=po.department.name if po.department else None,
        created_at=po.created_at,
        updated_at=po.updated_at
    )

@app.delete("/api/pos/{po_id}")
async def delete_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a PO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Check permissions
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Cannot delete PO from other department")

    # Check if PO is used in mappings
    mappings_count = db.query(COPOMapping).filter(COPOMapping.po_id == po_id).count()
    if mappings_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete PO. It has {mappings_count} CO mappings")

    db.delete(po)
    db.commit()

    return {"message": "PO deleted successfully"}

# CO-PO Mapping Endpoints
@app.get("/api/co-po-mappings")
async def get_co_po_mappings(
    skip: int = 0,
    limit: int = 100,
    co_id: Optional[int] = None,
    po_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get CO-PO mappings"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(COPOMapping)

    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.join(CO).join(Subject).filter(Subject.department_id == current_user.department_id)

    # Apply filters
    if co_id:
        query = query.filter(COPOMapping.co_id == co_id)
    if po_id:
        query = query.filter(COPOMapping.po_id == po_id)

    mappings = query.offset(skip).limit(limit).all()

    results = []
    for mapping in mappings:
        results.append({
            "id": mapping.id,
            "co_id": mapping.co_id,
            "po_id": mapping.po_id,
            "mapping_strength": float(mapping.mapping_strength),
            "co_name": mapping.co.name if mapping.co else None,
            "po_name": mapping.po.name if mapping.po else None,
            "created_at": mapping.created_at,
            "updated_at": mapping.updated_at
        })

    return results

@app.post("/api/co-po-mappings", response_model=COPOMappingResponse)
async def create_co_po_mapping(
    mapping_data: COPOMappingCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate CO and PO exist
    co = db.query(CO).filter(CO.id == mapping_data.co_id).first()
    po = db.query(PO).filter(PO.id == mapping_data.po_id).first()

    if not co:
        raise HTTPException(status_code=404, detail="CO not found")
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Check permissions
    if current_user.role == "hod":
        if co.department_id != current_user.department_id or po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot create mapping for CO/PO from other department")

    # Check if mapping already exists
    existing_mapping = db.query(COPOMapping).filter(
        COPOMapping.co_id == mapping_data.co_id,
        COPOMapping.po_id == mapping_data.po_id
    ).first()
    if existing_mapping:
        raise HTTPException(status_code=400, detail="CO-PO mapping already exists")

    mapping = COPOMapping(
        co_id=mapping_data.co_id,
        po_id=mapping_data.po_id,
        mapping_strength=mapping_data.mapping_strength
    )

    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    return COPOMappingResponse(
        id=mapping.id,
        co_id=mapping.co_id,
        po_id=mapping.po_id,
        mapping_strength=float(mapping.mapping_strength),
        co_name=mapping.co.name if mapping.co else None,
        po_name=mapping.po.name if mapping.po else None,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at
    )

@app.put("/api/co-po-mappings/{mapping_id}", response_model=COPOMappingResponse)
async def update_co_po_mapping(
    mapping_id: int,
    mapping_data: COPOMappingUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    mapping = db.query(COPOMapping).filter(COPOMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    # Check permissions
    if current_user.role == "hod":
        if mapping.co.department_id != current_user.department_id or mapping.po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot update mapping for CO/PO from other department")

    # Update fields
    update_data = mapping_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(mapping, field):
            setattr(mapping, field, value)

    db.commit()
    db.refresh(mapping)

    return COPOMappingResponse(
        id=mapping.id,
        co_id=mapping.co_id,
        po_id=mapping.po_id,
        mapping_strength=float(mapping.mapping_strength),
        co_name=mapping.co.name if mapping.co else None,
        po_name=mapping.po.name if mapping.po else None,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at
    )

@app.delete("/api/co-po-mappings/{mapping_id}")
async def delete_co_po_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    mapping = db.query(COPOMapping).filter(COPOMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    # Check permissions
    if current_user.role == "hod":
        if mapping.co.department_id != current_user.department_id or mapping.po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot delete mapping for CO/PO from other department")

    db.delete(mapping)
    db.commit()

    return {"message": "CO-PO mapping deleted successfully"}

# Attainment Analytics Endpoints
@app.get("/api/co-attainment")
async def get_co_attainment_analytics(
    co_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get CO attainment analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get COs based on role and filters
    if co_id:
        cos = [db.query(CO).filter(CO.id == co_id).first()]
    elif subject_id:
        cos = db.query(CO).filter(CO.subject_id == subject_id).all()
    else:
        # Get all COs based on role
        if current_user.role == "hod":
            cos = db.query(CO).join(Subject).filter(Subject.department_id == current_user.department_id).all()
        elif current_user.role == "teacher":
            from shared.models import TeacherSubject
            teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user.id).all()
            subject_ids = [ts.subject_id for ts in teacher_subjects]
            cos = db.query(CO).filter(CO.subject_id.in_(subject_ids)).all()
        else:  # admin
            cos = db.query(CO).all()

    results = []
    for co in cos:
        if co:
            attainment = calculate_co_attainment(db, co.id, semester_id, class_id)
            if attainment:
                results.append(COAttainmentResponse(**attainment))

    return results

@app.get("/api/po-attainment")
async def get_po_attainment_analytics(
    po_id: Optional[int] = None,
    department_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get PO attainment analytics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get POs based on role and filters
    if po_id:
        pos = [db.query(PO).filter(PO.id == po_id).first()]
    else:
        if current_user.role == "hod":
            pos = db.query(PO).filter(PO.department_id == current_user.department_id).all()
        else:  # admin
            target_department_id = department_id or None
            if target_department_id:
                pos = db.query(PO).filter(PO.department_id == target_department_id).all()
            else:
                pos = db.query(PO).all()

    results = []
    for po in pos:
        if po:
            attainment = calculate_po_attainment(db, po.id, po.department_id, semester_id)
            if attainment:
                results.append(POAttainmentResponse(**attainment))

    return results

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "copo"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)