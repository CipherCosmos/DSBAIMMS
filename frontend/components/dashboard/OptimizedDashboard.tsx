'use client'

import { Suspense, lazy, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/hooks'
import { useUIStore } from '@/lib/stores'
import { LazyWrapper, PerformanceMonitor } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load dashboard components based on user role
const AdminDashboard = lazy(() => import('@/components/dashboard/enhanced-admin-dashboard'))
const TeacherDashboard = lazy(() => import('@/components/dashboard/teacher-dashboard'))
const StudentDashboard = lazy(() => import('@/components/dashboard/student-dashboard'))
const HODDashboard = lazy(() => import('@/components/dashboard/hod-dashboard'))

// Loading skeleton for dashboard
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)

// Error fallback for dashboard
const DashboardErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <Card className="border-red-200 bg-red-50">
    <CardHeader>
      <CardTitle className="text-red-800">Dashboard Error</CardTitle>
      <CardDescription className="text-red-600">
        Failed to load dashboard component
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <p className="text-sm text-red-700">
          {process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while loading the dashboard'}
        </p>
        <Button onClick={resetErrorBoundary} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    </CardContent>
  </Card>
)

// Get dashboard component based on user role
function getDashboardComponent(role: string) {
  switch (role.toLowerCase()) {
    case 'admin':
      return AdminDashboard
    case 'teacher':
      return TeacherDashboard
    case 'student':
      return StudentDashboard
    case 'hod':
      return HODDashboard
    default:
      return AdminDashboard
  }
}

// Performance metrics for dashboard
interface DashboardMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  componentCount: number
}

export function OptimizedDashboard() {
  const { user, isLoading: authLoading } = useAuth()
  const { theme, setTheme } = useUIStore()
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0,
  })
  const [showMetrics, setShowMetrics] = useState(false)
  const [loadStartTime] = useState(performance.now())

  // Measure dashboard performance
  const measurePerformance = useCallback(() => {
    const loadTime = performance.now() - loadStartTime
    
    // Get memory usage
    let memoryUsage = 0
    if ('memory' in performance) {
      const memory = (performance as any).memory
      memoryUsage = memory.usedJSHeapSize / 1024 / 1024
    }
    
    // Get component count (approximate)
    const componentCount = document.querySelectorAll('[data-component]').length
    
    setMetrics({
      loadTime,
      renderTime: 0, // Will be updated by PerformanceMonitor
      memoryUsage,
      componentCount,
    })
  }, [loadStartTime])

  // Update metrics when dashboard loads
  useEffect(() => {
    if (!authLoading && user) {
      measurePerformance()
    }
  }, [authLoading, user, measurePerformance])

  // Handle theme toggle
  const handleThemeToggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  // Show loading state
  if (authLoading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    )
  }

  // Show error state if no user
  if (!user) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Authentication Required</CardTitle>
            <CardDescription className="text-red-600">
              Please log in to access the dashboard
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const DashboardComponent = getDashboardComponent(user.role)

  return (
    <div className="p-6 space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.full_name}
          </h1>
          <p className="text-gray-600 mt-1">
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="capitalize">
            {user.role}
          </Badge>
          
          <Button
            onClick={handleThemeToggle}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {theme === 'light' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              )}
            </svg>
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </Button>
          
          <Button
            onClick={() => setShowMetrics(!showMetrics)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Metrics</span>
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      <LazyWrapper
        fallback={<DashboardSkeleton />}
        errorFallback={<DashboardErrorFallback error={new Error('Dashboard Error')} resetErrorBoundary={() => {}} />}
        threshold={0.1}
        rootMargin="100px"
      >
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardComponent />
        </Suspense>
      </LazyWrapper>

      {/* Performance Metrics */}
      {showMetrics && (
        <PerformanceMonitor
          componentName="OptimizedDashboard"
          showMetrics={true}
          onMetricsUpdate={(newMetrics) => {
            setMetrics(prev => ({
              ...prev,
              ...newMetrics,
            }))
          }}
        />
      )}

      {/* Performance Summary */}
      {showMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>
              Dashboard loading and rendering performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.loadTime.toFixed(0)}ms
                </div>
                <div className="text-sm text-gray-600">Load Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.renderTime.toFixed(0)}ms
                </div>
                <div className="text-sm text-gray-600">Render Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.memoryUsage.toFixed(1)}MB
                </div>
                <div className="text-sm text-gray-600">Memory Usage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {metrics.componentCount}
                </div>
                <div className="text-sm text-gray-600">Components</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
