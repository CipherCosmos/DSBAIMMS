from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import psutil
import os
import json
import redis
from datetime import datetime, timedelta
import asyncio
import aiofiles
from pathlib import Path

from shared.database import get_db
from shared.models import SystemLog, User, AuditLog
from shared.auth import RoleChecker
from shared.schemas import SystemLogResponse, RealtimeStats

app = FastAPI(title="System Monitoring Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Redis for caching
try:
    redis_client = redis.from_url("redis://redis:6379")
except:
    redis_client = None

def log_system_event(db: Session, level: str, message: str, module: str = "monitoring", user_id: int = None):
    """Log system events"""
    system_log = SystemLog(
        level=level,
        message=message,
        module=module,
        user_id=user_id
    )
    db.add(system_log)
    db.commit()

def get_system_metrics() -> Dict:
    """Get comprehensive system metrics"""
    try:
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # Memory metrics
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        disk_io = psutil.disk_io_counters()
        
        # Network metrics
        network = psutil.net_io_counters()
        
        # Process metrics
        processes = psutil.pids()
        process_count = len(processes)
        
        # Load average (Unix only)
        try:
            load_avg = os.getloadavg()
        except:
            load_avg = [0, 0, 0]
        
        return {
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "frequency": {
                    "current": cpu_freq.current if cpu_freq else 0,
                    "min": cpu_freq.min if cpu_freq else 0,
                    "max": cpu_freq.max if cpu_freq else 0
                }
            },
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent,
                "used": memory.used,
                "free": memory.free
            },
            "swap": {
                "total": swap.total,
                "used": swap.used,
                "free": swap.free,
                "percent": swap.percent
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": (disk.used / disk.total) * 100
            },
            "network": {
                "bytes_sent": network.bytes_sent,
                "bytes_recv": network.bytes_recv,
                "packets_sent": network.packets_sent,
                "packets_recv": network.packets_recv
            },
            "processes": {
                "count": process_count
            },
            "load_average": {
                "1min": load_avg[0],
                "5min": load_avg[1],
                "15min": load_avg[2]
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}

def get_service_health() -> Dict:
    """Check health of various services"""
    health_status = {}
    
    # Check database connection
    try:
        from shared.database import get_db
        db = next(get_db())
        db.execute("SELECT 1")
        health_status["database"] = {"status": "healthy", "response_time": 0}
    except Exception as e:
        health_status["database"] = {"status": "unhealthy", "error": str(e)}
    
    # Check Redis connection
    try:
        if redis_client:
            redis_client.ping()
            health_status["redis"] = {"status": "healthy", "response_time": 0}
        else:
            health_status["redis"] = {"status": "not_configured"}
    except Exception as e:
        health_status["redis"] = {"status": "unhealthy", "error": str(e)}
    
    # Check disk space
    try:
        disk = psutil.disk_usage('/')
        free_percent = (disk.free / disk.total) * 100
        if free_percent < 10:
            health_status["disk"] = {"status": "warning", "free_percent": free_percent}
        else:
            health_status["disk"] = {"status": "healthy", "free_percent": free_percent}
    except Exception as e:
        health_status["disk"] = {"status": "error", "error": str(e)}
    
    return health_status

# Root endpoint
@app.get("/")
async def root():
    return {"message": "System Monitoring Service is running", "status": "healthy"}

# Health endpoint
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "monitoring", "timestamp": datetime.utcnow().isoformat()}

# Monitoring endpoints
@app.get("/metrics")
async def get_metrics(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get current system metrics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Log the request
    log_system_event(db, "INFO", f"Metrics requested by user {current_user_id}", "monitoring", current_user_id)
    
    metrics = get_system_metrics()
    
    # Cache metrics in Redis if available
    if redis_client:
        try:
            redis_client.setex("system_metrics", 60, json.dumps(metrics))
        except:
            pass
    
    return metrics

@app.get("/health")
async def get_health(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get system health status"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Log the request
    log_system_event(db, "INFO", f"Health check requested by user {current_user_id}", "monitoring", current_user_id)
    
    health_status = get_service_health()
    
    # Determine overall health
    overall_status = "healthy"
    for service, status in health_status.items():
        if status.get("status") in ["unhealthy", "error"]:
            overall_status = "unhealthy"
            break
        elif status.get("status") == "warning":
            overall_status = "warning"
    
    return {
        "overall_status": overall_status,
        "services": health_status,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/logs", response_model=List[SystemLogResponse])
async def get_system_logs(
    level: Optional[str] = None,
    module: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get system logs with optional filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(SystemLog)
    
    # Apply filters
    if level:
        query = query.filter(SystemLog.level == level)
    if module:
        query = query.filter(SystemLog.module == module)
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.filter(SystemLog.timestamp >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        query = query.filter(SystemLog.timestamp <= end_dt)
    
    logs = query.order_by(SystemLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    # Log the request
    log_system_event(db, "INFO", f"Logs requested by user {current_user_id}", "monitoring", current_user_id)
    
    return logs

@app.get("/stats", response_model=RealtimeStats)
async def get_realtime_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get real-time system statistics"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Get system metrics
    metrics = get_system_metrics()
    
    # Get database stats
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    
    # Get log stats
    total_logs = db.query(SystemLog).count()
    error_logs = db.query(SystemLog).filter(SystemLog.level == "ERROR").count()
    warning_logs = db.query(SystemLog).filter(SystemLog.level == "WARNING").count()
    
    # Get recent activity
    recent_logs = db.query(SystemLog).filter(
        SystemLog.timestamp >= datetime.utcnow() - timedelta(hours=1)
    ).count()
    
    # Log the request
    log_system_event(db, "INFO", f"Stats requested by user {current_user_id}", "monitoring", current_user_id)
    
    return RealtimeStats(
        total_users=total_users,
        active_users=active_users,
        total_logs=total_logs,
        error_logs=error_logs,
        warning_logs=warning_logs,
        recent_activity=recent_logs,
        cpu_percent=metrics.get("cpu", {}).get("percent", 0),
        memory_percent=metrics.get("memory", {}).get("percent", 0),
        disk_percent=metrics.get("disk", {}).get("percent", 0),
        timestamp=datetime.utcnow()
    )

@app.post("/logs/clear")
async def clear_old_logs(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin"]))
):
    """Clear old system logs"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Calculate cutoff date
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Delete old logs
    deleted_count = db.query(SystemLog).filter(
        SystemLog.timestamp < cutoff_date
    ).delete()
    
    db.commit()
    
    # Log the action
    log_system_event(db, "INFO", f"Cleared {deleted_count} old logs (older than {days} days) by user {current_user_id}", "monitoring", current_user_id)
    
    return {"message": f"Cleared {deleted_count} old logs", "deleted_count": deleted_count}

@app.get("/alerts")
async def get_alerts(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Get system alerts and warnings"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    alerts = []
    
    # Check system metrics for alerts
    metrics = get_system_metrics()
    
    # CPU alert
    if metrics.get("cpu", {}).get("percent", 0) > 80:
        alerts.append({
            "type": "cpu",
            "level": "warning",
            "message": f"High CPU usage: {metrics['cpu']['percent']}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # Memory alert
    if metrics.get("memory", {}).get("percent", 0) > 85:
        alerts.append({
            "type": "memory",
            "level": "warning",
            "message": f"High memory usage: {metrics['memory']['percent']}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # Disk alert
    if metrics.get("disk", {}).get("percent", 0) > 90:
        alerts.append({
            "type": "disk",
            "level": "critical",
            "message": f"Low disk space: {metrics['disk']['percent']:.1f}% used",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # Check for recent errors
    recent_errors = db.query(SystemLog).filter(
        SystemLog.level == "ERROR",
        SystemLog.timestamp >= datetime.utcnow() - timedelta(hours=1)
    ).count()
    
    if recent_errors > 10:
        alerts.append({
            "type": "logs",
            "level": "warning",
            "message": f"High error rate: {recent_errors} errors in the last hour",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # Log the request
    log_system_event(db, "INFO", f"Alerts requested by user {current_user_id}", "monitoring", current_user_id)
    
    return {
        "alerts": alerts,
        "count": len(alerts),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "monitoring"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8021)