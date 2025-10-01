"""
Enhanced Role-Based Access Control (RBAC) Implementation
Integrates with the permission system for fine-grained access control
"""

from typing import Optional, Dict, Any, List
from fastapi import HTTPException, Depends, Request
from sqlalchemy.orm import Session
from .auth import get_current_user_with_role
from .permissions import PermissionChecker, Permission
from .database import get_db
from .models import User, Department, Class, Subject, TeacherSubject

class RBACChecker:
    """Enhanced RBAC checker with permission validation"""

    def __init__(self, required_permission: Permission, allowed_roles: Optional[List[str]] = None):
        self.required_permission = required_permission
        self.allowed_roles = allowed_roles or ["admin", "hod", "teacher", "student"]

    def __call__(self, request: Request, db: Session = Depends(get_db)):
        """Check if user has required permission and role"""
        user_info = get_current_user_with_role(request)
        user_role = user_info["role"]
        user_id = user_info["id"]

        # Check if user role is allowed
        if self.allowed_roles and user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {self.allowed_roles}, User role: {user_role}"
            )

        # Check if user has the required permission
        if not PermissionChecker.has_permission(user_role, self.required_permission):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required permission: {self.required_permission.value}"
            )

        # Get user from database for additional context
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "user_id": user_id,
            "role": user_role,
            "department_id": user.department_id,
            "class_id": user.class_id,
            "user": user
        }

class ResourceAccessChecker:
    """Check access to specific resources based on user context"""

    @staticmethod
    def can_access_department(user: User, department_id: int) -> bool:
        """Check if user can access a specific department"""
        if user.role == "admin":
            return True
        elif user.role == "hod":
            return user.department_id == department_id
        elif user.role in ["teacher", "student"]:
            return user.department_id == department_id
        return False

    @staticmethod
    def can_access_class(user: User, class_id: int, db: Session) -> bool:
        """Check if user can access a specific class"""
        if user.role == "admin":
            return True
        elif user.role == "hod":
            # HOD can access classes in their department
            class_obj = db.query(Class).filter(Class.id == class_id).first()
            return class_obj and class_obj.department_id == user.department_id
        elif user.role == "teacher":
            # Teacher can access classes they're assigned to
            return db.query(TeacherSubject).filter(
                TeacherSubject.teacher_id == user.id,
                TeacherSubject.class_id == class_id
            ).first() is not None
        elif user.role == "student":
            # Student can access their own class
            return user.class_id == class_id
        return False

    @staticmethod
    def can_access_subject(user: User, subject_id: int, db: Session) -> bool:
        """Check if user can access a specific subject"""
        if user.role == "admin":
            return True
        elif user.role == "hod":
            # HOD can access subjects in their department
            subject = db.query(Subject).filter(Subject.id == subject_id).first()
            return subject and subject.department_id == user.department_id
        elif user.role == "teacher":
            # Teacher can access subjects they're assigned to
            return db.query(TeacherSubject).filter(
                TeacherSubject.teacher_id == user.id,
                TeacherSubject.subject_id == subject_id
            ).first() is not None
        elif user.role == "student":
            # Student can access subjects they're enrolled in
            # This would need to be checked against enrollment records
            return True  # Simplified for now
        return False

    @staticmethod
    def can_access_user(user: User, target_user_id: int, db: Session) -> bool:
        """Check if user can access another user's data"""
        if user.role == "admin":
            return True
        elif user.role == "hod":
            # HOD can access users in their department
            target_user = db.query(User).filter(User.id == target_user_id).first()
            return target_user and target_user.department_id == user.department_id
        elif user.role == "teacher":
            # Teacher can access students they teach
            target_user = db.query(User).filter(User.id == target_user_id).first()
            if not target_user:
                return False
            if target_user.role == "student":
                # Check if teacher teaches this student
                return db.query(TeacherSubject).join(Class).filter(
                    TeacherSubject.teacher_id == user.id,
                    Class.id == target_user.class_id
                ).first() is not None
            return False
        elif user.role == "student":
            # Student can only access their own data
            return user.id == target_user_id
        return False

def require_permission(permission: Permission, allowed_roles: Optional[List[str]] = None):
    """Create a dependency that requires a specific permission"""
    return RBACChecker(permission, allowed_roles)

def require_admin():
    """Require admin role"""
    return RBACChecker(Permission.VIEW_USERS, ["admin"])

def require_admin_or_hod():
    """Require admin or HOD role"""
    return RBACChecker(Permission.VIEW_USERS, ["admin", "hod"])

def require_teacher_or_above():
    """Require teacher role or above"""
    return RBACChecker(Permission.VIEW_USERS, ["admin", "hod", "teacher"])

def require_student_or_above():
    """Require student role or above (all roles)"""
    return RBACChecker(Permission.VIEW_USERS, ["admin", "hod", "teacher", "student"])

# Specific permission checkers
def require_department_management():
    """Require department management permission"""
    return RBACChecker(Permission.CREATE_DEPARTMENTS, ["admin", "hod"])

def require_user_management():
    """Require user management permission"""
    return RBACChecker(Permission.CREATE_USERS, ["admin", "hod"])

def require_class_management():
    """Require class management permission"""
    return RBACChecker(Permission.CREATE_CLASSES, ["admin", "hod", "teacher"])

def require_subject_management():
    """Require subject management permission"""
    return RBACChecker(Permission.CREATE_SUBJECTS, ["admin", "hod", "teacher"])

def require_exam_management():
    """Require exam management permission"""
    return RBACChecker(Permission.CREATE_EXAM_CONFIGURATIONS, ["admin", "hod", "teacher"])

def require_marks_access():
    """Require marks access permission"""
    return RBACChecker(Permission.VIEW_MARKS, ["admin", "hod", "teacher", "student"])

def require_analytics_access():
    """Require analytics access permission"""
    return RBACChecker(Permission.PERFORMANCE_DASHBOARDS, ["admin", "hod", "teacher", "student"])

def require_notification_send():
    """Require notification sending permission"""
    return RBACChecker(Permission.SEND_NOTIFICATIONS, ["admin", "hod", "teacher"])

def require_notification_receive():
    """Require notification receiving permission"""
    return RBACChecker(Permission.RECEIVE_NOTIFICATIONS, ["admin", "hod", "teacher", "student"])

def require_bulk_operations():
    """Require bulk operations permission"""
    return RBACChecker(Permission.EXPORT_FUNCTIONALITY, ["admin", "hod"])

def require_profile_management():
    """Require profile management permission"""
    return RBACChecker(Permission.UPDATE_PERSONAL_DETAILS, ["admin", "hod", "teacher", "student"])

# Context-aware permission checkers
def check_department_access(user: User, department_id: int) -> bool:
    """Check if user can access a department"""
    return ResourceAccessChecker.can_access_department(user, department_id)

def check_class_access(user: User, class_id: int, db: Session) -> bool:
    """Check if user can access a class"""
    return ResourceAccessChecker.can_access_class(user, class_id, db)

def check_subject_access(user: User, subject_id: int, db: Session) -> bool:
    """Check if user can access a subject"""
    return ResourceAccessChecker.can_access_subject(user, subject_id, db)

def check_user_access(user: User, target_user_id: int, db: Session) -> bool:
    """Check if user can access another user's data"""
    return ResourceAccessChecker.can_access_user(user, target_user_id, db)

# Utility functions for permission validation
def validate_resource_access(user: User, resource_type: str, resource_id: int, db: Session) -> bool:
    """Validate access to a specific resource"""
    if resource_type == "department":
        return check_department_access(user, resource_id)
    elif resource_type == "class":
        return check_class_access(user, resource_id, db)
    elif resource_type == "subject":
        return check_subject_access(user, resource_id, db)
    elif resource_type == "user":
        return check_user_access(user, resource_id, db)
    return False

def get_user_accessible_resources(user: User, resource_type: str, db: Session) -> List[int]:
    """Get list of resource IDs that user can access"""
    if resource_type == "departments":
        if user.role == "admin":
            return [dept.id for dept in db.query(Department).all()]
        elif user.department_id:
            return [user.department_id]
        return []

    elif resource_type == "classes":
        if user.role == "admin":
            return [cls.id for cls in db.query(Class).all()]
        elif user.role == "hod":
            return [cls.id for cls in db.query(Class).filter(Class.department_id == user.department_id).all()]
        elif user.role == "teacher":
            return [ts.class_id for ts in db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()]
        elif user.role == "student" and user.class_id:
            return [user.class_id]
        return []

    elif resource_type == "subjects":
        if user.role == "admin":
            return [subj.id for subj in db.query(Subject).all()]
        elif user.role == "hod":
            return [subj.id for subj in db.query(Subject).filter(Subject.department_id == user.department_id).all()]
        elif user.role == "teacher":
            return [ts.subject_id for ts in db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()]
        elif user.role == "student":
            # Students can see subjects in their class/semester
            if user.class_id:
                class_obj = db.query(Class).filter(Class.id == user.class_id).first()
                if class_obj:
                    return [subj.id for subj in db.query(Subject).filter(Subject.semester_id == class_obj.semester_id).all()]
        return []

    return []



