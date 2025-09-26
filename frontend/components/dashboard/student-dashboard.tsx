'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { BookOpen, Award, TrendingUp, Target } from 'lucide-react'

export function StudentDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    enrolledSubjects: 0,
    averageMarks: 0,
    coAttainment: 0,
    poAttainment: 0,
    cgpa: 0,
    attendance: 0,
    ranking: 0
  })

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.class_id) return

      try {
        const [subjects, coAttainment, poAttainment, studentPerformance] = await Promise.all([
          apiClient.getSubjects({ class_id: user.class_id }),
          apiClient.getCOAttainment({ student_id: user.id }),
          apiClient.getPOAttainment({ student_id: user.id }),
          apiClient.getStudentPerformance(user.id)
        ])

        const subjectsData = subjects.data || []
        const studentPerformanceData = studentPerformance.data?.[0] || {}
        
        setStats({
          enrolledSubjects: subjectsData.length,
          averageMarks: studentPerformanceData.average_marks || 0,
          coAttainment: coAttainment.data?.overall_attainment || 0,
          poAttainment: poAttainment.data?.overall_attainment || 0,
          cgpa: studentPerformanceData.cgpa || 0,
          attendance: studentPerformanceData.attendance || 0,
          ranking: studentPerformanceData.ranking || 0
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      }
    }

    loadStats()
  }, [user])

  const statCards = [
    {
      name: 'Enrolled Subjects',
      value: stats.enrolledSubjects,
      icon: BookOpen,
      color: 'bg-blue-500',
    },
    {
      name: 'Average Marks',
      value: `${stats.averageMarks}%`,
      icon: Award,
      color: 'bg-green-500',
    },
    {
      name: 'CO Attainment',
      value: `${stats.coAttainment}%`,
      icon: Target,
      color: 'bg-purple-500',
    },
    {
      name: 'PO Attainment',
      value: `${stats.poAttainment}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Student Dashboard</h2>
        <p className="text-gray-600">Track your academic progress and performance</p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">Academic Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Current Semester</span>
              <span className="text-sm font-medium text-gray-900">Semester 1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">CGPA</span>
              <span className="text-sm font-medium text-green-600">{stats.cgpa.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Attendance</span>
              <span className="text-sm font-medium text-blue-600">{stats.attendance.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ranking</span>
              <span className="text-sm font-medium text-purple-600">{stats.ranking}th</span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Focus on improving CO3 in Data Structures - current attainment: 65%
              </p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                Great progress in PO2 (Problem Analysis) - keep it up!
              </p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Your overall performance is above average. Continue the good work!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}