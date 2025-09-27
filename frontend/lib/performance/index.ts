// Export all performance optimization utilities and services
export {
  UIPerformanceService,
  useUIPerformance,
  useRenderOptimization,
  useImageOptimization,
  useBundleOptimization as useUIBundleOptimization,
  useComponentCache,
  usePerformanceMonitoring,
  uiPerformanceUtils,
} from './ui-optimization'

export {
  CacheOptimizationService,
  useCacheOptimization,
  useComponentCache as useCacheComponentCache,
  useDataCache,
  useCachePerformance,
  cacheOptimizationUtils,
} from './cache-optimization'

export {
  BundleOptimizationService,
  useBundleOptimization,
  useBundlePreloading,
  useBundlePerformance,
  bundleOptimizationUtils,
} from './bundle-optimization'

// Import services first
import { UIPerformanceService, uiPerformanceUtils } from './ui-performance'
import { CacheOptimizationService, cacheOptimizationUtils } from './cache-optimization'
import { BundleOptimizationService, bundleOptimizationUtils } from './bundle-optimization'

// Combined performance service
export class PerformanceService {
  private static instance: PerformanceService
  private uiPerformance: UIPerformanceService
  private cacheOptimization: CacheOptimizationService
  private bundleOptimization: BundleOptimizationService

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService()
    }
    return PerformanceService.instance
  }

  constructor() {
    this.uiPerformance = UIPerformanceService.getInstance()
    this.cacheOptimization = CacheOptimizationService.getInstance()
    this.bundleOptimization = BundleOptimizationService.getInstance()
  }

  // UI Performance
  get ui() {
    return {
      cacheComponent: (key: string, component: any) => this.uiPerformance.cacheComponent(key, component),
      getCachedComponent: (key: string) => this.uiPerformance.getCachedComponent(key),
      startRender: (key: string) => this.uiPerformance.startRender(key),
      endRender: (key: string) => this.uiPerformance.endRender(key),
      optimizeImage: (src: string, options?: any) => this.uiPerformance.optimizeImage(src, options),
      preloadBundle: (bundleName: string) => this.uiPerformance.preloadBundle(bundleName),
      getPerformanceMetrics: () => this.uiPerformance.getPerformanceMetrics(),
      clearCache: () => this.uiPerformance.clearCache(),
      resetMetrics: () => this.uiPerformance.resetMetrics(),
    }
  }

  // Cache Optimization
  get cache() {
    return {
      setMemory: (key: string, value: any, ttl?: number) => this.cacheOptimization.setMemory(key, value, ttl),
      getMemory: (key: string) => this.cacheOptimization.getMemory(key),
      deleteMemory: (key: string) => this.cacheOptimization.deleteMemory(key),
      setLocalStorage: (key: string, value: any, ttl?: number) => this.cacheOptimization.setLocalStorage(key, value, ttl),
      getLocalStorage: (key: string) => this.cacheOptimization.getLocalStorage(key),
      deleteLocalStorage: (key: string) => this.cacheOptimization.deleteLocalStorage(key),
      setSessionStorage: (key: string, value: any, ttl?: number) => this.cacheOptimization.setSessionStorage(key, value, ttl),
      getSessionStorage: (key: string) => this.cacheOptimization.getSessionStorage(key),
      deleteSessionStorage: (key: string) => this.cacheOptimization.deleteSessionStorage(key),
      getStats: () => this.cacheOptimization.getStats(),
      clearAll: () => this.cacheOptimization.clearAll(),
      clearExpired: () => this.cacheOptimization.clearExpired(),
    }
  }

  // Bundle Optimization
  get bundle() {
    return {
      loadBundle: (bundleName: string, options?: any) => this.bundleOptimization.loadBundle(bundleName, options),
      preloadBundle: (bundleName: string, priority?: 'high' | 'medium' | 'low') => this.bundleOptimization.preloadBundle(bundleName, priority),
      preloadBundles: (bundles: any[]) => this.bundleOptimization.preloadBundles(bundles),
      optimizeBundle: (bundleName: string, options?: any) => this.bundleOptimization.optimizeBundle(bundleName, options),
      getStats: () => this.bundleOptimization.getStats(),
      clearCache: () => this.bundleOptimization.clearCache(),
      resetStats: () => this.bundleOptimization.resetStats(),
    }
  }

  // Combined utilities
  get utils() {
    return {
      // UI Performance utilities
      debounce: uiPerformanceUtils.debounce,
      throttle: uiPerformanceUtils.throttle,
      memoize: uiPerformanceUtils.memoize,
      batchUpdates: uiPerformanceUtils.batchUpdates,
      createIntersectionObserver: uiPerformanceUtils.createIntersectionObserver,
      createResizeObserver: uiPerformanceUtils.createResizeObserver,
      measurePerformance: uiPerformanceUtils.measurePerformance,
      getMemoryUsage: uiPerformanceUtils.getMemoryUsage,

      // Cache optimization utilities
      generateKey: cacheOptimizationUtils.generateKey,
      estimateSize: cacheOptimizationUtils.estimateSize,
      compress: cacheOptimizationUtils.compress,
      decompress: cacheOptimizationUtils.decompress,
      isValid: cacheOptimizationUtils.isValid,
      cleanup: cacheOptimizationUtils.cleanup,
      warmCache: cacheOptimizationUtils.warmCache,

      // Bundle optimization utilities
      estimateBundleSize: bundleOptimizationUtils.estimateSize,
      getCompressionRatio: bundleOptimizationUtils.getCompressionRatio,
      calculatePriority: bundleOptimizationUtils.calculatePriority,
      analyzeDependencies: bundleOptimizationUtils.analyzeDependencies,
      getLoadingStrategy: bundleOptimizationUtils.getLoadingStrategy,
      getOptimizationRecommendations: bundleOptimizationUtils.getOptimizationRecommendations,
    }
  }

  // Initialize performance optimization
  initialize(): void {
    // Preload critical bundles
    this.bundle.preloadBundle('core', 'high')
    this.bundle.preloadBundle('ui', 'high')
    this.bundle.preloadBundle('utils', 'medium')

    // Warm up caches
    this.cache.setMemory('app-initialized', true, 300000) // 5 minutes
    this.cache.setLocalStorage('user-preferences', {}, 86400000) // 24 hours

    // Set up performance monitoring
    if (typeof window !== 'undefined') {
      // Monitor memory usage
      setInterval(() => {
        const memoryUsage = this.utils.getMemoryUsage()
        if ((memoryUsage as any).percentage > 80) {
          console.warn('High memory usage detected:', memoryUsage)
          this.cache.clearExpired()
        }
      }, 30000) // Check every 30 seconds

      // Monitor bundle performance
      setInterval(() => {
        const bundleStats = this.bundle.getStats()
        if (bundleStats.failed > 0) {
          console.warn('Bundle loading failures detected:', bundleStats)
        }
      }, 60000) // Check every minute
    }
  }

  // Get comprehensive performance report
  getPerformanceReport(): {
    ui: any
    cache: any
    bundle: any
    summary: {
      totalOptimizations: number
      averagePerformance: number
      cacheEfficiency: number
      bundleEfficiency: number
    }
  } {
    const uiMetrics = this.ui.getPerformanceMetrics()
    const cacheStats = this.cache.getStats()
    const bundleStats = this.bundle.getStats()

    return {
      ui: uiMetrics,
      cache: cacheStats,
      bundle: bundleStats,
      summary: {
        totalOptimizations: uiMetrics.componentMounts + cacheStats.sets + bundleStats.loaded,
        averagePerformance: (uiMetrics.averageRenderTime + bundleStats.averageLoadTime) / 2,
        cacheEfficiency: cacheStats.hitRate,
        bundleEfficiency: bundleStats.loaded / (bundleStats.loaded + bundleStats.failed) * 100,
      },
    }
  }

  // Clear all performance data
  clearAllData(): void {
    this.ui.clearCache()
    this.cache.clearAll()
    this.bundle.clearCache()
  }

  // Reset all performance metrics
  resetAllMetrics(): void {
    this.ui.resetMetrics()
    this.bundle.resetStats()
  }
}

// Initialize performance service
if (typeof window !== 'undefined') {
  const performanceService = PerformanceService.getInstance()
  performanceService.initialize()
}
