'use client'

import { useAuth } from '@/hooks/useAuth'
import { EnhancedAdminDashboard } from '@/components/dashboard/enhanced-admin-dashboard'
import { HODDashboard } from '@/components/dashboard/hod-dashboard'
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard'
import { StudentDashboard } from '@/components/dashboard/student-dashboard'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access the dashboard</p>
        </div>
      </div>
    )
  }

  try {
    
    switch (user.role) {
      case 'admin':
        return <EnhancedAdminDashboard />
      case 'hod':
        return <HODDashboard />
      case 'teacher':
        return <TeacherDashboard />
      case 'student':
        return <StudentDashboard />
      default:
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <p className="text-red-600">Invalid user role: {user.role}</p>
            </div>
          </div>
        )
    }
  } catch (error) {
    console.error('Error rendering dashboard:', error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">Error loading dashboard: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    )
  }
}