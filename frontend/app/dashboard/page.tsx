'use client'

import { useAuth } from '@/hooks/useAuth'
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'
import { HODDashboard } from '@/components/dashboard/hod-dashboard'
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard'
import { StudentDashboard } from '@/components/dashboard/student-dashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />
    case 'hod':
      return <HODDashboard />
    case 'teacher':
      return <TeacherDashboard />
    case 'student':
      return <StudentDashboard />
    default:
      return <div>Invalid role</div>
  }
}