'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MonitoringDashboard } from '@/components/monitoring'
import { 
  MonitoringService,
  performanceUtils,
  analyticsUtils,
  errorTrackingUtils
} from '@/lib/monitoring'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  BarChart3, 
  AlertTriangle, 
  Zap,
  Users,
  TrendingUp,
  RefreshCw,
  Download,
  Play,
  Pause,
  Square
} from 'lucide-react'

export function MonitoringDemo() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationData, setSimulationData] = useState({
    events: 0,
    errors: 0,
    performance: 0,
    users: 0,
  })

  const monitoringService = MonitoringService.getInstance()

  // Simulate monitoring data
  const simulateData = useCallback(() => {
    if (!isSimulating) return

    // Simulate performance metrics
    performanceUtils.measure('Simulated Operation', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000))
    })

    // Simulate analytics events
    analyticsUtils.trackAction('simulation', 'demo', {
      timestamp: new Date(),
      simulated: true,
    })

    // Simulate user interactions
    analyticsUtils.trackAction('click', 'demo', {
      element: 'simulation_button',
      page: 'monitoring_demo',
    })

    // Simulate feature usage
    analyticsUtils.trackFeature('monitoring', 'access', {
      duration: Math.random() * 5000,
      success: true,
    })

    // Simulate errors occasionally
    if (Math.random() < 0.1) {
      const error = new Error('Simulated error for demo purposes')
      error.name = 'SimulationError'
      errorTrackingUtils.trackError(error, 'demo', {
        simulated: true,
        severity: 'low',
      })
    }

    // Update simulation data
    setSimulationData(prev => ({
      events: prev.events + 1,
      errors: prev.errors + (Math.random() < 0.1 ? 1 : 0),
      performance: prev.performance + Math.random() * 100,
      users: prev.users + (Math.random() < 0.3 ? 1 : 0),
    }))

    // Continue simulation
    setTimeout(simulateData, 2000)
  }, [isSimulating])

  useEffect(() => {
    if (isSimulating) {
      simulateData()
    }
  }, [isSimulating, simulateData])

  const startSimulation = () => {
    setIsSimulating(true)
    setSimulationData({ events: 0, errors: 0, performance: 0, users: 0 })
  }

  const stopSimulation = () => {
    setIsSimulating(false)
  }

  const resetSimulation = () => {
    setIsSimulating(false)
    setSimulationData({ events: 0, errors: 0, performance: 0, users: 0 })
    monitoringService.clearAllData()
  }

  const exportSimulationData = () => {
    const data = monitoringService.exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monitoring-simulation-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const generateReport = () => {
    const report = monitoringService.generateCombinedReport()
    console.log('Generated monitoring report:', report)
    
    // Show success message
    analyticsUtils.trackAction('report', 'demo', {
      timestamp: new Date(),
      reportId: report.timestamp.toISOString(),
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring & Analytics Demo</h1>
          <p className="text-gray-600">Comprehensive monitoring system demonstration</p>
        </div>
        <Badge variant="outline">Phase 5 Complete</Badge>
      </div>

      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Data Simulation</CardTitle>
          <CardDescription>
            Simulate real-time monitoring data to see the system in action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <Button
              onClick={startSimulation}
              disabled={isSimulating}
              className="flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Start Simulation</span>
            </Button>
            
            <Button
              onClick={stopSimulation}
              disabled={!isSimulating}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </Button>
            
            <Button
              onClick={resetSimulation}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Square className="w-4 h-4" />
              <span>Reset</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{simulationData.events}</div>
              <div className="text-sm text-gray-500">Events</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{simulationData.errors}</div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {simulationData.performance.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">Performance</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{simulationData.users}</div>
              <div className="text-sm text-gray-500">Users</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Actions</CardTitle>
          <CardDescription>
            Test various monitoring features and generate reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={generateReport}
              className="flex items-center space-x-2 h-auto p-4"
            >
              <BarChart3 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Generate Report</div>
                <div className="text-xs opacity-75">Create comprehensive monitoring report</div>
              </div>
            </Button>
            
            <Button
              onClick={exportSimulationData}
              variant="outline"
              className="flex items-center space-x-2 h-auto p-4"
            >
              <Download className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Export Data</div>
                <div className="text-xs opacity-75">Download all monitoring data</div>
              </div>
            </Button>
            
            <Button
              onClick={() => {
                analyticsUtils.trackAction('refresh', 'demo')
                window.location.reload()
              }}
              variant="outline"
              className="flex items-center space-x-2 h-auto p-4"
            >
              <RefreshCw className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Refresh Data</div>
                <div className="text-xs opacity-75">Reload monitoring data</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Features */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Features</CardTitle>
          <CardDescription>
            Comprehensive monitoring capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium">Performance Monitoring</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Web Vitals tracking</li>
                <li>• Memory usage monitoring</li>
                <li>• Component render times</li>
                <li>• API response times</li>
                <li>• User interaction tracking</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <h3 className="font-medium">Analytics</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• User behavior tracking</li>
                <li>• Feature usage analytics</li>
                <li>• Session management</li>
                <li>• Page view tracking</li>
                <li>• Engagement metrics</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-medium">Error Tracking</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Error classification</li>
                <li>• Severity tracking</li>
                <li>• Pattern detection</li>
                <li>• Resolution tracking</li>
                <li>• Trend analysis</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Dashboard */}
      <MonitoringDashboard />

      {/* Status Indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-3 rounded-lg shadow-lg ${
            isSimulating 
              ? 'bg-green-100 border border-green-200' 
              : 'bg-gray-100 border border-gray-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isSimulating ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-sm font-medium">
              {isSimulating ? 'Simulating' : 'Idle'}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
