'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { AdminGuard } from '@/components/auth/RoleGuard'
import { 
  Monitor, RefreshCw, Download, AlertTriangle, CheckCircle, XCircle,
  Server, Database, Users, Activity, Clock, TrendingUp, TrendingDown,
  Cpu, HardDrive, Wifi, Shield, Eye, BarChart3, Settings
} from 'lucide-react'

interface SystemHealth {
  status: string
  uptime: number
  memory_usage: number
  cpu_usage: number
  disk_usage: number
  database_status: string
  redis_status: string
  kafka_status: string
  last_updated: string
}

interface ServiceStatus {
  name: string
  status: string
  uptime: number
  response_time: number
  last_check: string
  error_count: number
}

interface UserActivity {
  total_users: number
  active_users: number
  new_users_today: number
  login_attempts: number
  failed_logins: number
}

interface SystemMetrics {
  total_requests: number
  requests_per_minute: number
  average_response_time: number
  error_rate: number
  database_connections: number
  cache_hit_rate: number
}

interface SecurityEvent {
  id: number
  event_type: string
  severity: string
  description: string
  source_ip?: string
  user_id?: number
  user_name?: string
  timestamp: string
  resolved: boolean
}

function MonitoringPage() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30)

  useEffect(() => {
    loadData()
    
    if (autoRefresh) {
      const interval = setInterval(loadData, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [healthResponse, servicesResponse, activityResponse, metricsResponse, securityResponse] = await Promise.all([
        apiClient.get('/api/monitoring/health'),
        apiClient.get('/api/monitoring/services'),
        apiClient.get('/api/monitoring/activity'),
        apiClient.get('/api/monitoring/metrics'),
        apiClient.get('/api/monitoring/security-events')
      ])

      setSystemHealth(healthResponse.data)
      setServices(servicesResponse.data || [])
      setUserActivity(activityResponse.data)
      setMetrics(metricsResponse.data)
      setSecurityEvents(securityResponse.data || [])
    } catch (error) {
      console.error('Error loading monitoring data:', error)
      setError('Failed to load monitoring data')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'online':
        return 'text-green-600'
      case 'warning':
      case 'degraded':
        return 'text-yellow-600'
      case 'error':
      case 'down':
      case 'offline':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error':
      case 'down':
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const exportData = async () => {
    try {
      const data = {
        systemHealth,
        services,
        userActivity,
        metrics,
        securityEvents,
        timestamp: new Date().toISOString()
      }
      
      const csvContent = JSON.stringify(data, null, 2)
      const blob = new Blob([csvContent], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `system-monitoring-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  if (loading && !systemHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-gray-600">Real-time system health and performance monitoring</p>
        </div>
        <div className="flex space-x-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Auto Refresh:</label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              disabled={!autoRefresh}
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
          </div>
          <button
            onClick={loadData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Server className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <div className="flex items-center">
                  {getStatusIcon(systemHealth.status)}
                  <span className={`ml-2 text-lg font-semibold ${getStatusColor(systemHealth.status)}`}>
                    {systemHealth.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatUptime(systemHealth.uptime)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Cpu className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-lg font-semibold text-gray-900">
                  {systemHealth.cpu_usage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-orange-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                <p className="text-lg font-semibold text-gray-900">
                  {systemHealth.memory_usage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Services Status</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{service.name}</h4>
                  {getStatusIcon(service.status)}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Status: <span className={getStatusColor(service.status)}>{service.status}</span></div>
                  <div>Uptime: {formatUptime(service.uptime)}</div>
                  <div>Response Time: {service.response_time}ms</div>
                  <div>Errors: {service.error_count}</div>
                  <div className="text-xs text-gray-400">
                    Last Check: {new Date(service.last_check).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Activity & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Activity */}
        {userActivity && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">User Activity</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{userActivity.total_users}</p>
                  <p className="text-sm text-gray-600">Total Users</p>
                </div>
                <div className="text-center">
                  <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{userActivity.active_users}</p>
                  <p className="text-sm text-gray-600">Active Users</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{userActivity.new_users_today}</p>
                  <p className="text-sm text-gray-600">New Today</p>
                </div>
                <div className="text-center">
                  <Shield className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{userActivity.failed_logins}</p>
                  <p className="text-sm text-gray-600">Failed Logins</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Metrics */}
        {metrics && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">System Metrics</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Requests</span>
                  <span className="font-semibold">{metrics.total_requests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Requests/Min</span>
                  <span className="font-semibold">{metrics.requests_per_minute}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Response Time</span>
                  <span className="font-semibold">{metrics.average_response_time}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Error Rate</span>
                  <span className={`font-semibold ${metrics.error_rate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics.error_rate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">DB Connections</span>
                  <span className="font-semibold">{metrics.database_connections}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cache Hit Rate</span>
                  <span className="font-semibold">{metrics.cache_hit_rate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Events */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Security Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {securityEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.event_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(event.severity)}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {event.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.source_ip || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.user_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      event.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {event.resolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Database & Infrastructure Status */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Database className="h-6 w-6 text-blue-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Database</h3>
            </div>
            <div className="flex items-center">
              {getStatusIcon(systemHealth.database_status)}
              <span className={`ml-2 font-medium ${getStatusColor(systemHealth.database_status)}`}>
                {systemHealth.database_status}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Disk Usage: {systemHealth.disk_usage.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Activity className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Redis Cache</h3>
            </div>
            <div className="flex items-center">
              {getStatusIcon(systemHealth.redis_status)}
              <span className={`ml-2 font-medium ${getStatusColor(systemHealth.redis_status)}`}>
                {systemHealth.redis_status}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Memory: {systemHealth.memory_usage.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Wifi className="h-6 w-6 text-green-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Kafka</h3>
            </div>
            <div className="flex items-center">
              {getStatusIcon(systemHealth.kafka_status)}
              <span className={`ml-2 font-medium ${getStatusColor(systemHealth.kafka_status)}`}>
                {systemHealth.kafka_status}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Last Updated: {new Date(systemHealth.last_updated).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MonitoringPageWithGuard() {
  return (
    <AdminGuard>
      <MonitoringPage />
    </AdminGuard>
  )
}