'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PerformanceService,
  useUIPerformance,
  useCacheOptimization,
  useBundleOptimization,
  useImageOptimization,
  useRenderOptimization
} from '@/lib/performance'
import { 
  OptimizedImage, 
  OptimizedList, 
  OptimizedTable, 
  // PerformanceMonitor 
} from '@/components/performance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, 
  Image, 
  List, 
  Table, 
  Monitor, 
  RefreshCw,
  Download,
  Trash2,
  Play,
  Pause,
  Square,
  Settings,
  BarChart3,
  Cpu,
  HardDrive,
  Package
} from 'lucide-react'

// Sample data for demos
const sampleUsers = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ['admin', 'hod', 'teacher', 'student'][i % 4],
  department: ['Computer Science', 'Mathematics', 'Physics', 'Chemistry'][i % 4],
  status: ['active', 'inactive', 'pending'][i % 3],
  lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
}))

const sampleImages = [
  'https://picsum.photos/400/300?random=1',
  'https://picsum.photos/400/300?random=2',
  'https://picsum.photos/400/300?random=3',
  'https://picsum.photos/400/300?random=4',
  'https://picsum.photos/400/300?random=5',
  'https://picsum.photos/400/300?random=6',
]

export function UIPerformanceDemo() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationData, setSimulationData] = useState({
    renders: 0,
    images: 0,
    cacheHits: 0,
    bundleLoads: 0,
  })
  const [performanceSettings, setPerformanceSettings] = useState({
    virtualized: true,
    lazy: true,
    caching: true,
    preloading: true,
  })

  const performanceService = PerformanceService.getInstance()
  const { metrics: uiMetrics, updateMetrics } = useUIPerformance()
  const { getStats: getCacheStats } = useCacheOptimization()
  const { getStats: getBundleStats } = useBundleOptimization()
  const { optimizeImage } = useImageOptimization()
  const { renderTime } = useRenderOptimization('UIPerformanceDemo')

  // Load performance data
  const loadPerformanceData = useCallback(() => {
    updateMetrics()
  }, [updateMetrics])

  useEffect(() => {
    loadPerformanceData()
    
    // Refresh data every 5 seconds
    const interval = setInterval(loadPerformanceData, 5000)
    
    return () => clearInterval(interval)
  }, [loadPerformanceData])

  // Simulate performance operations
  const simulatePerformance = useCallback(() => {
    if (!isSimulating) return

    // Simulate render operations
    setSimulationData(prev => ({
      ...prev,
      renders: prev.renders + Math.floor(Math.random() * 5) + 1,
    }))

    // Simulate image operations
    if (Math.random() < 0.3) {
      setSimulationData(prev => ({
        ...prev,
        images: prev.images + 1,
      }))
    }

    // Simulate cache operations
    if (Math.random() < 0.5) {
      setSimulationData(prev => ({
        ...prev,
        cacheHits: prev.cacheHits + 1,
      }))
    }

    // Simulate bundle operations
    if (Math.random() < 0.2) {
      setSimulationData(prev => ({
        ...prev,
        bundleLoads: prev.bundleLoads + 1,
      }))
    }

    // Continue simulation
    setTimeout(simulatePerformance, 1000)
  }, [isSimulating])

  useEffect(() => {
    if (isSimulating) {
      simulatePerformance()
    }
  }, [isSimulating, simulatePerformance])

  const startSimulation = () => {
    setIsSimulating(true)
    setSimulationData({ renders: 0, images: 0, cacheHits: 0, bundleLoads: 0 })
  }

  const stopSimulation = () => {
    setIsSimulating(false)
  }

  const resetSimulation = () => {
    setIsSimulating(false)
    setSimulationData({ renders: 0, images: 0, cacheHits: 0, bundleLoads: 0 })
    performanceService.clearAllData()
  }

  const exportPerformanceData = () => {
    const data = performanceService.getPerformanceReport()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ui-performance-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'images', label: 'Image Optimization', icon: <Image className="w-4 h-4" /> },
    { id: 'lists', label: 'List Optimization', icon: <List className="w-4 h-4" /> },
    { id: 'tables', label: 'Table Optimization', icon: <Table className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Performance Monitor', icon: <Monitor className="w-4 h-4" /> },
  ]

  // Table columns for demo
  const tableColumns: any[] = [
    { key: 'id', title: 'ID', width: 80, sortable: true },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'email', title: 'Email', sortable: true },
    { key: 'role', title: 'Role', width: 120, sortable: true },
    { key: 'department', title: 'Department', width: 150, sortable: true },
    { key: 'status', title: 'Status', width: 100, sortable: true },
    { key: 'lastLogin', title: 'Last Login', width: 150, sortable: true },
  ]

  // Memoized filtered data for performance
  const filteredUsers = useMemo(() => {
    return sampleUsers.slice(0, 100) // Limit for demo
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">UI Performance Optimization Demo</h1>
          <p className="text-gray-600">Advanced UI performance optimization with caching, virtualization, and monitoring</p>
        </div>
        <Badge variant="outline">Phase 7 Complete</Badge>
      </div>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Performance Settings</span>
          </CardTitle>
          <CardDescription>
            Configure performance optimization features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={performanceSettings.virtualized}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, virtualized: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Virtualized</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={performanceSettings.lazy}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, lazy: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Lazy Loading</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={performanceSettings.caching}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, caching: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Caching</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={performanceSettings.preloading}
                onChange={(e) => setPerformanceSettings(prev => ({ ...prev, preloading: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Preloading</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Simulation</CardTitle>
          <CardDescription>
            Simulate performance operations to see optimization in action
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
              <div className="text-2xl font-bold text-blue-600">{simulationData.renders}</div>
              <div className="text-sm text-gray-500">Renders</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{simulationData.images}</div>
              <div className="text-sm text-gray-500">Images</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{simulationData.cacheHits}</div>
              <div className="text-sm text-gray-500">Cache Hits</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{simulationData.bundleLoads}</div>
              <div className="text-sm text-gray-500">Bundle Loads</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Actions</CardTitle>
          <CardDescription>
            Test various performance features and generate reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={loadPerformanceData}
              className="flex items-center space-x-2 h-auto p-4"
            >
              <RefreshCw className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Refresh Data</div>
                <div className="text-xs opacity-75">Update performance metrics</div>
              </div>
            </Button>
            
            <Button
              onClick={exportPerformanceData}
              variant="outline"
              className="flex items-center space-x-2 h-auto p-4"
            >
              <Download className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Export Report</div>
                <div className="text-xs opacity-75">Download performance data</div>
              </div>
            </Button>
            
            <Button
              onClick={() => {
                performanceService.clearAllData()
                loadPerformanceData()
              }}
              variant="outline"
              className="flex items-center space-x-2 h-auto p-4"
            >
              <Trash2 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Clear Data</div>
                <div className="text-xs opacity-75">Reset performance data</div>
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
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                  <CardDescription>
                    Current performance metrics and optimization status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {uiMetrics.averageRenderTime.toFixed(1)}ms
                      </div>
                      <div className="text-sm text-gray-500">Avg Render Time</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {uiMetrics.cacheHitRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">Cache Hit Rate</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {uiMetrics.componentMounts}
                      </div>
                      <div className="text-sm text-gray-500">Components</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {renderTime.toFixed(1)}ms
                      </div>
                      <div className="text-sm text-gray-500">Current Render</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Optimization Features</CardTitle>
                  <CardDescription>
                    Available performance optimization capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">UI Optimization</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Component caching and memoization</li>
                        <li>• Render performance tracking</li>
                        <li>• Image optimization and lazy loading</li>
                        <li>• Bundle preloading and optimization</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Performance Monitoring</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Real-time performance metrics</li>
                        <li>• Cache hit rate monitoring</li>
                        <li>• Bundle loading statistics</li>
                        <li>• Performance alert system</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Optimized Images</CardTitle>
                  <CardDescription>
                    Image optimization with lazy loading and caching
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sampleImages.map((src, index) => (
                      <div key={index} className="space-y-2">
                        <OptimizedImage
                          src={src}
                          alt={`Sample image ${index + 1}`}
                          width={400}
                          height={300}
                          quality={80}
                          format="webp"
                          lazy={performanceSettings.lazy}
                          priority={index < 2}
                          className="w-full h-48 rounded-lg"
                          placeholder={`Loading image ${index + 1}...`}
                        />
                        <div className="text-sm text-gray-600">
                          Image {index + 1} - {performanceSettings.lazy ? 'Lazy loaded' : 'Eager loaded'}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Image Optimization Features</CardTitle>
                  <CardDescription>
                    Advanced image optimization capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Optimization</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Automatic format conversion (WebP)</li>
                        <li>• Quality and size optimization</li>
                        <li>• Responsive image sizing</li>
                        <li>• Blur placeholder generation</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Loading</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Intersection Observer lazy loading</li>
                        <li>• Priority-based preloading</li>
                        <li>• Error handling and fallbacks</li>
                        <li>• Loading state management</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'lists' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Optimized Lists</CardTitle>
                  <CardDescription>
                    Virtualized lists with lazy loading and performance optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OptimizedList
                    items={filteredUsers}
                    renderItem={(user, index) => (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                    )}
                    height={400}
                    itemHeight={80}
                    virtualized={performanceSettings.virtualized}
                    lazy={performanceSettings.lazy}
                    onLoadMore={() => {
                      console.log('Loading more items...')
                    }}
                    hasMore={false}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>List Optimization Features</CardTitle>
                  <CardDescription>
                    Advanced list optimization capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Virtualization</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• React Window integration</li>
                        <li>• Fixed and variable item heights</li>
                        <li>• Efficient rendering of large lists</li>
                        <li>• Memory usage optimization</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Loading</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Intersection Observer lazy loading</li>
                        <li>• Progressive item loading</li>
                        <li>• Infinite scroll support</li>
                        <li>• Loading state management</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'tables' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Optimized Tables</CardTitle>
                  <CardDescription>
                    Virtualized tables with sorting, filtering, and performance optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OptimizedTable
                    data={filteredUsers}
                    columns={tableColumns}
                    height={400}
                    rowHeight={60}
                    virtualized={performanceSettings.virtualized}
                    sortable={true}
                    filterable={true}
                    selectable={true}
                    onSort={(key, direction) => {
                      console.log('Sort:', key, direction)
                    }}
                    onFilter={(filters) => {
                      console.log('Filter:', filters)
                    }}
                    onSelect={(selectedItems) => {
                      console.log('Selected:', selectedItems.length, 'items')
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Table Optimization Features</CardTitle>
                  <CardDescription>
                    Advanced table optimization capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Virtualization</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• React Window table virtualization</li>
                        <li>• Efficient row rendering</li>
                        <li>• Memory usage optimization</li>
                        <li>• Smooth scrolling performance</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Features</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Sorting and filtering</li>
                        <li>• Row selection</li>
                        <li>• Search functionality</li>
                        <li>• Performance monitoring</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              {/* <PerformanceMonitor
                showDetails={true}
                autoRefresh={true}
                refreshInterval={5000}
              /> */}
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
