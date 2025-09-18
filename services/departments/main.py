from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from shared.database import get_db
from shared.models import Department, User, AuditLog, Class, Subject, PO, CO, COPOMapping
from shared.auth import RoleChecker
from shared.schemas import DepartmentResponse, DepartmentCreate, DepartmentUpdate, ClassResponse, ClassCreate, ClassUpdate, SubjectResponse, SubjectCreate, SubjectUpdate, POResponse, POCreate, POUpdate, COResponse, COCreate, COUpdate, COPOMappingResponse, COPOMappingCreate, COPOMappingUpdate

app = FastAPI(title="Department Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

def log_audit(db: Session, user_id: int, action: str, resource: str, details: str = None):
    """Log audit trail"""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details or f"{action} on {resource}",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Department Service is running", "status": "healthy"}

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

@app.put("/departments/{department_id}", response_model=DepartmentResponse)
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

@app.delete("/departments/{department_id}")
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

# ==================== CLASS ENDPOINTS ====================

@app.get("/classes", response_model=List[ClassResponse])
async def get_classes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Class).options(
        joinedload(Class.department),
        joinedload(Class.class_teacher),
        joinedload(Class.cr)
    )
    
    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(Class.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can see classes they teach or are class teachers of
        query = query.filter(
            (Class.class_teacher_id == current_user_id) |
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
    if semester:
        query = query.filter(Class.semester == semester)
    
    classes = query.offset(skip).limit(limit).all()
    
    result = []
    for cls in classes:
        result.append(ClassResponse(
            id=cls.id,
            name=cls.name,
            year=cls.year,
            semester=cls.semester,
            section=cls.section,
            department_id=cls.department_id,
            class_teacher_id=cls.class_teacher_id,
            cr_id=cls.cr_id,
            department_name=cls.department.name if cls.department else "",
            class_teacher_name=cls.class_teacher.full_name if cls.class_teacher else None,
            cr_name=cls.cr.full_name if cls.cr else None,
            created_at=cls.created_at,
            updated_at=cls.updated_at
        ))
    
    return result

@app.post("/classes", response_model=ClassResponse)
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
    
    # Check if class name already exists in the same department
    existing = db.query(Class).filter(
        Class.name == class_data.name,
        Class.department_id == class_data.department_id,
        Class.year == class_data.year,
        Class.semester == class_data.semester,
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
        semester=new_class.semester,
        section=new_class.section,
        department_id=new_class.department_id,
        class_teacher_id=new_class.class_teacher_id,
        cr_id=new_class.cr_id,
        department_name=department.name,
        class_teacher_name=None,  # Will be populated if needed
        cr_name=None,  # Will be populated if needed
        created_at=new_class.created_at,
        updated_at=new_class.updated_at
    )

@app.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    class_obj = db.query(Class).options(
        joinedload(Class.department),
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

@app.put("/classes/{class_id}", response_model=ClassResponse)
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

@app.delete("/classes/{class_id}")
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

@app.get("/subjects", response_model=List[SubjectResponse])
async def get_subjects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Subject).options(
        joinedload(Subject.department),
        joinedload(Subject.class_ref),
        joinedload(Subject.teacher)
    )
    
    # Apply role-based filters
    if current_user.role == "hod":
        query = query.filter(Subject.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can see subjects they teach
        query = query.filter(Subject.teacher_id == current_user_id)
    elif current_user.role == "student":
        # Students can see subjects in their class
        query = query.filter(Subject.class_id == current_user.class_id)
    
    # Apply additional filters
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    if class_id:
        query = query.filter(Subject.class_id == class_id)
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

@app.post("/subjects", response_model=SubjectResponse)
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
    
    # HOD can only create subjects in their own department
    if current_user.role == "hod" and subject_data.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if subject code already exists
    existing = db.query(Subject).filter(Subject.code == subject_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists")
    
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
        class_name=None,  # Will be populated if needed
        teacher_name=None  # Will be populated if needed
    )

@app.get("/subjects/{subject_id}", response_model=SubjectResponse)
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

@app.put("/subjects/{subject_id}", response_model=SubjectResponse)
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

@app.delete("/subjects/{subject_id}")
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

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "departments"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)