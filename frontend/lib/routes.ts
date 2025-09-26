// Route configuration for the LMS system
export interface RouteConfig {
  path: string
  title: string
  description?: string
  allowedRoles: string[]
  icon?: string
  isPublic?: boolean
  requiresAuth?: boolean
  children?: RouteConfig[]
}

export const ROUTES: RouteConfig[] = [
  {
    path: '/login',
    title: 'Login',
    description: 'User authentication',
    allowedRoles: [],
    isPublic: true,
    requiresAuth: false
  },
  {
    path: '/dashboard',
    title: 'Dashboard',
    description: 'Main dashboard',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true
  },
  {
    path: '/dashboard/users',
    title: 'Users Management',
    description: 'Manage system users',
    allowedRoles: ['admin'],
    requiresAuth: true
  },
  {
    path: '/dashboard/departments',
    title: 'Departments',
    description: 'Manage departments',
    allowedRoles: ['admin'],
    requiresAuth: true
  },
  {
    path: '/dashboard/semesters',
    title: 'Semesters',
    description: 'Manage academic semesters',
    allowedRoles: ['admin', 'hod'],
    requiresAuth: true
  },
  {
    path: '/dashboard/classes',
    title: 'Classes',
    description: 'Manage classes and sections',
    allowedRoles: ['admin', 'hod'],
    requiresAuth: true
  },
  {
    path: '/dashboard/subjects',
    title: 'Subjects',
    description: 'Manage subjects and courses',
    allowedRoles: ['admin', 'hod', 'teacher'],
    requiresAuth: true
  },
  {
    path: '/dashboard/exams',
    title: 'Exams',
    description: 'Manage examinations',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true,
    children: [
      {
        path: '/dashboard/exams/create',
        title: 'Create Exam',
        allowedRoles: ['admin', 'hod', 'teacher'],
        requiresAuth: true
      },
      {
        path: '/dashboard/exams/enhanced',
        title: 'Enhanced Exam Management',
        allowedRoles: ['admin', 'hod', 'teacher'],
        requiresAuth: true
      }
    ]
  },
  {
    path: '/dashboard/attendance',
    title: 'Attendance',
    description: 'Manage student attendance',
    allowedRoles: ['admin', 'hod', 'teacher'],
    requiresAuth: true
  },
  {
    path: '/dashboard/promotion',
    title: 'Student Promotion',
    description: 'Manage student academic progression',
    allowedRoles: ['admin', 'hod'],
    requiresAuth: true
  },
  {
    path: '/dashboard/questionbanks',
    title: 'Question Banks',
    description: 'Manage question banks',
    allowedRoles: ['admin', 'hod', 'teacher'],
    requiresAuth: true
  },
  {
    path: '/dashboard/files',
    title: 'Files',
    description: 'Manage file uploads',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true
  },
  {
    path: '/dashboard/notifications',
    title: 'Notifications',
    description: 'System notifications',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true
  },
  {
    path: '/dashboard/co-po',
    title: 'CO/PO Management',
    description: 'Course and Program Outcomes',
    allowedRoles: ['admin', 'hod', 'teacher'],
    requiresAuth: true
  },
  {
    path: '/dashboard/analytics',
    title: 'Analytics',
    description: 'System analytics and reports',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true
  },
  {
    path: '/dashboard/bulk',
    title: 'Bulk Operations',
    description: 'Bulk data operations',
    allowedRoles: ['admin', 'hod'],
    requiresAuth: true
  },
  {
    path: '/dashboard/reports',
    title: 'Reports',
    description: 'Generate system reports',
    allowedRoles: ['admin', 'hod', 'teacher'],
    requiresAuth: true
  },
  {
    path: '/dashboard/monitoring',
    title: 'System Monitoring',
    description: 'Monitor system health',
    allowedRoles: ['admin'],
    requiresAuth: true
  },
  {
    path: '/dashboard/marks',
    title: 'Marks Management',
    description: 'Manage student marks',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true
  },
  {
    path: '/dashboard/courses',
    title: 'My Courses',
    description: 'Student course view',
    allowedRoles: ['student'],
    requiresAuth: true
  },
  {
    path: '/dashboard/profile',
    title: 'Profile',
    description: 'User profile management',
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    requiresAuth: true
  }
]

// Helper functions for route management
export function getRouteConfig(path: string): RouteConfig | undefined {
  return ROUTES.find(route => route.path === path)
}

export function isRouteAllowed(path: string, userRole: string): boolean {
  const route = getRouteConfig(path)
  if (!route) return false
  
  if (route.isPublic) return true
  if (!route.requiresAuth) return true
  
  return route.allowedRoles.includes(userRole)
}

export function getRoutesForRole(role: string): RouteConfig[] {
  return ROUTES.filter(route => 
    route.isPublic || route.allowedRoles.includes(role)
  )
}

export function getDefaultRouteForRole(role: string): string {
  const roleRoutes = getRoutesForRole(role)
  const dashboardRoute = roleRoutes.find(route => route.path === '/dashboard')
  return dashboardRoute ? dashboardRoute.path : '/login'
}

// Route permissions
export const PERMISSIONS = {
  // Admin permissions
  ADMIN: {
    USERS_MANAGEMENT: 'admin',
    DEPARTMENTS_MANAGEMENT: 'admin',
    SYSTEM_MONITORING: 'admin',
    BULK_OPERATIONS: 'admin'
  },
  
  // HOD permissions
  HOD: {
    SEMESTERS_MANAGEMENT: ['admin', 'hod'],
    CLASSES_MANAGEMENT: ['admin', 'hod'],
    SUBJECTS_MANAGEMENT: ['admin', 'hod'],
    PROMOTION_MANAGEMENT: ['admin', 'hod'],
    CO_PO_MANAGEMENT: ['admin', 'hod'],
    REPORTS_GENERATION: ['admin', 'hod', 'teacher']
  },
  
  // Teacher permissions
  TEACHER: {
    ATTENDANCE_MANAGEMENT: ['admin', 'hod', 'teacher'],
    QUESTION_BANK_MANAGEMENT: ['admin', 'hod', 'teacher'],
    MARKS_MANAGEMENT: ['admin', 'hod', 'teacher'],
    EXAM_CREATION: ['admin', 'hod', 'teacher']
  },
  
  // Student permissions
  STUDENT: {
    VIEW_COURSES: 'student',
    VIEW_MARKS: 'student',
    VIEW_ATTENDANCE: 'student',
    PROFILE_MANAGEMENT: 'student'
  }
}

export function hasPermission(userRole: string, permission: string | string[]): boolean {
  if (Array.isArray(permission)) {
    return permission.includes(userRole)
  }
  return permission === userRole
}

