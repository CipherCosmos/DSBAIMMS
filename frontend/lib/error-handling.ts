// Error type from react-error-boundary is not exported, using built-in Error

// Error types and interfaces
export interface AppError extends Error {
  code?: string
  status?: number
  context?: string
  timestamp?: Date
  userId?: string
  sessionId?: string
  userAgent?: string
  url?: string
  componentStack?: string
  metadata?: Record<string, any>
}

export interface ErrorReport {
  id: string
  error: AppError
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'network' | 'validation' | 'authentication' | 'authorization' | 'server' | 'client' | 'unknown'
  context: string
  user: {
    id?: string
    role?: string
    email?: string
  }
  session: {
    id?: string
    startTime?: Date
  }
  environment: {
    userAgent: string
    url: string
    referrer?: string
    viewport?: {
      width: number
      height: number
    }
  }
  metadata?: Record<string, any>
}

// Error categories and their handling
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  SERVER: 'server',
  CLIENT: 'client',
  UNKNOWN: 'unknown',
} as const

export const ERROR_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

// Error classification utility
export function classifyError(error: Error): {
  category: string
  severity: string
  code?: string
} {
  // Network errors
  if (error.name === 'NetworkError' || error.message.includes('network')) {
    return {
      category: ERROR_CATEGORIES.NETWORK,
      severity: ERROR_SEVERITIES.MEDIUM,
      code: 'NETWORK_ERROR',
    }
  }

  // Authentication errors
  if (error.name === 'AuthenticationError' || error.message.includes('unauthorized')) {
    return {
      category: ERROR_CATEGORIES.AUTHENTICATION,
      severity: ERROR_SEVERITIES.HIGH,
      code: 'AUTH_ERROR',
    }
  }

  // Authorization errors
  if (error.name === 'AuthorizationError' || error.message.includes('forbidden')) {
    return {
      category: ERROR_CATEGORIES.AUTHORIZATION,
      severity: ERROR_SEVERITIES.HIGH,
      code: 'AUTHZ_ERROR',
    }
  }

  // Validation errors
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return {
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITIES.LOW,
      code: 'VALIDATION_ERROR',
    }
  }

  // Server errors
  if (error.name === 'ServerError' || error.message.includes('server')) {
    return {
      category: ERROR_CATEGORIES.SERVER,
      severity: ERROR_SEVERITIES.HIGH,
      code: 'SERVER_ERROR',
    }
  }

  // Client errors
  if (error.name === 'ClientError' || error.message.includes('client')) {
    return {
      category: ERROR_CATEGORIES.CLIENT,
      severity: ERROR_SEVERITIES.MEDIUM,
      code: 'CLIENT_ERROR',
    }
  }

  // Default classification
  return {
    category: ERROR_CATEGORIES.UNKNOWN,
    severity: ERROR_SEVERITIES.MEDIUM,
    code: 'UNKNOWN_ERROR',
  }
}

// Error reporting service
export class ErrorReportingService {
  private static instance: ErrorReportingService
  private reports: ErrorReport[] = []
  private maxReports = 100

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService()
    }
    return ErrorReportingService.instance
  }

  reportError(error: Error, context?: string, metadata?: Record<string, any>): string {
    const reportId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const classification = classifyError(error)
    
    const report: ErrorReport = {
      id: reportId,
      error: {
        ...error,
        code: classification.code,
        context,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        metadata,
      },
      timestamp: new Date(),
      severity: classification.severity as any,
      category: classification.category as any,
      context: context || 'unknown',
      user: {
        // This would be populated from your auth system
        id: undefined,
        role: undefined,
        email: undefined,
      },
      session: {
        // This would be populated from your session management
        id: undefined,
        startTime: undefined,
      },
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
      metadata,
    }

    // Store report locally
    this.reports.unshift(report)
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(0, this.maxReports)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', report)
    }

    // Send to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(report)
    }

    return reportId
  }

  getReports(): ErrorReport[] {
    return [...this.reports]
  }

  getReport(id: string): ErrorReport | undefined {
    return this.reports.find(report => report.id === id)
  }

  clearReports(): void {
    this.reports = []
  }

  private sendToExternalService(report: ErrorReport): void {
    // This would be implemented based on your error reporting service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    // Example for Sentry:
    // Sentry.captureException(report.error, {
    //   tags: {
    //     category: report.category,
    //     severity: report.severity,
    //   },
    //   extra: {
    //     context: report.context,
    //     user: report.user,
    //     session: report.session,
    //     environment: report.environment,
    //     metadata: report.metadata,
    //   }
    // })

    // Example for custom API:
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(report),
    // }).catch(err => {
    //   console.error('Failed to send error report:', err)
    // })
  }
}

// Error handling utilities
export const errorHandling = {
  // Create a standardized error
  createError: (message: string, code?: string, context?: string): AppError => {
    const error = new Error(message) as AppError
    error.code = code
    error.context = context
    error.timestamp = new Date()
    return error
  },

  // Wrap async operations with error handling
  wrapAsync: async <T>(
    operation: () => Promise<T>,
    context?: string,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      return await operation()
    } catch (error) {
      const appError = error as AppError
      appError.context = context
      
      if (onError) {
        onError(appError)
      } else {
        ErrorReportingService.getInstance().reportError(appError, context)
      }
      
      return null
    }
  },

  // Handle API errors
  handleApiError: (error: any, context?: string): AppError => {
    const appError = new Error(error.message || 'API request failed') as AppError
    appError.code = error.code || 'API_ERROR'
    appError.status = error.status || error.response?.status
    appError.context = context
    appError.timestamp = new Date()
    
    // Add response data if available
    if (error.response?.data) {
      appError.metadata = { responseData: error.response.data }
    }
    
    return appError
  },

  // Handle network errors
  handleNetworkError: (error: any, context?: string): AppError => {
    const appError = new Error('Network request failed') as AppError
    appError.code = 'NETWORK_ERROR'
    appError.context = context
    appError.timestamp = new Date()
    
    if (error.code === 'NETWORK_ERROR') {
      appError.message = 'Please check your internet connection'
    } else if (error.code === 'TIMEOUT') {
      appError.message = 'Request timed out. Please try again'
    } else {
      appError.message = error.message || 'Network request failed'
    }
    
    return appError
  },

  // Handle validation errors
  handleValidationError: (errors: any, context?: string): AppError => {
    const appError = new Error('Validation failed') as AppError
    appError.code = 'VALIDATION_ERROR'
    appError.context = context
    appError.timestamp = new Date()
    appError.metadata = { validationErrors: errors }
    
    return appError
  },

  // Get user-friendly error message
  getUserFriendlyMessage: (error: Error): string => {
    const appError = error as AppError
    
    switch (appError.code) {
      case 'NETWORK_ERROR':
        return 'Please check your internet connection and try again'
      case 'AUTH_ERROR':
        return 'Please log in to continue'
      case 'AUTHZ_ERROR':
        return 'You do not have permission to perform this action'
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again'
      case 'SERVER_ERROR':
        return 'Something went wrong on our end. Please try again later'
      case 'CLIENT_ERROR':
        return 'There was an issue with your request. Please try again'
      default:
        return process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'An unexpected error occurred. Please try again'
    }
  },

  // Check if error is retryable
  isRetryable: (error: Error): boolean => {
    const appError = error as AppError
    
    switch (appError.code) {
      case 'NETWORK_ERROR':
      case 'SERVER_ERROR':
        return true
      case 'AUTH_ERROR':
      case 'AUTHZ_ERROR':
      case 'VALIDATION_ERROR':
        return false
      default:
        return appError.status ? appError.status >= 500 : false
    }
  },

  // Get retry delay for error
  getRetryDelay: (error: Error, attempt: number): number => {
    const baseDelay = 1000
    const maxDelay = 10000
    const multiplier = 2
    
    const delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay)
    
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1
    return delay + (Math.random() - 0.5) * jitter
  },
}

// Global error handler
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    ErrorReportingService.getInstance().reportError(error, 'unhandledrejection')
  })

  // Handle global errors
  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message)
    ErrorReportingService.getInstance().reportError(error, 'global', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  // Handle chunk load errors (common in Next.js)
  window.addEventListener('error', (event) => {
    if (event.target && (event.target as any).tagName === 'SCRIPT') {
      const error = new Error('Failed to load script chunk')
      error.name = 'ChunkLoadError'
      ErrorReportingService.getInstance().reportError(error, 'chunk-load', {
        src: (event.target as any).src,
      })
    }
  })
}

// Initialize global error handling
if (typeof window !== 'undefined') {
  setupGlobalErrorHandling()
}
