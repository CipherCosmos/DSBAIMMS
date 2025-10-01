'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Users, Building, BookOpen, BarChart3, Plus, Upload, TrendingUp, 
  FileText, Activity, Bell, GraduationCap, Calendar, Award, Target,
  PieChart, LineChart, BarChart, Download, RefreshCw, Eye
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  total_users: number
  total_departments: number
  total_classes: number
  total_subjects: number
  total_exams: number
  active_students: number
  active_teachers: number
  total_marks: number
  average_performance: number
  recent_activities: Array<{
    action: string
    table_name: string
    user_id: number
    created_at: string
    ip_address: string
  }>
  // Role-specific additional stats (optional)
  total_students?: number
  total_teachers?: number
  active_semesters?: number
  attendance_percentage?: number
  total_attendance_records?: number
  completed_exams?: number
  assigned_subjects?: number
  assigned_classes?: number
  students_taught?: number
  overall_percentage?: number
  total_exams_attempted?: number
  subjects_enrolled?: number
}

interface COPOAnalytics {
  id: number
  co_id: number
  po_id: number
  mapping_strength: number
  created_at: string
  updated_at: string
  co: {
    id: number
    name: string
    description: string
    subject_id: number
    department_id: number
    created_at: string
    updated_at: string
  }
  po: {
    id: number
    name: string
    description: string
    department_id: number
    created_at: string
    updated_at: string
  }
  // Optional fields for analytics (may not be present in basic mappings)
  attainment_percentage?: number
  student_count?: number
  average_score?: number
  bloom_distribution?: Record<string, number>
  difficulty_distribution?: Record<string, number>
}

interface StudentPerformance {
  id: number
  username: string
  full_name: string
  email: string
  department_id: number
  department_name: string
  class_id: number
  class_name: string
  is_active: boolean
  total_exams: number
  average_percentage: number
  grade: string
  performance_trend: Array<{
    exam_name: string
    percentage: number
    date: string
  }>
  last_exam_date: string | null
}

export function EnhancedAdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [coPoAnalytics, setCoPoAnalytics] = useState<COPOAnalytics[]>([])
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([])
  const [promotionStats, setPromotionStats] = useState<any>(null)
  const [bulkOperations, setBulkOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      const [statsData, coPoData, studentData] = await Promise.allSettled([
        apiClient.getDashboardStats(),
        apiClient.getCOPOPerformance(),
        apiClient.getStudentsAnalytics()
      ])

      if (statsData.status === 'fulfilled' && statsData.value.success) {
        setStats(statsData.value.data)
      } else {
        setStats({
          total_users: 0,
          total_departments: 0,
          total_classes: 0,
          total_subjects: 0,
          total_exams: 0,
          active_students: 0,
          active_teachers: 0,
          total_marks: 0,
          average_performance: 0,
          recent_activities: []
        })
      }
      
      if (coPoData.status === 'fulfilled' && coPoData.value.success) {
        // Handle both direct array and wrapped object responses
        const mappings = Array.isArray(coPoData.value.data) 
          ? coPoData.value.data 
          : coPoData.value.data?.mappings || []
        setCoPoAnalytics(mappings)
      } else {
        setCoPoAnalytics([])
      }
      
      if (studentData.status === 'fulfilled' && studentData.value.success) {
        // Handle both direct array and wrapped object responses
        const students = Array.isArray(studentData.value.data) 
          ? studentData.value.data 
          : studentData.value.data?.students || []
        setStudentPerformance(students)
      } else {
        setStudentPerformance([])
      }
    } catch (error) {
      setError('Failed to load dashboard data')
      setStats({
        total_users: 0,
        total_departments: 0,
        total_classes: 0,
        total_subjects: 0,
        total_exams: 0,
        active_students: 0,
        active_teachers: 0,
        total_marks: 0,
        average_performance: 0,
        recent_activities: []
      })
      setCoPoAnalytics([])
      setStudentPerformance([])
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      name: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      color: 'bg-blue-500',
      href: '/dashboard/users'
    },
    {
      name: 'Departments',
      value: stats?.total_departments || 0,
      icon: Building,
      color: 'bg-green-500',
      href: '/dashboard/departments'
    },
    {
      name: 'Active Classes',
      value: stats?.total_classes || 0,
      icon: BookOpen,
      color: 'bg-yellow-500',
      href: '/dashboard/classes'
    },
    {
      name: 'Subjects',
      value: stats?.total_subjects || 0,
      icon: FileText,
      color: 'bg-purple-500',
      href: '/dashboard/subjects'
    },
    {
      name: 'Exams',
      value: stats?.total_exams || 0,
      icon: Award,
      color: 'bg-indigo-500',
      href: '/dashboard/exams'
    },
    {
      name: 'Students',
      value: stats?.active_students || 0,
      icon: GraduationCap,
      color: 'bg-pink-500',
      href: '/dashboard/users?role=student'
    },
    {
      name: 'Teachers',
      value: stats?.active_teachers || 0,
      icon: Users,
      color: 'bg-teal-500',
      href: '/dashboard/users?role=teacher'
    },
    {
      name: 'Active Semesters',
      value: stats?.active_semesters || 0,
      icon: Calendar,
      color: 'bg-orange-500',
      href: '/dashboard/semesters'
    }
  ]

  const quickActions = [
    {
      name: 'Create Department',
      icon: Plus,
      action: () => router.push('/dashboard/departments?action=create'),
      color: 'text-blue-600 hover:bg-blue-50'
    },
    {
      name: 'Student Promotion',
      icon: GraduationCap,
      action: () => router.push('/dashboard/promotion'),
      color: 'text-indigo-600 hover:bg-indigo-50'
    },
    {
      name: 'Bulk Operations',
      icon: Upload,
      action: () => router.push('/dashboard/bulk-operations'),
      color: 'text-green-600 hover:bg-green-50'
    },
    {
      name: 'Exam Management',
      icon: FileText,
      action: () => router.push('/dashboard/exams'),
      color: 'text-amber-600 hover:bg-amber-50'
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
    },
    {
      name: 'CO/PO Management',
      icon: Target,
      action: () => router.push('/dashboard/co-po'),
      color: 'text-indigo-600 hover:bg-indigo-50'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Comprehensive overview of the LMS system</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadDashboardData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => router.push('/dashboard/reports')}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'analytics', name: 'Analytics', icon: TrendingUp },
            { id: 'performance', name: 'Performance', icon: Target },
            { id: 'activities', name: 'Activities', icon: Activity }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((card) => (
              <div
                key={card.name}
                className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(card.href)}
              >
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${card.color}`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{card.name}</p>
                    <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.name}
                  onClick={action.action}
                  className={`flex items-center p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors ${action.color}`}
                >
                  <action.icon className="h-5 w-5 mr-3" />
                  <span className="font-medium">{action.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h3>
            <div className="space-y-3">
              {(stats as any)?.recent_activities?.map((activity: any, index: number) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-500 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      {activity.action} on {activity.table_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.created_at ? new Date(activity.created_at).toLocaleString() : 'Unknown time'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* CO/PO Analytics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CO/PO Attainment Analytics</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attainment %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(coPoAnalytics || []).length > 0 ? (coPoAnalytics || []).map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.co.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.po.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(item.attainment_percentage || 0, 100)}%` }}
                            ></div>
                          </div>
                          <span>{(item.attainment_percentage || 0).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          (item.attainment_percentage || 0) >= 80 ? 'bg-green-100 text-green-800' :
                          (item.attainment_percentage || 0) >= 60 ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(item.attainment_percentage || 0) >= 80 ? 'Exceeds' :
                           (item.attainment_percentage || 0) >= 60 ? 'Meets' : 'Below'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.student_count || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.average_score ? item.average_score.toFixed(1) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No CO/PO analytics data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Student Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Performance Overview</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exams</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(studentPerformance || []).length > 0 ? (studentPerformance || []).map((student, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.class_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(student.average_percentage, 100)}%` }}
                            ></div>
                          </div>
                          <span>{student.average_percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          student.grade === 'A+' || student.grade === 'A' 
                            ? 'bg-green-100 text-green-800'
                            : student.grade === 'B+' || student.grade === 'B'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {student.grade}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.total_exams} exams
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          student.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {student.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No student performance data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Activities</h3>
            <div className="space-y-3">
              {(stats as any)?.recent_activities?.length > 0 ? (
                (stats as any)?.recent_activities?.map((activity: any, index: number) => (
                  <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Activity className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action} on {activity.table_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        User ID: {activity.user_id} • {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {activity.action}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No recent activities found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedAdminDashboard