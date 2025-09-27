// Export all routing utilities and components
export {
  useRouteGuard,
  useNavigationGuard,
  RouteGuard,
  ProtectedRoute,
  PublicRoute,
  checkRoutePermission,
  routeUtils,
  type RouteGuardConfig,
  type RoutePermission,
  ROUTE_PERMISSIONS,
} from './route-guards'

export {
  RouteOptimizationService,
  routeOptimization,
  OptimizedRoute,
  RoutePreloader,
  type RouteConfig,
  type RouteGroup,
  ROUTE_CONFIGS,
  ROUTE_GROUPS,
} from './route-optimization'

export {
  NavigationOptimizationService,
  NavigationPerformanceMonitor,
  useNavigationOptimization,
  NavigationProvider,
  navigationUtils,
  type NavigationItem,
  type NavigationConfig,
  type NavigationState,
  NAVIGATION_ITEMS,
} from './navigation-optimization'

// Import services first
import { RouteOptimizationService } from './route-optimization'
import { NavigationOptimizationService } from './navigation-optimization'
import { RoutingUtils } from './routing-utils'
import { MonitoringService } from '@/lib/monitoring'

// Combined routing service
export class RoutingService {
  private static instance: RoutingService
  private routeOptimization: RouteOptimizationService
  private navigationOptimization: NavigationOptimizationService
  // private navigationPerformance: NavigationPerformanceMonitor

  static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService()
    }
    return RoutingService.instance
  }

  constructor() {
    this.routeOptimization = RouteOptimizationService.getInstance()
    this.navigationOptimization = NavigationOptimizationService.getInstance()
    // this.navigationPerformance = NavigationPerformanceMonitor.getInstance()
  }

  // Route optimization
  get routes() {
    return {
      preload: (path: string) => this.routeOptimization.preloadRoute(path),
      preloadGroup: (groupName: string) => this.routeOptimization.preloadRouteGroup(groupName),
      preloadByPriority: (priority: 'high' | 'medium' | 'low') => this.routeOptimization.preloadByPriority(priority),
      prefetch: (path: string) => this.routeOptimization.prefetchRoute(path),
      getConfig: (path: string) => this.routeOptimization.getRouteConfig(path),
      isPreloaded: (path: string) => this.routeOptimization.isRoutePreloaded(path),
      getStats: () => this.routeOptimization.getPreloadStats(),
      clearCache: () => this.routeOptimization.clearCache(),
    }
  }

  // Navigation optimization
  get navigation() {
    return {
      addToHistory: (path: string) => this.navigationOptimization.addToHistory(path),
      getHistory: () => this.navigationOptimization.getHistory(),
      goBack: () => this.navigationOptimization.goBack(),
      setBreadcrumbs: (path: string) => this.navigationOptimization.setBreadcrumbs(path),
      getBreadcrumbs: () => this.navigationOptimization.getBreadcrumbs(),
      setActiveItem: (path: string) => this.navigationOptimization.setActiveItem(path),
      getActiveItem: () => this.navigationOptimization.getActiveItem(),
      setNavigating: (isNavigating: boolean) => this.navigationOptimization.setNavigating(isNavigating),
      getNavigating: () => this.navigationOptimization.getNavigating(),
      clear: () => this.navigationOptimization.clear(),
    }
  }

  // Performance monitoring
  get performance() {
    return {
      startNavigation: (path: string) => {
        // MonitoringService.getInstance().performance.startNavigation(path)
        console.log('Navigation started:', path)
      },
      endNavigation: (path: string) => {
        // MonitoringService.getInstance().performance.endNavigation(path)
        console.log('Navigation ended:', path)
      },
      getStats: () => {
        // return MonitoringService.getInstance().performance.getNavigationTimings()
        return []
      },
    }
  }

  // Combined utilities
  get utils() {
    return {
      // Route utilities
      getNavigationItems: (userRole: string) => RoutingUtils.getNavigationItems(userRole),
      getNavigationItem: (path: string) => RoutingUtils.getNavigationItem(path),
      isActivePath: (path: string, currentPath: string) => RoutingUtils.isActivePath(path, currentPath),
      getBreadcrumbLabels: (breadcrumbs: string[]) => RoutingUtils.getBreadcrumbLabels(breadcrumbs),
      getNavigationHierarchy: (userRole: string) => RoutingUtils.getNavigationHierarchy(userRole),
      getDefaultNavigationItem: (userRole: string) => RoutingUtils.getDefaultNavigationItem(userRole),
      validateNavigationPath: (path: string, userRole: string) => RoutingUtils.validateNavigationPath(path, userRole, true),
      
      // Route permission utilities
      checkRoutePermission: (path: string, userRole: string, isAuthenticated: boolean) => RoutingUtils.validateNavigationPath(path, userRole, isAuthenticated),
      getRoutePermissions: (path: string) => RoutingUtils.getRouteConfig(path),
      getRoutesForRole: (role: string) => RoutingUtils.getRoutesByRole(role),
      isValidRoute: (path: string) => RoutingUtils.routeExists(path),
      
      // Additional utilities
      getAllRoutes: () => RoutingUtils.getAllRoutes(),
      getRouteMetadata: (path: string) => RoutingUtils.getRouteMetadata(path),
      trackNavigation: (from: string, to: string, userRole: string) => RoutingUtils.trackNavigation(from, to, userRole),
    }
  }

  // Initialize routing
  initialize(): void {
    // Preload high priority routes
    this.routes.preloadByPriority('high')
    
    // Set up navigation performance monitoring
    if (typeof window !== 'undefined') {
      // Monitor navigation performance
      const originalPushState = history.pushState
      const originalReplaceState = history.replaceState
      
      history.pushState = function(...args) {
        const path = args[2] as string
        if (path) {
          RoutingService.getInstance().performance.startNavigation(path)
        }
        return originalPushState.apply(history, args)
      }
      
      history.replaceState = function(...args) {
        const path = args[2] as string
        if (path) {
          RoutingService.getInstance().performance.startNavigation(path)
        }
        return originalReplaceState.apply(history, args)
      }
    }
  }

  // Get comprehensive routing report
  getRoutingReport(): {
    routeOptimization: any
    navigationOptimization: any
    performance: any
    summary: {
      totalRoutes: number
      preloadedRoutes: number
      navigationHistory: number
      averageNavigationTime: number
    }
  } {
    const routeStats = this.routes.getStats()
    const navigationHistory = this.navigation.getHistory()
    const performanceStats = this.performance.getStats()
    
    return {
      routeOptimization: routeStats,
      navigationOptimization: {
        history: navigationHistory,
        breadcrumbs: this.navigation.getBreadcrumbs(),
        activeItem: this.navigation.getActiveItem(),
        isNavigating: this.navigation.getNavigating(),
      },
      performance: performanceStats,
      summary: {
        totalRoutes: 0, // ROUTE_CONFIGS.length,
        preloadedRoutes: routeStats.preloaded,
        navigationHistory: navigationHistory.length,
        averageNavigationTime: 0, // Performance stats not available
      },
    }
  }

  // Clear all routing data
  clearAllData(): void {
    this.routes.clearCache()
    this.navigation.clear()
  }
}

// Initialize routing service
if (typeof window !== 'undefined') {
  const routingService = RoutingService.getInstance()
  routingService.initialize()
}
