'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Users, BookOpen, Download, Filter } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface COAttainment {
  co_id: number
  co_name: string
  co_description: string
  subject_name: string
  attainment_percentage: number
  attainment_level: string
  students_count: number
  students_above_threshold: number
}

interface POAttainment {
  po_id: number
  po_name: string
  po_description: string
  department_name: string
  weighted_attainment: number
  attainment_level: string
  contributing_cos: number
}

interface StudentPerformance {
  student_id: number
  student_name: string
  overall_percentage: number
  co_attainments: Array<{
    co_name: string
    percentage: number
    attainment_level: string
  }>
  weak_areas: string[]
  recommendations: string[]
}

interface DashboardStats {
  total_users?: number
  department_users?: number
  my_subjects?: number
  exams_taken?: number
  overall_percentage?: number
  avg_co_attainment?: number
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [coAttainment, setCOAttainment] = useState<COAttainment[]>([])
  const [poAttainment, setPOAttainment] = useState<POAttainment[]>([])
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([])
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({})
  const [loading, setLoading] = useState(true)
  // const [selectedMetric] = useState('co_attainment')

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const { apiClient } = await import('@/lib/api')

      // Load dashboard stats
      try {
        const response = await apiClient.getDashboardStats()
        setDashboardStats(response.data)
      } catch (error) {
        console.warn('Failed to load dashboard stats:', error)
      }

      // Load CO attainment
      try {
        const response = await apiClient.getCOAttainment()
        setCOAttainment(response.data)
      } catch (error) {
        console.warn('Failed to load CO attainment:', error)
      }

      // Load PO attainment (for admin, hod, teacher)
      if (user?.role !== 'student') {
        try {
          const response = await apiClient.getPOAttainment()
          setPOAttainment(response.data)
        } catch (error) {
          console.warn('Failed to load PO attainment:', error)
        }
      }

      // Load student performance
      try {
        const response = await apiClient.getStudentPerformance()
        setStudentPerformance(response.slice(0, 10)) // Limit to first 10 students
      } catch (error) {
        console.warn('Failed to load student performance:', error)
      }

    } catch (error) {
      console.error('Error loading analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const getAttainmentLevelColor = (level: string) => {
    const colors = {
      'Exceeds': 'bg-green-100 text-green-800',
      'Meets': 'bg-blue-100 text-blue-800',
      'Below': 'bg-red-100 text-red-800'
    }
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  // Prepare chart data
  const coChartData = coAttainment.map(co => ({
    name: co.co_name,
    attainment: co.attainment_percentage,
    subject: co.subject_name
  }))

  const poChartData = poAttainment.map(po => ({
    name: po.po_name,
    attainment: po.weighted_attainment,
    cos: po.contributing_cos
  }))

  const studentChartData = studentPerformance.map(student => ({
    name: student.student_name.split(' ')[0], // First name only for chart
    percentage: student.overall_percentage
  }))

  const attainmentLevelDistribution = coAttainment.reduce((acc, co) => {
    acc[co.attainment_level] = (acc[co.attainment_level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pieChartData = Object.entries(attainmentLevelDistribution).map(([level, count]) => ({
    name: level,
    value: count
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            {user?.role === 'student' 
              ? 'Track your academic progress and CO/PO attainment'
              : 'Monitor CO/PO attainment and student performance'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Dashboard Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {user?.role === 'admin' && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold">{dashboardStats.total_users || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Avg CO Attainment</p>
                    <p className="text-2xl font-bold">{Math.round(dashboardStats.avg_co_attainment || 0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {user?.role === 'hod' && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Department Users</p>
                    <p className="text-2xl font-bold">{dashboardStats.department_users || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Dept Attainment</p>
                    <p className="text-2xl font-bold">{Math.round(dashboardStats.avg_department_attainment || 0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {user?.role === 'teacher' && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">My Subjects</p>
                    <p className="text-2xl font-bold">{dashboardStats.my_subjects || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Class Performance</p>
                    <p className="text-2xl font-bold">{Math.round(dashboardStats.avg_class_performance || 0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {user?.role === 'student' && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">My Subjects</p>
                    <p className="text-2xl font-bold">{dashboardStats.my_subjects || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Overall Percentage</p>
                    <p className="text-2xl font-bold">{Math.round(dashboardStats.overall_percentage || 0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Exams Taken</p>
                    <p className="text-2xl font-bold">{dashboardStats.exams_taken || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total COs</p>
                <p className="text-2xl font-bold">{coAttainment.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CO Attainment Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>CO Attainment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={coChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="attainment" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attainment Level Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attainment Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData && Array.isArray(pieChartData) && pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Student Performance Chart (for non-students) */}
        {user?.role !== 'student' && studentPerformance.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Top Student Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={studentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="percentage" stroke="#00C49F" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* PO Attainment (for non-students) */}
        {user?.role !== 'student' && poAttainment.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Program Outcomes Attainment</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={poChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="attainment" fill="#FFBB28" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CO Attainment Table */}
        <Card>
          <CardHeader>
            <CardTitle>Course Outcomes Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">CO</th>
                    <th className="text-left p-2 font-medium">Subject</th>
                    <th className="text-left p-2 font-medium">Attainment</th>
                    <th className="text-left p-2 font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {coAttainment.slice(0, 10).map((co) => (
                    <tr key={co.co_id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{co.co_name}</td>
                      <td className="p-2 text-sm text-gray-600">{co.subject_name}</td>
                      <td className="p-2">{co.attainment_percentage.toFixed(1)}%</td>
                      <td className="p-2">
                        <Badge className={getAttainmentLevelColor(co.attainment_level)}>
                          {co.attainment_level}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Student Recommendations (for students) */}
        {user?.role === 'student' && studentPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Personalized Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentPerformance[0].weak_areas.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Areas for Improvement:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {studentPerformance[0].weak_areas.map((area, index) => (
                        <li key={index} className="text-sm text-gray-600">{area}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {studentPerformance[0].recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2">Recommendations:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {studentPerformance[0].recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-gray-600">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PO Attainment Table (for non-students) */}
        {user?.role !== 'student' && poAttainment.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Program Outcomes Detail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">PO</th>
                      <th className="text-left p-2 font-medium">Attainment</th>
                      <th className="text-left p-2 font-medium">COs</th>
                      <th className="text-left p-2 font-medium">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poAttainment.slice(0, 10).map((po) => (
                      <tr key={po.po_id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{po.po_name}</td>
                        <td className="p-2">{po.weighted_attainment.toFixed(1)}%</td>
                        <td className="p-2">{po.contributing_cos}</td>
                        <td className="p-2">
                          <Badge className={getAttainmentLevelColor(po.attainment_level)}>
                            {po.attainment_level}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}