from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
from io import BytesIO, StringIO
import json
import csv

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Exam, Question, Mark, CO, PO, AuditLog
from shared.auth import RoleChecker, get_password_hash
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

# Root endpoint for health check
@app.get("/")
async def root():
    return {"message": "Bulk Operations Service is running", "status": "healthy"}

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None
    )
    db.add(audit_log)
    db.commit()

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
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
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
            success_count=len(created_users),
            error_count=len(errors),
            errors=errors,
            message=f"Successfully created {len(created_users)} users out of {len(data_list)} records"
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
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
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
            success_count=len(created_departments),
            error_count=len(errors),
            errors=errors,
            message=f"Successfully created {len(created_departments)} departments out of {len(data_list)} records"
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
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
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
            success_count=len(created_classes),
            error_count=len(errors),
            errors=errors,
            message=f"Successfully created {len(created_classes)} classes out of {len(data_list)} records"
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
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
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
            success_count=len(created_subjects),
            error_count=len(errors),
            errors=errors,
            message=f"Successfully created {len(created_subjects)} subjects out of {len(data_list)} records"
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
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
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
            success_count=len(created_marks),
            error_count=len(errors),
            errors=errors,
            message=f"Successfully created {len(created_marks)} marks out of {len(data_list)} records"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.get("/template/{entity_type}")
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
        BytesIO(output.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={entity_type}_template.xlsx"}
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bulk"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8016)