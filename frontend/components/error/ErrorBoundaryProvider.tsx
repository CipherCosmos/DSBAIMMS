'use client'

import { ReactNode } from 'react'
// Custom ErrorBoundary implementation
import { Component, ReactNode, ErrorInfo } from 'react'

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

const ErrorBoundary = CustomErrorBoundary
import { GlobalErrorBoundary, ErrorRecoveryProvider } from './index'
import { ErrorReportingService } from '@/lib/error-handling'

interface ErrorBoundaryProviderProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: any) => void
  onReset?: () => void
}

// Custom error fallback component
function CustomErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error
  resetErrorBoundary: () => void 
}) {
  return (
    <GlobalErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-sm text-gray-500 mb-6">
                {process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={resetErrorBoundary}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Try again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div />
    </GlobalErrorBoundary>
  )
}

export function ErrorBoundaryProvider({ 
  children, 
  fallback, 
  onError, 
  onReset 
}: ErrorBoundaryProviderProps) {
  const handleError = (error: Error, errorInfo: any) => {
    // Report error to our error reporting service
    ErrorReportingService.getInstance().reportError(error, 'error-boundary', {
      componentStack: errorInfo.componentStack,
    })

    // Call custom error handler if provided
    onError?.(error, errorInfo)
  }

  const handleReset = () => {
    // Clear any error state
    ErrorReportingService.getInstance().clearReports()
    
    // Call custom reset handler if provided
    onReset?.()
  }

  return (
    <ErrorRecoveryProvider>
      <ErrorBoundary
        FallbackComponent={fallback ? () => <>{fallback}</> : CustomErrorFallback}
        onError={handleError}
        onReset={handleReset}
      >
        {children}
      </ErrorBoundary>
    </ErrorRecoveryProvider>
  )
}
