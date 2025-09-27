// Export all monitoring services and utilities
export {
  PerformanceMonitorService,
  performanceUtils,
  type PerformanceMetric,
  type WebVitalsMetric,
  type PerformanceReport,
  type PerformanceThresholds,
  DEFAULT_THRESHOLDS,
} from './performance-monitor'

export {
  AnalyticsService,
  analyticsUtils,
  type AnalyticsEvent,
  type UserSession,
  type PageView,
  type FeatureUsage,
} from './analytics'

export {
  ErrorTrackingService,
  errorTrackingUtils,
  type ErrorEvent,
  type ErrorStats,
  type ErrorTrend,
} from './error-tracking'

// Import services first
import { PerformanceMonitorService, performanceUtils } from './performance-monitor'
import { AnalyticsService, analyticsUtils } from './analytics'
import { ErrorTrackingService, errorTrackingUtils } from './error-tracking'

// Combined monitoring service
export class MonitoringService {
  private static instance: MonitoringService
  private performanceMonitor: PerformanceMonitorService
  private analyticsService: AnalyticsService
  private errorTrackingService: ErrorTrackingService

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  constructor() {
    this.performanceMonitor = PerformanceMonitorService.getInstance()
    this.analyticsService = AnalyticsService.getInstance()
    this.errorTrackingService = ErrorTrackingService.getInstance()
  }

  // Performance monitoring
  get performance() {
    return {
      recordMetric: (metric: any) => this.performanceMonitor.recordMetric(metric),
      generateReport: () => this.performanceMonitor.generateReport(),
      getReports: () => this.performanceMonitor.getReports(),
      getMetrics: () => this.performanceMonitor.getMetrics(),
      getSummary: () => performanceUtils.getSummary(),
      measure: performanceUtils.measure,
      measureRender: performanceUtils.measureRender,
    }
  }

  // Analytics
  get analytics() {
    return {
      trackEvent: (category: string, action: string, name: string, label?: string, value?: number, properties?: Record<string, any>) => 
        this.analyticsService.trackEvent(category, action, name, label, properties),
      getEvents: (category?: string, action?: string, limit?: number) => 
        this.analyticsService.getEvents(category, action, limit),
      getSessions: (limit?: number) => this.analyticsService.getSessions(limit),
      getPageViews: (limit?: number) => this.analyticsService.getPageViews(limit),
      getFeatureUsage: () => this.analyticsService.getFeatureUsage(),
      getTopFeatures: (limit?: number) => this.analyticsService.getTopFeatures(limit),
      getSummary: () => analyticsUtils.getSummary(),
      trackFeature: analyticsUtils.trackFeature,
      trackAction: analyticsUtils.trackAction,
      trackPage: analyticsUtils.trackPage,
      trackError: analyticsUtils.trackError,
      trackPerformance: analyticsUtils.trackPerformance,
    }
  }

  // Error tracking
  get errors() {
    return {
      trackError: (error: Error, context: string, metadata?: Record<string, any>) => 
        this.errorTrackingService.trackError(error, context, metadata),
      resolveError: (errorId: string, resolution: string) => 
        this.errorTrackingService.resolveError(errorId, resolution),
      getStats: () => this.errorTrackingService.getErrorStats(),
      getTrends: (days?: number) => this.errorTrackingService.getErrorTrends(days),
      getRecent: (hours?: number, limit?: number) => 
        this.errorTrackingService.getRecentErrors(hours, limit),
      getUnresolved: (limit?: number) => this.errorTrackingService.getUnresolvedErrors(limit),
      getPatterns: () => this.errorTrackingService.getErrorPatterns(),
    }
  }

  // Combined reporting
  generateCombinedReport() {
    return {
      timestamp: new Date(),
      performance: this.performanceMonitor.generateReport(),
      analytics: this.analyticsService.exportData(),
      errors: this.errorTrackingService.exportData(),
      summary: {
        performance: performanceUtils.getSummary(),
        analytics: analyticsUtils.getSummary(),
        errors: this.errorTrackingService.getErrorStats(),
      },
    }
  }

  // Clear all data
  clearAllData() {
    this.performanceMonitor.clearData()
    this.analyticsService.clearData()
    this.errorTrackingService.clearData()
  }

  // Export all data
  exportAllData() {
    return {
      performance: {
        reports: this.performanceMonitor.getReports(),
        metrics: this.performanceMonitor.getMetrics(),
      },
      analytics: this.analyticsService.exportData(),
      errors: this.errorTrackingService.exportData(),
    }
  }
}

// Initialize monitoring service
if (typeof window !== 'undefined') {
  MonitoringService.getInstance()
}
