'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Users, BookOpen, GraduationCap, BarChart3 } from 'lucide-react'

export function HODDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    departmentUsers: 0,
    departmentSubjects: 0,
    departmentClasses: 0,
    coAttainment: 0,
    poAttainment: 0
  })

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.department_id) return

      try {
        const [users, subjects, classes, coAttainment, poAttainment] = await Promise.all([
          apiClient.getUsers({ department_id: user.department_id }),
          apiClient.getSubjects({ department_id: user.department_id }),
          apiClient.getClasses({ department_id: user.department_id }),
          apiClient.getCOAttainment({ department_id: user.department_id }),
          apiClient.getPOAttainment({ department_id: user.department_id })
        ])

        setStats({
          departmentUsers: users.data?.length || 0,
          departmentSubjects: subjects.data?.length || 0,
          departmentClasses: classes.data?.length || 0,
          coAttainment: coAttainment.data?.overall_attainment || 0,
          poAttainment: poAttainment.data?.overall_attainment || 0
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      }
    }

    loadStats()
  }, [user])

  const statCards = [
    {
      name: 'Department Users',
      value: stats.departmentUsers,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Department Subjects',
      value: stats.departmentSubjects,
      icon: BookOpen,
      color: 'bg-green-500',
    },
    {
      name: 'Department Classes',
      value: stats.departmentClasses,
      icon: GraduationCap,
      color: 'bg-purple-500',
    },
    {
      name: 'CO/PO Analytics',
      value: 'View',
      icon: BarChart3,
      color: 'bg-orange-500',
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">HOD Dashboard</h2>
        <p className="text-gray-600">Manage your department operations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">Department Management</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              Manage Classes
            </button>
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              Add Teachers/Students
            </button>
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              CO/PO Management
            </button>
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              Department Analytics
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">CO/PO Attainment Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Overall CO Attainment</span>
              <span className="text-sm font-medium text-green-600">{stats.coAttainment.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Overall PO Attainment</span>
              <span className="text-sm font-medium text-blue-600">{stats.poAttainment.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active Subjects</span>
              <span className="text-sm font-medium text-gray-900">{stats.departmentSubjects}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active Classes</span>
              <span className="text-sm font-medium text-gray-900">{stats.departmentClasses}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HODDashboard