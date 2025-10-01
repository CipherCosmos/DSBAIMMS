from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import json

from shared.database import get_db
from shared.models import User, Department, Class, Subject, Exam, Mark, AuditLog, Notification
from shared.schemas import NotificationResponse
from shared.auth import RoleChecker
from shared.audit import log_audit, log_bulk_audit

app = FastAPI(title="Notifications Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Notification schemas
# Using NotificationCreate from shared.schemas

class NotificationStats(BaseModel):
    total_notifications: int
    unread_count: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]
    recent_count: int

# Audit logging is now handled by shared.audit module

@app.get("/", response_model=Dict[str, str])
async def root():
    return {"message": "Notifications Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    is_read: Optional[bool] = Query(None),
    notification_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get user notifications"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Query notifications from database
    query = db.query(Notification).filter(Notification.user_id == current_user_id)

    # Apply filters
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)

    if notification_type:
        query = query.filter(Notification.type == notification_type)

    # Apply pagination
    notifications = query.offset(skip).limit(limit).all()

    # Convert to response format
    result = []
    for notification in notifications:
        result.append(NotificationResponse(
            id=notification.id,
            title=notification.title,
            message=notification.message,
            notification_type=notification.type,
            priority=notification.priority or "medium",
            is_read=notification.is_read,
            created_at=notification.created_at.isoformat() if notification.created_at else None,
            scheduled_at=notification.scheduled_at.isoformat() if notification.scheduled_at else None,
            expires_at=notification.expires_at.isoformat() if notification.expires_at else None,
            sender_name=notification.sender_name or (notification.sender.full_name if notification.sender else "System")
        ))

    return result

@app.post("/api/notifications")
async def create_notification(
    notification_data: NotificationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new notification"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Validate scheduled and expiry dates
    scheduled_at = None
    expires_at = None

    if notification_data.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(notification_data.scheduled_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at format")

    if notification_data.expires_at:
        try:
            expires_at = datetime.fromisoformat(notification_data.expires_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at format")

    # Validate date logic
    if scheduled_at and expires_at and scheduled_at >= expires_at:
        raise HTTPException(status_code=400, detail="expires_at must be after scheduled_at")

    # Create notification records for target users
    target_users = []

    # Determine target users based on criteria
    if notification_data.target_users:
        target_users = notification_data.target_users
    elif notification_data.target_roles:
        users = db.query(User).filter(User.role.in_(notification_data.target_roles)).all()
        target_users = [user.id for user in users]
    elif notification_data.target_departments:
        users = db.query(User).filter(User.department_id.in_(notification_data.target_departments)).all()
        target_users = [user.id for user in users]
    elif notification_data.target_classes:
        users = db.query(User).filter(User.class_id.in_(notification_data.target_classes)).all()
        target_users = [user.id for user in users]
    else:
        # Send to all users if no specific targets
        users = db.query(User).all()
        target_users = [user.id for user in users]

    # Create notification records
    created_notifications = []
    for user_id in target_users:
        notification = Notification(
            user_id=user_id,
            title=notification_data.title,
            message=notification_data.message,
            type=notification_data.type,
            priority=notification_data.priority,
            is_read=False,
            action_url=notification_data.action_url,
            sender_id=current_user_id,
            sender_name=notification_data.sender_name or current_user.full_name,
            scheduled_at=scheduled_at,
            expires_at=expires_at
        )
        db.add(notification)
        created_notifications.append(notification)

    db.commit()

    # Log audit
    log_audit(db, current_user_id, "CREATE_NOTIFICATION", "notifications", request=request)

    return {
        "message": "Notification created successfully",
        "notification_count": len(created_notifications),
        "target_count": len(target_users)
    }

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Mark notification as read"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Find and update the notification
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user_id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    # Log audit
    log_audit(db, current_user_id, "MARK_NOTIFICATION_READ", "notifications", request=request)

    return {"message": "Notification marked as read"}

@app.get("/api/notifications/stats", response_model=NotificationStats)
async def get_notification_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get notification statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Current user not found")

    # Query real statistics from database
    total_notifications = db.query(Notification).filter(Notification.user_id == current_user_id).count()
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user_id,
        Notification.is_read == False
    ).count()

    # Get counts by type
    by_type = {}
    type_counts = db.query(Notification.type, func.count(Notification.id)).filter(
        Notification.user_id == current_user_id
    ).group_by(Notification.type).all()

    for notification_type, count in type_counts:
        by_type[notification_type] = count

    # Get recent notifications (last 24 hours)
    recent_count = db.query(Notification).filter(
        Notification.user_id == current_user_id,
        Notification.created_at >= datetime.utcnow() - timedelta(days=1)
    ).count()

    stats = {
        "total_notifications": total_notifications,
        "unread_count": unread_count,
        "by_type": by_type,
        "by_priority": {
            "high": 0,  # Priority not implemented in current model
            "medium": total_notifications,
            "low": 0,
            "urgent": 0
        },
        "recent_count": recent_count
    }

    return NotificationStats(**stats)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "notifications"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8018)