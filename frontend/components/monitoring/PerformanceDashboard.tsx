'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  PerformanceMonitorService, 
  performanceUtils,
  type PerformanceReport,
  type PerformanceMetric 
} from '@/lib/monitoring'
import { 
  Activity, 
  Clock, 
  // Memory, // Not available in lucide-react 
  Zap, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface PerformanceDashboardProps {
  className?: string
}

export function PerformanceDashboard({ className = '' }: PerformanceDashboardProps) {
  const [reports, setReports] = useState<PerformanceReport[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const performanceMonitor = PerformanceMonitorService.getInstance()

  const loadData = useCallback(() => {
    setIsLoading(true)
    
    try {
      const newReports = performanceMonitor.getReports()
      const newMetrics = performanceMonitor.getMetrics()
      const newSummary = performanceUtils.getSummary()
      
      setReports(newReports)
      setMetrics(newMetrics)
      setSummary(newSummary)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load performance data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [performanceMonitor])

  useEffect(() => {
    loadData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000)
    
    return () => clearInterval(interval)
  }, [loadData])

  const generateReport = useCallback(() => {
    const report = performanceMonitor.generateReport()
    setReports(prev => [report, ...prev])
  }, [performanceMonitor])

  const exportData = useCallback(() => {
    const data = {
      reports,
      metrics,
      summary,
      exportedAt: new Date().toISOString(),
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [reports, metrics, summary])

  const getWebVitalStatus = (name: string, value: number) => {
    const thresholds = {
      CLS: 0.1,
      FID: 100,
      FCP: 1800,
      LCP: 2500,
      TTFB: 600,
    }
    
    const threshold = thresholds[name as keyof typeof thresholds]
    if (!threshold) return 'unknown'
    
    if (value <= threshold) return 'good'
    if (value <= threshold * 1.5) return 'needs-improvement'
    return 'poor'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100'
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="w-4 h-4" />
      case 'needs-improvement': return <AlertTriangle className="w-4 h-4" />
      case 'poor': return <AlertTriangle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
          <p className="text-gray-600">Real-time performance metrics and Web Vitals</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={generateReport} variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Generate Report
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
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.memory?.used?.toFixed(1) || 0} MB
            </div>
            <p className="text-xs text-gray-500">
              of {summary?.memory?.limit?.toFixed(0) || 0} MB limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Page Load Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.webVitals?.LCP?.toFixed(0) || 0} ms
            </div>
            <p className="text-xs text-gray-500">Largest Contentful Paint</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">First Input Delay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {summary?.webVitals?.FID?.toFixed(0) || 0} ms
            </div>
            <p className="text-xs text-gray-500">Interaction responsiveness</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Layout Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary?.webVitals?.CLS?.toFixed(3) || 0}
            </div>
            <p className="text-xs text-gray-500">Visual stability</p>
          </CardContent>
        </Card>
      </div>

      {/* Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle>Web Vitals</CardTitle>
          <CardDescription>Core Web Vitals and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(summary?.webVitals || {}).map(([name, value]) => {
              const status = getWebVitalStatus(name, value as number)
              return (
                <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-gray-500">
                      {String(value)} {name === 'CLS' ? 'score' : 'ms'}
                    </div>
                  </div>
                  <Badge className={getStatusColor(status)}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(status)}
                      <span className="capitalize">{status.replace('-', ' ')}</span>
                    </div>
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Metrics</CardTitle>
          <CardDescription>Application-specific performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(summary?.custom || {}).map(([name, value]) => (
              <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-sm text-gray-500">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </div>
                  <div className="text-xs text-gray-500">ms</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Latest performance reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.slice(0, 5).map((report) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="font-medium">
                    Report {report.id.split('_')[1]}
                  </div>
                  <div className="text-sm text-gray-500">
                    {report.timestamp.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {report.metrics.webVitals.length} Web Vitals
                  </div>
                  <div className="text-xs text-gray-500">
                    {report.metrics.custom.length} Custom Metrics
                  </div>
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
