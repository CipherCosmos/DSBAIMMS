'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  LineChart,
  PieChart,
  Users,
  Award,
  BookOpen,
  Calendar,
  Target,
  Activity,
  Download,
  Filter,
  Eye,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface CrossSemesterData {
  metric: string
  description: string
  unit: string
  semesters: Array<{
    semester_id: number
    semester_name: string
    academic_year: string
    value: number
    change_from_previous: number
    student_count: number
    trend_direction: 'up' | 'down' | 'stable'
    benchmark_comparison: number
  }>
  overall_trend: 'improving' | 'declining' | 'stable'
  trend_strength: number
  insights: Array<{
    type: 'positive' | 'negative' | 'neutral'
    message: string
    impact: 'low' | 'medium' | 'high'
  }>
  recommendations: string[]
  benchmark_data: {
    institutional_average: number
    department_average: number
    national_average?: number
  }
}

interface Department {
  id: number
  name: string
  code: string
}

interface Semester {
  id: number
  name: string
  academic_year: string
  is_active: boolean
}

interface MetricComparison {
  metric: string
  current_value: number
  previous_value: number
  change_percentage: number
  trend: 'up' | 'down' | 'stable'
  significance: 'low' | 'medium' | 'high'
}

export function CrossSemesterAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<CrossSemesterData[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'comparison' | 'trends' | 'benchmarks' | 'insights'>('comparison')
  const [timeRange, setTimeRange] = useState<'all' | 'recent' | 'custom'>('recent')
  const [comparisonType, setComparisonType] = useState<'semester' | 'year' | 'department'>('semester')

  const availableMetrics = [
    { id: 'co_attainment', name: 'CO Attainment', description: 'Average Course Outcome attainment' },
    { id: 'po_attainment', name: 'PO Attainment', description: 'Average Program Outcome attainment' },
    { id: 'student_performance', name: 'Student Performance', description: 'Overall student academic performance' },
    { id: 'exam_scores', name: 'Exam Scores', description: 'Average examination scores' },
    { id: 'attendance', name: 'Attendance', description: 'Student attendance rates' },
    { id: 'assignment_completion', name: 'Assignment Completion', description: 'Assignment completion rates' },
    { id: 'pass_rate', name: 'Pass Rate', description: 'Student pass rates' },
    { id: 'graduation_rate', name: 'Graduation Rate', description: 'Student graduation rates' }
  ]

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (departments.length > 0 && semesters.length > 0) {
      loadAnalyticsData()
    }
  }, [selectedDepartment, selectedSemesters, selectedMetrics, timeRange, comparisonType])

  const loadInitialData = async () => {
    try {
      const [departmentsData, semestersData] = await Promise.all([
        apiClient.get('/api/departments'),
        apiClient.get('/api/semesters')
      ])
      setDepartments(departmentsData.data || [])
      setSemesters(semestersData.data || [])
      
      // Set default selections
      const recentSemesters = (semestersData.data || []).slice(-4).map((s: Semester) => s.id)
      setSelectedSemesters(recentSemesters)
      setSelectedMetrics(['co_attainment', 'student_performance'])
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      const params: any = {
        metrics: selectedMetrics,
        semesters: selectedSemesters,
        time_range: timeRange,
        comparison_type: comparisonType
      }
      
      if (selectedDepartment) params.department_id = selectedDepartment

      const response = await apiClient.get('/api/analytics/cross-semester-comparison', { params })
      setAnalyticsData(response.data || [])
    } catch (error) {
      console.error('Error loading analytics data:', error)
      toast.error('Failed to load cross-semester analytics')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format: 'pdf' | 'excel') => {
    try {
      const params: any = { format }
      if (selectedDepartment) params.department_id = selectedDepartment
      if (selectedSemesters.length > 0) params.semesters = selectedSemesters
      if (selectedMetrics.length > 0) params.metrics = selectedMetrics

      const response = await apiClient.get('/api/analytics/export-cross-semester-report', { params })
      
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cross_semester_analytics.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Cross-semester report exported successfully')
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
      case 'improving':
        return <ArrowUp className="h-4 w-4 text-green-600" />
      case 'down':
      case 'declining':
        return <ArrowDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
      case 'improving':
        return 'text-green-600 bg-green-100'
      case 'down':
      case 'declining':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'negative':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 border-green-200'
      case 'negative':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cross-Semester Analytics</h1>
          <p className="text-gray-600">Compare performance across multiple semesters and academic years</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => exportReport('excel')}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          <button
            onClick={() => exportReport('pdf')}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semesters</label>
            <select
              multiple
              value={selectedSemesters.map(String)}
              onChange={(e) => setSelectedSemesters(Array.from(e.target.selectedOptions, option => Number(option.value)))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              size={3}
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} ({sem.academic_year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metrics</label>
            <select
              multiple
              value={selectedMetrics}
              onChange={(e) => setSelectedMetrics(Array.from(e.target.selectedOptions, option => option.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              size={3}
            >
              {availableMetrics.map((metric) => (
                <option key={metric.id} value={metric.id}>{metric.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="recent">Recent (2 years)</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comparison Type</label>
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="semester">Semester-wise</option>
              <option value="year">Year-wise</option>
              <option value="department">Department-wise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="comparison">Comparison</option>
              <option value="trends">Trends</option>
              <option value="benchmarks">Benchmarks</option>
              <option value="insights">Insights</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Semesters Analyzed</p>
              <p className="text-2xl font-semibold text-gray-900">{selectedSemesters.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Improving Metrics</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analyticsData.filter(item => item.overall_trend === 'improving').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-500">
              <TrendingDown className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Declining Metrics</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analyticsData.filter(item => item.overall_trend === 'declining').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Metrics</p>
              <p className="text-2xl font-semibold text-gray-900">{analyticsData.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'comparison' && (
        <div className="space-y-6">
          {analyticsData.map((metric, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{metric.metric}</h3>
                  <p className="text-gray-600">{metric.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {getTrendIcon(metric.overall_trend)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(metric.overall_trend)}`}>
                    {metric.overall_trend}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Semester
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trend
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        vs Benchmark
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {metric.semesters.map((semester, semIndex) => (
                      <tr key={semIndex} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{semester.semester_name}</div>
                            <div className="text-sm text-gray-500">{semester.academic_year}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {semester.value.toFixed(1)} {metric.unit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getTrendIcon(semester.trend_direction)}
                            <span className={`ml-1 text-sm ${
                              semester.change_from_previous > 0 ? 'text-green-600' :
                              semester.change_from_previous < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {semester.change_from_previous > 0 ? '+' : ''}{semester.change_from_previous.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {semester.student_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getTrendIcon(semester.trend_direction)}
                            <span className={`ml-1 text-xs px-2 py-1 rounded-full ${getTrendColor(semester.trend_direction)}`}>
                              {semester.trend_direction}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={
                            semester.benchmark_comparison > 0 ? 'text-green-600' :
                            semester.benchmark_comparison < 0 ? 'text-red-600' : 'text-gray-600'
                          }>
                            {semester.benchmark_comparison > 0 ? '+' : ''}{semester.benchmark_comparison.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'trends' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
          <div className="text-center py-12 text-gray-500">
            <LineChart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Interactive trend charts will be implemented here</p>
            <p className="text-sm">This would include line charts, bar charts, and trend analysis visualizations</p>
          </div>
        </div>
      )}

      {viewMode === 'benchmarks' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Benchmark Comparison</h3>
          <div className="space-y-6">
            {analyticsData.map((metric, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{metric.metric}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-blue-600">
                      {metric.benchmark_data.institutional_average.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Institutional Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-green-600">
                      {metric.benchmark_data.department_average.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Department Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-purple-600">
                      {metric.benchmark_data.national_average?.toFixed(1) || 'N/A'}%
                    </div>
                    <div className="text-sm text-gray-600">National Average</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'insights' && (
        <div className="space-y-6">
          {analyticsData.map((metric, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{metric.metric}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(metric.overall_trend)}`}>
                  {metric.overall_trend}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Key Insights</h4>
                  <div className="space-y-2">
                    {metric.insights.map((insight, insightIndex) => (
                      <div key={insightIndex} className={`border rounded-lg p-3 ${getInsightColor(insight.type)}`}>
                        <div className="flex items-start">
                          {getInsightIcon(insight.type)}
                          <div className="ml-2">
                            <p className="text-sm text-gray-700">{insight.message}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                              insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {insight.impact} impact
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
                  <ul className="space-y-2">
                    {metric.recommendations.map((recommendation, recIndex) => (
                      <li key={recIndex} className="flex items-start">
                        <span className="mr-2 text-blue-600">•</span>
                        <span className="text-sm text-gray-700">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
