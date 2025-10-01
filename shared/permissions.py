"""
Simple Permission System
"""
from enum import Enum
from typing import Dict

class UserRole(Enum):
    ADMIN = "admin"
    HOD = "hod"
    TEACHER = "teacher"
    STUDENT = "student"

class Permission(Enum):
    # Department Management
    CREATE_DEPARTMENTS = "create_departments"
    UPDATE_DEPARTMENTS = "update_departments"
    DELETE_DEPARTMENTS = "delete_departments"
    VIEW_DEPARTMENTS = "view_departments"

    # Class Management
    CREATE_CLASSES = "create_classes"
    UPDATE_CLASSES = "update_classes"
    DELETE_CLASSES = "delete_classes"
    VIEW_CLASSES = "view_classes"

    # User Management
    CREATE_USERS = "create_users"
    UPDATE_USERS = "update_users"
    DELETE_USERS = "delete_users"
    VIEW_USERS = "view_users"

    # Subject Management
    CREATE_SUBJECTS = "create_subjects"
    UPDATE_SUBJECTS = "update_subjects"
    DELETE_SUBJECTS = "delete_subjects"
    VIEW_SUBJECTS = "view_subjects"

    # Exam Management
    CREATE_EXAM_CONFIGURATIONS = "create_exam_configurations"
    VIEW_EXAM_CONFIGURATIONS = "view_exam_configurations"
    QUESTION_BANK_MANAGEMENT = "question_bank_management"
    MARKS_ENTRY_INTERFACE = "marks_entry_interface"
    VIEW_MARKS = "view_marks"

    # Analytics & Reports
    PERFORMANCE_DASHBOARDS = "performance_dashboards"
    EXPORT_FUNCTIONALITY = "export_functionality"

    # Profile Management
    UPDATE_PERSONAL_DETAILS = "update_personal_details"
    CHANGE_PASSWORDS = "change_passwords"

    # Notifications
    SEND_NOTIFICATIONS = "send_notifications"
    RECEIVE_NOTIFICATIONS = "receive_notifications"

# Simple permission matrix
PERMISSION_MATRIX = {
    UserRole.ADMIN: {
        Permission.CREATE_DEPARTMENTS: "full",
        Permission.UPDATE_DEPARTMENTS: "full",
        Permission.DELETE_DEPARTMENTS: "full",
        Permission.VIEW_DEPARTMENTS: "full",
        Permission.CREATE_CLASSES: "full",
        Permission.UPDATE_CLASSES: "full",
        Permission.DELETE_CLASSES: "full",
        Permission.VIEW_CLASSES: "full",
        Permission.CREATE_USERS: "full",
        Permission.UPDATE_USERS: "full",
        Permission.DELETE_USERS: "full",
        Permission.VIEW_USERS: "full",
        Permission.CREATE_SUBJECTS: "full",
        Permission.UPDATE_SUBJECTS: "full",
        Permission.DELETE_SUBJECTS: "full",
        Permission.VIEW_SUBJECTS: "full",
        Permission.CREATE_EXAM_CONFIGURATIONS: "full",
        Permission.VIEW_EXAM_CONFIGURATIONS: "full",
        Permission.QUESTION_BANK_MANAGEMENT: "full",
        Permission.MARKS_ENTRY_INTERFACE: "full",
        Permission.VIEW_MARKS: "full",
        Permission.PERFORMANCE_DASHBOARDS: "full",
        Permission.EXPORT_FUNCTIONALITY: "full",
        Permission.UPDATE_PERSONAL_DETAILS: "full",
        Permission.CHANGE_PASSWORDS: "full",
        Permission.SEND_NOTIFICATIONS: "full",
        Permission.RECEIVE_NOTIFICATIONS: "full"
    },
    UserRole.HOD: {
        Permission.CREATE_DEPARTMENTS: "dept_only",
        Permission.UPDATE_DEPARTMENTS: "dept_only",
        Permission.DELETE_DEPARTMENTS: "dept_only",
        Permission.VIEW_DEPARTMENTS: "dept_only",
        Permission.CREATE_CLASSES: "dept_only",
        Permission.UPDATE_CLASSES: "dept_only",
        Permission.DELETE_CLASSES: "dept_only",
        Permission.VIEW_CLASSES: "dept_only",
        Permission.CREATE_USERS: "dept_only",
        Permission.UPDATE_USERS: "dept_only",
        Permission.DELETE_USERS: "dept_only",
        Permission.VIEW_USERS: "dept_only",
        Permission.CREATE_SUBJECTS: "dept_only",
        Permission.UPDATE_SUBJECTS: "dept_only",
        Permission.DELETE_SUBJECTS: "dept_only",
        Permission.VIEW_SUBJECTS: "dept_only",
        Permission.CREATE_EXAM_CONFIGURATIONS: "dept_only",
        Permission.VIEW_EXAM_CONFIGURATIONS: "dept_only",
        Permission.QUESTION_BANK_MANAGEMENT: "dept_only",
        Permission.MARKS_ENTRY_INTERFACE: "dept_only",
        Permission.VIEW_MARKS: "dept_only",
        Permission.PERFORMANCE_DASHBOARDS: "dept_only",
        Permission.EXPORT_FUNCTIONALITY: "dept_only",
        Permission.UPDATE_PERSONAL_DETAILS: "own_only",
        Permission.CHANGE_PASSWORDS: "own_only",
        Permission.SEND_NOTIFICATIONS: "dept_only",
        Permission.RECEIVE_NOTIFICATIONS: "dept_only"
    },
    UserRole.TEACHER: {
        Permission.CREATE_DEPARTMENTS: "view_only",
        Permission.UPDATE_DEPARTMENTS: "view_only",
        Permission.DELETE_DEPARTMENTS: "view_only",
        Permission.VIEW_DEPARTMENTS: "view_only",
        Permission.CREATE_CLASSES: "assigned_only",
        Permission.UPDATE_CLASSES: "assigned_only",
        Permission.DELETE_CLASSES: "assigned_only",
        Permission.VIEW_CLASSES: "assigned_only",
        Permission.CREATE_USERS: "view_only",
        Permission.UPDATE_USERS: "view_only",
        Permission.DELETE_USERS: "view_only",
        Permission.VIEW_USERS: "view_only",
        Permission.CREATE_SUBJECTS: "assigned_only",
        Permission.UPDATE_SUBJECTS: "assigned_only",
        Permission.DELETE_SUBJECTS: "assigned_only",
        Permission.VIEW_SUBJECTS: "assigned_only",
        Permission.CREATE_EXAM_CONFIGURATIONS: "assigned_only",
        Permission.VIEW_EXAM_CONFIGURATIONS: "assigned_only",
        Permission.QUESTION_BANK_MANAGEMENT: "assigned_only",
        Permission.MARKS_ENTRY_INTERFACE: "assigned_only",
        Permission.VIEW_MARKS: "assigned_only",
        Permission.PERFORMANCE_DASHBOARDS: "assigned_only",
        Permission.EXPORT_FUNCTIONALITY: "assigned_only",
        Permission.UPDATE_PERSONAL_DETAILS: "own_only",
        Permission.CHANGE_PASSWORDS: "own_only",
        Permission.SEND_NOTIFICATIONS: "assigned_only",
        Permission.RECEIVE_NOTIFICATIONS: "assigned_only"
    },
    UserRole.STUDENT: {
        Permission.CREATE_DEPARTMENTS: "view_only",
        Permission.UPDATE_DEPARTMENTS: "view_only",
        Permission.DELETE_DEPARTMENTS: "view_only",
        Permission.VIEW_DEPARTMENTS: "view_only",
        Permission.CREATE_CLASSES: "view_only",
        Permission.UPDATE_CLASSES: "view_only",
        Permission.DELETE_CLASSES: "view_only",
        Permission.VIEW_CLASSES: "view_only",
        Permission.CREATE_USERS: "view_only",
        Permission.UPDATE_USERS: "view_only",
        Permission.DELETE_USERS: "view_only",
        Permission.VIEW_USERS: "view_only",
        Permission.CREATE_SUBJECTS: "view_only",
        Permission.UPDATE_SUBJECTS: "view_only",
        Permission.DELETE_SUBJECTS: "view_only",
        Permission.VIEW_SUBJECTS: "view_only",
        Permission.CREATE_EXAM_CONFIGURATIONS: "view_only",
        Permission.VIEW_EXAM_CONFIGURATIONS: "view_only",
        Permission.QUESTION_BANK_MANAGEMENT: "view_only",
        Permission.MARKS_ENTRY_INTERFACE: "view_only",
        Permission.VIEW_MARKS: "own_only",
        Permission.PERFORMANCE_DASHBOARDS: "own_only",
        Permission.EXPORT_FUNCTIONALITY: "own_only",
        Permission.UPDATE_PERSONAL_DETAILS: "own_only",
        Permission.CHANGE_PASSWORDS: "own_only",
        Permission.SEND_NOTIFICATIONS: "receive_only",
        Permission.RECEIVE_NOTIFICATIONS: "receive_only"
    }
}

class PermissionChecker:
    @staticmethod
    def has_permission(user_role: str, permission: Permission) -> bool:
        try:
            role = UserRole(user_role)
            permission_level = PERMISSION_MATRIX.get(role, {}).get(permission, "no_access")
            return permission_level != "no_access"
        except ValueError:
            return False

    @staticmethod
    def get_permission_level(user_role: str, permission: Permission) -> str:
        try:
            role = UserRole(user_role)
            return PERMISSION_MATRIX.get(role, {}).get(permission, "no_access")
        except ValueError:
            return "no_access"
