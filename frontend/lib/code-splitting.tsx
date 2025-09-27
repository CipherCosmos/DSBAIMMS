import { ComponentType, lazy, Suspense } from 'react'
import { LazyWrapper } from '@/components/common/LazyWrapper'

// Preload function for better performance
export function preloadComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  return importFunc()
}

// Create lazy component with preloading
export function createLazyComponentWithPreload<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  preloadFunc?: () => Promise<void>
) {
  const LazyComponent = lazy(importFunc)
  
  // Preload component
  if (preloadFunc) {
    preloadFunc()
  }
  
  return LazyComponent
}

// Route-based code splitting
export const routeComponents = {
  // Dashboard routes
  Dashboard: lazy(() => import('@/app/dashboard/page')),
  Users: lazy(() => import('@/app/dashboard/users/page')),
  Departments: lazy(() => import('@/app/dashboard/departments/page')),
  Classes: lazy(() => import('@/app/dashboard/classes/page')),
  Subjects: lazy(() => import('@/app/dashboard/subjects/page')),
  Semesters: lazy(() => import('@/app/dashboard/semesters/page')),
  Exams: lazy(() => import('@/app/dashboard/files/exams/page')),
  Analytics: lazy(() => import('@/app/dashboard/analytics/page')),
  Reports: lazy(() => import('@/app/dashboard/reports/page')),
  Files: lazy(() => import('@/app/dashboard/files/page')),
  Notifications: lazy(() => import('@/app/dashboard/notifications/page')),
  Monitoring: lazy(() => import('@/app/dashboard/monitoring/page')),
  Bulk: lazy(() => import('@/app/dashboard/bulk/page')),
  Promotion: lazy(() => import('@/app/dashboard/promotion/page')),
  Attendance: lazy(() => import('@/app/dashboard/attendance/page')),
  Marks: lazy(() => import('@/app/dashboard/marks/page')),
  Profile: lazy(() => import('@/app/dashboard/profile/page')),
  QuestionBanks: lazy(() => import('@/app/dashboard/questionbanks/page')),
  COPO: lazy(() => import('@/app/dashboard/co-po/page')),
  Courses: lazy(() => import('@/app/dashboard/courses/page')),
  
  // Auth routes
  Login: lazy(() => import('@/app/login/page')),
  
  // Debug routes
  Debug: lazy(() => import('@/app/debug/page')),
  StateManagement: lazy(() => import('@/app/debug/state-management/page')),
}

// Component-based code splitting
export const componentModules = {
  // Dashboard components
  AdminDashboard: lazy(() => import('@/components/dashboard/enhanced-admin-dashboard')),
  TeacherDashboard: lazy(() => import('@/components/dashboard/teacher-dashboard')),
  StudentDashboard: lazy(() => import('@/components/dashboard/student-dashboard')),
  HODDashboard: lazy(() => import('@/components/dashboard/hod-dashboard')),
  
  // Management components
  // UsersManager: lazy(() => import('@/components/users/UsersManager')),
  // DepartmentsManager: lazy(() => import('@/components/departments/DepartmentsManager')),
  ClassesManager: lazy(() => import('@/components/classes/ClassesManager')),
  SubjectsManager: lazy(() => import('@/components/subjects/SubjectsManager')),
  SemestersManager: lazy(() => import('@/components/semesters/SemestersManager')),
  
  // Exam components
  ExamCreationForm: lazy(() => import('@/components/exams/ExamCreationForm')),
  // EnhancedExamCreationForm: lazy(() => import('@/components/exams/EnhancedExamCreationForm')),
  
  // Analytics components
  // COPOAnalytics: lazy(() => import('@/components/analytics/COPOAnalytics')),
  // AdvancedAnalyticsDashboard: lazy(() => import('@/components/analytics/AdvancedAnalyticsDashboard')),
  // CrossSemesterAnalytics: lazy(() => import('@/components/analytics/CrossSemesterAnalytics')),
  
  // Other components
  NotificationCenter: lazy(() => import('@/components/notifications/NotificationCenter')),
  SystemMonitoring: lazy(() => import('@/components/monitoring/SystemMonitoring')),
  // BulkOperations: lazy(() => import('@/components/bulk/BulkOperations')),
  PromotionManager: lazy(() => import('@/components/promotion/PromotionManager')),
  AttendanceManager: lazy(() => import('@/components/attendance/AttendanceManager')),
  QuestionBankManager: lazy(() => import('@/components/questionbank/QuestionBankManager')),
  // COPOManagement: lazy(() => import('@/components/co-po/co-po-management')),
  FileUpload: lazy(() => import('@/components/files/FileUpload')),
}

// Feature-based code splitting
export const featureModules = {
  // Authentication features
  // Auth: lazy(() => import('@/features/auth/AuthModule')),
  
  // User management features
  // UserManagement: lazy(() => import('@/features/users/UserManagementModule')),
  
  // Department management features
  // DepartmentManagement: lazy(() => import('@/features/departments/DepartmentManagementModule')),
  
  // Class management features
  // ClassManagement: lazy(() => import('@/features/classes/ClassManagementModule')),
  
  // Subject management features
  // SubjectManagement: lazy(() => import('@/features/subjects/SubjectManagementModule')),
  
  // Exam management features
  // ExamManagement: lazy(() => import('@/features/exams/ExamManagementModule')),
  
  // Analytics features
  // Analytics: lazy(() => import('@/features/analytics/AnalyticsModule')),
  
  // File management features
  // FileManagement: lazy(() => import('@/features/files/FileManagementModule')),
  
  // Notification features
  // Notifications: lazy(() => import('@/features/notifications/NotificationModule')),
}

// Utility function to preload all route components
export function preloadAllRoutes() {
  Object.values(routeComponents).forEach(component => {
    if ('preload' in component) {
      (component as any).preload()
    }
  })
}

// Utility function to preload specific route
export function preloadRoute(routeName: keyof typeof routeComponents) {
  const component = routeComponents[routeName]
  if (component && 'preload' in component) {
    (component as any).preload()
  }
}

// Utility function to preload component module
export function preloadComponentByName(componentName: keyof typeof componentModules) {
  const component = componentModules[componentName]
  if (component && 'preload' in component) {
    (component as any).preload()
  }
}

// Utility function to preload feature module
export function preloadFeature(featureName: keyof typeof featureModules) {
  const feature = featureModules[featureName]
  if (feature && 'preload' in feature) {
    (feature as any).preload()
  }
}

// Higher-order component for code splitting
export function withCodeSplitting<T extends ComponentType<any>>(
  Component: T,
  fallback?: React.ReactNode,
  name?: string
) {
  const WrappedComponent = (props: any) => (
    <LazyWrapper fallback={fallback}>
      <Component {...props} />
    </LazyWrapper>
  )
  
  WrappedComponent.displayName = `LazyComponent(${name || 'Unknown'})`
  
  return WrappedComponent
}

// Dynamic import utility
export function dynamicImport<T>(importFunc: () => Promise<T>) {
  return importFunc().catch(error => {
    console.error('Failed to load module:', error)
    throw error
  })
}

// Bundle analyzer utility
export function analyzeBundle() {
  if (process.env.NODE_ENV === 'development') {
    // import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
    //   console.log('Bundle analyzer available')
    // })
    console.log('Bundle analyzer available')
  }
}

// Performance monitoring for code splitting
export function measureCodeSplittingPerformance() {
  const start = performance.now()
  
  return {
    end: () => {
      const end = performance.now()
      const duration = end - start
      console.log(`Code splitting performance: ${duration.toFixed(2)}ms`)
      return duration
    }
  }
}
