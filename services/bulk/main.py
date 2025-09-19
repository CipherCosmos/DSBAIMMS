from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional
import pandas as pd
from io import BytesIO, StringIO
import json
import csv
from datetime import datetime

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Exam, Question, Mark, CO, PO, AuditLog, TeacherSubject
from shared.auth import RoleChecker, get_password_hash
from shared.schemas import UserCreate, UserUpdate
from pydantic import BaseModel

app = FastAPI(title="Bulk Operations Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Import schemas from shared module
from shared.schemas import BulkOperationResult, ValidationResult

# Bulk operation request models
class BulkDeleteRequest(BaseModel):
    user_ids: List[int]

class BulkUpdateRequest(BaseModel):
    user_ids: List[int]
    update_data: dict

class BulkCreateRequest(BaseModel):
    users: List[UserCreate]

# Root endpoint for health check
@app.get("/")
async def root():
    return {"message": "Bulk Operations Service is running", "status": "healthy"}

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: Optional[int] = None,
              old_values: Optional[dict] = None, new_values: Optional[dict] = None):
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id or 0,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None
    )
    db.add(audit_log)
    db.commit()

def format_user_response(user: User, db: Session) -> dict:
    """Format user data according to UserResponse schema"""
    # Parse specializations from JSON string
    specializations = []
    if user.specializations and user.specializations != "":
        try:
            specializations = json.loads(str(user.specializations))
            if not isinstance(specializations, list):
                specializations = []
        except (json.JSONDecodeError, TypeError):
            specializations = []
    
    user_response = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "phone": user.phone,
        "address": user.address,
        "department_id": user.department_id,
        "class_id": user.class_id,
        "student_id": user.student_id,
        "employee_id": user.employee_id,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth is not None else None,
        "gender": user.gender,
        "qualification": user.qualification,
        "experience_years": user.experience_years,
        "specializations": specializations,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at is not None else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at is not None else None,
        "last_login": user.last_login.isoformat() if user.last_login is not None else None,
        "department_name": None,
        "class_name": None,
        "subjects": []
    }
    
    # Get department name
    if user.department_id is not None:
        dept = db.query(Department).filter(Department.id == user.department_id).first()
        if dept:
            user_response["department_name"] = dept.name
    
    # Get class name
    if user.class_id is not None:
        cls = db.query(Class).filter(Class.id == user.class_id).first()
        if cls:
            user_response["class_name"] = cls.name
    
    # Get subjects for teachers
    if user.role == "teacher":
        teacher_subjects = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
        for ts in teacher_subjects:
            subject = db.query(Subject).filter(Subject.id == ts.subject_id).first()
            if subject:
                user_response["subjects"].append({
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code
                })
    
    return user_response

def validate_role_based_fields(role: str, user_data: dict) -> dict:
    """Validate and clean user data based on role"""
    cleaned_data = user_data.copy()
    
    # Remove fields that shouldn't be set for this role
    if role == "student":
        # Students shouldn't have employee_id, experience_years, qualification
        cleaned_data.pop("employee_id", None)
        cleaned_data.pop("experience_years", None)
        cleaned_data.pop("qualification", None)
    else:
        # Staff shouldn't have student_id
        cleaned_data.pop("student_id", None)
    
    # Convert empty strings to None for optional integer fields
    for field in ["department_id", "class_id", "experience_years"]:
        if field in cleaned_data and cleaned_data[field] == "":
            cleaned_data[field] = None
    
    return cleaned_data

def generate_employee_id(role: str, db: Session) -> str:
    """Generate unique employee ID based on role"""
    prefix_map = {
        "admin": "ADM",
        "hod": "HOD", 
        "teacher": "TCH"
    }
    prefix = prefix_map.get(role, "EMP")
    
    # Get the highest existing employee ID for this role
    existing_users = db.query(User).filter(
        User.employee_id.like(f"{prefix}%")
    ).all()
    
    max_num = 0
    for user in existing_users:
        if user.employee_id and str(user.employee_id).startswith(prefix):
            try:
                num = int(str(user.employee_id)[3:])  # Extract number part
                max_num = max(max_num, num)
            except (ValueError, IndexError):
                continue
    
    return f"{prefix}{max_num + 1:03d}"

def generate_student_id(db: Session) -> str:
    """Generate unique student ID"""
    # Get the highest existing student ID
    existing_users = db.query(User).filter(
        User.student_id.like("STU%")
    ).all()
    
    max_num = 0
    for user in existing_users:
        if user.student_id and str(user.student_id).startswith("STU"):
            try:
                num = int(str(user.student_id)[3:])  # Extract number part
                max_num = max(max_num, num)
            except (ValueError, IndexError):
                continue
    
    return f"STU{max_num + 1:03d}"

def validate_user_data(data: Dict[str, Any]) -> List[str]:
    """Validate user data for bulk upload"""
    errors = []
    
    required_fields = ['username', 'email', 'full_name', 'role', 'password']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate role
    if 'role' in data and data['role'] not in ['admin', 'hod', 'teacher', 'student']:
        errors.append("Invalid role. Must be one of: admin, hod, teacher, student")
    
    # Validate email format
    if 'email' in data and '@' not in data['email']:
        errors.append("Invalid email format")
    
    # Validate department_id for non-admin roles
    if 'role' in data and data['role'] in ['hod', 'teacher', 'student']:
        if 'department_id' not in data or not data['department_id']:
            errors.append("Department ID is required for this role")
    
    # Validate class_id for students
    if 'role' in data and data['role'] == 'student':
        if 'class_id' not in data or not data['class_id']:
            errors.append("Class ID is required for students")
    
    return errors

def validate_department_data(data: Dict[str, Any]) -> List[str]:
    """Validate department data for bulk upload"""
    errors = []
    
    required_fields = ['name', 'code']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    return errors

def validate_class_data(data: Dict[str, Any]) -> List[str]:
    """Validate class data for bulk upload"""
    errors = []
    
    required_fields = ['name', 'department_id']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    return errors

def validate_subject_data(data: Dict[str, Any]) -> List[str]:
    """Validate subject data for bulk upload"""
    errors = []
    
    required_fields = ['name', 'code', 'department_id', 'teacher_id']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    return errors

def validate_exam_data(data: Dict[str, Any]) -> List[str]:
    """Validate exam data for bulk upload"""
    errors = []
    
    required_fields = ['title', 'subject_id', 'class_id', 'total_marks', 'duration_minutes']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate numeric fields
    if 'total_marks' in data:
        try:
            int(data['total_marks'])
        except (ValueError, TypeError):
            errors.append("Total marks must be a number")
    
    if 'duration_minutes' in data:
        try:
            int(data['duration_minutes'])
        except (ValueError, TypeError):
            errors.append("Duration must be a number")
    
    return errors

def validate_question_data(data: Dict[str, Any]) -> List[str]:
    """Validate question data for bulk upload"""
    errors = []
    
    required_fields = ['question_text', 'marks', 'co_id', 'section_id']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate numeric fields
    if 'marks' in data:
        try:
            int(data['marks'])
        except (ValueError, TypeError):
            errors.append("Marks must be a number")
    
    return errors

def validate_mark_data(data: Dict[str, Any]) -> List[str]:
    """Validate mark data for bulk upload"""
    errors = []
    
    required_fields = ['student_id', 'question_id', 'marks_obtained', 'max_marks']
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate numeric fields
    for field in ['marks_obtained', 'max_marks']:
        if field in data:
            try:
                float(data[field])
            except (ValueError, TypeError):
                errors.append(f"{field} must be a number")
    
    return errors

# Bulk upload endpoints
@app.post("/upload/users", response_model=BulkOperationResult)
async def bulk_upload_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk upload users from CSV/Excel file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check file type
    if not file.filename or not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        # Read file
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        # Convert to list of dictionaries
        data_list = df.to_dict('records')
        
        created_users = []
        errors = []
        
        for i, data in enumerate(data_list):
            try:
                # Validate data
                validation_errors = validate_user_data(data)
                if validation_errors:
                    errors.append(f"Row {i+1}: {'; '.join(validation_errors)}")
                    continue
                
                # Check if user already exists
                existing_user = db.query(User).filter(
                    (User.username == data['username']) | (User.email == data['email'])
                ).first()
                
                if existing_user:
                    errors.append(f"Row {i+1}: User with username '{data['username']}' or email '{data['email']}' already exists")
                    continue
                
                # Check if department exists
                if 'department_id' in data:
                    department = db.query(Department).filter(Department.id == data['department_id']).first()
                    if not department:
                        errors.append(f"Row {i+1}: Department with ID {data['department_id']} not found")
                        continue
                
                # Check if class exists
                if 'class_id' in data:
                    class_obj = db.query(Class).filter(Class.id == data['class_id']).first()
                    if not class_obj:
                        errors.append(f"Row {i+1}: Class with ID {data['class_id']} not found")
                        continue
                
                # Create user
                user = User(
                    username=data['username'],
                    email=data['email'],
                    full_name=data['full_name'],
                    first_name=data.get('first_name', ''),
                    last_name=data.get('last_name', ''),
                    role=data['role'],
                    password_hash=get_password_hash(data['password']),
                    department_id=data.get('department_id'),
                    class_id=data.get('class_id'),
                    is_active=data.get('is_active', True)
                )
                
                db.add(user)
                created_users.append(user)
                
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        if created_users:
            db.commit()
            
            # Log audit
            log_audit(db, current_user_id, "BULK_CREATE", "User", None, None, {
                "count": len(created_users),
                "total_attempted": len(data_list)
            })
        
        return BulkOperationResult(
            success=True,
            processed_count=len(data_list),
            error_count=len(errors),
            errors=errors,
            created_ids=[user.id for user in created_users]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.post("/upload/departments", response_model=BulkOperationResult)
async def bulk_upload_departments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Bulk upload departments from CSV/Excel file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check file type
    if not file.filename or not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        # Read file
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        # Convert to list of dictionaries
        data_list = df.to_dict('records')
        
        created_departments = []
        errors = []
        
        for i, data in enumerate(data_list):
            try:
                # Validate data
                validation_errors = validate_department_data(data)
                if validation_errors:
                    errors.append(f"Row {i+1}: {'; '.join(validation_errors)}")
                    continue
                
                # Check if department already exists
                existing_department = db.query(Department).filter(
                    (Department.name == data['name']) | (Department.code == data['code'])
                ).first()
                
                if existing_department:
                    errors.append(f"Row {i+1}: Department with name '{data['name']}' or code '{data['code']}' already exists")
                    continue
                
                # Create department
                department = Department(
                    name=data['name'],
                    code=data['code'],
                    description=data.get('description', ''),
                    is_active=data.get('is_active', True)
                )
                
                db.add(department)
                created_departments.append(department)
                
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        if created_departments:
            db.commit()
            
            # Log audit
            log_audit(db, current_user_id, "BULK_CREATE", "Department", None, None, {
                "count": len(created_departments),
                "total_attempted": len(data_list)
            })
        
        return BulkOperationResult(
            success=True,
            processed_count=len(data_list),
            error_count=len(errors),
            errors=errors,
            created_ids=[dept.id for dept in created_departments]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.post("/upload/classes", response_model=BulkOperationResult)
async def bulk_upload_classes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk upload classes from CSV/Excel file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check file type
    if not file.filename or not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        # Read file
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        # Convert to list of dictionaries
        data_list = df.to_dict('records')
        
        created_classes = []
        errors = []
        
        for i, data in enumerate(data_list):
            try:
                # Validate data
                validation_errors = validate_class_data(data)
                if validation_errors:
                    errors.append(f"Row {i+1}: {'; '.join(validation_errors)}")
                    continue
                
                # Check if department exists
                department = db.query(Department).filter(Department.id == data['department_id']).first()
                if not department:
                    errors.append(f"Row {i+1}: Department with ID {data['department_id']} not found")
                    continue
                
                # Check if class already exists
                existing_class = db.query(Class).filter(
                    (Class.name == data['name']) & (Class.department_id == data['department_id'])
                ).first()
                
                if existing_class:
                    errors.append(f"Row {i+1}: Class with name '{data['name']}' already exists in this department")
                    continue
                
                # Create class
                class_obj = Class(
                    name=data['name'],
                    department_id=data['department_id'],
                    description=data.get('description', ''),
                    is_active=data.get('is_active', True)
                )
                
                db.add(class_obj)
                created_classes.append(class_obj)
                
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        if created_classes:
            db.commit()
            
            # Log audit
            log_audit(db, current_user_id, "BULK_CREATE", "Class", None, None, {
                "count": len(created_classes),
                "total_attempted": len(data_list)
            })
        
        return BulkOperationResult(
            success=True,
            processed_count=len(data_list),
            error_count=len(errors),
            errors=errors,
            created_ids=[cls.id for cls in created_classes]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.post("/upload/subjects", response_model=BulkOperationResult)
async def bulk_upload_subjects(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk upload subjects from CSV/Excel file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check file type
    if not file.filename or not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        # Read file
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        # Convert to list of dictionaries
        data_list = df.to_dict('records')
        
        created_subjects = []
        errors = []
        
        for i, data in enumerate(data_list):
            try:
                # Validate data
                validation_errors = validate_subject_data(data)
                if validation_errors:
                    errors.append(f"Row {i+1}: {'; '.join(validation_errors)}")
                    continue
                
                # Check if department exists
                department = db.query(Department).filter(Department.id == data['department_id']).first()
                if not department:
                    errors.append(f"Row {i+1}: Department with ID {data['department_id']} not found")
                    continue
                
                # Check if teacher exists
                teacher = db.query(User).filter(User.id == data['teacher_id']).first()
                if not teacher or teacher.role != 'teacher':
                    errors.append(f"Row {i+1}: Teacher with ID {data['teacher_id']} not found or not a teacher")
                    continue
                
                # Check if subject already exists
                existing_subject = db.query(Subject).filter(
                    (Subject.name == data['name']) & (Subject.department_id == data['department_id'])
                ).first()
                
                if existing_subject:
                    errors.append(f"Row {i+1}: Subject with name '{data['name']}' already exists in this department")
                    continue
                
                # Create subject
                subject = Subject(
                    name=data['name'],
                    code=data['code'],
                    department_id=data['department_id'],
                    teacher_id=data['teacher_id'],
                    description=data.get('description', ''),
                    credits=data.get('credits', 0),
                    is_active=data.get('is_active', True)
                )
                
                db.add(subject)
                created_subjects.append(subject)
                
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        if created_subjects:
            db.commit()
            
            # Log audit
            log_audit(db, current_user_id, "BULK_CREATE", "Subject", None, None, {
                "count": len(created_subjects),
                "total_attempted": len(data_list)
            })
        
        return BulkOperationResult(
            success=True,
            processed_count=len(data_list),
            error_count=len(errors),
            errors=errors,
            created_ids=[subj.id for subj in created_subjects]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.post("/upload/marks", response_model=BulkOperationResult)
async def bulk_upload_marks(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Bulk upload marks from CSV/Excel file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check file type
    if not file.filename or not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        # Read file
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        # Convert to list of dictionaries
        data_list = df.to_dict('records')
        
        created_marks = []
        errors = []
        
        for i, data in enumerate(data_list):
            try:
                # Validate data
                validation_errors = validate_mark_data(data)
                if validation_errors:
                    errors.append(f"Row {i+1}: {'; '.join(validation_errors)}")
                    continue
                
                # Check if student exists
                student = db.query(User).filter(User.id == data['student_id']).first()
                if not student or student.role != 'student':
                    errors.append(f"Row {i+1}: Student with ID {data['student_id']} not found or not a student")
                    continue
                
                # Check if question exists
                question = db.query(Question).filter(Question.id == data['question_id']).first()
                if not question:
                    errors.append(f"Row {i+1}: Question with ID {data['question_id']} not found")
                    continue
                
                # Check if mark already exists
                existing_mark = db.query(Mark).filter(
                    (Mark.student_id == data['student_id']) & (Mark.question_id == data['question_id'])
                ).first()
                
                if existing_mark:
                    errors.append(f"Row {i+1}: Mark already exists for this student and question")
                    continue
                
                # Create mark
                mark = Mark(
                    student_id=data['student_id'],
                    question_id=data['question_id'],
                    marks_obtained=float(data['marks_obtained']),
                    max_marks=float(data['max_marks']),
                    graded_by=current_user_id
                )
                
                db.add(mark)
                created_marks.append(mark)
                
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        if created_marks:
            db.commit()
            
            # Log audit
            log_audit(db, current_user_id, "BULK_CREATE", "Mark", None, None, {
                "count": len(created_marks),
                "total_attempted": len(data_list)
            })
        
        return BulkOperationResult(
            success=True,
            processed_count=len(data_list),
            error_count=len(errors),
            errors=errors,
            created_ids=[mark.id for mark in created_marks]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.get("/api/bulk/template/{entity_type}")
async def download_template(
    entity_type: str,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Download template file for bulk upload"""
    
    if entity_type == "users":
        # Create users template
        template_data = {
            'username': ['john_doe', 'jane_smith'],
            'email': ['john@example.com', 'jane@example.com'],
            'full_name': ['John Doe', 'Jane Smith'],
            'first_name': ['John', 'Jane'],
            'last_name': ['Doe', 'Smith'],
            'role': ['student', 'teacher'],
            'password': ['password123', 'password123'],
            'department_id': [1, 1],
            'class_id': [1, None],
            'is_active': [True, True]
        }
        df = pd.DataFrame(template_data)
        
    elif entity_type == "departments":
        # Create departments template
        template_data = {
            'name': ['Computer Science', 'Mathematics'],
            'code': ['CS', 'MATH'],
            'description': ['Computer Science Department', 'Mathematics Department'],
            'is_active': [True, True]
        }
        df = pd.DataFrame(template_data)
        
    elif entity_type == "classes":
        # Create classes template
        template_data = {
            'name': ['CS-2024', 'MATH-2024'],
            'department_id': [1, 2],
            'description': ['Computer Science Class 2024', 'Mathematics Class 2024'],
            'is_active': [True, True]
        }
        df = pd.DataFrame(template_data)
        
    elif entity_type == "subjects":
        # Create subjects template
        template_data = {
            'name': ['Data Structures', 'Calculus'],
            'code': ['DS101', 'CALC101'],
            'department_id': [1, 2],
            'teacher_id': [1, 2],
            'description': ['Data Structures Course', 'Calculus Course'],
            'credits': [3, 4],
            'is_active': [True, True]
        }
        df = pd.DataFrame(template_data)
        
    elif entity_type == "marks":
        # Create marks template
        template_data = {
            'student_id': [1, 1],
            'question_id': [1, 2],
            'marks_obtained': [8, 7],
            'max_marks': [10, 10]
        }
        df = pd.DataFrame(template_data)
        
    else:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    # Create Excel file
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Template', index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={entity_type}_template.xlsx"}
    )

# Bulk user operations
@app.post("/api/users/bulk-create")
async def bulk_create_users(
    request: BulkCreateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk create users with proper field validation and role-based logic"""
    from shared.permissions import PermissionChecker, Permission
    from passlib.context import CryptContext
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    if not PermissionChecker.has_permission(str(current_user.role), Permission.CREATE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create users")
    
    try:
        created_count = 0
        created_users = []
        
        for user_data in request.users:
            # Convert user_data to dict for validation
            user_dict = user_data.dict()
            
            # Validate and clean fields based on role
            cleaned_data = validate_role_based_fields(user_data.role, user_dict)
            
            # Generate IDs based on role
            if user_data.role == "student":
                if not cleaned_data.get("student_id"):
                    cleaned_data["student_id"] = generate_student_id(db)
            else:
                if not cleaned_data.get("employee_id"):
                    cleaned_data["employee_id"] = generate_employee_id(user_data.role, db)
            
            # Handle specializations
            specializations_json = None
            if cleaned_data.get("specializations"):
                specializations_json = json.dumps(cleaned_data["specializations"])
            
            # Generate full_name from first_name and last_name if not provided
            full_name = cleaned_data.get("full_name")
            if not full_name and (cleaned_data.get("first_name") or cleaned_data.get("last_name")):
                full_name = f"{cleaned_data.get('first_name', '')} {cleaned_data.get('last_name', '')}".strip()
            
            # Handle date_of_birth conversion from string to datetime
            date_of_birth = None
            if cleaned_data.get("date_of_birth"):
                try:
                    date_of_birth = datetime.strptime(cleaned_data["date_of_birth"], "%Y-%m-%d")
                except ValueError:
                    date_of_birth = None
            
            # Extract validated fields
            department_id = cleaned_data.get("department_id")
            class_id = cleaned_data.get("class_id")
            experience_years = cleaned_data.get("experience_years")
            student_id = cleaned_data.get("student_id")
            employee_id = cleaned_data.get("employee_id")
            qualification = cleaned_data.get("qualification")
            
            # Hash password
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            hashed_password = pwd_context.hash(user_data.password)
            
            # Create user
            user = User(
                username=user_data.username,
                email=user_data.email,
                full_name=full_name,
                first_name=cleaned_data.get("first_name"),
                last_name=cleaned_data.get("last_name"),
                role=user_data.role,
                department_id=department_id,
                class_id=class_id,
                phone=cleaned_data.get("phone"),
                address=cleaned_data.get("address"),
                student_id=student_id,
                employee_id=employee_id,
                hashed_password=hashed_password,
                is_active=getattr(user_data, 'is_active', True),
                specializations=specializations_json,
                date_of_birth=date_of_birth,
                experience_years=experience_years,
                qualification=qualification,
                gender=cleaned_data.get("gender")
            )
            
            db.add(user)
            created_users.append(user)
            created_count += 1
        
        db.commit()
        
        # Refresh all users to get their IDs
        for user in created_users:
            db.refresh(user)
        
        return {
            "message": f"Successfully created {created_count} users",
            "created_users": [format_user_response(user, db) for user in created_users]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating users: {str(e)}")

@app.post("/api/users/bulk-update")
async def bulk_update_users(
    request: BulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk update users with proper field validation and role-based logic"""
    from shared.permissions import PermissionChecker, Permission
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    if not PermissionChecker.has_permission(str(current_user.role), Permission.UPDATE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to update users")
    
    # Get users to update
    query = db.query(User).filter(User.id.in_(request.user_ids))
    
    # Apply department restrictions for HOD
    if str(current_user.role) == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    
    users = query.all()
    
    if not users:
        raise HTTPException(status_code=404, detail="No users found to update")
    
    try:
        updated_count = 0
        for user in users:
            # Create update data for this user
            update_data = request.update_data.copy()
            
            # Check if role is being changed
            new_role = update_data.get("role", user.role)
            role_changed = new_role != user.role
            
            # Validate and clean fields based on new role
            cleaned_data = validate_role_based_fields(new_role, update_data)
            
            # Handle role change - generate appropriate IDs
            if role_changed:
                if new_role == "student":
                    # Changing to student - generate student_id, remove employee_id
                    if not cleaned_data.get("student_id"):
                        cleaned_data["student_id"] = generate_student_id(db)
                    cleaned_data["employee_id"] = None
                else:
                    # Changing to staff - generate employee_id, remove student_id
                    if not cleaned_data.get("employee_id"):
                        cleaned_data["employee_id"] = generate_employee_id(new_role, db)
                    cleaned_data["student_id"] = None
            
            # Hash password if provided
            if "password" in cleaned_data:
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                cleaned_data["hashed_password"] = pwd_context.hash(cleaned_data.pop("password"))
            
            # Handle specializations
            if "specializations" in cleaned_data:
                if cleaned_data["specializations"]:
                    cleaned_data["specializations"] = json.dumps(cleaned_data["specializations"])
                else:
                    cleaned_data["specializations"] = None
            
            # Handle full_name generation from first_name and last_name
            if "first_name" in cleaned_data or "last_name" in cleaned_data:
                first_name = cleaned_data.get("first_name", user.first_name)
                last_name = cleaned_data.get("last_name", user.last_name)
                if first_name or last_name:
                    cleaned_data["full_name"] = f"{first_name or ''} {last_name or ''}".strip()
            
            # Handle date_of_birth conversion from string to datetime
            if "date_of_birth" in cleaned_data and cleaned_data["date_of_birth"]:
                try:
                    cleaned_data["date_of_birth"] = datetime.strptime(cleaned_data["date_of_birth"], "%Y-%m-%d")
                except ValueError:
                    cleaned_data["date_of_birth"] = None
            
            # Handle subject_ids for teachers (if provided)
            if "subject_ids" in cleaned_data:
                subject_ids = cleaned_data.pop("subject_ids")
                if subject_ids and new_role == "teacher":
                    # Remove existing teacher subjects
                    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).delete()
                    # Add new teacher subjects
                    for subject_id in subject_ids:
                        teacher_subject = TeacherSubject(teacher_id=user.id, subject_id=subject_id)
                        db.add(teacher_subject)
            
            # Update all fields
            for field, value in cleaned_data.items():
                if hasattr(user, field):
                    setattr(user, field, value)
            
            updated_count += 1
        
        db.commit()
        
        return {"message": f"Successfully updated {updated_count} users"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating users: {str(e)}")

@app.post("/api/users/bulk-delete")
async def bulk_delete_users(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Bulk delete users with proper foreign key constraint handling"""
    from shared.permissions import PermissionChecker, Permission
    
    # Check permissions
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")
    
    if not PermissionChecker.has_permission(str(current_user.role), Permission.DELETE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete users")
    
    # Get users to delete
    query = db.query(User).filter(User.id.in_(request.user_ids))
    
    # Apply department restrictions for HOD
    if str(current_user.role) == "hod":
        query = query.filter(User.department_id == current_user.department_id)
    
    users = query.all()
    
    if not users:
        raise HTTPException(status_code=404, detail="No users found to delete")
    
    try:
        deleted_count = 0
        for user in users:
            # Handle foreign key constraints by setting referencing fields to NULL
            from shared.models import Department, Class, TeacherSubject, Mark, QuestionBank, QuestionBankItem, FileUpload, Notification, AuditLog
            
            # Set user_id to NULL in audit logs
            db.query(AuditLog).filter(AuditLog.user_id == user.id).update({"user_id": None})
            
            # Set hod_id to NULL in departments
            db.query(Department).filter(Department.hod_id == user.id).update({"hod_id": None})
            
            # Set class_teacher_id and cr_id to NULL in classes
            db.query(Class).filter(Class.class_teacher_id == user.id).update({"class_teacher_id": None})
            db.query(Class).filter(Class.cr_id == user.id).update({"cr_id": None})
            
            # Set teacher_id to NULL in teacher subjects (this has CASCADE, but let's be explicit)
            db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).delete()
            
            # Set graded_by to NULL in marks
            db.query(Mark).filter(Mark.graded_by == user.id).update({"graded_by": None})
            
            # Set created_by to NULL in question banks
            db.query(QuestionBank).filter(QuestionBank.created_by == user.id).update({"created_by": None})
            
            # Set added_by to NULL in question bank items
            db.query(QuestionBankItem).filter(QuestionBankItem.added_by == user.id).update({"added_by": None})
            
            # Set uploaded_by to NULL in file uploads
            db.query(FileUpload).filter(FileUpload.uploaded_by == user.id).update({"uploaded_by": None})
            
            # Set user_id to NULL in notifications
            db.query(Notification).filter(Notification.user_id == user.id).update({"user_id": None})
            
            # Then delete the user
            db.delete(user)
            deleted_count += 1
        
        db.commit()
        
        return {"message": f"Successfully deleted {deleted_count} users"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting users: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bulk"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8016)