'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ErrorTrackingService, 
  errorTrackingUtils,
  type ErrorEvent,
  type ErrorStats,
  type ErrorTrend 
} from '@/lib/monitoring'
import { 
  AlertTriangle, 
  Bug, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Download,
  XCircle,
  Shield,
  Network,
  Database
} from 'lucide-react'

interface ErrorTrackingDashboardProps {
  className?: string
}

export function ErrorTrackingDashboard({ className = '' }: ErrorTrackingDashboardProps) {
  const [errors, setErrors] = useState<ErrorEvent[]>([])
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [trends, setTrends] = useState<ErrorTrend[]>([])
  const [patterns, setPatterns] = useState<Array<{ pattern: string; count: number }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const errorTrackingService = ErrorTrackingService.getInstance()

  const loadData = useCallback(() => {
    setIsLoading(true)
    
    try {
      const newErrors = errorTrackingService.getRecentErrors(24, 100)
      const newStats = errorTrackingService.getErrorStats()
      const newTrends = errorTrackingService.getErrorTrends(7)
      const newPatterns = errorTrackingService.getErrorPatterns()
      
      setErrors(newErrors)
      setStats(newStats)
      setTrends(newTrends)
      setPatterns(newPatterns)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load error tracking data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [errorTrackingService])

  useEffect(() => {
    loadData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000)
    
    return () => clearInterval(interval)
  }, [loadData])

  const exportData = useCallback(() => {
    const data = {
      errors,
      stats,
      trends,
      patterns,
      exportedAt: new Date().toISOString(),
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `error-tracking-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [errors, stats, trends, patterns])

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    }
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      network: <Network className="w-4 h-4" />,
      authentication: <Shield className="w-4 h-4" />,
      authorization: <Shield className="w-4 h-4" />,
      validation: <CheckCircle className="w-4 h-4" />,
      server: <Database className="w-4 h-4" />,
      client: <Bug className="w-4 h-4" />,
      unknown: <AlertTriangle className="w-4 h-4" />,
    }
    return icons[category as keyof typeof icons] || <AlertTriangle className="w-4 h-4" />
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      network: 'bg-blue-100 text-blue-800',
      authentication: 'bg-red-100 text-red-800',
      authorization: 'bg-orange-100 text-orange-800',
      validation: 'bg-yellow-100 text-yellow-800',
      server: 'bg-purple-100 text-purple-800',
      client: 'bg-green-100 text-green-800',
      unknown: 'bg-gray-100 text-gray-800',
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Error Tracking Dashboard</h2>
          <p className="text-gray-600">Error monitoring and resolution tracking</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.total || 0}
            </div>
            <p className="text-xs text-gray-500">All tracked errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.unresolved || 0}
            </div>
            <p className="text-xs text-gray-500">Pending resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Resolution Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.resolutionRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-gray-500">Successfully resolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatDuration(stats?.averageResolutionTime || 0)}
            </div>
            <p className="text-xs text-gray-500">Time to resolve</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Error Categories</CardTitle>
          <CardDescription>Errors grouped by category and severity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats?.byCategory || {}).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getCategoryIcon(category)}
                  <div>
                    <div className="font-medium capitalize">{category}</div>
                    <div className="text-sm text-gray-500">{count} errors</div>
                  </div>
                </div>
                <Badge className={getCategoryColor(category)}>
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Severity */}
      <Card>
        <CardHeader>
          <CardTitle>Error Severity</CardTitle>
          <CardDescription>Errors grouped by severity level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats?.bySeverity || {}).map(([severity, count]) => (
              <div key={severity} className="text-center p-4 border rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  {severity === 'low' && <CheckCircle className="w-6 h-6 text-green-600" />}
                  {severity === 'medium' && <AlertTriangle className="w-6 h-6 text-yellow-600" />}
                  {severity === 'high' && <XCircle className="w-6 h-6 text-orange-600" />}
                  {severity === 'critical' && <AlertTriangle className="w-6 h-6 text-red-600" />}
                </div>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-sm text-gray-500 capitalize">{severity}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Errors</CardTitle>
          <CardDescription>Most frequently occurring errors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.topErrors?.slice(0, 10).map((error, index) => (
              <motion.div
                key={error.error}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-red-600">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">{error.error}</div>
                    <div className="text-xs text-gray-500">
                      Last: {error.lastOccurrence.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {error.count}
                  </div>
                  <Badge className={getSeverityColor(error.severity)}>
                    {error.severity}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>Latest errors from the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {errors.slice(0, 10).map((error, index) => (
              <motion.div
                key={error.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Badge className={getCategoryColor(error.category)}>
                    {getCategoryIcon(error.category)}
                    <span className="ml-1 capitalize">{error.category}</span>
                  </Badge>
                  <div>
                    <div className="font-medium text-sm">{error.error.name}</div>
                    <div className="text-xs text-gray-500">
                      {error.context} • {error.timestamp.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getSeverityColor(error.severity)}>
                    {error.severity}
                  </Badge>
                  {error.resolved && (
                    <div className="text-xs text-green-600 mt-1">Resolved</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Error Patterns</CardTitle>
          <CardDescription>Common error patterns and their frequency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {patterns.slice(0, 10).map((pattern, index) => (
              <motion.div
                key={pattern.pattern}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="font-medium text-sm">{pattern.pattern}</div>
                  <div className="text-xs text-gray-500">
                    Pattern #{index + 1}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {pattern.count}
                  </div>
                  <div className="text-xs text-gray-500">occurrences</div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {lastUpdated.toLocaleString()}
      </div>
    </div>
  )
}

