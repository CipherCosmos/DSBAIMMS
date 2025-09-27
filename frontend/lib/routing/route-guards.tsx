// Route guards and navigation utilities
import { useAuth } from '@/lib/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export interface RouteGuardConfig {
  requireAuth?: boolean
  requiredRoles?: string[]
  redirectTo?: string
  fallback?: React.ReactNode
  onUnauthorized?: () => void
  onAuthorized?: () => void
}

export interface RoutePermission {
  path: string
  roles: string[]
  permissions?: string[]
  requireAuth: boolean
}

// Route permissions configuration
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Public routes
  { path: '/', roles: ['admin', 'hod', 'teacher', 'student'], requireAuth: false },
  { path: '/login', roles: ['admin', 'hod', 'teacher', 'student'], requireAuth: false },
  
  // Admin only routes
  { path: '/dashboard', roles: ['admin'], requireAuth: true },
  { path: '/dashboard/users', roles: ['admin'], requireAuth: true },
  { path: '/dashboard/departments', roles: ['admin'], requireAuth: true },
  { path: '/dashboard/analytics', roles: ['admin'], requireAuth: true },
  { path: '/dashboard/monitoring', roles: ['admin'], requireAuth: true },
  { path: '/dashboard/bulk', roles: ['admin'], requireAuth: true },
  
  // HOD routes
  { path: '/dashboard/classes', roles: ['admin', 'hod'], requireAuth: true },
  { path: '/dashboard/subjects', roles: ['admin', 'hod'], requireAuth: true },
  { path: '/dashboard/semesters', roles: ['admin', 'hod'], requireAuth: true },
  { path: '/dashboard/promotion', roles: ['admin', 'hod'], requireAuth: true },
  
  // Teacher routes
  { path: '/dashboard/exams', roles: ['admin', 'hod', 'teacher'], requireAuth: true },
  { path: '/dashboard/marks', roles: ['admin', 'hod', 'teacher'], requireAuth: true },
  { path: '/dashboard/attendance', roles: ['admin', 'hod', 'teacher'], requireAuth: true },
  { path: '/dashboard/questionbanks', roles: ['admin', 'hod', 'teacher'], requireAuth: true },
  { path: '/dashboard/co-po', roles: ['admin', 'hod', 'teacher'], requireAuth: true },
  
  // Student routes
  { path: '/dashboard/profile', roles: ['admin', 'hod', 'teacher', 'student'], requireAuth: true },
  { path: '/dashboard/reports', roles: ['admin', 'hod', 'teacher', 'student'], requireAuth: true },
  { path: '/dashboard/files', roles: ['admin', 'hod', 'teacher', 'student'], requireAuth: true },
  { path: '/dashboard/notifications', roles: ['admin', 'hod', 'teacher', 'student'], requireAuth: true },
  
  // Debug routes (development only)
  { path: '/debug', roles: ['admin'], requireAuth: true },
  { path: '/debug/state-management', roles: ['admin'], requireAuth: true },
  { path: '/debug/component-optimization', roles: ['admin'], requireAuth: true },
  { path: '/debug/error-handling', roles: ['admin'], requireAuth: true },
  { path: '/debug/monitoring', roles: ['admin'], requireAuth: true },
]

// Route guard hook
export function useRouteGuard(config: RouteGuardConfig = {}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuthorization = async () => {
      setIsChecking(true)

      // Wait for auth to load
      if (isLoading) {
        return
      }

      // Check if authentication is required
      if (config.requireAuth && !user) {
        setIsAuthorized(false)
        setIsChecking(false)
        config.onUnauthorized?.()
        
        if (config.redirectTo) {
          router.push(config.redirectTo)
        } else {
          router.push('/login')
        }
        return
      }

      // Check role requirements
      if (config.requiredRoles && user) {
        const hasRequiredRole = config.requiredRoles.includes(user.role)
        if (!hasRequiredRole) {
          setIsAuthorized(false)
          setIsChecking(false)
          config.onUnauthorized?.()
          
          if (config.redirectTo) {
            router.push(config.redirectTo)
          } else {
            router.push('/dashboard')
          }
          return
        }
      }

      // User is authorized
      setIsAuthorized(true)
      setIsChecking(false)
      config.onAuthorized?.()
    }

    checkAuthorization()
  }, [user, isLoading, config, router])

  return {
    isAuthorized,
    isChecking,
    user,
  }
}

// Route permission checker
export function checkRoutePermission(path: string, userRole: string, isAuthenticated: boolean): boolean {
  const routePermission = ROUTE_PERMISSIONS.find(permission => 
    path.startsWith(permission.path) || path === permission.path
  )

  if (!routePermission) {
    // Default to requiring authentication for unknown routes
    return isAuthenticated
  }

  // Check authentication requirement
  if (routePermission.requireAuth && !isAuthenticated) {
    return false
  }

  // Check role requirement
  if (routePermission.roles && !routePermission.roles.includes(userRole)) {
    return false
  }

  return true
}

// Navigation guard hook
export function useNavigationGuard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const canNavigateTo = (path: string): boolean => {
    if (isLoading) return false
    
    return checkRoutePermission(path, user?.role || '', !!user)
  }

  const navigateTo = (path: string, options?: { replace?: boolean }) => {
    if (canNavigateTo(path)) {
      if (options?.replace) {
        router.replace(path)
      } else {
        router.push(path)
      }
      return true
    } else {
      // Redirect to appropriate page based on user role
      if (!user) {
        router.push('/login')
      } else {
        router.push('/dashboard')
      }
      return false
    }
  }

  const getDefaultRoute = (): string => {
    if (!user) return '/login'
    
    switch (user.role) {
      case 'admin':
        return '/dashboard'
      case 'hod':
        return '/dashboard/classes'
      case 'teacher':
        return '/dashboard/exams'
      case 'student':
        return '/dashboard/profile'
      default:
        return '/dashboard'
    }
  }

  return {
    canNavigateTo,
    navigateTo,
    getDefaultRoute,
    isAuthenticated: !!user,
    userRole: user?.role,
  }
}

// Route guard component
export function RouteGuard({ 
  children, 
  config = {} 
}: { 
  children: React.ReactNode
  config?: RouteGuardConfig 
}) {
  const { isAuthorized, isChecking } = useRouteGuard(config)

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isAuthorized === false) {
    if (config.fallback) {
      return <>{config.fallback}</>
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="mt-4 text-center">
            <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="mt-2 text-sm text-gray-500">
              You don&apos;t have permission to access this page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Protected route component
export function ProtectedRoute({ 
  children, 
  roles = [], 
  fallback 
}: { 
  children: React.ReactNode
  roles?: string[]
  fallback?: React.ReactNode
}) {
  return (
    <RouteGuard
      config={{
        requireAuth: true,
        requiredRoles: roles.length > 0 ? roles : undefined,
        fallback,
      }}
    >
      {children}
    </RouteGuard>
  )
}

// Public route component
export function PublicRoute({ 
  children, 
  redirectIfAuthenticated = false 
}: { 
  children: React.ReactNode
  redirectIfAuthenticated?: boolean
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && redirectIfAuthenticated) {
      // Redirect authenticated users to their default route
      const defaultRoute = getDefaultRouteForUser(user.role)
      router.push(defaultRoute)
    }
  }, [user, isLoading, redirectIfAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (user && redirectIfAuthenticated) {
    return null // Will redirect
  }

  return <>{children}</>
}

// Helper function to get default route for user
function getDefaultRouteForUser(role: string): string {
  switch (role) {
    case 'admin':
      return '/dashboard'
    case 'hod':
      return '/dashboard/classes'
    case 'teacher':
      return '/dashboard/exams'
    case 'student':
      return '/dashboard/profile'
    default:
      return '/dashboard'
  }
}

// Route validation utilities
export const routeUtils = {
  // Check if route exists
  isValidRoute: (path: string): boolean => {
    return ROUTE_PERMISSIONS.some(permission => 
      path.startsWith(permission.path) || path === permission.path
    )
  },

  // Get route permissions
  getRoutePermissions: (path: string): RoutePermission | undefined => {
    return ROUTE_PERMISSIONS.find(permission => 
      path.startsWith(permission.path) || path === permission.path
    )
  },

  // Get all routes for a role
  getRoutesForRole: (role: string): RoutePermission[] => {
    return ROUTE_PERMISSIONS.filter(permission => 
      permission.roles.includes(role)
    )
  },

  // Get navigation menu items for a role
  getNavigationItems: (role: string) => {
    const routes = routeUtils.getRoutesForRole(role)
    
    return routes
      .filter(route => route.requireAuth)
      .map(route => ({
        path: route.path,
        label: getRouteLabel(route.path),
        icon: getRouteIcon(route.path),
        roles: route.roles,
      }))
  },
}

// Helper function to get route label
function getRouteLabel(path: string): string {
  const labels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/users': 'Users',
    '/dashboard/departments': 'Departments',
    '/dashboard/classes': 'Classes',
    '/dashboard/subjects': 'Subjects',
    '/dashboard/semesters': 'Semesters',
    '/dashboard/exams': 'Exams',
    '/dashboard/marks': 'Marks',
    '/dashboard/attendance': 'Attendance',
    '/dashboard/analytics': 'Analytics',
    '/dashboard/reports': 'Reports',
    '/dashboard/files': 'Files',
    '/dashboard/notifications': 'Notifications',
    '/dashboard/monitoring': 'Monitoring',
    '/dashboard/bulk': 'Bulk Operations',
    '/dashboard/promotion': 'Promotion',
    '/dashboard/questionbanks': 'Question Banks',
    '/dashboard/co-po': 'CO-PO Management',
    '/dashboard/profile': 'Profile',
  }
  
  return labels[path] || path.split('/').pop() || 'Unknown'
}

// Helper function to get route icon
function getRouteIcon(path: string): string {
  const icons: Record<string, string> = {
    '/dashboard': 'Home',
    '/dashboard/users': 'Users',
    '/dashboard/departments': 'Building',
    '/dashboard/classes': 'BookOpen',
    '/dashboard/subjects': 'Book',
    '/dashboard/semesters': 'Calendar',
    '/dashboard/exams': 'FileText',
    '/dashboard/marks': 'CheckSquare',
    '/dashboard/attendance': 'UserCheck',
    '/dashboard/analytics': 'BarChart3',
    '/dashboard/reports': 'FileBarChart',
    '/dashboard/files': 'Folder',
    '/dashboard/notifications': 'Bell',
    '/dashboard/monitoring': 'Activity',
    '/dashboard/bulk': 'Upload',
    '/dashboard/promotion': 'TrendingUp',
    '/dashboard/questionbanks': 'Archive',
    '/dashboard/co-po': 'Target',
    '/dashboard/profile': 'User',
  }
  
  return icons[path] || 'File'
}
