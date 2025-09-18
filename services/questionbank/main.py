from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import json

from shared.database import get_db
from shared.models import QuestionBank, QuestionBankItem, User, Department, Subject, CO, AuditLog
from shared.auth import RoleChecker
from shared.schemas import (
    QuestionBankCreate, QuestionBankUpdate, QuestionBankResponse,
    QuestionBankItemCreate, QuestionBankItemResponse
)

app = FastAPI(title="Question Bank Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None):
    """Log audit events"""
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

# Question Bank endpoints
@app.get("/", response_model=List[QuestionBankResponse])
async def get_question_banks(
    department_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    is_public: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all question banks with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(QuestionBank).options(
        joinedload(QuestionBank.creator),
        joinedload(QuestionBank.department),
        joinedload(QuestionBank.subject)
    )
    
    # Apply role-based filters
    if current_user.role == "student":
        # Students can only see public question banks
        query = query.filter(QuestionBank.is_public == True)
    elif current_user.role == "teacher":
        # Teachers can see public question banks and their own
        query = query.filter(
            (QuestionBank.is_public == True) | (QuestionBank.created_by == current_user_id)
        )
    elif current_user.role == "hod":
        # HODs can see public question banks and those from their department
        query = query.filter(
            (QuestionBank.is_public == True) | (QuestionBank.department_id == current_user.department_id)
        )
    
    # Apply additional filters
    if department_id:
        query = query.filter(QuestionBank.department_id == department_id)
    if subject_id:
        query = query.filter(QuestionBank.subject_id == subject_id)
    if is_public is not None:
        query = query.filter(QuestionBank.is_public == is_public)
    
    question_banks = query.offset(skip).limit(limit).all()
    return question_banks

@app.get("/{question_bank_id}", response_model=QuestionBankResponse)
async def get_question_bank(
    question_bank_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific question bank by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    question_bank = db.query(QuestionBank).options(
        joinedload(QuestionBank.creator),
        joinedload(QuestionBank.department),
        joinedload(QuestionBank.subject)
    ).filter(QuestionBank.id == question_bank_id).first()
    
    if not question_bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if not question_bank.is_public:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        if not question_bank.is_public and question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if not question_bank.is_public and question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return question_bank

@app.post("/", response_model=QuestionBankResponse)
async def create_question_bank(
    question_bank: QuestionBankCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new question bank"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check if subject exists and user has permission
    if question_bank.subject_id:
        subject = db.query(Subject).filter(Subject.id == question_bank.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Apply role-based access control
        if current_user.role == "teacher":
            if subject.teacher_id != current_user_id:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user.role == "hod":
            if subject.department_id != current_user.department_id:
                raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if department exists and user has permission
    if question_bank.department_id:
        department = db.query(Department).filter(Department.id == question_bank.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        
        if current_user.role == "hod":
            if department.id != current_user.department_id:
                raise HTTPException(status_code=403, detail="Access denied")
    
    # Create question bank
    db_question_bank = QuestionBank(
        name=question_bank.name,
        description=question_bank.description,
        department_id=question_bank.department_id,
        subject_id=question_bank.subject_id,
        is_public=question_bank.is_public,
        created_by=current_user_id
    )
    
    db.add(db_question_bank)
    db.commit()
    db.refresh(db_question_bank)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "QuestionBank", db_question_bank.id, None, {
        "name": question_bank.name,
        "department_id": question_bank.department_id,
        "subject_id": question_bank.subject_id
    })
    
    return db_question_bank

@app.put("/{question_bank_id}", response_model=QuestionBankResponse)
async def update_question_bank(
    question_bank_id: int,
    question_bank: QuestionBankUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update an existing question bank"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_question_bank = db.query(QuestionBank).filter(QuestionBank.id == question_bank_id).first()
    if not db_question_bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if db_question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if db_question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "name": db_question_bank.name,
        "description": db_question_bank.description,
        "is_public": db_question_bank.is_public
    }
    
    # Update question bank
    update_data = question_bank.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_question_bank, field, value)
    
    db.commit()
    db.refresh(db_question_bank)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "QuestionBank", question_bank_id, old_values, update_data)
    
    return db_question_bank

@app.delete("/{question_bank_id}")
async def delete_question_bank(
    question_bank_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a question bank"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_question_bank = db.query(QuestionBank).filter(QuestionBank.id == question_bank_id).first()
    if not db_question_bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if db_question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if db_question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "name": db_question_bank.name,
        "department_id": db_question_bank.department_id,
        "subject_id": db_question_bank.subject_id
    }
    
    # Delete question bank items first
    db.query(QuestionBankItem).filter(QuestionBankItem.question_bank_id == question_bank_id).delete()
    
    # Delete question bank
    db.delete(db_question_bank)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "QuestionBank", question_bank_id, old_values, None)
    
    return {"message": "Question bank deleted successfully"}

# Question Bank Item endpoints
@app.get("/{question_bank_id}/items", response_model=List[QuestionBankItemResponse])
async def get_question_bank_items(
    question_bank_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all items in a question bank"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check question bank access
    question_bank = db.query(QuestionBank).filter(QuestionBank.id == question_bank_id).first()
    if not question_bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if not question_bank.is_public:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        if not question_bank.is_public and question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if not question_bank.is_public and question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    items = db.query(QuestionBankItem).options(
        joinedload(QuestionBankItem.co)
    ).filter(QuestionBankItem.question_bank_id == question_bank_id
    ).offset(skip).limit(limit).all()
    
    return items

@app.post("/{question_bank_id}/items", response_model=QuestionBankItemResponse)
async def create_question_bank_item(
    question_bank_id: int,
    item: QuestionBankItemCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Add an item to a question bank"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check question bank access
    question_bank = db.query(QuestionBank).filter(QuestionBank.id == question_bank_id).first()
    if not question_bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if CO exists
    if item.co_id:
        co = db.query(CO).filter(CO.id == item.co_id).first()
        if not co:
            raise HTTPException(status_code=404, detail="Course Outcome not found")
    
    # Create question bank item
    db_item = QuestionBankItem(
        question_bank_id=question_bank_id,
        question_text=item.question_text,
        question_type=item.question_type,
        marks=item.marks,
        difficulty_level=item.difficulty_level,
        bloom_level=item.bloom_level,
        co_id=item.co_id,
        tags=item.tags or [],
        created_by=current_user_id
    )
    
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "QuestionBankItem", db_item.id, None, {
        "question_bank_id": question_bank_id,
        "question_text": item.question_text[:100]
    })
    
    return db_item

@app.put("/items/{item_id}", response_model=QuestionBankItemResponse)
async def update_question_bank_item(
    item_id: int,
    item: QuestionBankItemCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update a question bank item"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_item = db.query(QuestionBankItem).filter(QuestionBankItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Question bank item not found")
    
    # Check question bank access
    question_bank = db.query(QuestionBank).filter(QuestionBank.id == db_item.question_bank_id).first()
    
    if current_user.role == "teacher":
        if question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if CO exists
    if item.co_id:
        co = db.query(CO).filter(CO.id == item.co_id).first()
        if not co:
            raise HTTPException(status_code=404, detail="Course Outcome not found")
    
    # Store old values for audit
    old_values = {
        "question_text": db_item.question_text,
        "marks": db_item.marks,
        "difficulty_level": db_item.difficulty_level
    }
    
    # Update item
    update_data = item.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)
    
    db.commit()
    db.refresh(db_item)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "QuestionBankItem", item_id, old_values, update_data)
    
    return db_item

@app.delete("/items/{item_id}")
async def delete_question_bank_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a question bank item"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_item = db.query(QuestionBankItem).filter(QuestionBankItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Question bank item not found")
    
    # Check question bank access
    question_bank = db.query(QuestionBank).filter(QuestionBank.id == db_item.question_bank_id).first()
    
    if current_user.role == "teacher":
        if question_bank.created_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if question_bank.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "question_bank_id": db_item.question_bank_id,
        "question_text": db_item.question_text
    }
    
    # Delete item
    db.delete(db_item)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "QuestionBankItem", item_id, old_values, None)
    
    return {"message": "Question bank item deleted successfully"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "questionbank"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8020)