// Navigation optimization and routing utilities
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { analyticsUtils } from '@/lib/monitoring'

export interface NavigationItem {
  path: string
  label: string
  icon: string
  roles: string[]
  children?: NavigationItem[]
  badge?: string | number
  disabled?: boolean
}

export interface NavigationConfig {
  items: NavigationItem[]
  userRole: string
  currentPath: string
}

export interface NavigationState {
  isNavigating: boolean
  navigationHistory: string[]
  breadcrumbs: string[]
  activeItem: string | null
}

// Navigation items configuration
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'Home',
    roles: ['admin', 'hod', 'teacher', 'student'],
  },
  {
    path: '/dashboard/users',
    label: 'Users',
    icon: 'Users',
    roles: ['admin'],
  },
  {
    path: '/dashboard/departments',
    label: 'Departments',
    icon: 'Building',
    roles: ['admin'],
  },
  {
    path: '/dashboard/classes',
    label: 'Classes',
    icon: 'BookOpen',
    roles: ['admin', 'hod'],
  },
  {
    path: '/dashboard/subjects',
    label: 'Subjects',
    icon: 'Book',
    roles: ['admin', 'hod'],
  },
  {
    path: '/dashboard/semesters',
    label: 'Semesters',
    icon: 'Calendar',
    roles: ['admin', 'hod'],
  },
  {
    path: '/dashboard/exams',
    label: 'Exams',
    icon: 'FileText',
    roles: ['admin', 'hod', 'teacher'],
  },
  {
    path: '/dashboard/marks',
    label: 'Marks',
    icon: 'CheckSquare',
    roles: ['admin', 'hod', 'teacher'],
  },
  {
    path: '/dashboard/attendance',
    label: 'Attendance',
    icon: 'UserCheck',
    roles: ['admin', 'hod', 'teacher'],
  },
  {
    path: '/dashboard/analytics',
    label: 'Analytics',
    icon: 'BarChart3',
    roles: ['admin'],
  },
  {
    path: '/dashboard/reports',
    label: 'Reports',
    icon: 'FileBarChart',
    roles: ['admin', 'hod', 'teacher', 'student'],
  },
  {
    path: '/dashboard/files',
    label: 'Files',
    icon: 'Folder',
    roles: ['admin', 'hod', 'teacher', 'student'],
  },
  {
    path: '/dashboard/notifications',
    label: 'Notifications',
    icon: 'Bell',
    roles: ['admin', 'hod', 'teacher', 'student'],
  },
  {
    path: '/dashboard/monitoring',
    label: 'Monitoring',
    icon: 'Activity',
    roles: ['admin'],
  },
  {
    path: '/dashboard/bulk',
    label: 'Bulk Operations',
    icon: 'Upload',
    roles: ['admin'],
  },
  {
    path: '/dashboard/promotion',
    label: 'Promotion',
    icon: 'TrendingUp',
    roles: ['admin', 'hod'],
  },
  {
    path: '/dashboard/questionbanks',
    label: 'Question Banks',
    icon: 'Archive',
    roles: ['admin', 'hod', 'teacher'],
  },
  {
    path: '/dashboard/co-po',
    label: 'CO-PO Management',
    icon: 'Target',
    roles: ['admin', 'hod', 'teacher'],
  },
  {
    path: '/dashboard/profile',
    label: 'Profile',
    icon: 'User',
    roles: ['admin', 'hod', 'teacher', 'student'],
  },
]

// Navigation optimization service
export class NavigationOptimizationService {
  private static instance: NavigationOptimizationService
  private navigationHistory: string[] = []
  private maxHistorySize = 50
  private breadcrumbs: string[] = []
  private activeItem: string | null = null
  private isNavigating = false

  static getInstance(): NavigationOptimizationService {
    if (!NavigationOptimizationService.instance) {
      NavigationOptimizationService.instance = new NavigationOptimizationService()
    }
    return NavigationOptimizationService.instance
  }

  // Add to navigation history
  addToHistory(path: string): void {
    if (this.navigationHistory[this.navigationHistory.length - 1] !== path) {
      this.navigationHistory.push(path)
      
      // Limit history size
      if (this.navigationHistory.length > this.maxHistorySize) {
        this.navigationHistory = this.navigationHistory.slice(-this.maxHistorySize)
      }
    }
  }

  // Get navigation history
  getHistory(): string[] {
    return [...this.navigationHistory]
  }

  // Go back in history
  goBack(): string | null {
    if (this.navigationHistory.length > 1) {
      this.navigationHistory.pop() // Remove current
      const previousPath = this.navigationHistory[this.navigationHistory.length - 1]
      return previousPath
    }
    return null
  }

  // Set breadcrumbs
  setBreadcrumbs(path: string): void {
    const pathSegments = path.split('/').filter(Boolean)
    this.breadcrumbs = pathSegments.map((segment, index) => {
      const fullPath = '/' + pathSegments.slice(0, index + 1).join('/')
      return fullPath
    })
  }

  // Get breadcrumbs
  getBreadcrumbs(): string[] {
    return [...this.breadcrumbs]
  }

  // Set active navigation item
  setActiveItem(path: string): void {
    this.activeItem = path
  }

  // Get active navigation item
  getActiveItem(): string | null {
    return this.activeItem
  }

  // Set navigation state
  setNavigating(isNavigating: boolean): void {
    this.isNavigating = isNavigating
  }

  // Get navigation state
  getNavigating(): boolean {
    return this.isNavigating
  }

  // Clear navigation data
  clear(): void {
    this.navigationHistory = []
    this.breadcrumbs = []
    this.activeItem = null
    this.isNavigating = false
  }
}

// Navigation hook
export function useNavigationOptimization() {
  const router = useRouter()
  const pathname = usePathname()
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    navigationHistory: [],
    breadcrumbs: [],
    activeItem: null,
  })

  const navigationService = NavigationOptimizationService.getInstance()

  // Optimized navigation function
  const navigateTo = useCallback(async (path: string, options?: { replace?: boolean; prefetch?: boolean }) => {
    if (navigationState.isNavigating) {
      return
    }

    setNavigationState(prev => ({ ...prev, isNavigating: true }))
    navigationService.setNavigating(true)

    try {
      // Track navigation analytics
      analyticsUtils.trackAction('navigate', 'navigation', {
        from: pathname,
        to: path,
        method: options?.replace ? 'replace' : 'push',
      })

      // Prefetch if enabled
      if (options?.prefetch) {
        // This would trigger route preloading
        console.log(`Prefetching route: ${path}`)
      }

      // Navigate
      if (options?.replace) {
        router.replace(path)
      } else {
        router.push(path)
      }

      // Update navigation state
      navigationService.addToHistory(path)
      navigationService.setBreadcrumbs(path)
      navigationService.setActiveItem(path)

      setNavigationState({
        isNavigating: false,
        navigationHistory: navigationService.getHistory(),
        breadcrumbs: navigationService.getBreadcrumbs(),
        activeItem: path,
      })

    } catch (error) {
      console.error('Navigation error:', error)
      setNavigationState(prev => ({ ...prev, isNavigating: false }))
      navigationService.setNavigating(false)
    }
  }, [router, pathname, navigationState.isNavigating, navigationService])

  // Go back function
  const goBack = useCallback(() => {
    const previousPath = navigationService.goBack()
    if (previousPath) {
      router.push(previousPath)
      navigationService.setBreadcrumbs(previousPath)
      navigationService.setActiveItem(previousPath)
      
      setNavigationState({
        isNavigating: false,
        navigationHistory: navigationService.getHistory(),
        breadcrumbs: navigationService.getBreadcrumbs(),
        activeItem: previousPath,
      })
    }
  }, [router, navigationService])

  // Update state when pathname changes
  useEffect(() => {
    navigationService.addToHistory(pathname)
    navigationService.setBreadcrumbs(pathname)
    navigationService.setActiveItem(pathname)
    
    setNavigationState({
      isNavigating: false,
      navigationHistory: navigationService.getHistory(),
      breadcrumbs: navigationService.getBreadcrumbs(),
      activeItem: pathname,
    })
  }, [pathname, navigationService])

  return {
    navigateTo,
    goBack,
    isNavigating: navigationState.isNavigating,
    navigationHistory: navigationState.navigationHistory,
    breadcrumbs: navigationState.breadcrumbs,
    activeItem: navigationState.activeItem,
  }
}

// Navigation utilities
export const navigationUtils = {
  // Get navigation items for role
  getNavigationItems: (userRole: string): NavigationItem[] => {
    return NAVIGATION_ITEMS.filter(item => item.roles.includes(userRole))
  },

  // Get navigation item by path
  getNavigationItem: (path: string): NavigationItem | undefined => {
    return NAVIGATION_ITEMS.find(item => item.path === path)
  },

  // Check if path is active
  isActivePath: (path: string, currentPath: string): boolean => {
    if (path === currentPath) return true
    if (path !== '/dashboard' && currentPath.startsWith(path)) return true
    return false
  },

  // Get breadcrumb labels
  getBreadcrumbLabels: (breadcrumbs: string[]): string[] => {
    return breadcrumbs.map(path => {
      const item = navigationUtils.getNavigationItem(path)
      return item ? item.label : path.split('/').pop() || 'Unknown'
    })
  },

  // Get navigation hierarchy
  getNavigationHierarchy: (userRole: string) => {
    const items = navigationUtils.getNavigationItems(userRole)
    
    // Group items by category
    const categories = {
      main: items.filter(item => 
        ['/dashboard', '/dashboard/profile', '/dashboard/notifications'].includes(item.path)
      ),
      management: items.filter(item => 
        ['/dashboard/users', '/dashboard/departments', '/dashboard/classes', '/dashboard/subjects', '/dashboard/semesters'].includes(item.path)
      ),
      academic: items.filter(item => 
        ['/dashboard/exams', '/dashboard/marks', '/dashboard/attendance', '/dashboard/questionbanks', '/dashboard/co-po'].includes(item.path)
      ),
      analytics: items.filter(item => 
        ['/dashboard/analytics', '/dashboard/reports', '/dashboard/monitoring'].includes(item.path)
      ),
      tools: items.filter(item => 
        ['/dashboard/files', '/dashboard/bulk', '/dashboard/promotion'].includes(item.path)
      ),
    }

    return categories
  },

  // Get default navigation item for role
  getDefaultNavigationItem: (userRole: string): NavigationItem | undefined => {
    const defaults = {
      admin: '/dashboard',
      hod: '/dashboard/classes',
      teacher: '/dashboard/exams',
      student: '/dashboard/profile',
    }

    const defaultPath = defaults[userRole as keyof typeof defaults]
    return navigationUtils.getNavigationItem(defaultPath)
  },

  // Validate navigation path
  validateNavigationPath: (path: string, userRole: string): boolean => {
    const item = navigationUtils.getNavigationItem(path)
    return item ? item.roles.includes(userRole) : false
  },
}

// Navigation context provider
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { navigateTo, goBack, isNavigating, navigationHistory, breadcrumbs, activeItem } = useNavigationOptimization()

  return (
    <div className="navigation-context">
      {children}
    </div>
  )
}

// Navigation performance monitoring
export class NavigationPerformanceMonitor {
  private static instance: NavigationPerformanceMonitor
  private navigationTimes: Map<string, number> = new Map()
  private startTime: number = 0

  static getInstance(): NavigationPerformanceMonitor {
    if (!NavigationPerformanceMonitor.instance) {
      NavigationPerformanceMonitor.instance = new NavigationPerformanceMonitor()
    }
    return NavigationPerformanceMonitor.instance
  }

  // Start navigation timing
  startNavigation(path: string): void {
    this.startTime = performance.now()
    this.navigationTimes.set(path, this.startTime)
  }

  // End navigation timing
  endNavigation(path: string): number {
    const endTime = performance.now()
    const startTime = this.navigationTimes.get(path) || this.startTime
    const duration = endTime - startTime

    // Track navigation performance
    analyticsUtils.trackPerformance('navigation', duration, {
      path,
      duration,
    })

    return duration
  }

  // Get navigation performance stats
  getPerformanceStats(): {
    averageTime: number
    totalNavigations: number
    slowestNavigation: { path: string; time: number }
  } {
    const times = Array.from(this.navigationTimes.values())
    const averageTime = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0
    const totalNavigations = times.length
    const slowestNavigation = times.length > 0 ? {
      path: Array.from(this.navigationTimes.keys())[times.indexOf(Math.max(...times))],
      time: Math.max(...times)
    } : { path: '', time: 0 }

    return {
      averageTime,
      totalNavigations,
      slowestNavigation,
    }
  }
}

// Initialize navigation optimization
if (typeof window !== 'undefined') {
  NavigationOptimizationService.getInstance()
  NavigationPerformanceMonitor.getInstance()
}
