from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict
import json
import asyncio
from datetime import datetime, timedelta
import redis
import psutil
import os

from shared.database import get_db
from shared.models import Notification, User, AuditLog
from shared.auth import RoleChecker
from shared.schemas import NotificationCreate, NotificationUpdate, NotificationResponse, RealtimeStats

app = FastAPI(title="Notification Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Redis for real-time notifications
try:
    redis_client = redis.from_url("redis://redis:6379")
except:
    redis_client = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message)
                except:
                    # Remove broken connections
                    self.active_connections[user_id].remove(connection)

    async def broadcast(self, message: str):
        for user_connections in self.active_connections.values():
            for connection in user_connections:
                try:
                    await connection.send_text(message)
                except:
                    pass

manager = ConnectionManager()

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
    return {"message": "Notification Service is running", "status": "healthy"}

# Notification endpoints
@app.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    user_id: Optional[int] = None,
    is_read: Optional[bool] = None,
    notification_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get all notifications with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Notification).options(joinedload(Notification.user))
    
    # Apply role-based filters
    if current_user.role == "student":
        # Students can only see their own notifications
        query = query.filter(Notification.user_id == current_user_id)
    elif current_user.role == "teacher":
        # Teachers can see notifications for their department
        query = query.join(User, User.id == Notification.user_id).filter(
            User.department_id == current_user.department_id
        )
    elif current_user.role == "hod":
        # HODs can see notifications for their department
        query = query.join(User, User.id == Notification.user_id).filter(
            User.department_id == current_user.department_id
        )
    
    # Apply additional filters
    if user_id:
        query = query.filter(Notification.user_id == user_id)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    
    notifications = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    return notifications

@app.get("/notifications/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get a specific notification by ID"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    notification = db.query(Notification).options(joinedload(Notification.user)).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if notification.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ["teacher", "hod"]:
        user = db.query(User).filter(User.id == notification.user_id).first()
        if user.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return notification

@app.post("/notifications", response_model=NotificationResponse)
async def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Create a new notification"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Check if target user exists
    target_user = db.query(User).filter(User.id == notification.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if target_user.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        if target_user.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Create notification
    db_notification = Notification(
        user_id=notification.user_id,
        title=notification.title,
        message=notification.message,
        notification_type=notification.notification_type,
        is_read=False,
        created_by=current_user_id
    )
    
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    # Send real-time notification
    if redis_client:
        try:
            notification_data = {
                "id": db_notification.id,
                "title": db_notification.title,
                "message": db_notification.message,
                "type": db_notification.notification_type,
                "created_at": db_notification.created_at.isoformat()
            }
            redis_client.publish(f"notifications:{notification.user_id}", json.dumps(notification_data))
        except:
            pass
    
    # Send WebSocket notification
    await manager.send_personal_message(
        json.dumps({
            "type": "notification",
            "data": {
                "id": db_notification.id,
                "title": db_notification.title,
                "message": db_notification.message,
                "notification_type": db_notification.notification_type
            }
        }),
        notification.user_id
    )
    
    # Log audit
    log_audit(db, current_user_id, "CREATE", "Notification", db_notification.id, None, {
        "user_id": notification.user_id,
        "title": notification.title
    })
    
    return db_notification

@app.put("/notifications/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: int,
    notification: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Update an existing notification"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if db_notification.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        user = db.query(User).filter(User.id == db_notification.user_id).first()
        if user.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "title": db_notification.title,
        "message": db_notification.message,
        "is_read": db_notification.is_read
    }
    
    # Update notification
    update_data = notification.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_notification, field, value)
    
    db.commit()
    db.refresh(db_notification)
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Notification", notification_id, old_values, update_data)
    
    return db_notification

@app.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Delete a notification"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Apply role-based access control
    if current_user.role == "teacher":
        if db_notification.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "hod":
        user = db.query(User).filter(User.id == db_notification.user_id).first()
        if user.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Store old values for audit
    old_values = {
        "user_id": db_notification.user_id,
        "title": db_notification.title
    }
    
    # Delete notification
    db.delete(db_notification)
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "DELETE", "Notification", notification_id, old_values, None)
    
    return {"message": "Notification deleted successfully"}

@app.get("/notifications/unread-count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Get unread notification count for current user"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(Notification).filter(Notification.user_id == current_user_id)
    
    # Apply role-based filters
    if current_user.role == "student":
        # Students can only see their own notifications
        query = query.filter(Notification.user_id == current_user_id)
    elif current_user.role in ["teacher", "hod"]:
        # Teachers and HODs can see notifications for their department
        query = query.join(User, User.id == Notification.user_id).filter(
            User.department_id == current_user.department_id
        )
    
    unread_count = query.filter(Notification.is_read == False).count()
    
    return {"unread_count": unread_count}

@app.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Mark a notification as read"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    db_notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Apply role-based access control
    if current_user.role == "student":
        if db_notification.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in ["teacher", "hod"]:
        user = db.query(User).filter(User.id == db_notification.user_id).first()
        if user.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Mark as read
    db_notification.is_read = True
    db_notification.read_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "UPDATE", "Notification", notification_id, None, {
        "is_read": True
    })
    
    return {"message": "Notification marked as read"}

@app.put("/notifications/mark-all-read")
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher", "student"]))
):
    """Mark all notifications as read for current user"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Mark all unread notifications as read
    updated_count = db.query(Notification).filter(
        Notification.user_id == current_user_id,
        Notification.is_read == False
    ).update({
        "is_read": True,
        "read_at": datetime.utcnow()
    })
    
    db.commit()
    
    # Log audit
    log_audit(db, current_user_id, "BULK_UPDATE", "Notification", None, None, {
        "action": "mark_all_read",
        "count": updated_count
    })
    
    return {"message": f"Marked {updated_count} notifications as read"}

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back the message (can be extended for real-time features)
            await manager.send_personal_message(f"Echo: {data}", user_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# Real-time stats endpoint
@app.get("/stats", response_model=RealtimeStats)
async def get_realtime_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get real-time system statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get notification stats
    total_notifications = db.query(Notification).count()
    unread_notifications = db.query(Notification).filter(Notification.is_read == False).count()
    
    # Get user stats
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    
    # Get system stats
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Get WebSocket connections
    active_connections = sum(len(connections) for connections in manager.active_connections.values())
    
    return RealtimeStats(
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
        total_users=total_users,
        active_users=active_users,
        active_connections=active_connections,
        cpu_percent=cpu_percent,
        memory_percent=memory.percent,
        disk_percent=disk.percent,
        timestamp=datetime.utcnow()
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "notifications"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8018)