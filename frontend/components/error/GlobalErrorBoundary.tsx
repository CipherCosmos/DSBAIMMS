'use client'

import { Component, ReactNode, ErrorInfo } from 'react'
// Custom ErrorBoundary implementation to avoid module resolution issues

// Custom ErrorBoundary component
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class CustomErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>
    }

    return this.props.children
  }
}

// Export as ErrorBoundary for compatibility
export const ErrorBoundary = CustomErrorBoundary
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ErrorDetails {
  error: Error
  errorInfo: ErrorInfo
  timestamp: Date
  userAgent: string
  url: string
  userId?: string
  componentStack: string
}

interface GlobalErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

interface GlobalErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: ErrorDetails) => void
  onReset?: () => void
}

// Error reporting service
class ErrorReportingService {
  private static instance: ErrorReportingService
  private errors: ErrorDetails[] = []

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService()
    }
    return ErrorReportingService.instance
  }

  reportError(errorDetails: ErrorDetails): void {
    // Store error locally
    this.errors.push(errorDetails)
    
    // In a real application, you would send this to an error reporting service
    // like Sentry, LogRocket, or Bugsnag
    console.error('Error reported:', errorDetails)
    
    // Example: Send to external service
    // this.sendToExternalService(errorDetails)
  }

  getErrors(): ErrorDetails[] {
    return [...this.errors]
  }

  clearErrors(): void {
    this.errors = []
  }

  private sendToExternalService(errorDetails: ErrorDetails): void {
    // This would be implemented based on your error reporting service
    // Example for Sentry:
    // Sentry.captureException(errorDetails.error, {
    //   extra: {
    //     errorInfo: errorDetails.errorInfo,
    //     timestamp: errorDetails.timestamp,
    //     userAgent: errorDetails.userAgent,
    //     url: errorDetails.url,
    //     userId: errorDetails.userId,
    //     componentStack: errorDetails.componentStack,
    //   }
    // })
  }
}

// Default error fallback component
const DefaultErrorFallback = ({ 
  error, 
  resetErrorBoundary, 
  errorId 
}: { 
  error: Error
  resetErrorBoundary: () => void
  errorId?: string
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="max-w-md w-full">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <CardTitle className="text-red-800">Something went wrong</CardTitle>
            <CardDescription className="text-red-600">
              An unexpected error occurred
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-red-50 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">Error Details</h4>
          <p className="text-sm text-red-700 mb-2">
            {process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'}
          </p>
          {errorId && (
            <div className="text-xs text-red-600">
              Error ID: <code className="bg-red-100 px-1 rounded">{errorId}</code>
            </div>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
              Stack Trace (Development Only)
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex space-x-2">
          <Button onClick={resetErrorBoundary} className="flex-1">
            Try Again
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="flex-1"
          >
            Reload Page
          </Button>
        </div>

        <div className="text-xs text-gray-500 text-center">
          If this problem persists, please contact support
        </div>
      </CardContent>
    </Card>
  </div>
)

// Error boundary class component
class GlobalErrorBoundaryClass extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  private errorReportingService: ErrorReportingService

  constructor(props: GlobalErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    }
    this.errorReportingService = ErrorReportingService.getInstance()
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Create error details
    const errorDetails: ErrorDetails = {
      error,
      errorInfo,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getCurrentUserId(),
      componentStack: errorInfo.componentStack || '',
    }

    // Report error
    this.errorReportingService.reportError(errorDetails)

    // Call custom error handler
    this.props.onError?.(errorDetails)
  }

  private getCurrentUserId(): string | undefined {
    // This would be implemented based on your auth system
    // Example: return useAuthStore.getState().user?.id
    return undefined
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.handleReset}
          errorId={this.state.errorId || undefined}
        />
      )
    }

    return this.props.children
  }
}

// Functional error boundary using react-error-boundary
export function GlobalErrorBoundary({ 
  children, 
  fallback, 
  onError, 
  onReset 
}: GlobalErrorBoundaryProps) {
  const errorReportingService = ErrorReportingService.getInstance()

  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails: ErrorDetails = {
      error,
      errorInfo,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: undefined, // Would be implemented based on auth system
      componentStack: errorInfo.componentStack || '',
    }

    errorReportingService.reportError(errorDetails)
    onError?.(errorDetails)
  }

  return (
    <ErrorBoundary
      FallbackComponent={fallback ? () => <>{fallback}</> : DefaultErrorFallback}
      onError={handleError}
      onReset={onReset}
    >
      {children}
    </ErrorBoundary>
  )
}

// Error context for accessing error reporting service
export const ErrorContext = {
  getErrors: () => ErrorReportingService.getInstance().getErrors(),
  clearErrors: () => ErrorReportingService.getInstance().clearErrors(),
  reportError: (error: Error, context?: any) => {
    const errorDetails: ErrorDetails = {
      error,
      errorInfo: { componentStack: '' },
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: undefined,
      componentStack: '',
    }
    ErrorReportingService.getInstance().reportError(errorDetails)
  },
}

// Hook for error reporting
export function useErrorReporting() {
  return {
    reportError: (error: Error, context?: any) => {
      ErrorContext.reportError(error, context)
    },
    getErrors: () => ErrorContext.getErrors(),
    clearErrors: () => ErrorContext.clearErrors(),
  }
}

// Error boundary for specific features
export function FeatureErrorBoundary({ 
  children, 
  featureName 
}: { 
  children: ReactNode
  featureName: string 
}) {
  const CustomFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-800">{featureName} Error</CardTitle>
        <CardDescription className="text-red-600">
          An error occurred in the {featureName} feature
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-red-700">
            {process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'}
          </p>
          <Button onClick={resetErrorBoundary} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <ErrorBoundary FallbackComponent={CustomFallback}>
      {children}
    </ErrorBoundary>
  )
}

export default GlobalErrorBoundary
