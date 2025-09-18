'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { Users, Building, BookOpen, BarChart3, Plus, Upload, TrendingUp, FileText, Activity, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDepartments: 0,
    totalSubjects: 0,
    totalClasses: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        const [users, departments, subjects, classes, notifications] = await Promise.allSettled([
          apiClient.getUsers(),
          apiClient.getDepartments(),
          apiClient.getSubjects(),
          apiClient.getClasses(),
          apiClient.getNotifications({ limit: 5 })
        ])

        // Extract successful results and handle failures
        const usersData = users.status === 'fulfilled' ? users.value : []
        const departmentsData = departments.status === 'fulfilled' ? departments.value : []
        const subjectsData = subjects.status === 'fulfilled' ? subjects.value : []
        const classesData = classes.status === 'fulfilled' ? classes.value : []
        const notificationsData = notifications.status === 'fulfilled' ? notifications.value : []

        // Log any failed requests for debugging
        if (notifications.status === 'rejected') {
          console.warn('Notifications API failed:', notifications.reason)
        }

        setStats({
          totalUsers: usersData.length,
          totalDepartments: departmentsData.length,
          totalSubjects: subjectsData.length,
          totalClasses: classesData.length
        })

        // Process recent activity from notifications
        const activity = Array.isArray(notificationsData) ? notificationsData.map(notification => ({
          id: notification.id,
          message: notification.message,
          type: notification.type,
          timestamp: notification.created_at
        })) : []
        setRecentActivity(activity)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const statCards = [
    {
      name: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      href: '/dashboard/users'
    },
    {
      name: 'Departments',
      value: stats.totalDepartments,
      icon: Building,
      color: 'bg-green-500',
      href: '/dashboard/departments'
    },
    {
      name: 'Subjects',
      value: stats.totalSubjects,
      icon: BookOpen,
      color: 'bg-yellow-500',
      href: '/dashboard/subjects'
    },
    {
      name: 'Classes',
      value: stats.totalClasses,
      icon: BarChart3,
      color: 'bg-purple-500',
      href: '/dashboard/classes'
    }
  ]

  const quickActions = [
    {
      name: 'Create New Department',
      icon: Plus,
      action: () => router.push('/dashboard/departments?action=create'),
      color: 'text-blue-600 hover:bg-blue-50'
    },
    {
      name: 'Add Users (Bulk Upload)',
      icon: Upload,
      action: () => router.push('/dashboard/bulk'),
      color: 'text-green-600 hover:bg-green-50'
    },
    {
      name: 'System Analytics',
      icon: TrendingUp,
      action: () => router.push('/dashboard/analytics'),
      color: 'text-purple-600 hover:bg-purple-50'
    },
    {
      name: 'Generate Reports',
      icon: FileText,
      action: () => router.push('/dashboard/reports'),
      color: 'text-orange-600 hover:bg-orange-50'
    },
    {
      name: 'System Monitoring',
      icon: Activity,
      action: () => router.push('/dashboard/monitoring'),
      color: 'text-red-600 hover:bg-red-50'
    }
  ]

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-600">Overview of the entire LMS system</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/notifications')}
            className="relative p-2 text-gray-600 hover:text-gray-900"
          >
            <Bell className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div 
            key={stat.name} 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(stat.href)}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.name}
                onClick={action.action}
                className={`w-full text-left p-3 border rounded-md hover:bg-gray-50 flex items-center space-x-3 ${action.color}`}
              >
                <action.icon className="w-5 h-5" />
                <span>{action.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="text-sm text-gray-600 flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p>{activity.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}