'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/hooks'
import { 
  RoutingService,
  useNavigationOptimization,
  navigationUtils,
  routeOptimization,
  useRouteGuard
} from '@/lib/routing'
import { OptimizedNavigation, BreadcrumbNavigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Route, 
  Navigation, 
  Shield, 
  Zap, 
  BarChart3,
  RefreshCw,
  Download,
  Play,
  Pause,
  Square,
  Clock,
  Users,
  Activity
} from 'lucide-react'

export function RoutingOptimizationDemo() {
  const { user } = useAuth()
  const { navigateTo, isNavigating, navigationHistory, breadcrumbs, activeItem } = useNavigationOptimization()
  const [activeTab, setActiveTab] = useState('route-guards')
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationData, setSimulationData] = useState({
    routes: 0,
    navigations: 0,
    preloaded: 0,
    performance: 0,
  })
  const [routingStats, setRoutingStats] = useState<any>(null)

  const routingService = RoutingService.getInstance()

  // Load routing statistics
  const loadRoutingStats = useCallback(() => {
    const stats = routingService.getRoutingReport()
    setRoutingStats(stats)
  }, [routingService])

  useEffect(() => {
    loadRoutingStats()
    
    // Refresh stats every 5 seconds
    const interval = setInterval(loadRoutingStats, 5000)
    
    return () => clearInterval(interval)
  }, [loadRoutingStats])

  // Simulate routing operations
  const simulateRouting = useCallback(() => {
    if (!isSimulating) return

    // Simulate route preloading
    const routes = ['/dashboard/users', '/dashboard/classes', '/dashboard/exams', '/dashboard/analytics']
    const randomRoute = routes[Math.floor(Math.random() * routes.length)]
    
    routeOptimization.prefetchRoute(randomRoute)
    
    // Simulate navigation
    if (Math.random() < 0.3) {
      navigateTo(randomRoute, { prefetch: true })
    }

    // Update simulation data
    setSimulationData(prev => ({
      routes: prev.routes + 1,
      navigations: prev.navigations + (Math.random() < 0.3 ? 1 : 0),
      preloaded: prev.preloaded + 1,
      performance: prev.performance + Math.random() * 100,
    }))

    // Continue simulation
    setTimeout(simulateRouting, 2000)
  }, [isSimulating, navigateTo])

  useEffect(() => {
    if (isSimulating) {
      simulateRouting()
    }
  }, [isSimulating, simulateRouting])

  const startSimulation = () => {
    setIsSimulating(true)
    setSimulationData({ routes: 0, navigations: 0, preloaded: 0, performance: 0 })
  }

  const stopSimulation = () => {
    setIsSimulating(false)
  }

  const resetSimulation = () => {
    setIsSimulating(false)
    setSimulationData({ routes: 0, navigations: 0, preloaded: 0, performance: 0 })
    routingService.clearAllData()
  }

  const exportRoutingData = () => {
    const data = routingService.getRoutingReport()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `routing-optimization-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'route-guards', label: 'Route Guards', icon: <Shield className="w-4 h-4" /> },
    { id: 'route-optimization', label: 'Route Optimization', icon: <Zap className="w-4 h-4" /> },
    { id: 'navigation', label: 'Navigation', icon: <Navigation className="w-4 h-4" /> },
    { id: 'performance', label: 'Performance', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  const navigationItems = user ? navigationUtils.getNavigationItems(user.role) : []
  const navigationHierarchy = user ? navigationUtils.getNavigationHierarchy(user.role) : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Routing Optimization Demo</h1>
          <p className="text-gray-600">Advanced routing system with guards, optimization, and navigation</p>
        </div>
        <Badge variant="outline">Phase 6 Complete</Badge>
      </div>

      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Routing Simulation</CardTitle>
          <CardDescription>
            Simulate routing operations to see the optimization system in action
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
              <div className="text-2xl font-bold text-blue-600">{simulationData.routes}</div>
              <div className="text-sm text-gray-500">Routes</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{simulationData.navigations}</div>
              <div className="text-sm text-gray-500">Navigations</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{simulationData.preloaded}</div>
              <div className="text-sm text-gray-500">Preloaded</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {simulationData.performance.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">Performance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Routing Actions</CardTitle>
          <CardDescription>
            Test various routing features and generate reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={loadRoutingStats}
              className="flex items-center space-x-2 h-auto p-4"
            >
              <RefreshCw className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Refresh Stats</div>
                <div className="text-xs opacity-75">Update routing statistics</div>
              </div>
            </Button>
            
            <Button
              onClick={exportRoutingData}
              variant="outline"
              className="flex items-center space-x-2 h-auto p-4"
            >
              <Download className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Export Data</div>
                <div className="text-xs opacity-75">Download routing report</div>
              </div>
            </Button>
            
            <Button
              onClick={() => {
                routeOptimization.clearCache()
                loadRoutingStats()
              }}
              variant="outline"
              className="flex items-center space-x-2 h-auto p-4"
            >
              <Square className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Clear Cache</div>
                <div className="text-xs opacity-75">Reset route cache</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

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
          {activeTab === 'route-guards' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Route Guards</CardTitle>
                  <CardDescription>
                    Test route protection and access control
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Current User</h4>
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-gray-600">Role: {user?.role || 'Not authenticated'}</div>
                        <div className="text-sm text-gray-600">Name: {user?.full_name || 'N/A'}</div>
                        <div className="text-sm text-gray-600">ID: {user?.id || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-medium">Route Permissions</h4>
                      <div className="space-y-2">
                        {['/dashboard', '/dashboard/users', '/dashboard/classes', '/dashboard/exams'].map(path => {
                          const hasAccess = user ? navigationUtils.validateNavigationPath(path, user.role) : false
                          return (
                            <div key={path} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm">{path}</span>
                              <Badge variant={hasAccess ? 'default' : 'secondary'}>
                                {hasAccess ? 'Allowed' : 'Denied'}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Route Guard Features</CardTitle>
                  <CardDescription>
                    What happens when route guards are triggered
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Authentication Guards</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Automatic redirect to login</li>
                        <li>• Session validation</li>
                        <li>• Token refresh handling</li>
                        <li>• Guest route protection</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Authorization Guards</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Role-based access control</li>
                        <li>• Permission checking</li>
                        <li>• Route-level restrictions</li>
                        <li>• Fallback routing</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'route-optimization' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Route Optimization</CardTitle>
                  <CardDescription>
                    Lazy loading, code splitting, and preloading
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Preloading Statistics</h4>
                      {routingStats && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Total Routes:</span>
                            <span className="text-sm font-medium">{routingStats.summary.totalRoutes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Preloaded:</span>
                            <span className="text-sm font-medium">{routingStats.summary.preloadedRoutes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Percentage:</span>
                            <span className="text-sm font-medium">
                              {((routingStats.summary.preloadedRoutes / routingStats.summary.totalRoutes) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-medium">Route Priorities</h4>
                      <div className="space-y-2">
                        {['high', 'medium', 'low'].map(priority => (
                          <div key={priority} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm capitalize">{priority}</span>
                            <Badge variant={priority === 'high' ? 'default' : priority === 'medium' ? 'secondary' : 'outline'}>
                              {priority === 'high' ? 'Critical' : priority === 'medium' ? 'Important' : 'Optional'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Optimization Features</CardTitle>
                  <CardDescription>
                    Advanced route optimization capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Lazy Loading</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Component-level code splitting</li>
                        <li>• Route-based lazy loading</li>
                        <li>• Dynamic imports</li>
                        <li>• Bundle size optimization</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Preloading</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Hover-based prefetching</li>
                        <li>• Priority-based preloading</li>
                        <li>• Route group preloading</li>
                        <li>• Cache management</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'navigation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Navigation Menu */}
                <div className="lg:col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Navigation Menu</CardTitle>
                      <CardDescription>
                        Optimized navigation with role-based access
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-96 overflow-y-auto">
                        <OptimizedNavigation collapsed={false} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Navigation Details */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Navigation Statistics</CardTitle>
                      <CardDescription>
                        Current navigation state and history
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {navigationHistory.length}
                          </div>
                          <div className="text-sm text-gray-500">History</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {breadcrumbs.length}
                          </div>
                          <div className="text-sm text-gray-500">Breadcrumbs</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {isNavigating ? 'Yes' : 'No'}
                          </div>
                          <div className="text-sm text-gray-500">Navigating</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {navigationItems.length}
                          </div>
                          <div className="text-sm text-gray-500">Menu Items</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Breadcrumb Navigation</CardTitle>
                      <CardDescription>
                        Current breadcrumb trail
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BreadcrumbNavigation />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Navigation Hierarchy</CardTitle>
                      <CardDescription>
                        Role-based navigation structure
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {navigationHierarchy && (
                        <div className="space-y-4">
                          {Object.entries(navigationHierarchy).map(([category, items]) => (
                            <div key={category} className="border rounded-lg p-4">
                              <h4 className="font-medium capitalize mb-2">{category}</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {items.map((item: any) => (
                                  <div key={item.path} className="text-sm text-gray-600">
                                    {item.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Routing Performance</CardTitle>
                  <CardDescription>
                    Performance metrics and optimization statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {routingStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {routingStats.summary.averageNavigationTime.toFixed(0)}ms
                        </div>
                        <div className="text-sm text-gray-500">Avg Navigation</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {routingStats.summary.totalRoutes}
                        </div>
                        <div className="text-sm text-gray-500">Total Routes</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {routingStats.summary.preloadedRoutes}
                        </div>
                        <div className="text-sm text-gray-500">Preloaded</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {routingStats.summary.navigationHistory}
                        </div>
                        <div className="text-sm text-gray-500">History</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Features</CardTitle>
                  <CardDescription>
                    Advanced performance optimization capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Navigation Performance</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Route transition timing</li>
                        <li>• Navigation history tracking</li>
                        <li>• Performance monitoring</li>
                        <li>• Optimization analytics</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Caching & Optimization</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Route component caching</li>
                        <li>• Preload queue management</li>
                        <li>• Bundle size optimization</li>
                        <li>• Memory management</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

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

