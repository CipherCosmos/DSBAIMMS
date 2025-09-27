// Error tracking and monitoring
import { ErrorReportingService } from '@/lib/error-handling'

export interface ErrorEvent {
  id: string
  error: Error
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'network' | 'validation' | 'authentication' | 'authorization' | 'server' | 'client' | 'unknown'
  context: string
  user: {
    id?: string
    role?: string
    sessionId?: string
  }
  environment: {
    userAgent: string
    url: string
    referrer?: string
    viewport: { width: number; height: number }
  }
  stack: string
  metadata: Record<string, any>
  resolved: boolean
  resolvedAt?: Date
  resolution?: string
}

export interface ErrorStats {
  total: number
  byCategory: Record<string, number>
  bySeverity: Record<string, number>
  byContext: Record<string, number>
  resolved: number
  unresolved: number
  resolutionRate: number
  averageResolutionTime: number
  topErrors: Array<{
    error: string
    count: number
    lastOccurrence: Date
    severity: string
  }>
}

export interface ErrorTrend {
  date: string
  count: number
  resolved: number
  severity: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

// Error tracking service
export class ErrorTrackingService {
  private static instance: ErrorTrackingService
  private errors: ErrorEvent[] = []
  private maxErrors = 500
  private errorPatterns: Map<string, number> = new Map()
  private errorThresholds: Map<string, number> = new Map()

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService()
    }
    return ErrorTrackingService.instance
  }

  constructor() {
    this.initializeErrorTracking()
  }

  private initializeErrorTracking(): void {
    if (typeof window === 'undefined') return

    // Set up error thresholds
    this.setupErrorThresholds()
    
    // Monitor for new errors
    this.monitorErrors()
    
    // Set up error pattern detection
    this.setupErrorPatternDetection()
  }

  private setupErrorThresholds(): void {
    // Set thresholds for different error types
    this.errorThresholds.set('network', 10) // 10 network errors per hour
    this.errorThresholds.set('authentication', 5) // 5 auth errors per hour
    this.errorThresholds.set('validation', 20) // 20 validation errors per hour
    this.errorThresholds.set('server', 3) // 3 server errors per hour
    this.errorThresholds.set('client', 15) // 15 client errors per hour
  }

  private monitorErrors(): void {
    // Monitor unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      this.trackError(error, 'unhandledrejection', {
        type: 'unhandledrejection',
        reason: event.reason,
      })
    })

    // Monitor global errors
    window.addEventListener('error', (event) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message)
      this.trackError(error, 'global', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'global',
      })
    })

    // Monitor chunk load errors
    window.addEventListener('error', (event) => {
      if (event.target && (event.target as any).tagName === 'SCRIPT') {
        const error = new Error('Failed to load script chunk')
        error.name = 'ChunkLoadError'
        this.trackError(error, 'chunk-load', {
          src: (event.target as any).src,
          type: 'chunk-load',
        })
      }
    })

    // Monitor resource load errors
    window.addEventListener('error', (event) => {
      if (event.target && (event.target as any).tagName === 'IMG') {
        const error = new Error('Failed to load image')
        error.name = 'ImageLoadError'
        this.trackError(error, 'resource-load', {
          src: (event.target as any).src,
          type: 'image-load',
        })
      }
    })
  }

  private setupErrorPatternDetection(): void {
    // Monitor for error patterns and alert on thresholds
    setInterval(() => {
      this.checkErrorThresholds()
    }, 60000) // Check every minute
  }

  private checkErrorThresholds(): void {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    // Get errors from the last hour
    const recentErrors = this.errors.filter(error => error.timestamp > oneHourAgo)
    
    // Group by category
    const errorsByCategory = recentErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Check thresholds
    Object.entries(errorsByCategory).forEach(([category, count]) => {
      const threshold = this.errorThresholds.get(category)
      if (threshold && count > threshold) {
        console.warn(`Error threshold exceeded for ${category}:`, {
          count,
          threshold,
          timeWindow: '1 hour',
        })
        
        // In a real application, you would send an alert
        // this.sendAlert(category, count, threshold)
      }
    })
  }

  // Public methods
  trackError(
    error: Error,
    context: string,
    metadata: Record<string, any> = {}
  ): string {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Classify error
    const classification = this.classifyError(error)
    
    // Create error event
    const errorEvent: ErrorEvent = {
      id: errorId,
      error,
      timestamp: new Date(),
      severity: classification.severity,
      category: classification.category,
      context,
      user: {
        // This would be populated from your auth system
        id: undefined,
        role: undefined,
        sessionId: undefined,
      },
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
      stack: error.stack || '',
      metadata,
      resolved: false,
    }

    // Store error
    this.errors.unshift(errorEvent)
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }

    // Update error patterns
    this.updateErrorPatterns(error, context)

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error tracked:', errorEvent)
    }

    // Send to external error tracking service
    this.sendToExternalService(errorEvent)

    return errorId
  }

  private classifyError(error: Error): { category: 'network' | 'validation' | 'authentication' | 'authorization' | 'server' | 'client' | 'unknown'; severity: 'low' | 'medium' | 'high' | 'critical' } {
    // Network errors
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return { category: 'network', severity: 'medium' }
    }

    // Authentication errors
    if (error.name === 'AuthenticationError' || error.message.includes('unauthorized')) {
      return { category: 'authentication', severity: 'high' }
    }

    // Authorization errors
    if (error.name === 'AuthorizationError' || error.message.includes('forbidden')) {
      return { category: 'authorization', severity: 'high' }
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      return { category: 'validation', severity: 'low' }
    }

    // Server errors
    if (error.name === 'ServerError' || error.message.includes('server')) {
      return { category: 'server', severity: 'high' }
    }

    // Client errors
    if (error.name === 'ClientError' || error.message.includes('client')) {
      return { category: 'client', severity: 'medium' }
    }

    // Chunk load errors
    if (error.name === 'ChunkLoadError') {
      return { category: 'client', severity: 'high' }
    }

    // Default classification
    return { category: 'unknown', severity: 'medium' }
  }

  private updateErrorPatterns(error: Error, context: string): void {
    const pattern = `${error.name}:${error.message}:${context}`
    const count = this.errorPatterns.get(pattern) || 0
    this.errorPatterns.set(pattern, count + 1)
  }

  private sendToExternalService(errorEvent: ErrorEvent): void {
    // This would be implemented based on your error tracking service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    // Example for Sentry:
    // Sentry.captureException(errorEvent.error, {
    //   tags: {
    //     category: errorEvent.category,
    //     severity: errorEvent.severity,
    //     context: errorEvent.context,
    //   },
    //   extra: {
    //     user: errorEvent.user,
    //     environment: errorEvent.environment,
    //     metadata: errorEvent.metadata,
    //   }
    // })

    // Example for custom API:
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(errorEvent),
    // }).catch(err => {
    //   console.error('Failed to send error event:', err)
    // })
  }

  // Error resolution
  resolveError(errorId: string, resolution: string): void {
    const error = this.errors.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      error.resolvedAt = new Date()
      error.resolution = resolution
    }
  }

  // Analytics and reporting
  getErrorStats(): ErrorStats {
    const total = this.errors.length
    const resolved = this.errors.filter(e => e.resolved).length
    const unresolved = total - resolved

    // Group by category
    const byCategory = this.errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by severity
    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by context
    const byContext = this.errors.reduce((acc, error) => {
      acc[error.context] = (acc[error.context] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate resolution rate
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0

    // Calculate average resolution time
    const resolvedErrors = this.errors.filter(e => e.resolved && e.resolvedAt)
    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, error) => {
          const resolutionTime = error.resolvedAt!.getTime() - error.timestamp.getTime()
          return sum + resolutionTime
        }, 0) / resolvedErrors.length
      : 0

    // Get top errors
    const errorCounts = new Map<string, { count: number; lastOccurrence: Date; severity: string }>()
    this.errors.forEach(error => {
      const key = `${error.error.name}:${error.error.message}`
      const existing = errorCounts.get(key)
      if (existing) {
        existing.count++
        if (error.timestamp > existing.lastOccurrence) {
          existing.lastOccurrence = error.timestamp
        }
      } else {
        errorCounts.set(key, {
          count: 1,
          lastOccurrence: error.timestamp,
          severity: error.severity,
        })
      }
    })

    const topErrors = Array.from(errorCounts.entries())
      .map(([error, data]) => ({
        error,
        count: data.count,
        lastOccurrence: data.lastOccurrence,
        severity: data.severity,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total,
      byCategory,
      bySeverity,
      byContext,
      resolved,
      unresolved,
      resolutionRate,
      averageResolutionTime,
      topErrors,
    }
  }

  getErrorTrends(days: number = 7): ErrorTrend[] {
    const trends: ErrorTrend[] = []
    const now = new Date()
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)
      
      const dayErrors = this.errors.filter(error => 
        error.timestamp >= date && error.timestamp < nextDate
      )
      
      const resolved = dayErrors.filter(e => e.resolved).length
      
      const severity = {
        low: dayErrors.filter(e => e.severity === 'low').length,
        medium: dayErrors.filter(e => e.severity === 'medium').length,
        high: dayErrors.filter(e => e.severity === 'high').length,
        critical: dayErrors.filter(e => e.severity === 'critical').length,
      }
      
      trends.push({
        date: date.toISOString().split('T')[0],
        count: dayErrors.length,
        resolved,
        severity,
      })
    }
    
    return trends
  }

  getErrorsByCategory(category: string, limit = 50): ErrorEvent[] {
    return this.errors
      .filter(error => error.category === category)
      .slice(0, limit)
  }

  getErrorsBySeverity(severity: string, limit = 50): ErrorEvent[] {
    return this.errors
      .filter(error => error.severity === severity)
      .slice(0, limit)
  }

  getUnresolvedErrors(limit = 50): ErrorEvent[] {
    return this.errors
      .filter(error => !error.resolved)
      .slice(0, limit)
  }

  getRecentErrors(hours: number = 24, limit = 100): ErrorEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.errors
      .filter(error => error.timestamp > cutoff)
      .slice(0, limit)
  }

  getErrorPatterns(): Array<{ pattern: string; count: number }> {
    return Array.from(this.errorPatterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
  }

  clearData(): void {
    this.errors = []
    this.errorPatterns.clear()
  }

  exportData(): {
    errors: ErrorEvent[]
    patterns: Array<{ pattern: string; count: number }>
    stats: ErrorStats
  } {
    return {
      errors: this.errors,
      patterns: this.getErrorPatterns(),
      stats: this.getErrorStats(),
    }
  }
}

// Error tracking utilities
export const errorTrackingUtils = {
  // Track error with context
  trackError: (error: Error, context: string, metadata: Record<string, any> = {}) => {
    return ErrorTrackingService.getInstance().trackError(error, context, metadata)
  },

  // Resolve error
  resolveError: (errorId: string, resolution: string) => {
    ErrorTrackingService.getInstance().resolveError(errorId, resolution)
  },

  // Get error statistics
  getStats: () => {
    return ErrorTrackingService.getInstance().getErrorStats()
  },

  // Get error trends
  getTrends: (days: number = 7) => {
    return ErrorTrackingService.getInstance().getErrorTrends(days)
  },

  // Get recent errors
  getRecent: (hours: number = 24, limit: number = 100) => {
    return ErrorTrackingService.getInstance().getRecentErrors(hours, limit)
  },

  // Get unresolved errors
  getUnresolved: (limit: number = 50) => {
    return ErrorTrackingService.getInstance().getUnresolvedErrors(limit)
  },

  // Get error patterns
  getPatterns: () => {
    return ErrorTrackingService.getInstance().getErrorPatterns()
  },
}

// Initialize error tracking
if (typeof window !== 'undefined') {
  ErrorTrackingService.getInstance()
}
