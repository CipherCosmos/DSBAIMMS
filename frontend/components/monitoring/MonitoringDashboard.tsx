'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PerformanceDashboard } from './PerformanceDashboard'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import { ErrorTrackingDashboard } from './ErrorTrackingDashboard'
import { 
  Activity, 
  BarChart3, 
  AlertTriangle, 
  Download,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'

interface MonitoringDashboardProps {
  className?: string
}

export function MonitoringDashboard({ className = '' }: MonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'performance', label: 'Performance', icon: <Zap className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'errors', label: 'Error Tracking', icon: <AlertTriangle className="w-4 h-4" /> },
  ]

  const exportAllData = () => {
    // This would export all monitoring data
    console.log('Exporting all monitoring data...')
  }

  const refreshAllData = () => {
    // This would refresh all monitoring data
    console.log('Refreshing all monitoring data...')
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
          <p className="text-gray-600">Comprehensive application monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={refreshAllData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
          <Button onClick={exportAllData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Performance Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">95</div>
                    <p className="text-xs text-gray-500">Web Vitals Score</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">1,234</div>
                    <p className="text-xs text-gray-500">Current sessions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">0.2%</div>
                    <p className="text-xs text-gray-500">Last 24 hours</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Uptime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">99.9%</div>
                    <p className="text-xs text-gray-500">Last 30 days</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>Key performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Page Load Time</span>
                        </div>
                        <span className="text-sm font-medium">1.2s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">First Input Delay</span>
                        </div>
                        <span className="text-sm font-medium">45ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-purple-600" />
                          <span className="text-sm">Cumulative Layout Shift</span>
                        </div>
                        <span className="text-sm font-medium">0.05</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Engagement</CardTitle>
                    <CardDescription>User interaction metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">Total Sessions</span>
                        </div>
                        <span className="text-sm font-medium">5,678</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <BarChart3 className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Page Views</span>
                        </div>
                        <span className="text-sm font-medium">12,345</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-purple-600" />
                          <span className="text-sm">Avg Session Duration</span>
                        </div>
                        <span className="text-sm font-medium">4m 32s</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest events and activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { type: 'performance', message: 'Page load time improved by 15%', time: '2 minutes ago', status: 'success' },
                      { type: 'user', message: 'New user session started', time: '5 minutes ago', status: 'info' },
                      { type: 'error', message: 'Network error resolved', time: '10 minutes ago', status: 'warning' },
                      { type: 'analytics', message: 'Feature usage increased by 25%', time: '15 minutes ago', status: 'success' },
                    ].map((activity, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            activity.status === 'success' ? 'bg-green-500' :
                            activity.status === 'warning' ? 'bg-yellow-500' :
                            activity.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          <div>
                            <div className="text-sm font-medium">{activity.message}</div>
                            <div className="text-xs text-gray-500">{activity.time}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.type}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'performance' && <PerformanceDashboard />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'errors' && <ErrorTrackingDashboard />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

