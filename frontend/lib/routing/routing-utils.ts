'use client'

import { ROUTE_CONFIGS } from './route-optimization'
import { checkRoutePermission } from './route-guards'
import { analyticsUtils } from '@/lib/monitoring'

// Navigation item interface
export interface NavigationItem {
  path: string
  label: string
  icon?: string
  children?: NavigationItem[]
  roles?: string[]
  requiresAuth?: boolean
}

// Navigation hierarchy for different user roles
const NAVIGATION_HIERARCHY: Record<string, NavigationItem[]> = {
  admin: [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      roles: ['admin'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/users',
      label: 'Users',
      icon: 'Users',
      roles: ['admin'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/departments',
      label: 'Departments',
      icon: 'Building',
      roles: ['admin'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/classes',
      label: 'Classes',
      icon: 'GraduationCap',
      roles: ['admin'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/subjects',
      label: 'Subjects',
      icon: 'BookOpen',
      roles: ['admin'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/semesters',
      label: 'Semesters',
      icon: 'Calendar',
      roles: ['admin'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/attendance',
      label: 'Attendance',
      icon: 'ClipboardCheck',
      roles: ['admin', 'teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/marks',
      label: 'Marks',
      icon: 'Award',
      roles: ['admin', 'teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/exams',
      label: 'Exams',
      icon: 'FileText',
      roles: ['admin', 'teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/reports',
      label: 'Reports',
      icon: 'BarChart3',
      roles: ['admin', 'hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/analytics',
      label: 'Analytics',
      icon: 'TrendingUp',
      roles: ['admin', 'hod'],
      requiresAuth: true,
    },
  ],
  hod: [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/departments',
      label: 'My Department',
      icon: 'Building',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/classes',
      label: 'Classes',
      icon: 'GraduationCap',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/subjects',
      label: 'Subjects',
      icon: 'BookOpen',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/attendance',
      label: 'Attendance',
      icon: 'ClipboardCheck',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/marks',
      label: 'Marks',
      icon: 'Award',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/reports',
      label: 'Reports',
      icon: 'BarChart3',
      roles: ['hod'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/analytics',
      label: 'Analytics',
      icon: 'TrendingUp',
      roles: ['hod'],
      requiresAuth: true,
    },
  ],
  teacher: [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      roles: ['teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/classes',
      label: 'My Classes',
      icon: 'GraduationCap',
      roles: ['teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/subjects',
      label: 'My Subjects',
      icon: 'BookOpen',
      roles: ['teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/attendance',
      label: 'Attendance',
      icon: 'ClipboardCheck',
      roles: ['teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/marks',
      label: 'Marks',
      icon: 'Award',
      roles: ['teacher'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/exams',
      label: 'Exams',
      icon: 'FileText',
      roles: ['teacher'],
      requiresAuth: true,
    },
  ],
  student: [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      roles: ['student'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/attendance',
      label: 'My Attendance',
      icon: 'ClipboardCheck',
      roles: ['student'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/marks',
      label: 'My Marks',
      icon: 'Award',
      roles: ['student'],
      requiresAuth: true,
    },
    {
      path: '/dashboard/exams',
      label: 'Exams',
      icon: 'FileText',
      roles: ['student'],
      requiresAuth: true,
    },
  ],
}

// Breadcrumb labels mapping
const BREADCRUMB_LABELS: Record<string, string> = {
  '/': 'Home',
  '/login': 'Login',
  '/dashboard': 'Dashboard',
  '/dashboard/users': 'Users',
  '/dashboard/departments': 'Departments',
  '/dashboard/classes': 'Classes',
  '/dashboard/subjects': 'Subjects',
  '/dashboard/semesters': 'Semesters',
  '/dashboard/attendance': 'Attendance',
  '/dashboard/marks': 'Marks',
  '/dashboard/exams': 'Exams',
  '/dashboard/reports': 'Reports',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/files': 'Files',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/profile': 'Profile',
  '/dashboard/promotion': 'Promotion',
  '/dashboard/questionbanks': 'Question Banks',
  '/dashboard/co-po': 'CO/PO Management',
  '/dashboard/bulk': 'Bulk Operations',
  '/dashboard/monitoring': 'System Monitoring',
}

// Navigation utilities
export class RoutingUtils {
  // Get navigation items for a user role
  static getNavigationItems(userRole: string): NavigationItem[] {
    const items = NAVIGATION_HIERARCHY[userRole] || []
    
    // Filter items based on user role and authentication
    return items.filter(item => {
      if (item.requiresAuth && !this.isAuthenticated()) return false
      if (item.roles && !item.roles.includes(userRole)) return false
      return true
    })
  }

  // Get a specific navigation item by path
  static getNavigationItem(path: string): NavigationItem | null {
    for (const role in NAVIGATION_HIERARCHY) {
      const items = NAVIGATION_HIERARCHY[role]
      const item = this.findNavigationItem(items, path)
      if (item) return item
    }
    return null
  }

  // Find navigation item recursively
  private static findNavigationItem(items: NavigationItem[], path: string): NavigationItem | null {
    for (const item of items) {
      if (item.path === path) return item
      if (item.children) {
        const found = this.findNavigationItem(item.children, path)
        if (found) return found
      }
    }
    return null
  }

  // Check if a path is active
  static isActivePath(path: string, currentPath: string): boolean {
    if (path === currentPath) return true
    if (path === '/' && currentPath !== '/') return false
    return currentPath.startsWith(path + '/')
  }

  // Get breadcrumb labels
  static getBreadcrumbLabels(breadcrumbs: string[]): string[] {
    return breadcrumbs.map(path => BREADCRUMB_LABELS[path] || path)
  }

  // Get navigation hierarchy for a user role
  static getNavigationHierarchy(userRole: string): NavigationItem[] {
    return this.getNavigationItems(userRole)
  }

  // Get default navigation item for a user role
  static getDefaultNavigationItem(userRole: string): NavigationItem | null {
    const items = this.getNavigationItems(userRole)
    return items.length > 0 ? items[0] : null
  }

  // Validate navigation path
  static validateNavigationPath(path: string, userRole: string, isAuthenticated: boolean): boolean {
    return checkRoutePermission(path, userRole, isAuthenticated)
  }

  // Check if user is authenticated
  private static isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('auth_token') !== null
  }

  // Get route configuration
  static getRouteConfig(path: string) {
    return ROUTE_CONFIGS.find(config => config.path === path)
  }

  // Track navigation analytics
  static trackNavigation(from: string, to: string, userRole: string) {
    analyticsUtils.trackAction('navigate', 'navigation', {
      from,
      to,
      userRole,
      timestamp: new Date().toISOString(),
    })
  }

  // Get all available routes
  static getAllRoutes(): string[] {
    return ROUTE_CONFIGS.map(config => config.path)
  }

  // Get routes by role
  static getRoutesByRole(userRole: string): string[] {
    const items = this.getNavigationItems(userRole)
    return items.map(item => item.path)
  }

  // Check if route exists
  static routeExists(path: string): boolean {
    return ROUTE_CONFIGS.some(config => config.path === path)
  }

  // Get route metadata
  static getRouteMetadata(path: string) {
    const config = this.getRouteConfig(path)
    if (!config) return null

    return {
      path: config.path,
      preload: config.preload,
      priority: config.priority,
      // delay: config.delay, // Not available in RouteConfig
      // fallback: config.fallback, // Not available in RouteConfig
    }
  }
}
