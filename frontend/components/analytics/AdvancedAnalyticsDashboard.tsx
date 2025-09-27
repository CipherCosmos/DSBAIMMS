'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BookOpen, 
  Target, 
  Award,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  Zap
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface RealtimeStats {
  timestamp: string
  active_users: number
  system_load: number
  memory_usage: number
  database_connections: number
  api_requests_per_minute: number
  cpu_usage: number
  disk_usage: number
  response_time: number
}

interface PredictiveInsight {
  id: string
  type: 'performance' | 'risk' | 'opportunity' | 'trend'
  title: string
  description: string
  confidence: number
  impact: 'low' | 'medium' | 'high'
  recommendation: string
  data_points: number[]
  trend: 'up' | 'down' | 'stable'
}

interface COPOAnalytics {
  co_id: number
  co_name: string
  po_id: number
  po_name: string
  current_attainment: number
  target_attainment: number
  trend_data: Array<{
    semester: string
    attainment: number
    student_count: number
  }>
  bloom_distribution: Record<string, number>
  difficulty_analysis: {
    easy: { count: number; avg_score: number }
    medium: { count: number; avg_score: number }
    hard: { count: number; avg_score: number }
  }
  student_performance: Array<{
    student_id: number
    student_name: string
    attainment: number
    grade: string
  }>
}

interface CrossSemesterComparison {
  metric: string
  semesters: Array<{
    semester_name: string
    value: number
    change_from_previous: number
    student_count: number
  }>
  trend: 'improving' | 'declining' | 'stable'
  insights: string[]
}

interface PerformancePrediction {
  student_id: number
  student_name: string
  current_performance: number
  predicted_performance: number
  confidence_score: number
  risk_factors: string[]
  recommendations: string[]
  next_exam_prediction: number
}

export function AdvancedAnalyticsDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'copo' | 'predictive' | 'realtime' | 'comparison'>('overview')
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null)
  const [predictiveInsights, setPredictiveInsights] = useState<PredictiveInsight[]>([])
  const [copoAnalytics, setCopoAnalytics] = useState<COPOAnalytics[]>([])
  const [crossSemesterData, setCrossSemesterData] = useState<CrossSemesterComparison[]>([])
  const [performancePredictions, setPerformancePredictions] = useState<PerformancePrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadAnalyticsData()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [selectedTimeRange, selectedDepartment, selectedSemester])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      const params: any = {
        time_range: selectedTimeRange,
        department_id: selectedDepartment,
        semester_id: selectedSemester
      }

      const [insightsData, copoData, comparisonData, predictionsData] = await Promise.allSettled([
        apiClient.get('/api/analytics/predictive-insights', { params }),
        apiClient.get('/api/analytics/advanced-copo', { params }),
        apiClient.get('/api/analytics/cross-semester-comparison', { params }),
        apiClient.get('/api/analytics/performance-predictions', { params })
      ])

      if (insightsData.status === 'fulfilled') {
        setPredictiveInsights(insightsData.value.data || [])
      }
      if (copoData.status === 'fulfilled') {
        setCopoAnalytics(copoData.value.data || [])
      }
      if (comparisonData.status === 'fulfilled') {
        setCrossSemesterData(comparisonData.value.data || [])
      }
      if (predictionsData.status === 'fulfilled') {
        setPerformancePredictions(predictionsData.value.data || [])
      }
    } catch (error) {
      console.error('Error loading analytics data:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const connectRealtimeUpdates = () => {
    if (realtimeEnabled) return

    try {
      // Connect to WebSocket for real-time updates
      wsRef.current = new WebSocket('ws://localhost:8001/ws/analytics')
      
      wsRef.current.onopen = () => {
        setRealtimeEnabled(true)
        toast.success('Real-time updates connected')
      }

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'realtime_stats') {
          setRealtimeStats(data.payload)
        } else if (data.type === 'predictive_update') {
          setPredictiveInsights(prev => [...prev, data.payload])
        }
      }

      wsRef.current.onclose = () => {
        setRealtimeEnabled(false)
        toast.success('Real-time connection closed')
      }

      wsRef.current.onerror = () => {
        setRealtimeEnabled(false)
        toast.error('Real-time connection failed')
      }

      // Fallback polling if WebSocket fails
      intervalRef.current = setInterval(async () => {
        try {
          const statsResponse = await apiClient.get('/api/analytics/realtime-stats', { params: {} })
          setRealtimeStats(statsResponse.data)
        } catch (error) {
          console.error('Error fetching real-time stats:', error)
        }
      }, 30000) // Poll every 30 seconds

    } catch (error) {
      console.error('Error connecting to real-time updates:', error)
      toast.error('Failed to connect to real-time updates')
    }
  }

  const disconnectRealtimeUpdates = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setRealtimeEnabled(false)
  }

  const exportAnalytics = async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      const response = await apiClient.get(`/api/analytics/export?format=${format}&time_range=${selectedTimeRange}`)
      
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `analytics_${selectedTimeRange}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Analytics exported successfully')
    } catch (error) {
      toast.error('Failed to export analytics')
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'performance': return <TrendingUp className="h-5 w-5" />
      case 'risk': return <AlertTriangle className="h-5 w-5" />
      case 'opportunity': return <Target className="h-5 w-5" />
      case 'trend': return <BarChart3 className="h-5 w-5" />
      default: return <Info className="h-5 w-5" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'performance': return 'text-green-600 bg-green-100'
      case 'risk': return 'text-red-600 bg-red-100'
      case 'opportunity': return 'text-blue-600 bg-blue-100'
      case 'trend': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
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
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600">Comprehensive insights and predictive analytics</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={realtimeEnabled ? disconnectRealtimeUpdates : connectRealtimeUpdates}
            className={`flex items-center px-4 py-2 rounded-lg ${
              realtimeEnabled 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            <Zap className="h-4 w-4 mr-2" />
            {realtimeEnabled ? 'Disconnect' : 'Real-time'}
          </button>
          <div className="flex space-x-2">
            <button
              onClick={() => exportAnalytics('pdf')}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              <Download className="h-4 w-4 mr-1" />
              PDF
            </button>
            <button
              onClick={() => exportAnalytics('excel')}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Download className="h-4 w-4 mr-1" />
              Excel
            </button>
          </div>
          <button
            onClick={loadAnalyticsData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(Number(e.target.value) || null)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {/* Add department options */}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <select
              value={selectedSemester || ''}
              onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Semesters</option>
              {/* Add semester options */}
            </select>
          </div>
        </div>
      </div>

      {/* Real-time Stats Banner */}
      {realtimeStats && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span className="font-medium">Real-time System Status</span>
              <div className={`w-2 h-2 rounded-full ${realtimeEnabled ? 'bg-green-400' : 'bg-red-400'}`}></div>
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{realtimeStats.active_users} active users</span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4" />
                <span>{realtimeStats.api_requests_per_minute} req/min</span>
              </div>
              <div className="flex items-center space-x-1">
                <Activity className="h-4 w-4" />
                <span>{realtimeStats.response_time}ms avg</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>{realtimeStats.cpu_usage}% CPU</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'copo', name: 'CO/PO Analytics', icon: Target },
            { id: 'predictive', name: 'Predictive Insights', icon: TrendingUp },
            { id: 'realtime', name: 'Real-time', icon: Activity },
            { id: 'comparison', name: 'Cross-Semester', icon: LineChart }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-500">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-semibold text-gray-900">1,247</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +5.2% from last month
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-500">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">CO Attainment</p>
                  <p className="text-2xl font-semibold text-gray-900">78.5%</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +2.1% from last semester
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-500">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                  <p className="text-2xl font-semibold text-gray-900">82.3%</p>
                  <p className="text-sm text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +1.8% from last month
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-orange-500">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Exams</p>
                  <p className="text-2xl font-semibold text-gray-900">23</p>
                  <p className="text-sm text-blue-600 flex items-center">
                    <Info className="h-3 w-3 mr-1" />
                    12 scheduled this week
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Predictive Insights Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictiveInsights.slice(0, 6).map((insight) => (
                <div key={insight.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${getInsightColor(insight.type)}`}>
                      {getInsightIcon(insight.type)}
                    </div>
                    <span className={`text-xs font-medium ${getImpactColor(insight.impact)}`}>
                      {insight.impact.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">{insight.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {insight.confidence}% confidence
                    </span>
                    <span className={`text-xs ${
                      insight.trend === 'up' ? 'text-green-600' : 
                      insight.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {insight.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CO/PO Analytics Tab */}
      {activeTab === 'copo' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CO/PO Attainment Analysis</h3>
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
                      Trend
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
                  {copoAnalytics.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.co_name}</div>
                          <div className="text-sm text-gray-500">{item.po_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
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
                        <span className={item.current_attainment >= item.target_attainment ? 'text-green-600' : 'text-red-600'}>
                          {item.current_attainment >= item.target_attainment ? '+' : ''}
                          {(item.current_attainment - item.target_attainment).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-green-600">+2.3%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.student_performance.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Predictive Insights Tab */}
      {activeTab === 'predictive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Predictions</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Predicted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk Factors
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {performancePredictions.map((prediction, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {prediction.student_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(prediction.current_performance, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{prediction.current_performance.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(prediction.predicted_performance, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{prediction.predicted_performance.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${
                          prediction.confidence_score >= 80 ? 'text-green-600' :
                          prediction.confidence_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {prediction.confidence_score.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {prediction.risk_factors.slice(0, 2).map((risk, riskIndex) => (
                            <span key={riskIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {risk}
                            </span>
                          ))}
                          {prediction.risk_factors.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{prediction.risk_factors.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Tab */}
      {activeTab === 'realtime' && (
        <div className="space-y-6">
          {realtimeStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-green-500">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-2xl font-semibold text-gray-900">{realtimeStats.active_users}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-blue-500">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">API Requests/min</p>
                    <p className="text-2xl font-semibold text-gray-900">{realtimeStats.api_requests_per_minute}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-purple-500">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Response Time</p>
                    <p className="text-2xl font-semibold text-gray-900">{realtimeStats.response_time}ms</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-orange-500">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                    <p className="text-2xl font-semibold text-gray-900">{realtimeStats.cpu_usage}%</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No real-time data</h3>
              <p className="text-gray-600 mb-4">Connect to real-time updates to see live system metrics</p>
              <button
                onClick={connectRealtimeUpdates}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Connect Real-time
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cross-Semester Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cross-Semester Performance</h3>
            <div className="space-y-6">
              {crossSemesterData.map((comparison, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">{comparison.metric}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      comparison.trend === 'improving' ? 'bg-green-100 text-green-800' :
                      comparison.trend === 'declining' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {comparison.trend}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {comparison.semesters.map((semester, semIndex) => (
                      <div key={semIndex} className="text-center">
                        <div className="text-lg font-semibold text-gray-900">{semester.value.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">{semester.semester_name}</div>
                        <div className={`text-xs ${
                          semester.change_from_previous > 0 ? 'text-green-600' :
                          semester.change_from_previous < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {semester.change_from_previous > 0 ? '+' : ''}{semester.change_from_previous.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Key Insights:</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {comparison.insights.map((insight, insightIndex) => (
                        <li key={insightIndex} className="flex items-start">
                          <span className="mr-2">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
