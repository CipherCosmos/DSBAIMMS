'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AnalyticsService, 
  analyticsUtils,
  type AnalyticsEvent,
  type UserSession,
  type PageView,
  type FeatureUsage 
} from '@/lib/monitoring'
import { 
  Users, 
  Eye, 
  MousePointer, 
  Clock, 
  TrendingUp, 
  BarChart3,
  RefreshCw,
  Download,
  Activity,
  Target
} from 'lucide-react'

interface AnalyticsDashboardProps {
  className?: string
}

export function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [pageViews, setPageViews] = useState<PageView[]>([])
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const analyticsService = AnalyticsService.getInstance()

  const loadData = useCallback(() => {
    setIsLoading(true)
    
    try {
      const newEvents = analyticsService.getEvents(undefined, undefined, 100)
      const newSessions = analyticsService.getSessions(50)
      const newPageViews = analyticsService.getPageViews(100)
      const newFeatureUsage = analyticsService.getFeatureUsage()
      const newSummary = analyticsUtils.getSummary()
      
      setEvents(newEvents)
      setSessions(newSessions)
      setPageViews(newPageViews)
      setFeatureUsage(newFeatureUsage)
      setSummary(newSummary)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [analyticsService])

  useEffect(() => {
    loadData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000)
    
    return () => clearInterval(interval)
  }, [loadData])

  const exportData = useCallback(() => {
    const data = {
      events,
      sessions,
      pageViews,
      featureUsage,
      summary,
      exportedAt: new Date().toISOString(),
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [events, sessions, pageViews, featureUsage, summary])

  const getEventCategoryColor = (category: string) => {
    const colors = {
      page: 'bg-blue-100 text-blue-800',
      interaction: 'bg-green-100 text-green-800',
      feature: 'bg-purple-100 text-purple-800',
      form: 'bg-yellow-100 text-yellow-800',
      engagement: 'bg-orange-100 text-orange-800',
      error: 'bg-red-100 text-red-800',
      performance: 'bg-indigo-100 text-indigo-800',
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
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">User behavior and engagement analytics</p>
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
            <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.totalEvents || 0}
            </div>
            <p className="text-xs text-gray-500">All tracked events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.totalSessions || 0}
            </div>
            <p className="text-xs text-gray-500">User sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Page Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {summary?.totalPageViews || 0}
            </div>
            <p className="text-xs text-gray-500">Total page views</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatDuration(summary?.sessionDuration?.average || 0)}
            </div>
            <p className="text-xs text-gray-500">Session duration</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Top Features</CardTitle>
          <CardDescription>Most used features and functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary?.topFeatures?.slice(0, 10).map((feature: FeatureUsage, index: number) => (
              <motion.div
                key={feature.feature}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium capitalize">{feature.feature}</div>
                    <div className="text-sm text-gray-500">
                      {feature.users.size} users • {feature.count} uses
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {feature.count}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(feature.averageTime)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Engagement */}
      <Card>
        <CardHeader>
          <CardTitle>User Engagement</CardTitle>
          <CardDescription>User interaction and engagement metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <MousePointer className="w-8 h-8 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {summary?.userEngagement?.clicks || 0}
              </div>
              <div className="text-sm text-gray-500">Clicks</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <Activity className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {summary?.userEngagement?.scrolls || 0}
              </div>
              <div className="text-sm text-gray-500">Scrolls</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <Target className="w-8 h-8 mx-auto text-purple-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {summary?.userEngagement?.forms || 0}
              </div>
              <div className="text-sm text-gray-500">Forms</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <Clock className="w-8 h-8 mx-auto text-orange-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {formatDuration(summary?.userEngagement?.timeOnPage || 0)}
              </div>
              <div className="text-sm text-gray-500">Time on Page</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest user interactions and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.slice(0, 10).map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Badge className={getEventCategoryColor(event.category)}>
                    {event.category}
                  </Badge>
                  <div>
                    <div className="font-medium">{event.name}</div>
                    <div className="text-sm text-gray-500">
                      {event.action} • {event.timestamp.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {event.label && (
                    <div className="text-sm font-medium text-gray-900">
                      {event.label}
                    </div>
                  )}
                  {false && (
                    <div className="text-xs text-gray-500">
                      {/* Value removed */}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Page Views */}
      <Card>
        <CardHeader>
          <CardTitle>Page Views</CardTitle>
          <CardDescription>Most visited pages and routes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pageViews.slice(0, 10).map((pageView, index) => (
              <motion.div
                key={pageView.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="font-medium">{pageView.title}</div>
                  <div className="text-sm text-gray-500">
                    {pageView.url} • {pageView.timestamp.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  {pageView.duration && (
                    <div className="text-sm font-medium text-gray-900">
                      {formatDuration(pageView.duration)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    {pageView.referrer ? 'Referred' : 'Direct'}
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
