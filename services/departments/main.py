from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from shared.database import get_db
from shared.models import Department, User, AuditLog, PO, CO, COPOMapping
from shared.auth import RoleChecker
from shared.permissions import PermissionChecker, Permission
from shared.audit import log_audit
from shared.schemas import DepartmentResponse, DepartmentCreate, DepartmentUpdate, POResponse, POCreate, POUpdate, COResponse, COCreate, COUpdate

app = FastAPI(title="Department Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Department Service is running", "status": "healthy"}

# Department endpoints
@app.get("/api/departments", response_model=List[DepartmentResponse])
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
            hod_name=None
        ))

    return result

@app.post("/api/departments", response_model=DepartmentResponse)
async def create_department(
    dept_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
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

@app.put("/api/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    dept_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
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

@app.delete("/api/departments/{department_id}")
async def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
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

@app.get("/api/departments/available-hods")
async def get_available_hods(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get available HODs for department assignment"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    # Get users who can be HODs (teachers or existing HODs)
    hods = db.query(User).filter(
        User.role.in_(["teacher", "hod"]),
        User.is_active == True
    ).all()
    
    return {
        "hods": [
            {
                "id": hod.id,
                "name": hod.full_name,
                "email": hod.email,
                "current_role": hod.role,
                "department_id": hod.department_id
            }
            for hod in hods
        ]
    }

@app.get("/api/departments/{department_id}", response_model=DepartmentResponse)
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

# PO (Program Outcomes) endpoints
@app.get("/api/pos", response_model=List[POResponse])
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

@app.post("/api/pos", response_model=POResponse)
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

    # Create PO
    po = PO(**po_data.dict())
    db.add(po)
    db.commit()
    db.refresh(po)

    # Log audit
    log_audit(db, current_user_id, "create", "po", f"Created PO: {po.name}")

    return POResponse(
        id=po.id,
        name=po.name,
        description=po.description,
        department_id=po.department_id,
        department_name=po.department.name if po.department else "",
        created_at=po.created_at,
        updated_at=po.updated_at
    )

@app.get("/api/pos/{po_id}", response_model=POResponse)
async def get_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    po = db.query(PO).options(joinedload(PO.department)).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Check permissions
    if current_user.role == "hod" and po.department_id != current_user.department_id:
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

@app.put("/api/pos/{po_id}", response_model=POResponse)
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

    # Check permissions
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    for field, value in po_data.dict(exclude_unset=True).items():
        if hasattr(po, field):
            setattr(po, field, value)

    po.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(po)

    # Log audit
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

@app.delete("/api/pos/{po_id}")
async def delete_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()

    po = db.query(PO).filter(PO.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # Check permissions
    if current_user.role == "hod" and po.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Log audit
    log_audit(db, current_user_id, "delete", "po", f"Deleted PO: {po.name}")

    db.delete(po)
    db.commit()

    return {"message": "PO deleted successfully"}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "departments"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)
