'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  componentCount: number
  bundleSize: number
  cacheHitRate: number
}

interface PerformanceMonitorProps {
  componentName: string
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
  showMetrics?: boolean
  className?: string
}

export function PerformanceMonitor({
  componentName,
  onMetricsUpdate,
  showMetrics = false,
  className = '',
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0,
    bundleSize: 0,
    cacheHitRate: 0,
  })
  const [isVisible, setIsVisible] = useState(showMetrics)

  // Measure render time
  const measureRenderTime = useCallback(() => {
    const start = performance.now()
    
    return () => {
      const end = performance.now()
      const renderTime = end - start
      
      setMetrics(prev => ({
        ...prev,
        renderTime,
      }))
      
      onMetricsUpdate?.({
        ...metrics,
        renderTime,
      })
    }
  }, [metrics, onMetricsUpdate])

  // Get memory usage
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        limit: memory.jsHeapSizeLimit / 1024 / 1024, // MB
      }
    }
    return null
  }, [])

  // Get component count
  const getComponentCount = useCallback(() => {
    // This is a simplified approach - in a real app, you'd use React DevTools
    const elements = document.querySelectorAll('[data-component]')
    return elements.length
  }, [])

  // Get bundle size (approximate)
  const getBundleSize = useCallback(() => {
    // This is a simplified approach - in a real app, you'd use webpack-bundle-analyzer
    const scripts = document.querySelectorAll('script[src]')
    let totalSize = 0
    
    scripts.forEach(script => {
      const src = script.getAttribute('src')
      if (src && src.includes('_next/static')) {
        // Approximate size based on common Next.js bundle patterns
        totalSize += 100 // KB
      }
    })
    
    return totalSize
  }, [])

  // Update metrics
  const updateMetrics = useCallback(() => {
    const memory = getMemoryUsage()
    const componentCount = getComponentCount()
    const bundleSize = getBundleSize()
    
    setMetrics(prev => ({
      ...prev,
      memoryUsage: memory?.used || 0,
      componentCount,
      bundleSize,
    }))
  }, [getMemoryUsage, getComponentCount, getBundleSize])

  // Initialize performance monitoring
  useEffect(() => {
    const endMeasure = measureRenderTime()
    
    // Update metrics periodically
    const interval = setInterval(updateMetrics, 5000)
    
    // Cleanup
    return () => {
      endMeasure()
      clearInterval(interval)
    }
  }, [measureRenderTime, updateMetrics])

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className={`fixed bottom-4 right-4 z-50 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        title="Show Performance Metrics"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[300px] ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Performance Metrics</h3>
        <button
          onClick={toggleVisibility}
          className="text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Component:</span>
          <span className="font-mono text-gray-900">{componentName}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Render Time:</span>
          <span className="font-mono text-gray-900">{metrics.renderTime.toFixed(2)}ms</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Memory Usage:</span>
          <span className="font-mono text-gray-900">{metrics.memoryUsage.toFixed(2)}MB</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Components:</span>
          <span className="font-mono text-gray-900">{metrics.componentCount}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Bundle Size:</span>
          <span className="font-mono text-gray-900">{metrics.bundleSize}KB</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Cache Hit Rate:</span>
          <span className="font-mono text-gray-900">{metrics.cacheHitRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-gray-600">Performance Good</span>
        </div>
      </div>
    </motion.div>
  )
}

// Hook for performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0,
    bundleSize: 0,
    cacheHitRate: 0,
  })

  const updateMetrics = useCallback((newMetrics: Partial<PerformanceMetrics>) => {
    setMetrics(prev => ({ ...prev, ...newMetrics }))
  }, [])

  const measureRenderTime = useCallback(() => {
    const start = performance.now()
    
    return () => {
      const end = performance.now()
      const renderTime = end - start
      updateMetrics({ renderTime })
    }
  }, [updateMetrics])

  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const used = memory.usedJSHeapSize / 1024 / 1024
      updateMetrics({ memoryUsage: used })
      return used
    }
    return 0
  }, [updateMetrics])

  return {
    metrics,
    updateMetrics,
    measureRenderTime,
    getMemoryUsage,
  }
}

// Utility function to measure component performance
export function measureComponentPerformance<T extends React.ComponentType<any>>(
  Component: T,
  componentName: string
): T {
  const WrappedComponent = (props: any) => {
    const { measureRenderTime } = usePerformanceMonitor(componentName)
    
    useEffect(() => {
      const endMeasure = measureRenderTime()
      return endMeasure
    }, [measureRenderTime])

    return <Component {...props} />
  }

  WrappedComponent.displayName = `withPerformanceMonitor(${componentName})`
  
  return WrappedComponent as T
}

