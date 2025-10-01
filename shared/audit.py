# Centralized Audit Logging Utility
# Eliminates duplicate audit logging code across services

from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import json
from .models import AuditLog

def log_audit(
    db: Session,
    user_id: int,
    action: str,
    table_name: str,
    record_id: Optional[int] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    request = None
) -> None:
    """
    Centralized audit logging function

    Args:
        db: Database session
        user_id: ID of user performing the action
        action: Action being performed (CREATE, UPDATE, DELETE, etc.)
        table_name: Name of the table being modified
        record_id: ID of the record being modified (optional)
        old_values: Previous values before modification (optional)
        new_values: New values after modification (optional)
        request: FastAPI request object for IP and user agent (optional)
    """
    try:
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            table_name=table_name,
            record_id=record_id,
            old_values=json.dumps(old_values) if old_values else None,
            new_values=json.dumps(new_values) if new_values else None,
            ip_address=request.client.host if request and hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if request and hasattr(request, 'headers') else None,
            created_at=datetime.utcnow()
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        # Log error but don't fail the main operation
        print(f"Audit logging failed: {str(e)}")
        db.rollback()

def log_bulk_audit(
    db: Session,
    user_id: int,
    action: str,
    table_name: str,
    records: list,
    request = None
) -> None:
    """
    Log audit for bulk operations

    Args:
        db: Database session
        user_id: ID of user performing the action
        action: Action being performed (BULK_CREATE, BULK_UPDATE, BULK_DELETE)
        table_name: Name of the table being modified
        records: List of records being modified
        request: FastAPI request object for IP and user agent (optional)
    """
    try:
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            table_name=table_name,
            record_id=None,
            old_values=None,
            new_values=json.dumps({
                "record_count": len(records),
                "operation_type": "bulk"
            }),
            ip_address=request.client.host if request and hasattr(request, 'client') else None,
            user_agent=request.headers.get("user-agent") if request and hasattr(request, 'headers') else None,
            created_at=datetime.utcnow()
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        print(f"Bulk audit logging failed: {str(e)}")
        db.rollback()



