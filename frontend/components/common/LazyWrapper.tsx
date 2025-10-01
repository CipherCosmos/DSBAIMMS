'use client'

import { Suspense, lazy, ComponentType, Component, ErrorInfo } from 'react'
import type { ReactNode } from 'react'

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
import { useInView } from 'react-intersection-observer'
import { motion } from 'framer-motion'

interface LazyWrapperProps {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: ReactNode
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
  className?: string
}

// Default loading fallback
const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

// Default error fallback
const DefaultErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-red-600 mb-4">
      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
    <p className="text-sm text-gray-500 mb-4">
      {process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while loading this component'}
    </p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Try again
    </button>
  </div>
)

export function LazyWrapper({
  children,
  fallback = <DefaultFallback />,
  errorFallback,
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
  className = '',
}: LazyWrapperProps) {
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce,
  })

  return (
    <div ref={ref} className={className}>
      {inView ? (
        <ErrorBoundary
          fallback={errorFallback ? <>{errorFallback}</> : (props: { error: Error; resetErrorBoundary: () => void }) => <DefaultErrorFallback {...props} />}
        >
          <Suspense fallback={fallback}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </Suspense>
        </ErrorBoundary>
      ) : (
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="animate-pulse bg-gray-200 rounded-lg w-full h-32"></div>
        </div>
      )}
    </div>
  )
}

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode
) {
  const LazyComponent = (props: P) => (
    <LazyWrapper fallback={fallback}>
      <Component {...props} />
    </LazyWrapper>
  )

  LazyComponent.displayName = `withLazyLoading(${Component.displayName || Component.name})`
  
  return LazyComponent
}

// Utility function to create lazy components with proper typing
export function createLazyComponent<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ReactNode,
  name?: string
) {
  const LazyComponent = lazy(importFunc)
  
  const WrappedComponent = (props: P) => (
    <LazyWrapper fallback={fallback}>
      <LazyComponent {...props} />
    </LazyWrapper>
  )
  
  WrappedComponent.displayName = `LazyComponent(${name || 'Unknown'})`
  
  return WrappedComponent
}
