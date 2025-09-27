'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { BookOpen, FileText, Users, TrendingUp } from 'lucide-react'

export function TeacherDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    mySubjects: 0,
    totalExams: 0,
    totalStudents: 0,
    coAttainment: 0
  })

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return

      try {
        const [subjects, exams, coAttainment] = await Promise.all([
          apiClient.getSubjects({ teacher_id: user.id }),
          apiClient.getExams({ teacher_id: user.id }),
          apiClient.getCOAttainment({ teacher_id: user.id })
        ])

        // Calculate total students from subjects
        const subjectsData = subjects.data || []
        const examsData = exams.data || []
        const totalStudents = subjectsData.reduce((total: number, subject: any) => {
          return total + (subject.student_count || 0)
        }, 0)

        setStats({
          mySubjects: subjectsData.length,
          totalExams: examsData.length,
          totalStudents: totalStudents,
          coAttainment: coAttainment.data?.overall_attainment || 0
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      }
    }

    loadStats()
  }, [user])

  const statCards = [
    {
      name: 'My Subjects',
      value: stats.mySubjects,
      icon: BookOpen,
      color: 'bg-blue-500',
    },
    {
      name: 'Total Exams',
      value: stats.totalExams,
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      name: 'Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      name: 'CO Attainment',
      value: `${stats.coAttainment.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h2>
        <p className="text-gray-600">Manage your courses and track student performance</p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              Create New Exam
            </button>
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              Enter Marks
            </button>
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              View CO/PO Analytics
            </button>
            <button className="w-full text-left p-3 border rounded-md hover:bg-gray-50">
              Generate Reports
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Exams</h3>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              No exams created yet. Create your first exam to get started.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard