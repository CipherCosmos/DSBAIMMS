"""
User Permission Matrix Implementation
Based on the provided matrix data
"""

from enum import Enum
from typing import List, Dict, Set,

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
    ASSIGN_HODS = "assign_hods"
    SET_ACADEMIC_YEARS = "set_academic_years"
    CONFIGURE_DURATION = "configure_duration"
    
    # Class Management
    CREATE_CLASSES = "create_classes"
    UPDATE_CLASSES = "update_classes"
    DELETE_CLASSES = "delete_classes"
    VIEW_CLASSES = "view_classes"
    ASSIGN_CLASS_TEACHERS = "assign_class_teachers"
    ASSIGN_CLASS_CRS = "assign_class_crs"
    MAP_STUDENTS_TO_CLASSES = "map_students_to_classes"
    
    # User Management
    CREATE_USERS = "create_users"
    UPDATE_USERS = "update_users"
    DELETE_USERS = "delete_users"
    VIEW_USERS = "view_users"
    MANAGE_STUDENT_PROFILES = "manage_student_profiles"
    MANAGE_TEACHER_PROFILES = "manage_teacher_profiles"
    ROLE_BASED_ACCESS_CONTROL = "role_based_access_control"
    
    # Subject Management
    CREATE_SUBJECTS = "create_subjects"
    UPDATE_SUBJECTS = "update_subjects"
    DELETE_SUBJECTS = "delete_subjects"
    VIEW_SUBJECTS = "view_subjects"
    MAP_SUBJECTS_TO_CLASSES = "map_subjects_to_classes"
    DEFINE_SUBJECT_PREREQUISITES = "define_subject_prerequisites"
    SUBJECT_PERFORMANCE_TRACKING = "subject_performance_tracking"
    
    # Exam Management
    CREATE_EXAM_CONFIGURATIONS = "create_exam_configurations"
    VIEW_EXAM_CONFIGURATIONS = "view_exam_configurations"
    QUESTION_BANK_MANAGEMENT = "question_bank_management"
    MARKS_ENTRY_INTERFACE = "marks_entry_interface"
    VIEW_MARKS = "view_marks"
    AUTOMATED_GRADING = "automated_grading"
    TAKE_EXAMS = "take_exams"
    
    # CO-PO Management
    DEFINE_COURSE_OUTCOMES = "define_course_outcomes"
    MAP_CO_TO_PO = "map_co_to_po"
    SET_THRESHOLD_VALUES = "set_threshold_values"
    ATTAINMENT_CALCULATIONS = "attainment_calculations"
    VIEW_CO_PO = "view_co_po"
    
    # Analytics & Reports
    PERFORMANCE_DASHBOARDS = "performance_dashboards"
    EXPORT_FUNCTIONALITY = "export_functionality"
    TREND_ANALYSIS = "trend_analysis"
    PREDICTIVE_ANALYTICS = "predictive_analytics"
    
    # Bulk Operations
    BULK_USER_UPLOAD = "bulk_user_upload"
    BULK_MARKS_ENTRY = "bulk_marks_entry"
    BULK_QUESTION_IMPORT = "bulk_question_import"
    BULK_DATA_EXPORT = "bulk_data_export"
    
    # Profile Management
    UPDATE_PERSONAL_DETAILS = "update_personal_details"
    CHANGE_PASSWORDS = "change_passwords"
    MANAGE_PREFERENCES = "manage_preferences"
    VIEW_ACTIVITY_LOGS = "view_activity_logs"
    
    # Notifications
    SEND_NOTIFICATIONS = "send_notifications"
    RECEIVE_NOTIFICATIONS = "receive_notifications"
    EMAIL_NOTIFICATIONS = "email_notifications"
    SMS_INTEGRATION = "sms_integration"
    PUSH_NOTIFICATIONS = "push_notifications"

# Permission matrix based on the provided data
PERMISSION_MATRIX = {
    UserRole.ADMIN: {
        # Department Management - Full CRUD
        Permission.CREATE_DEPARTMENTS: "full"
        Permission.UPDATE_DEPARTMENTS: "full" 
        Permission.DELETE_DEPARTMENTS: "full"
        Permission.VIEW_DEPARTMENTS: "full"
        Permission.ASSIGN_HODS: "full"
        Permission.SET_ACADEMIC_YEARS: "full"
        Permission.CONFIGURE_DURATION: "full"
        
        # Class Management - Full CRUD
        Permission.CREATE_CLASSES: "full"
        Permission.UPDATE_CLASSES: "full"
        Permission.DELETE_CLASSES: "full" 
        Permission.VIEW_CLASSES: "full"
        Permission.ASSIGN_CLASS_TEACHERS: "full"
        Permission.ASSIGN_CLASS_CRS: "full"
        Permission.MAP_STUDENTS_TO_CLASSES: "full"
        
        # User Management - Full CRUD
        Permission.CREATE_USERS: "full"
        Permission.UPDATE_USERS: "full"
        Permission.DELETE_USERS: "full"
        Permission.VIEW_USERS: "full"
        Permission.MANAGE_STUDENT_PROFILES: "full"
        Permission.MANAGE_TEACHER_PROFILES: "full"
        Permission.ROLE_BASED_ACCESS_CONTROL: "full"
        
        # Subject Management - Full CRUD
        Permission.CREATE_SUBJECTS: "full"
        Permission.UPDATE_SUBJECTS: "full"
        Permission.DELETE_SUBJECTS: "full"
        Permission.VIEW_SUBJECTS: "full"
        Permission.MAP_SUBJECTS_TO_CLASSES: "full"
        Permission.DEFINE_SUBJECT_PREREQUISITES: "full"
        Permission.SUBJECT_PERFORMANCE_TRACKING: "full"
        
        # Exam Management - View/Monitor
        Permission.CREATE_EXAM_CONFIGURATIONS: "view_monitor"
        Permission.VIEW_EXAM_CONFIGURATIONS: "full"
        Permission.QUESTION_BANK_MANAGEMENT: "view_only"
        Permission.MARKS_ENTRY_INTERFACE: "view_only"
        Permission.VIEW_MARKS: "full"
        Permission.AUTOMATED_GRADING: "configure"
        
        # CO-PO Management - Full CRUD
        Permission.DEFINE_COURSE_OUTCOMES: "full"
        Permission.MAP_CO_TO_PO: "full"
        Permission.SET_THRESHOLD_VALUES: "full"
        Permission.ATTAINMENT_CALCULATIONS: "full"
        Permission.VIEW_CO_PO: "full"
        
        # Analytics & Reports - Full Access
        Permission.PERFORMANCE_DASHBOARDS: "full"
        Permission.EXPORT_FUNCTIONALITY: "full"
        Permission.TREND_ANALYSIS: "full"
        Permission.PREDICTIVE_ANALYTICS: "full"
        
        # Bulk Operations - Full Access
        Permission.BULK_USER_UPLOAD: "full"
        Permission.BULK_MARKS_ENTRY: "full"
        Permission.BULK_QUESTION_IMPORT: "full"
        Permission.BULK_DATA_EXPORT: "full"
        
        # Profile Management - Full Access
        Permission.UPDATE_PERSONAL_DETAILS: "full"
        Permission.CHANGE_PASSWORDS: "full"
        Permission.MANAGE_PREFERENCES: "full"
        Permission.VIEW_ACTIVITY_LOGS: "full"
        
        # Notifications - Send/Receive
        Permission.SEND_NOTIFICATIONS: "full"
        Permission.RECEIVE_NOTIFICATIONS: "full"
        Permission.EMAIL_NOTIFICATIONS: "full"
        Permission.SMS_INTEGRATION: "configure"
        Permission.PUSH_NOTIFICATIONS: "configure"
    }
    UserRole.HOD: {
        # Department Management - Assigned Dept Only
        Permission.CREATE_DEPARTMENTS: "assigned_dept_only"
        Permission.UPDATE_DEPARTMENTS: "assigned_dept_only"
        Permission.DELETE_DEPARTMENTS: "assigned_dept_only"
        Permission.VIEW_DEPARTMENTS: "assigned_dept_only"
        Permission.ASSIGN_HODS: "view_only"
        Permission.SET_ACADEMIC_YEARS: "view_suggest"
        Permission.CONFIGURE_DURATION: "view_only"
        
        # Class Management - Dept Classes Only
        Permission.CREATE_CLASSES: "dept_classes_only"
        Permission.UPDATE_CLASSES: "dept_classes_only"
        Permission.DELETE_CLASSES: "dept_classes_only"
        Permission.VIEW_CLASSES: "dept_classes_only"
        Permission.ASSIGN_CLASS_TEACHERS: "assign_in_dept"
        Permission.ASSIGN_CLASS_CRS: "assign_in_dept"
        Permission.MAP_STUDENTS_TO_CLASSES: "dept_students_only"
        
        # User Management - Dept Users Only
        Permission.CREATE_USERS: "dept_users_only"
        Permission.UPDATE_USERS: "dept_users_only"
        Permission.DELETE_USERS: "dept_users_only"
        Permission.VIEW_USERS: "dept_users_only"
        Permission.MANAGE_STUDENT_PROFILES: "dept_students"
        Permission.MANAGE_TEACHER_PROFILES: "dept_teachers"
        Permission.ROLE_BASED_ACCESS_CONTROL: "dept_level_only"
        
        # Subject Management - Dept Subjects Only
        Permission.CREATE_SUBJECTS: "dept_subjects_only"
        Permission.UPDATE_SUBJECTS: "dept_subjects_only"
        Permission.DELETE_SUBJECTS: "dept_subjects_only"
        Permission.VIEW_SUBJECTS: "dept_subjects_only"
        Permission.MAP_SUBJECTS_TO_CLASSES: "dept_classes_only"
        Permission.DEFINE_SUBJECT_PREREQUISITES: "view_only"
        Permission.SUBJECT_PERFORMANCE_TRACKING: "dept_subject_tracking"
        
        # Exam Management - Dept Exams Only
        Permission.CREATE_EXAM_CONFIGURATIONS: "dept_exams_only"
        Permission.VIEW_EXAM_CONFIGURATIONS: "dept_exams_only"
        Permission.QUESTION_BANK_MANAGEMENT: "view_dept_questions"
        Permission.MARKS_ENTRY_INTERFACE: "view_dept_marks"
        Permission.VIEW_MARKS: "dept_marks"
        Permission.AUTOMATED_GRADING: "view_reports"
        
        # CO-PO Management - Dept COs Only
        Permission.DEFINE_COURSE_OUTCOMES: "dept_cos_only"
        Permission.MAP_CO_TO_PO: "dept_co_po_mapping"
        Permission.SET_THRESHOLD_VALUES: "set_dept_thresholds"
        Permission.ATTAINMENT_CALCULATIONS: "dept_attainment"
        Permission.VIEW_CO_PO: "dept_cos_only"
        
        # Analytics & Reports - Dept Analytics
        Permission.PERFORMANCE_DASHBOARDS: "dept_analytics"
        Permission.EXPORT_FUNCTIONALITY: "dept_reports_export"
        Permission.TREND_ANALYSIS: "dept_trends"
        Permission.PREDICTIVE_ANALYTICS: "limited_predictions"
        
        # Bulk Operations - Dept Users Only
        Permission.BULK_USER_UPLOAD: "dept_users_only"
        Permission.BULK_MARKS_ENTRY: "dept_marks_only"
        Permission.BULK_QUESTION_IMPORT: "dept_questions_only"
        Permission.BULK_DATA_EXPORT: "dept_data_only"
        
        # Profile Management - Own Profile Only
        Permission.UPDATE_PERSONAL_DETAILS: "own_profile_only"
        Permission.CHANGE_PASSWORDS: "change_password"
        Permission.MANAGE_PREFERENCES: "own_preferences"
        Permission.VIEW_ACTIVITY_LOGS: "own_activity"
        
        # Notifications - Dept Notifications
        Permission.SEND_NOTIFICATIONS: "dept_notifications"
        Permission.RECEIVE_NOTIFICATIONS: "dept_notifications"
        Permission.EMAIL_NOTIFICATIONS: "dept_emails"
        Permission.SMS_INTEGRATION: "no_sms_access"
        Permission.PUSH_NOTIFICATIONS: "dept_push_notifications"
    }
    UserRole.TEACHER: {
        # Department Management - View Only
        Permission.CREATE_DEPARTMENTS: "view_only"
        Permission.UPDATE_DEPARTMENTS: "view_only"
        Permission.DELETE_DEPARTMENTS: "view_only"
        Permission.VIEW_DEPARTMENTS: "view_only"
        Permission.ASSIGN_HODS: "no_access"
        Permission.SET_ACADEMIC_YEARS: "view_only"
        Permission.CONFIGURE_DURATION: "view_only"
        
        # Class Management - Assigned Classes
        Permission.CREATE_CLASSES: "assigned_classes"
        Permission.UPDATE_CLASSES: "assigned_classes"
        Permission.DELETE_CLASSES: "assigned_classes"
        Permission.VIEW_CLASSES: "assigned_classes"
        Permission.ASSIGN_CLASS_TEACHERS: "view_only"
        Permission.ASSIGN_CLASS_CRS: "view_only"
        Permission.MAP_STUDENTS_TO_CLASSES: "assigned_students"
        
        # User Management - View Students Only
        Permission.CREATE_USERS: "view_students_only"
        Permission.UPDATE_USERS: "view_students_only"
        Permission.DELETE_USERS: "view_students_only"
        Permission.VIEW_USERS: "view_students_only"
        Permission.MANAGE_STUDENT_PROFILES: "view_assigned_students"
        Permission.MANAGE_TEACHER_PROFILES: "view_own_profile"
        Permission.ROLE_BASED_ACCESS_CONTROL: "no_access"
        
        # Subject Management - Assigned Subjects
        Permission.CREATE_SUBJECTS: "assigned_subjects"
        Permission.UPDATE_SUBJECTS: "assigned_subjects"
        Permission.DELETE_SUBJECTS: "assigned_subjects"
        Permission.VIEW_SUBJECTS: "assigned_subjects"
        Permission.MAP_SUBJECTS_TO_CLASSES: "view_assignment"
        Permission.DEFINE_SUBJECT_PREREQUISITES: "no_access"
        Permission.SUBJECT_PERFORMANCE_TRACKING: "own_subject_performance"
        
        # Exam Management - Create for Assigned
        Permission.CREATE_EXAM_CONFIGURATIONS: "create_for_assigned"
        Permission.VIEW_EXAM_CONFIGURATIONS: "assigned_exams"
        Permission.QUESTION_BANK_MANAGEMENT: "full_crud_own"
        Permission.MARKS_ENTRY_INTERFACE: "full_access_own"
        Permission.VIEW_MARKS: "own_marks"
        Permission.AUTOMATED_GRADING: "configure_own"
        
        # CO-PO Management - Own Subject COs
        Permission.DEFINE_COURSE_OUTCOMES: "own_subject_cos"
        Permission.MAP_CO_TO_PO: "own_co_po_mapping"
        Permission.SET_THRESHOLD_VALUES: "view_thresholds"
        Permission.ATTAINMENT_CALCULATIONS: "own_subject_attainment"
        Permission.VIEW_CO_PO: "own_progress"
        
        # Analytics & Reports - Own Analytics
        Permission.PERFORMANCE_DASHBOARDS: "own_analytics"
        Permission.EXPORT_FUNCTIONALITY: "own_reports_export"
        Permission.TREND_ANALYSIS: "own_performance"
        Permission.PREDICTIVE_ANALYTICS: "no_predictions"
        
        # Bulk Operations - Own Students Only
        Permission.BULK_USER_UPLOAD: "own_students_only"
        Permission.BULK_MARKS_ENTRY: "own_classes_only"
        Permission.BULK_QUESTION_IMPORT: "own_questions_only"
        Permission.BULK_DATA_EXPORT: "own_data_only"
        
        # Profile Management - Own Profile Only
        Permission.UPDATE_PERSONAL_DETAILS: "own_profile_only"
        Permission.CHANGE_PASSWORDS: "change_password"
        Permission.MANAGE_PREFERENCES: "own_preferences"
        Permission.VIEW_ACTIVITY_LOGS: "own_activity"
        
        # Notifications - Class Notifications
        Permission.SEND_NOTIFICATIONS: "class_notifications"
        Permission.RECEIVE_NOTIFICATIONS: "class_notifications"
        Permission.EMAIL_NOTIFICATIONS: "class_emails"
        Permission.SMS_INTEGRATION: "no_sms_access"
        Permission.PUSH_NOTIFICATIONS: "class_push_notifications"
    }
    UserRole.STUDENT: {
        # Department Management - View Only
        Permission.CREATE_DEPARTMENTS: "view_only"
        Permission.UPDATE_DEPARTMENTS: "view_only"
        Permission.DELETE_DEPARTMENTS: "view_only"
        Permission.VIEW_DEPARTMENTS: "view_only"
        Permission.ASSIGN_HODS: "no_access"
        Permission.SET_ACADEMIC_YEARS: "view_only"
        Permission.CONFIGURE_DURATION: "view_only"
        
        # Class Management - View Own Class
        Permission.CREATE_CLASSES: "view_own_class"
        Permission.UPDATE_CLASSES: "view_own_class"
        Permission.DELETE_CLASSES: "view_own_class"
        Permission.VIEW_CLASSES: "view_own_class"
        Permission.ASSIGN_CLASS_TEACHERS: "view_teachers"
        Permission.ASSIGN_CLASS_CRS: "view_crs"
        Permission.MAP_STUDENTS_TO_CLASSES: "view_classmates"
        
        # User Management - View Own Profile
        Permission.CREATE_USERS: "view_own_profile"
        Permission.UPDATE_USERS: "view_own_profile"
        Permission.DELETE_USERS: "view_own_profile"
        Permission.VIEW_USERS: "view_own_profile"
        Permission.MANAGE_STUDENT_PROFILES: "own_profile_only"
        Permission.MANAGE_TEACHER_PROFILES: "view_teachers"
        Permission.ROLE_BASED_ACCESS_CONTROL: "no_access"
        
        # Subject Management - View Enrolled
        Permission.CREATE_SUBJECTS: "view_enrolled"
        Permission.UPDATE_SUBJECTS: "view_enrolled"
        Permission.DELETE_SUBJECTS: "view_enrolled"
        Permission.VIEW_SUBJECTS: "view_enrolled"
        Permission.MAP_SUBJECTS_TO_CLASSES: "view_own_subjects"
        Permission.DEFINE_SUBJECT_PREREQUISITES: "view_prerequisites"
        Permission.SUBJECT_PERFORMANCE_TRACKING: "view_own_performance"
        
        # Exam Management - Take Assigned Exams
        Permission.CREATE_EXAM_CONFIGURATIONS: "take_assigned_exams"
        Permission.VIEW_EXAM_CONFIGURATIONS: "assigned_exams"
        Permission.QUESTION_BANK_MANAGEMENT: "no_access"
        Permission.MARKS_ENTRY_INTERFACE: "view_own_marks"
        Permission.VIEW_MARKS: "own_marks"
        Permission.AUTOMATED_GRADING: "no_access"
        Permission.TAKE_EXAMS: "assigned_exams"
        
        # CO-PO Management - View Own Progress
        Permission.DEFINE_COURSE_OUTCOMES: "view_own_progress"
        Permission.MAP_CO_TO_PO: "view_mappings"
        Permission.SET_THRESHOLD_VALUES: "view_targets"
        Permission.ATTAINMENT_CALCULATIONS: "view_own_attainment"
        Permission.VIEW_CO_PO: "own_progress"
        
        # Analytics & Reports - Own Performance
        Permission.PERFORMANCE_DASHBOARDS: "own_performance"
        Permission.EXPORT_FUNCTIONALITY: "limited_export"
        Permission.TREND_ANALYSIS: "own_trends"
        Permission.PREDICTIVE_ANALYTICS: "recommendations"
        
        # Bulk Operations - No Access
        Permission.BULK_USER_UPLOAD: "no_access"
        Permission.BULK_MARKS_ENTRY: "no_access"
        Permission.BULK_QUESTION_IMPORT: "no_access"
        Permission.BULK_DATA_EXPORT: "own_data_export"
        
        # Profile Management - Own Profile Only
        Permission.UPDATE_PERSONAL_DETAILS: "own_profile_only"
        Permission.CHANGE_PASSWORDS: "change_password"
        Permission.MANAGE_PREFERENCES: "own_preferences"
        Permission.VIEW_ACTIVITY_LOGS: "own_activity"
        
        # Notifications - Receive Only
        Permission.SEND_NOTIFICATIONS: "receive_only"
        Permission.RECEIVE_NOTIFICATIONS: "receive_only"
        Permission.EMAIL_NOTIFICATIONS: "receive_only"
        Permission.SMS_INTEGRATION: "receive_only"
        Permission.PUSH_NOTIFICATIONS: "receive_only"
    }
}

class PermissionChecker:
    """Check user permissions based on role and context"""
    
    @staticmethod
    def has_permission(user_role: str, permission: Permission, context: Dict, =,, None) -> bool: """Check if user has permission for a specific action"""
        try:
            role = UserRole(user_role)
            permission_level = PERMISSION_MATRIX.get(role,, {}).get(permission,, "no_access")
            return permission_level != "no_access"
        except ValueError:
            return False
    
    @staticmethod
    def get_permission_level(user_role: str,, permission:,, Permission) -> str: """Get the permission level for a user role and permission"""
        try:
            role = UserRole(user_role)
            return PERMISSION_MATRIX.get(role,, {}).get(permission,, "no_access")
        except ValueError:
            return "no_access"
    
    @staticmethod
    def get_user_permissions(user_role:, str) -> Dict[Permission, str]:
        """Get all permissions for a user role"""
        try:
            role = UserRole(user_role)
            return PERMISSION_MATRIX.get(role,, {})
        except ValueError:
            return {}
    
    @staticmethod
    def can_access_resource(user_role: str, resource_type: str, resource_id: int = None, user_department_id: int = None, resource_department_id: int, =,, None) -> bool:
        """Check if user can access a specific resource based on department/class assignment"""
        role = UserRole(user_role)
        
        # Admin has full access
        if role = = UserRole.ADMIN:
            return True
        
        # HOD can access resources in their department
        if role = = UserRole.HOD:
            return user_department_id == resource_department_id
        
        # Teacher can access resources they're assigned to
        if role == UserRole.TEACHER:
            # This would need to be checked against actual assignments
            # For now, return True if same department,
            return user_department_id = = resource_department_id
        
        # Student can only access their own resources
        if role = = UserRole.STUDENT:
            return resource_id is not None  # Would need to check if it's their resource
        
        return False
def get_permission_matrix_data():
    """Return the permission matrix in the format used by the frontend"""
    matrix_data = []
    
    # Define the categories and their permissions
    categories = {
        "Department Management": [
            ("Create/Update/Delete Departments", Permission.CREATE_DEPARTMENTS, Permission.UPDATE_DEPARTMENTS, Permission.DELETE_DEPARTMENTS),
            ("Assign HODs", Permission.ASSIGN_HODS),
            ("Set Academic Years", Permission.SET_ACADEMIC_YEARS),
            ("Configure Duration", Permission.CONFIGURE_DURATION),
        ],
        "Class Management": [
            ("Create/Manage Classes", Permission.CREATE_CLASSES, Permission.UPDATE_CLASSES, Permission.DELETE_CLASSES),
            ("Assign Class Teachers", Permission.ASSIGN_CLASS_TEACHERS),
            ("Assign Class CRs", Permission.ASSIGN_CLASS_CRS),
            ("Map Students to Classes", Permission.MAP_STUDENTS_TO_CLASSES),
        ],
        "User Management": [
            ("Create User Accounts", Permission.CREATE_USERS),
            ("Manage Student Profiles", Permission.MANAGE_STUDENT_PROFILES),
            ("Manage Teacher Profiles", Permission.MANAGE_TEACHER_PROFILES),
            ("Role-based Access Control", Permission.ROLE_BASED_ACCESS_CONTROL),
        ],
        "Subject Management": [
            ("Create/Update Subjects", Permission.CREATE_SUBJECTS, Permission.UPDATE_SUBJECTS, Permission.DELETE_SUBJECTS),
            ("Map Subjects to Classes", Permission.MAP_SUBJECTS_TO_CLASSES),
            ("Define Subject Prerequisites", Permission.DEFINE_SUBJECT_PREREQUISITES),
            ("Subject Performance Tracking", Permission.SUBJECT_PERFORMANCE_TRACKING),
        ],
        "Exam Management": [
            ("Create Exam Configurations", Permission.CREATE_EXAM_CONFIGURATIONS),
            ("Question Bank Management", Permission.QUESTION_BANK_MANAGEMENT),
            ("Marks Entry Interface", Permission.MARKS_ENTRY_INTERFACE),
            ("Automated Grading", Permission.AUTOMATED_GRADING),
        ],
        "CO-PO Management": [
            ("Define Course Outcomes", Permission.DEFINE_COURSE_OUTCOMES),
            ("Map CO to PO", Permission.MAP_CO_TO_PO),
            ("Set Threshold Values", Permission.SET_THRESHOLD_VALUES),
            ("Attainment Calculations", Permission.ATTAINMENT_CALCULATIONS),
        ],
        "Analytics & Reports": [
            ("Performance Dashboards", Permission.PERFORMANCE_DASHBOARDS),
            ("Export Functionality", Permission.EXPORT_FUNCTIONALITY),
            ("Trend Analysis", Permission.TREND_ANALYSIS),
            ("Predictive Analytics", Permission.PREDICTIVE_ANALYTICS),
        ],
        "Bulk Operations": [
            ("Bulk User Upload", Permission.BULK_USER_UPLOAD),
            ("Bulk Marks Entry", Permission.BULK_MARKS_ENTRY),
            ("Bulk Question Import", Permission.BULK_QUESTION_IMPORT),
            ("Bulk Data Export", Permission.BULK_DATA_EXPORT),
        ],
        "Profile Management": [
            ("Update Personal Details", Permission.UPDATE_PERSONAL_DETAILS),
            ("Change Passwords", Permission.CHANGE_PASSWORDS),
            ("Manage Preferences", Permission.MANAGE_PREFERENCES),
            ("View Activity Logs", Permission.VIEW_ACTIVITY_LOGS),
        ],
        "Notifications": [
            ("Real-time Alerts", Permission.SEND_NOTIFICATIONS, Permission.RECEIVE_NOTIFICATIONS),
            ("Email Notifications", Permission.EMAIL_NOTIFICATIONS),
            ("SMS Integration", Permission.SMS_INTEGRATION),
            ("Push Notifications", Permission.PUSH_NOTIFICATIONS),
        ]
    }
    
    for category, permissions_list in categories.items():
        for permission_info in permissions_list:
            if isinstance(permission_info,, tuple):
                feature_name = permission_info[0]
                permissions = permission_info[1: ]
            else:
                feature_name = permission_info
                permissions = [permission_info]
            
            # Get permission levels for each role
            admin_level = "Full CRUD" if all(PermissionChecker.get_permission_level("admin",, p) != "no_access" for p in permissions) else "Limited"
            hod_level = "Dept Only" if any("dept" in, PermissionChecker.get_permission_level("hod",,, p) for p in permissions) else "Limited"
            teacher_level = "Assigned Only" if any("assigned" in, PermissionChecker.get_permission_level("teacher",,, p) for p in permissions) else "Limited"
            student_level = "View Only" if any("view" in, PermissionChecker.get_permission_level("student",,, p) for p in permissions) else "No Access"
            
            matrix_data.append([
                category,
                feature_name,
                admin_level,
                hod_level,
                teacher_level,
                student_level
          , ,, ])
    
    return matrix_data
