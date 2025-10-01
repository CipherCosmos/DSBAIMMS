// Route optimization and lazy loading utilities
import React, { ComponentType, lazy, Suspense, useState, useEffect } from 'react'
import { LazyWrapper } from '@/components/common'

export interface RouteConfig {
  path: string
  component: ComponentType<any>
  exact?: boolean
  preload?: boolean
  priority?: 'high' | 'medium' | 'low'
  cache?: boolean
  prefetch?: boolean
}

export interface RouteGroup {
  name: string
  routes: RouteConfig[]
  preload?: boolean
  priority?: 'high' | 'medium' | 'low'
}

// Route configurations with lazy loading
export const ROUTE_CONFIGS: RouteConfig[] = [
  // Public routes
  {
    path: '/',
    component: lazy(() => import('@/app/page').then(module => ({ default: module.default as any }))),
    exact: true,
    preload: true,
    priority: 'high',
    cache: true,
    prefetch: true,
  },
  {
    path: '/login',
    component: lazy(() => import('@/app/login/page')),
    exact: true,
    preload: true,
    priority: 'high',
    cache: true,
    prefetch: true,
  },

  // Dashboard routes
  {
    path: '/dashboard',
    component: lazy(() => import('@/app/dashboard/page')),
    exact: true,
    preload: true,
    priority: 'high',
    cache: true,
    prefetch: true,
  },

  // Admin routes
  {
    path: '/dashboard/users',
    component: lazy(() => import('@/app/dashboard/users/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/departments',
    component: lazy(() => import('@/app/dashboard/departments/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/analytics',
    component: lazy(() => import('@/app/dashboard/analytics/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },

  // HOD routes
  {
    path: '/dashboard/classes',
    component: lazy(() => import('@/app/dashboard/classes/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/subjects',
    component: lazy(() => import('@/app/dashboard/subjects/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/semesters',
    component: lazy(() => import('@/app/dashboard/semesters/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/promotion',
    component: lazy(() => import('@/app/dashboard/promotion/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },

  // Teacher routes
  {
    path: '/dashboard/exams',
    component: lazy(() => import('@/app/dashboard/exams/page')),
    preload: false,
    priority: 'high',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/marks',
    component: lazy(() => import('@/app/dashboard/marks/page')),
    preload: false,
    priority: 'high',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/co-po',
    component: lazy(() => import('@/app/dashboard/co-po/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },

  // Student routes
  {
    path: '/dashboard/profile',
    component: lazy(() => import('@/app/dashboard/profile/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },
  {
    path: '/dashboard/notifications',
    component: lazy(() => import('@/app/dashboard/notifications/page')),
    preload: false,
    priority: 'medium',
    cache: true,
    prefetch: true,
  },

  // Debug routes (development only)
  {
    path: '/debug',
    component: lazy(() => import('@/app/debug/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },
  {
    path: '/debug/state-management',
    component: lazy(() => import('@/app/debug/state-management/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },
  {
    path: '/debug/component-optimization',
    component: lazy(() => import('@/app/debug/component-optimization/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },
  {
    path: '/debug/error-handling',
    component: lazy(() => import('@/app/debug/error-handling/page')),
    preload: false,
    priority: 'low',
    cache: false,
    prefetch: false,
  },
]

// Route groups for better organization
export const ROUTE_GROUPS: RouteGroup[] = [
  {
    name: 'public',
    routes: ROUTE_CONFIGS.filter(route => 
      route.path === '/' || route.path === '/login'
    ),
    preload: true,
    priority: 'high',
  },
  {
    name: 'dashboard',
    routes: ROUTE_CONFIGS.filter(route => 
      route.path.startsWith('/dashboard') && !route.path.includes('/dashboard/')
    ),
    preload: true,
    priority: 'high',
  },
  {
    name: 'admin',
    routes: ROUTE_CONFIGS.filter(route => 
      ['/dashboard/users', '/dashboard/departments', '/dashboard/analytics', '/dashboard/monitoring', '/dashboard/bulk'].includes(route.path)
    ),
    preload: false,
    priority: 'medium',
  },
  {
    name: 'hod',
    routes: ROUTE_CONFIGS.filter(route => 
      ['/dashboard/classes', '/dashboard/subjects', '/dashboard/semesters', '/dashboard/promotion'].includes(route.path)
    ),
    preload: false,
    priority: 'medium',
  },
  {
    name: 'teacher',
    routes: ROUTE_CONFIGS.filter(route => 
      ['/dashboard/exams', '/dashboard/marks', '/dashboard/attendance', '/dashboard/questionbanks', '/dashboard/co-po'].includes(route.path)
    ),
    preload: false,
    priority: 'high',
  },
  {
    name: 'student',
    routes: ROUTE_CONFIGS.filter(route => 
      ['/dashboard/profile', '/dashboard/reports', '/dashboard/files', '/dashboard/notifications'].includes(route.path)
    ),
    preload: false,
    priority: 'medium',
  },
  {
    name: 'debug',
    routes: ROUTE_CONFIGS.filter(route => 
      route.path.startsWith('/debug')
    ),
    preload: false,
    priority: 'low',
  },
]

// Route optimization service
export class RouteOptimizationService {
  private static instance: RouteOptimizationService
  private preloadedRoutes: Set<string> = new Set()
  private routeCache: Map<string, ComponentType<any>> = new Map()
  private prefetchQueue: string[] = []
  private isPrefetching = false

  static getInstance(): RouteOptimizationService {
    if (!RouteOptimizationService.instance) {
      RouteOptimizationService.instance = new RouteOptimizationService()
    }
    return RouteOptimizationService.instance
  }

  // Preload route component
  async preloadRoute(path: string): Promise<void> {
    if (this.preloadedRoutes.has(path)) {
      return
    }

    const routeConfig = ROUTE_CONFIGS.find(route => route.path === path)
    if (!routeConfig) {
      console.warn(`Route not found: ${path}`)
      return
    }

    try {
      // Preload the component
      await routeConfig.component
      this.preloadedRoutes.add(path)
      
      // Cache if enabled
      if (routeConfig.cache) {
        this.routeCache.set(path, routeConfig.component)
      }

      console.log(`Preloaded route: ${path}`)
    } catch (error) {
      console.error(`Failed to preload route ${path}:`, error)
    }
  }

  // Preload route group
  async preloadRouteGroup(groupName: string): Promise<void> {
    const group = ROUTE_GROUPS.find(g => g.name === groupName)
    if (!group) {
      console.warn(`Route group not found: ${groupName}`)
      return
    }

    const preloadPromises = group.routes.map(route => this.preloadRoute(route.path))
    await Promise.all(preloadPromises)
    
    console.log(`Preloaded route group: ${groupName}`)
  }

  // Preload routes by priority
  async preloadByPriority(priority: 'high' | 'medium' | 'low'): Promise<void> {
    const routes = ROUTE_CONFIGS.filter(route => route.priority === priority)
    const preloadPromises = routes.map(route => this.preloadRoute(route.path))
    await Promise.all(preloadPromises)
    
    console.log(`Preloaded ${priority} priority routes`)
  }

  // Prefetch route on hover
  prefetchRoute(path: string): void {
    if (this.prefetchQueue.includes(path)) {
      return
    }

    this.prefetchQueue.push(path)
    this.processPrefetchQueue()
  }

  private async processPrefetchQueue(): Promise<void> {
    if (this.isPrefetching || this.prefetchQueue.length === 0) {
      return
    }

    this.isPrefetching = true

    while (this.prefetchQueue.length > 0) {
      const path = this.prefetchQueue.shift()!
      await this.preloadRoute(path)
    }

    this.isPrefetching = false
  }

  // Get route configuration
  getRouteConfig(path: string): RouteConfig | undefined {
    return ROUTE_CONFIGS.find(route => 
      route.exact ? route.path === path : path.startsWith(route.path)
    )
  }

  // Check if route is preloaded
  isRoutePreloaded(path: string): boolean {
    return this.preloadedRoutes.has(path)
  }

  // Get cached route component
  getCachedRoute(path: string): ComponentType<any> | undefined {
    return this.routeCache.get(path)
  }

  // Clear route cache
  clearCache(): void {
    this.routeCache.clear()
    this.preloadedRoutes.clear()
  }

  // Get preload statistics
  getPreloadStats(): {
    total: number
    preloaded: number
    cached: number
    percentage: number
  } {
    const total = ROUTE_CONFIGS.length
    const preloaded = this.preloadedRoutes.size
    const cached = this.routeCache.size
    
    return {
      total,
      preloaded,
      cached,
      percentage: total > 0 ? (preloaded / total) * 100 : 0,
    }
  }
}

// Route optimization utilities
export const routeOptimization = {
  // Preload route
  preloadRoute: (path: string) => {
    return RouteOptimizationService.getInstance().preloadRoute(path)
  },

  // Preload route group
  preloadRouteGroup: (groupName: string) => {
    return RouteOptimizationService.getInstance().preloadRouteGroup(groupName)
  },

  // Preload by priority
  preloadByPriority: (priority: 'high' | 'medium' | 'low') => {
    return RouteOptimizationService.getInstance().preloadByPriority(priority)
  },

  // Prefetch route
  prefetchRoute: (path: string) => {
    RouteOptimizationService.getInstance().prefetchRoute(path)
  },

  // Get route config
  getRouteConfig: (path: string) => {
    return RouteOptimizationService.getInstance().getRouteConfig(path)
  },

  // Check if preloaded
  isRoutePreloaded: (path: string) => {
    return RouteOptimizationService.getInstance().isRoutePreloaded(path)
  },

  // Get preload stats
  getPreloadStats: () => {
    return RouteOptimizationService.getInstance().getPreloadStats()
  },

  // Clear cache
  clearCache: () => {
    RouteOptimizationService.getInstance().clearCache()
  },
}

// Optimized route component
export function OptimizedRoute({ 
  path, 
  children 
}: { 
  path: string
  children: React.ReactNode 
}) {
  const routeConfig = routeOptimization.getRouteConfig(path)
  
  if (!routeConfig) {
    return <>{children}</>
  }

  // Prefetch on hover if enabled
  const handleMouseEnter = () => {
    if (routeConfig.prefetch) {
      routeOptimization.prefetchRoute(path)
    }
  }

  return (
    <div onMouseEnter={handleMouseEnter}>
      <LazyWrapper
        threshold={0.1}
        rootMargin="100px"
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }
        >
          {children}
        </Suspense>
      </LazyWrapper>
    </div>
  )
}

// Route preloader component
export function RoutePreloader({ 
  paths, 
  priority = 'medium' 
}: { 
  paths: string[]
  priority?: 'high' | 'medium' | 'low'
}) {
  const [preloaded, setPreloaded] = useState<string[]>([])
  const [isPreloading, setIsPreloading] = useState(false)

  useEffect(() => {
    const preloadRoutes = async () => {
      setIsPreloading(true)
      
      for (const path of paths) {
        try {
          await routeOptimization.preloadRoute(path)
          setPreloaded(prev => [...prev, path])
        } catch (error) {
          console.error(`Failed to preload ${path}:`, error)
        }
      }
      
      setIsPreloading(false)
    }

    preloadRoutes()
  }, [paths])

  return (
    <div className="hidden">
      {/* Hidden component for preloading */}
      {isPreloading && (
        <div className="text-xs text-gray-500">
          Preloading {paths.length} routes...
        </div>
      )}
    </div>
  )
}

// Initialize route optimization
if (typeof window !== 'undefined') {
  // Preload high priority routes on app start
  setTimeout(() => {
    routeOptimization.preloadByPriority('high')
  }, 1000)

  // Preload medium priority routes after 3 seconds
  setTimeout(() => {
    routeOptimization.preloadByPriority('medium')
  }, 3000)
}
