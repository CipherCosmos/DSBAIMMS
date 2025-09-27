// Performance monitoring utilities and services
export interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  timestamp: Date
  context?: Record<string, any>
}

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
  value: number
  delta: number
  id: string
  navigationType: string
}

export interface PerformanceReport {
  id: string
  timestamp: Date
  url: string
  userAgent: string
  viewport: {
    width: number
    height: number
  }
  metrics: {
    webVitals: WebVitalsMetric[]
    custom: PerformanceMetric[]
    memory: {
      used: number
      total: number
      limit: number
    }
    timing: {
      domContentLoaded: number
      loadComplete: number
      firstPaint: number
      firstContentfulPaint: number
    }
  }
  user: {
    id?: string
    role?: string
  }
  session: {
    id?: string
    startTime?: Date
  }
}

export interface PerformanceThresholds {
  CLS: number
  FID: number
  FCP: number
  LCP: number
  TTFB: number
  memory: number
  renderTime: number
}

// Default performance thresholds
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  CLS: 0.1,
  FID: 100,
  FCP: 1800,
  LCP: 2500,
  TTFB: 600,
  memory: 50, // MB
  renderTime: 100, // ms
}

// Performance monitoring service
export class PerformanceMonitorService {
  private static instance: PerformanceMonitorService
  private reports: PerformanceReport[] = []
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []
  private thresholds: PerformanceThresholds
  private maxReports = 50
  private maxMetrics = 200

  static getInstance(): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService()
    }
    return PerformanceMonitorService.instance
  }

  constructor(thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds
    this.initializeMonitoring()
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return

    // Monitor Web Vitals
    this.observeWebVitals()
    
    // Monitor memory usage
    this.observeMemoryUsage()
    
    // Monitor custom metrics
    this.observeCustomMetrics()
    
    // Monitor page load performance
    this.observePageLoad()
  }

  private observeWebVitals(): void {
    // Observe Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { element?: Element }
          
          this.recordMetric({
            id: `lcp_${Date.now()}`,
            name: 'LCP',
            value: lastEntry.startTime,
            unit: 'ms',
            timestamp: new Date(),
            context: {
              element: lastEntry.element?.tagName,
              url: lastEntry.name,
            },
          })
        })
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)
      } catch (error) {
        console.warn('LCP observer not supported:', error)
      }

      // Observe First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            this.recordMetric({
              id: `fid_${Date.now()}`,
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              unit: 'ms',
              timestamp: new Date(),
              context: {
                eventType: entry.name,
              },
            })
          })
        })
        
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)
      } catch (error) {
        console.warn('FID observer not supported:', error)
      }

      // Observe Cumulative Layout Shift
      try {
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          })
          
          this.recordMetric({
            id: `cls_${Date.now()}`,
            name: 'CLS',
            value: clsValue,
            unit: 'score',
            timestamp: new Date(),
          })
        })
        
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(clsObserver)
      } catch (error) {
        console.warn('CLS observer not supported:', error)
      }
    }
  }

  private observeMemoryUsage(): void {
    if ('memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory
        this.recordMetric({
          id: `memory_${Date.now()}`,
          name: 'Memory Usage',
          value: memory.usedJSHeapSize / 1024 / 1024, // MB
          unit: 'MB',
          timestamp: new Date(),
          context: {
            total: memory.totalJSHeapSize / 1024 / 1024,
            limit: memory.jsHeapSizeLimit / 1024 / 1024,
          },
        })
      }

      // Check memory usage every 30 seconds
      setInterval(checkMemory, 30000)
      checkMemory() // Initial check
    }
  }

  private observeCustomMetrics(): void {
    // Monitor component render times
    this.observeComponentPerformance()
    
    // Monitor API response times
    this.observeApiPerformance()
    
    // Monitor user interactions
    this.observeUserInteractions()
  }

  private observeComponentPerformance(): void {
    // This would be implemented with React DevTools or custom instrumentation
    // For now, we'll use a simple approach
    const originalConsoleTime = console.time
    const originalConsoleTimeEnd = console.timeEnd

    console.time = (label: string) => {
      originalConsoleTime.call(console, label)
      this.recordMetric({
        id: `component_${Date.now()}`,
        name: 'Component Render',
        value: 0, // Will be updated by timeEnd
        unit: 'ms',
        timestamp: new Date(),
        context: { component: label },
      })
    }

    console.timeEnd = (label: string) => {
      originalConsoleTimeEnd.call(console, label)
      // In a real implementation, you'd capture the actual timing
    }
  }

  private observeApiPerformance(): void {
    // Monitor fetch requests
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = performance.now()
      const url = args[0] instanceof Request ? args[0].url : args[0]
      
      try {
        const response = await originalFetch(...args)
        const endTime = performance.now()
        
        this.recordMetric({
          id: `api_${Date.now()}`,
          name: 'API Response Time',
          value: endTime - startTime,
          unit: 'ms',
          timestamp: new Date(),
          context: {
            url,
            status: response.status,
            method: args[1]?.method || 'GET',
          },
        })
        
        return response
      } catch (error) {
        const endTime = performance.now()
        
        this.recordMetric({
          id: `api_error_${Date.now()}`,
          name: 'API Error',
          value: endTime - startTime,
          unit: 'ms',
          timestamp: new Date(),
          context: {
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        
        throw error
      }
    }
  }

  private observeUserInteractions(): void {
    // Monitor click events
    document.addEventListener('click', (event) => {
      this.recordMetric({
        id: `click_${Date.now()}`,
        name: 'User Click',
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        context: {
          target: (event.target as Element)?.tagName,
          x: event.clientX,
          y: event.clientY,
        },
      })
    })

    // Monitor scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        this.recordMetric({
          id: `scroll_${Date.now()}`,
          name: 'User Scroll',
          value: 1,
          unit: 'count',
          timestamp: new Date(),
          context: {
            scrollY: window.scrollY,
            scrollX: window.scrollX,
          },
        })
      }, 100)
    })
  }

  private observePageLoad(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        
        if (navigation) {
          this.recordMetric({
            id: `page_load_${Date.now()}`,
            name: 'Page Load Time',
            value: navigation.loadEventEnd - navigation.fetchStart,
            unit: 'ms',
            timestamp: new Date(),
            context: {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
              firstPaint: this.getFirstPaint(),
              firstContentfulPaint: this.getFirstContentfulPaint(),
            },
          })
        }
      }, 0)
    })
  }

  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType('paint')
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')
    return firstPaint ? firstPaint.startTime : 0
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType('paint')
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0
  }

  // Public methods
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.unshift(metric)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(0, this.maxMetrics)
    }

    // Check thresholds
    this.checkThresholds(metric)

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance metric:', metric)
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.name as keyof PerformanceThresholds]
    if (threshold && metric.value > threshold) {
      console.warn(`Performance threshold exceeded for ${metric.name}:`, {
        value: metric.value,
        threshold,
        unit: metric.unit,
      })
    }
  }

  generateReport(): PerformanceReport {
    const webVitals = this.metrics.filter(m => ['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].includes(m.name))
    const custom = this.metrics.filter(m => !['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].includes(m.name))
    
    const memory = this.getMemoryInfo()
    const timing = this.getTimingInfo()

    const report: PerformanceReport = {
      id: `report_${Date.now()}`,
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      metrics: {
        webVitals: webVitals as unknown as WebVitalsMetric[],
        custom,
        memory,
        timing,
      },
      user: {
        // This would be populated from your auth system
        id: undefined,
        role: undefined,
      },
      session: {
        // This would be populated from your session management
        id: undefined,
        startTime: undefined,
      },
    }

    this.reports.unshift(report)
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(0, this.maxReports)
    }

    return report
  }

  getMemoryInfo() {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize / 1024 / 1024,
        total: memory.totalJSHeapSize / 1024 / 1024,
        limit: memory.jsHeapSizeLimit / 1024 / 1024,
      }
    }
    return { used: 0, total: 0, limit: 0 }
  }

  private getTimingInfo() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
        firstPaint: this.getFirstPaint(),
        firstContentfulPaint: this.getFirstContentfulPaint(),
      }
    }
    return { domContentLoaded: 0, loadComplete: 0, firstPaint: 0, firstContentfulPaint: 0 }
  }

  getReports(): PerformanceReport[] {
    return [...this.reports]
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  clearData(): void {
    this.reports = []
    this.metrics = []
  }

  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// Performance monitoring utilities
export const performanceUtils = {
  // Measure function execution time
  measure: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now()
    try {
      const result = await fn()
      const end = performance.now()
      
      PerformanceMonitorService.getInstance().recordMetric({
        id: `measure_${Date.now()}`,
        name,
        value: end - start,
        unit: 'ms',
        timestamp: new Date(),
      })
      
      return result
    } catch (error) {
      const end = performance.now()
      
      PerformanceMonitorService.getInstance().recordMetric({
        id: `measure_error_${Date.now()}`,
        name: `${name}_error`,
        value: end - start,
        unit: 'ms',
        timestamp: new Date(),
        context: { error: error instanceof Error ? error.message : 'Unknown error' },
      })
      
      throw error
    }
  },

  // Measure component render time
  measureRender: (componentName: string, renderFn: () => void): void => {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    
    PerformanceMonitorService.getInstance().recordMetric({
      id: `render_${Date.now()}`,
      name: 'Component Render',
      value: end - start,
      unit: 'ms',
      timestamp: new Date(),
      context: { component: componentName },
    })
  },

  // Get performance summary
  getSummary: (): {
    webVitals: Record<string, number>
    custom: Record<string, number>
    memory: { used: number; total: number; limit: number }
  } => {
    const service = PerformanceMonitorService.getInstance()
    const metrics = service.getMetrics()
    
    const webVitals = metrics
      .filter(m => ['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].includes(m.name))
      .reduce((acc, metric) => {
        acc[metric.name] = metric.value
        return acc
      }, {} as Record<string, number>)
    
    const custom = metrics
      .filter(m => !['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].includes(m.name))
      .reduce((acc, metric) => {
        acc[metric.name] = (acc[metric.name] || 0) + metric.value
        return acc
      }, {} as Record<string, number>)
    
    const memory = service.getMemoryInfo()
    
    return { webVitals, custom, memory }
  },
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  PerformanceMonitorService.getInstance()
}
