from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os
import uuid
import mimetypes
import shutil
from datetime import datetime
import json
from pathlib import Path

from shared.database import get_db
from shared.models import FileUpload, User, AuditLog
from shared.auth import RoleChecker
from shared.schemas import FileUploadCreate, FileUploadResponse

app = FastAPI(title="File Management Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# File storage configuration
UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {
    'images': {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'},
    'documents': {'.pdf', '.doc', '.docx', '.txt', '.rtf'},
    'spreadsheets': {'.xls', '.xlsx', '.csv'},
    'presentations': {'.ppt', '.pptx'},
    'archives': {'.zip', '.rar', '.7z', '.tar', '.gz'},
    'videos': {'.mp4', '.avi', '.mov', '.wmv', '.flv'},
    'audio': {'.mp3', '.wav', '.ogg', '.m4a'}
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_MIME_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/svg+xml',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/rtf',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'video/mp4', 'video/avi', 'video/quicktime', 'video/x-ms-wmv',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'
}

def ensure_upload_dir():
    """Ensure upload directory exists"""
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    for category in ALLOWED_EXTENSIONS.keys():
        Path(UPLOAD_DIR, category).mkdir(parents=True, exist_ok=True)

def get_file_category(filename: str) -> str:
    """Determine file category based on extension"""
    ext = Path(filename).suffix.lower()
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return 'other'

def validate_file(file: UploadFile) -> tuple[bool, str]:
    """Validate uploaded file"""
    # Check file size
    if hasattr(file, 'size') and file.size > MAX_FILE_SIZE:
        return False, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
    
    # Check file extension
    ext = Path(file.filename).suffix.lower()
    if not any(ext in extensions for extensions in ALLOWED_EXTENSIONS.values()):
        return False, f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS.keys())}"
    
    # Check MIME type
    content_type = file.content_type
    if content_type not in ALLOWED_MIME_TYPES:
        return False, f"MIME type not allowed: {content_type}"
    
    return True, ""

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

# Root endpoint
@app.get("/")
async def root():
    return {"message": "File Management Service is running", "status": "healthy"}

# File upload endpoints
@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    description: str = Form(""),
    tags: str = Form(""),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Upload a file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate file
    is_valid, error_message = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)
    
    # Ensure upload directory exists
    ensure_upload_dir()
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{file_id}{file_extension}"
    
    # Determine file category
    category = get_file_category(file.filename)
    
    # Create file path
    file_path = Path(UPLOAD_DIR) / category / filename
    
    try:
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = file_path.stat().st_size
        
        # Create database record
        db_file = FileUpload(
            filename=file.filename,
            stored_filename=filename,
            file_path=str(file_path),
            file_size=file_size,
            mime_type=file.content_type,
            category=category,
            description=description,
            tags=tags.split(",") if tags else [],
            uploaded_by=current_user_id
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        # Log audit
        log_audit(db, current_user_id, "CREATE", "FileUpload", db_file.id, None, {
            "filename": file.filename,
            "file_size": file_size,
            "category": category
        })
        
        return db_file
        
    except Exception as e:
        # Clean up file if database operation fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@app.get("/files", response_model=List[FileUploadResponse])
async def get_files(
    category: Optional[str] = None,
    uploaded_by: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all files with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(FileUpload).options(joinedload(FileUpload.uploader))
    
    # Apply role-based filters
    if current_user.role == "student":
        # Students can only see their own files
        query = query.filter(FileUpload.uploaded_by == current_user_id)
    elif current_user.role == "teacher":
        # Teachers can see files from their department
        query = query.join(User, User.id == FileUpload.uploaded_by).filter(
            User.department_id == current_user.department_id
        )
    elif current_user.role == "hod":
        # HODs can see files from their department
        query = query.join(User, User.id == FileUpload.uploaded_by).filter(
            User.department_id == current_user.department_id
        )
    
    # Apply additional filters
    if category:
        query = query.filter(FileUpload.category == category)
    if uploaded_by:
        query = query.filter(FileUpload.uploaded_by == uploaded_by)
    if search:
        query = query.filter(
            (FileUpload.filename.ilike(f"%{search}%")) |
            (FileUpload.description.ilike(f"%{search}%"))
        )
    
    files = query.offset(skip).limit(limit).all()
    return files

@app.get("/files/{file_id}", response_model=FileUploadResponse)
async def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific file by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    file_upload = db.query(FileUpload).options(joinedload(FileUpload.uploader)).filter(FileUpload.id == file_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if file_upload.uploaded_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ["teacher", "hod"]:
        uploader = db.query(User).filter(User.id == file_upload.uploaded_by).first()
        if uploader.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return file_upload

@app.get("/files/{file_id}/download")
async def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Download a file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if file_upload.uploaded_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ["teacher", "hod"]:
        uploader = db.query(User).filter(User.id == file_upload.uploaded_by).first()
        if uploader.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if file exists
    file_path = Path(file_upload.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Log download
    log_audit(db, current_user_id, "DOWNLOAD", "FileUpload", file_id, None, {
        "filename": file_upload.filename
    })
    
    return FileResponse(
        path=str(file_path),
        filename=file_upload.filename,
        media_type=file_upload.mime_type
    )

@app.put("/files/{file_id}", response_model=FileUploadResponse)
async def update_file(
    file_id: int,
    description: str = Form(""),
    tags: str = Form(""),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update file metadata"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if file_upload.uploaded_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        uploader = db.query(User).filter(User.id == file_upload.uploaded_by).first()
        if uploader.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "description": file_upload.description,
        "tags": file_upload.tags
    }
    
    # Update file metadata
    file_upload.description = description
    file_upload.tags = tags.split(",") if tags else []
    
    db.commit()
    db.refresh(file_upload)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "FileUpload", file_id, old_values, {
        "description": description,
        "tags": tags.split(",") if tags else []
    })
    
    return file_upload

@app.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a file"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if file_upload.uploaded_by != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        uploader = db.query(User).filter(User.id == file_upload.uploaded_by).first()
        if uploader.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "filename": file_upload.filename,
        "file_path": file_upload.file_path
    }
    
    # Delete file from disk
    file_path = Path(file_upload.file_path)
    if file_path.exists():
        file_path.unlink()
    
    # Delete database record
    db.delete(file_upload)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "FileUpload", file_id, old_values, None)
    
    return {"message": "File deleted successfully"}

@app.get("/files/categories")
async def get_file_categories():
    """Get available file categories"""
    return {
        "categories": list(ALLOWED_EXTENSIONS.keys()),
        "extensions": {k: list(v) for k, v in ALLOWED_EXTENSIONS.items()}
    }

@app.get("/files/stats")
async def get_file_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get file statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(FileUpload)
    
    # Apply role-based filters
    if current_user.role == "teacher":
        query = query.join(User, User.id == FileUpload.uploaded_by).filter(
            User.department_id == current_user.department_id
        )
    elif current_user.role == "hod":
        query = query.join(User, User.id == FileUpload.uploaded_by).filter(
            User.department_id == current_user.department_id
        )
    
    total_files = query.count()
    total_size = query.with_entities(db.func.sum(FileUpload.file_size)).scalar() or 0
    
    # Category breakdown
    category_stats = {}
    for category in ALLOWED_EXTENSIONS.keys():
        count = query.filter(FileUpload.category == category).count()
        category_stats[category] = count
    
    return {
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "category_breakdown": category_stats
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "files"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8019)