'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart,
  LineChart,
  Users,
  Award,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  Filter,
  Calendar,
  BookOpen,
  Activity
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface COPOData {
  co_id: number
  co_name: string
  co_description: string
  po_id: number
  po_name: string
  po_description: string
  current_attainment: number
  target_attainment: number
  trend_data: Array<{
    semester: string
    attainment: number
    student_count: number
    exams_count: number
  }>
  bloom_distribution: {
    remember: number
    understand: number
    apply: number
    analyze: number
    evaluate: number
    create: number
  }
  difficulty_analysis: {
    easy: { count: number; avg_score: number; percentage: number }
    medium: { count: number; avg_score: number; percentage: number }
    hard: { count: number; avg_score: number; percentage: number }
  }
  student_performance: Array<{
    student_id: number
    student_name: string
    attainment: number
    grade: string
    trend: 'up' | 'down' | 'stable'
  }>
  mapping_strength: number
  assessment_methods: string[]
  improvement_suggestions: string[]
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
}

export function COPOAnalytics() {
  const [copData, setCopData] = useState<COPOData[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [selectedCO, setSelectedCO] = useState<number | null>(null)
  const [selectedPO, setSelectedPO] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends' | 'students'>('overview')
  const [sortBy, setSortBy] = useState<'attainment' | 'trend' | 'students' | 'mapping'>('attainment')
  const [filterBy, setFilterBy] = useState<'all' | 'below_target' | 'above_target' | 'critical'>('all')

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadCOPOData()
  }, [selectedDepartment, selectedSemester, selectedCO, selectedPO])

  const loadInitialData = async () => {
    try {
      const [departmentsData, semestersData] = await Promise.all([
        apiClient.get('/api/departments'),
        apiClient.get('/api/semesters')
      ])
      setDepartments(departmentsData.data || [])
      setSemesters(semestersData.data || [])
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load departments and semesters')
    }
  }

  const loadCOPOData = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (selectedDepartment) params.department_id = selectedDepartment
      if (selectedSemester) params.semester_id = selectedSemester
      if (selectedCO) params.co_id = selectedCO
      if (selectedPO) params.po_id = selectedPO

      const response = await apiClient.get('/api/analytics/advanced-copo', { params })
      setCopData(response.data || [])
    } catch (error) {
      console.error('Error loading CO/PO data:', error)
      toast.error('Failed to load CO/PO analytics')
    } finally {
      setLoading(false)
    }
  }

  const exportCOPOReport = async (format: 'pdf' | 'excel') => {
    try {
      const params: any = { format }
      if (selectedDepartment) params.department_id = selectedDepartment
      if (selectedSemester) params.semester_id = selectedSemester

      const response = await apiClient.get('/api/analytics/export-copo-report', { params })
      
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `copo_analytics_report.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('CO/PO report exported successfully')
    } catch (error) {
      toast.error('Failed to export CO/PO report')
    }
  }

  const getAttainmentColor = (current: number, target: number) => {
    const percentage = (current / target) * 100
    if (percentage >= 100) return 'text-green-600 bg-green-100'
    if (percentage >= 80) return 'text-yellow-600 bg-yellow-100'
    if (percentage >= 60) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getAttainmentStatus = (current: number, target: number) => {
    const percentage = (current / target) * 100
    if (percentage >= 100) return { status: 'Achieved', icon: CheckCircle, color: 'text-green-600' }
    if (percentage >= 80) return { status: 'On Track', icon: TrendingUp, color: 'text-blue-600' }
    if (percentage >= 60) return { status: 'Below Target', icon: AlertTriangle, color: 'text-yellow-600' }
    return { status: 'Critical', icon: AlertTriangle, color: 'text-red-600' }
  }

  const filteredData = copData.filter(item => {
    if (filterBy === 'all') return true
    if (filterBy === 'below_target') return item.current_attainment < item.target_attainment
    if (filterBy === 'above_target') return item.current_attainment >= item.target_attainment
    if (filterBy === 'critical') return item.current_attainment < item.target_attainment * 0.7
    return true
  }).sort((a, b) => {
    switch (sortBy) {
      case 'attainment':
        return b.current_attainment - a.current_attainment
      case 'trend':
        // Sort by trend data (simplified)
        const aTrend = a.trend_data[a.trend_data.length - 1]?.attainment || 0
        const bTrend = b.trend_data[b.trend_data.length - 1]?.attainment || 0
        return bTrend - aTrend
      case 'students':
        return b.student_performance.length - a.student_performance.length
      case 'mapping':
        return b.mapping_strength - a.mapping_strength
      default:
        return 0
    }
  })

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
          <h1 className="text-3xl font-bold text-gray-900">CO/PO Analytics</h1>
          <p className="text-gray-600">Comprehensive analysis of Course and Program Outcomes</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => exportCOPOReport('excel')}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          <button
            onClick={() => exportCOPOReport('pdf')}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              value={selectedSemester || ''}
              onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Semesters</option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>{sem.name} ({sem.academic_year})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter By</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All CO/PO</option>
              <option value="below_target">Below Target</option>
              <option value="above_target">Above Target</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="attainment">Attainment</option>
              <option value="trend">Trend</option>
              <option value="students">Students</option>
              <option value="mapping">Mapping Strength</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="overview">Overview</option>
              <option value="detailed">Detailed</option>
              <option value="trends">Trends</option>
              <option value="students">Students</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total CO/PO Pairs</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredData.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Achieved Target</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredData.filter(item => item.current_attainment >= item.target_attainment).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-500">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Below Target</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredData.filter(item => item.current_attainment < item.target_attainment).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredData.reduce((sum, item) => sum + item.student_performance.length, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'overview' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">CO/PO Attainment Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CO/PO Pair
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, index) => {
                  const attainmentStatus = getAttainmentStatus(item.current_attainment, item.target_attainment)
                  const gap = item.current_attainment - item.target_attainment
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.co_name}</div>
                          <div className="text-sm text-gray-500">{item.po_name}</div>
                          <div className="text-xs text-gray-400">Strength: {item.mapping_strength.toFixed(1)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(item.current_attainment, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{item.current_attainment.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.target_attainment}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={gap >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {gap >= 0 ? '+' : ''}{gap.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <attainmentStatus.icon className={`h-4 w-4 mr-1 ${attainmentStatus.color}`} />
                          <span className={`text-xs font-medium ${getAttainmentColor(item.current_attainment, item.target_attainment)}`}>
                            {attainmentStatus.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {item.student_performance.length}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => {
                            setSelectedCO(item.co_id)
                            setSelectedPO(item.po_id)
                            setViewMode('detailed')
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'detailed' && selectedCO && selectedPO && (
        <DetailedCOPOView 
          data={filteredData.find(item => item.co_id === selectedCO && item.po_id === selectedPO)!}
          onBack={() => {
            setSelectedCO(null)
            setSelectedPO(null)
            setViewMode('overview')
          }}
        />
      )}

      {viewMode === 'trends' && (
        <TrendsView data={filteredData} />
      )}

      {viewMode === 'students' && (
        <StudentsView data={filteredData} />
      )}
    </div>
  )
}

// Detailed CO/PO View Component
interface DetailedCOPOViewProps {
  data: COPOData
  onBack: () => void
}

function DetailedCOPOView({ data, onBack }: DetailedCOPOViewProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{data.co_name} → {data.po_name}</h3>
          <p className="text-gray-600">{data.co_description}</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Back to Overview
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attainment Chart */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Attainment Progress</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Current Attainment</span>
                <span>{data.current_attainment.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(data.current_attainment, 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Target Attainment</span>
                <span>{data.target_attainment}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${data.target_attainment}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bloom's Taxonomy Distribution */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Bloom&apos;s Taxonomy Distribution</h4>
          <div className="space-y-2">
            {Object.entries(data.bloom_distribution).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <span className="text-sm capitalize">{level}</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: `${(count / Math.max(...Object.values(data.bloom_distribution))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Analysis */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Difficulty Analysis</h4>
          <div className="space-y-3">
            {Object.entries(data.difficulty_analysis).map(([level, analysis]) => (
              <div key={level} className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium capitalize">{level}</span>
                  <span className="text-sm text-gray-600">{analysis.percentage.toFixed(1)}%</span>
                </div>
                <div className="text-sm text-gray-600">
                  Count: {analysis.count} | Avg Score: {analysis.avg_score.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement Suggestions */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Improvement Suggestions</h4>
          <ul className="space-y-2">
            {data.improvement_suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2 text-blue-600">•</span>
                <span className="text-sm text-gray-700">{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Trend Data */}
      <div className="mt-6 border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-4">Semester Trends</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Semester</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Attainment</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Students</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Exams</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.trend_data.map((trend, index) => (
                <tr key={index}>
                  <td className="px-3 py-2">{trend.semester}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center">
                      <div className="w-12 bg-gray-200 rounded-full h-1 mr-2">
                        <div 
                          className="bg-blue-600 h-1 rounded-full" 
                          style={{ width: `${Math.min(trend.attainment, 100)}%` }}
                        ></div>
                      </div>
                      <span>{trend.attainment.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{trend.student_count}</td>
                  <td className="px-3 py-2">{trend.exams_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Trends View Component
interface TrendsViewProps {
  data: COPOData[]
}

function TrendsView({ data }: TrendsViewProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
      <div className="text-center py-12 text-gray-500">
        <LineChart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Trend visualization charts will be implemented here</p>
        <p className="text-sm">This would include interactive charts showing CO/PO attainment trends over time</p>
      </div>
    </div>
  )
}

// Students View Component
interface StudentsViewProps {
  data: COPOData[]
}

function StudentsView({ data }: StudentsViewProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Performance Analysis</h3>
      <div className="text-center py-12 text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Student performance analysis will be implemented here</p>
        <p className="text-sm">This would include detailed student-level CO/PO attainment analysis</p>
      </div>
    </div>
  )
}
