from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import json

from shared.database import get_db
from shared.models import CO, PO, COPOMapping, User, Subject, Department, AuditLog, Mark, Question, Exam
from shared.auth import RoleChecker
from shared.schemas import COCreate, COUpdate, COResponse, POCreate, POUpdate, POResponse, COPOMappingCreate, COPOMappingUpdate, COPOMappingResponse

app = FastAPI(title="CO/PO Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    """Log audit trail"""
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

@app.get("/", response_model=Dict[str, str])
async def root():
    return {"message": "CO/PO Service", "version": "1.0.0", "status": "healthy"}

# CO Endpoints
@app.get("/api/cos")
async def get_cos(
    subject_id: Optional[int] = None,
    department_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get all Course Outcomes with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(CO).options(
        joinedload(CO.subject),
        joinedload(CO.department)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see COs for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.filter(CO.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)  # No access if no subjects assigned
    
    # Apply filters
    if subject_id:
        query = query.filter(CO.subject_id == subject_id)
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            query = query.filter(CO.department_id == department_id)
        else:
            raise HTTPException(status_code=403, detail="Access denied to this department")
    
    cos = query.offset(skip).limit(limit).all()
    
    return {"cos": cos}

@app.get("/api/cos/{co_id}")
async def get_co(
    co_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get a specific CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    co = db.query(CO).options(
        joinedload(CO.subject),
        joinedload(CO.department)
    ).filter(CO.id == co_id).first()
    
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only access COs for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if co.subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return {"co": co}

@app.post("/api/cos")
async def create_co(
    co_data: COCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new Course Outcome"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate subject exists
    subject = db.query(Subject).filter(Subject.id == co_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create COs for subjects in your department")
    
    # Create CO
    new_co = CO(
        name=co_data.name,
        description=co_data.description,
        subject_id=co_data.subject_id,
        department_id=subject.department_id,  # Use subject's department
        created_at=datetime.utcnow()
    )
    
    db.add(new_co)
    db.commit()
    db.refresh(new_co)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "CO", new_co.id, None, co_data.dict())
    
    return {
        "message": "CO created successfully",
        "co_id": new_co.id,
        "co": new_co
    }

@app.put("/api/cos/{co_id}")
async def update_co(
    co_id: int,
    co_data: COUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "name": co.name,
        "description": co.description,
        "subject_id": co.subject_id
    }
    
    # Update CO
    update_data = co_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(co, field):
            setattr(co, field, value)
    
    co.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(co)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "CO", co_id, old_values, update_data)
    
    return {
        "message": "CO updated successfully",
        "co": co
    }

@app.delete("/api/cos/{co_id}")
async def delete_co(
    co_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    co = db.query(CO).filter(CO.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if CO is referenced in mappings
    mappings_count = db.query(COPOMapping).filter(COPOMapping.co_id == co_id).count()
    if mappings_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete CO with {mappings_count} PO mappings. Remove mappings first.")
    
    # Store data for audit
    co_data = {
        "id": co.id,
        "name": co.name,
        "description": co.description,
        "subject_id": co.subject_id,
        "department_id": co.department_id
    }
    
    db.delete(co)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "CO", co_id, co_data, None)
    
    return {"message": "CO deleted successfully"}

# PO Endpoints
@app.get("/api/pos")
async def get_pos(
    department_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get all Program Outcomes with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(PO).options(
        joinedload(PO.department)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(PO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see POs for their department
        query = query.filter(PO.department_id == current_user.department_id)
    
    # Apply filters
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            query = query.filter(PO.department_id == department_id)
        else:
            raise HTTPException(status_code=403, detail="Access denied to this department")
    
    pos = query.offset(skip).limit(limit).all()
    
    return {"pos": pos}

@app.get("/api/pos/{po_id}")
async def get_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get a specific PO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    po = db.query(PO).options(
        joinedload(PO.department)
    ).filter(PO.id == po_id).first()
    
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    # Role-based access control
    if current_user.role in ["hod", "teacher"]:
        if po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return {"po": po}

@app.post("/api/pos")
async def create_po(
    po_data: POCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new Program Outcome"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate department exists
    department = db.query(Department).filter(Department.id == po_data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if po_data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create POs for your department")
    
    # Create PO
    new_po = PO(
        name=po_data.name,
        description=po_data.description,
        department_id=po_data.department_id,
        created_at=datetime.utcnow()
    )
    
    db.add(new_po)
    db.commit()
    db.refresh(new_po)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "PO", new_po.id, None, po_data.dict())
    
    return {
        "message": "PO created successfully",
        "po_id": new_po.id,
        "po": new_po
    }

@app.put("/api/pos/{po_id}")
async def update_po(
    po_id: int,
    po_data: POUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a PO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "name": po.name,
        "description": po.description,
        "department_id": po.department_id
    }
    
    # Update PO
    update_data = po_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(po, field):
            setattr(po, field, value)
    
    po.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(po)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "PO", po_id, old_values, update_data)
    
    return {
        "message": "PO updated successfully",
        "po": po
    }

@app.delete("/api/pos/{po_id}")
async def delete_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a PO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if PO is referenced in mappings
    mappings_count = db.query(COPOMapping).filter(COPOMapping.po_id == po_id).count()
    if mappings_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete PO with {mappings_count} CO mappings. Remove mappings first.")
    
    # Store data for audit
    po_data = {
        "id": po.id,
        "name": po.name,
        "description": po.description,
        "department_id": po.department_id
    }
    
    db.delete(po)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "PO", po_id, po_data, None)
    
    return {"message": "PO deleted successfully"}

# CO-PO Mapping Endpoints
@app.get("/api/copo-mappings")
async def get_copo_mappings(
    co_id: Optional[int] = None,
    po_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    department_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get CO-PO mappings with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(COPOMapping).options(
        joinedload(COPOMapping.co),
        joinedload(COPOMapping.po)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.join(CO).filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see mappings for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.join(CO).filter(CO.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)  # No access if no subjects assigned
    
    # Apply filters
    if co_id:
        query = query.filter(COPOMapping.co_id == co_id)
    if po_id:
        query = query.filter(COPOMapping.po_id == po_id)
    if subject_id:
        query = query.join(CO).filter(CO.subject_id == subject_id)
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            query = query.join(CO).filter(CO.department_id == department_id)
        else:
            raise HTTPException(status_code=403, detail="Access denied to this department")
    
    mappings = query.offset(skip).limit(limit).all()
    
    return {"mappings": mappings}

@app.post("/api/copo-mappings")
async def create_copo_mapping(
    mapping_data: COPOMappingCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate CO exists
    co = db.query(CO).filter(CO.id == mapping_data.co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")
    
    # Validate PO exists
    po = db.query(PO).filter(PO.id == mapping_data.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id or po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create mappings within your department")
    
    # Check if mapping already exists
    existing_mapping = db.query(COPOMapping).filter(
        COPOMapping.co_id == mapping_data.co_id,
        COPOMapping.po_id == mapping_data.po_id
    ).first()
    
    if existing_mapping:
        raise HTTPException(status_code=400, detail="CO-PO mapping already exists")
    
    # Create mapping
    new_mapping = COPOMapping(
        co_id=mapping_data.co_id,
        po_id=mapping_data.po_id,
        strength=mapping_data.strength,
        created_at=datetime.utcnow()
    )
    
    db.add(new_mapping)
    db.commit()
    db.refresh(new_mapping)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "COPOMapping", new_mapping.id, None, mapping_data.dict())
    
    return {
        "message": "CO-PO mapping created successfully",
        "mapping": new_mapping
    }

@app.put("/api/copo-mappings/{mapping_id}")
async def update_copo_mapping(
    mapping_id: int,
    mapping_data: COPOMappingUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Update a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    mapping = db.query(COPOMapping).filter(COPOMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    # Get CO and PO for access control
    co = db.query(CO).filter(CO.id == mapping.co_id).first()
    po = db.query(PO).filter(PO.id == mapping.po_id).first()
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id or po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "co_id": mapping.co_id,
        "po_id": mapping.po_id,
        "strength": mapping.strength
    }
    
    # Update mapping
    update_data = mapping_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(mapping, field):
            setattr(mapping, field, value)
    
    mapping.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(mapping)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "COPOMapping", mapping_id, old_values, update_data)
    
    return {
        "message": "CO-PO mapping updated successfully",
        "mapping": mapping
    }

@app.delete("/api/copo-mappings/{mapping_id}")
async def delete_copo_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Delete a CO-PO mapping"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    mapping = db.query(COPOMapping).filter(COPOMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    # Get CO and PO for access control
    co = db.query(CO).filter(CO.id == mapping.co_id).first()
    po = db.query(PO).filter(PO.id == mapping.po_id).first()
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id or po.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store data for audit
    mapping_data = {
        "id": mapping.id,
        "co_id": mapping.co_id,
        "po_id": mapping.po_id,
        "strength": mapping.strength
    }
    
    db.delete(mapping)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "COPOMapping", mapping_id, mapping_data, None)
    
    return {"message": "CO-PO mapping deleted successfully"}

# Analytics Endpoints
@app.get("/api/copo/analytics")
async def get_copo_analytics(
    department_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    exam_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get comprehensive CO/PO analytics with attainment calculations"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Build base queries with role-based filtering
    cos_query = db.query(CO)
    pos_query = db.query(PO)
    mappings_query = db.query(COPOMapping)
    
    if current_user.role == "hod":
        cos_query = cos_query.filter(CO.department_id == current_user.department_id)
        pos_query = pos_query.filter(PO.department_id == current_user.department_id)
        mappings_query = mappings_query.join(CO).filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see analytics for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            cos_query = cos_query.filter(CO.subject_id.in_(subject_ids))
            mappings_query = mappings_query.join(CO).filter(CO.subject_id.in_(subject_ids))
        else:
            cos_query = cos_query.filter(False)
            mappings_query = mappings_query.filter(False)
    
    # Apply filters
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            cos_query = cos_query.filter(CO.department_id == department_id)
            pos_query = pos_query.filter(PO.department_id == department_id)
            mappings_query = mappings_query.join(CO).filter(CO.department_id == department_id)
    
    if subject_id:
        cos_query = cos_query.filter(CO.subject_id == subject_id)
        mappings_query = mappings_query.join(CO).filter(CO.subject_id == subject_id)
    
    # Get counts
    total_cos = cos_query.count()
    total_pos = pos_query.count()
    total_mappings = mappings_query.count()
    
    # Calculate attainment (simplified)
    attainment_data = {}
    if exam_id:
        # Get marks for specific exam
        marks = db.query(Mark).join(Question).join(Exam).filter(Exam.id == exam_id).all()
        if marks:
            total_obtained = sum(mark.marks_obtained for mark in marks)
            total_maximum = sum(mark.max_marks for mark in marks)
            attainment_percentage = (total_obtained / total_maximum * 100) if total_maximum > 0 else 0
            attainment_data = {
                "exam_attainment": round(attainment_percentage, 2),
                "total_students": len(set(mark.student_id for mark in marks)),
                "average_score": round(total_obtained / len(marks), 2) if marks else 0
            }
    
    # Get department-wise stats
    department_stats = {}
    departments = db.query(Department).all()
    for dept in departments:
        if current_user.role == "hod" and dept.id != current_user.department_id:
            continue
        
        dept_cos = cos_query.filter(CO.department_id == dept.id).count()
        dept_pos = pos_query.filter(PO.department_id == dept.id).count()
        dept_mappings = mappings_query.join(CO).filter(CO.department_id == dept.id).count()
        
        department_stats[dept.name] = {
            "cos": dept_cos,
            "pos": dept_pos,
            "mappings": dept_mappings
        }
    
    analytics = {
        "total_cos": total_cos,
        "total_pos": total_pos,
        "total_mappings": total_mappings,
        "average_mappings_per_co": round(total_mappings / total_cos, 2) if total_cos > 0 else 0,
        "average_mappings_per_po": round(total_mappings / total_pos, 2) if total_pos > 0 else 0,
        "department_stats": department_stats,
        **attainment_data
    }
    
    return {"analytics": analytics}

@app.get("/api/copo/recommendations")
async def get_copo_recommendations(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get smart CO/PO mapping recommendations"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Role-based access control
    if current_user.role == "hod":
        if department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied to this department")
    
    # Get COs and POs for the department
    cos = db.query(CO).filter(CO.department_id == department_id).all()
    pos = db.query(PO).filter(PO.department_id == department_id).all()
    
    # Get existing mappings
    existing_mappings = db.query(COPOMapping).join(CO).filter(CO.department_id == department_id).all()
    mapped_pairs = {(mapping.co_id, mapping.po_id) for mapping in existing_mappings}
    
    recommendations = []
    
    # Generate recommendations based on keyword matching
    for co in cos:
        for po in pos:
            if (co.id, po.id) not in mapped_pairs:
                # Simple keyword-based recommendation
                co_keywords = co.description.lower().split() if co.description else []
                po_keywords = po.description.lower().split() if po.description else []
                
                # Calculate similarity score
                common_keywords = set(co_keywords) & set(po_keywords)
                confidence_score = len(common_keywords) / max(len(co_keywords), len(po_keywords), 1)
                
                if confidence_score > 0.1:  # Threshold for recommendations
                    recommendations.append({
                        "co_id": co.id,
                        "co_name": co.name,
                        "po_id": po.id,
                        "po_name": po.name,
                        "confidence_score": round(confidence_score, 2),
                        "reason": f"Common keywords: {', '.join(common_keywords)}",
                        "suggested_strength": min(3, max(1, int(confidence_score * 3)))
                    })
    
    # Sort by confidence score
    recommendations.sort(key=lambda x: x["confidence_score"], reverse=True)
    
    return {
        "recommendations": recommendations[:20],  # Top 20 recommendations
        "department_id": department_id,
        "total_recommendations": len(recommendations)
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "copo"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8026)
