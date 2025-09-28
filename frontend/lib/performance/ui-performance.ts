'use client'

import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { analyticsUtils } from '@/lib/monitoring'

// UI Performance Service for component caching and optimization
export class UIPerformanceService {
  private static instance: UIPerformanceService
  private componentCache = new Map<string, any>()
  private renderMetrics = new Map<string, { startTime: number; endTime: number; duration: number }>()
  private memoryUsage: { used: number; total: number; limit: number } = { used: 0, total: 0, limit: 0 }

  static getInstance(): UIPerformanceService {
    if (!UIPerformanceService.instance) {
      UIPerformanceService.instance = new UIPerformanceService()
    }
    return UIPerformanceService.instance
  }

  // Component caching
  cacheComponent(key: string, component: any): void {
    this.componentCache.set(key, component)
    analyticsUtils.trackAction('component_cached', 'performance', { key })
  }

  getCachedComponent(key: string): any {
    const component = this.componentCache.get(key)
    if (component) {
      analyticsUtils.trackAction('component_cache_hit', 'performance', { key })
    }
    return component
  }

  // Render performance tracking
  startRender(key: string): void {
    this.renderMetrics.set(key, { startTime: performance.now(), endTime: 0, duration: 0 })
  }

  endRender(key: string): void {
    const metric = this.renderMetrics.get(key)
    if (metric) {
      metric.endTime = performance.now()
      metric.duration = metric.endTime - metric.startTime
      analyticsUtils.trackPerformance('render_time', metric.duration, { component: key })
    }
  }

  // Image optimization
  optimizeImage(src: string, options?: { width?: number; height?: number; quality?: number }): string {
    if (!src) return src
    
    // Basic image optimization - in production, use a service like Cloudinary or Next.js Image
    const params = new URLSearchParams()
    if (options?.width) params.set('w', options.width.toString())
    if (options?.height) params.set('h', options.height.toString())
    if (options?.quality) params.set('q', options.quality.toString())
    
    const optimizedSrc = params.toString() ? `${src}?${params.toString()}` : src
    analyticsUtils.trackAction('image_optimized', 'performance', { src, optimizedSrc })
    
    return optimizedSrc
  }

  // Bundle preloading
  preloadBundle(bundleName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'script'
      link.href = `/static/js/${bundleName}.js`
      
      link.onload = () => {
        analyticsUtils.trackAction('bundle_preloaded', 'performance', { bundleName })
        resolve()
      }
      
      link.onerror = () => {
        analyticsUtils.trackAction('bundle_preload_failed', 'performance', { bundleName })
        reject(new Error(`Failed to preload bundle: ${bundleName}`))
      }
      
      document.head.appendChild(link)
    })
  }

  // Performance metrics
  getPerformanceMetrics(): Record<string, any> {
    const renderTimes = Array.from(this.renderMetrics.values()).map(m => m.duration)
    const averageRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
      : 0

    return {
      componentMounts: this.componentCache.size,
      averageRenderTime,
      memory: this.getMemoryInfo(),
      renderMetrics: Object.fromEntries(this.renderMetrics),
    }
  }

  // Memory usage
  getMemoryInfo(): { used: number; total: number; limit: number } {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory
      this.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      }
    }
    return this.memoryUsage
  }

  // Cache management
  clearCache(): void {
    this.componentCache.clear()
    this.renderMetrics.clear()
    analyticsUtils.trackAction('performance_cache_cleared', 'performance')
  }

  resetMetrics(): void {
    this.renderMetrics.clear()
    analyticsUtils.trackAction('performance_metrics_reset', 'performance')
  }
}

// Performance utilities
export const uiPerformanceUtils = {
  // Debounce function
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func(...args), delay)
    }
  },

  // Throttle function
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0
    return (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        func(...args)
      }
    }
  },

  // Memoize function
  memoize: <T extends (...args: any[]) => any>(func: T): T => {
    const cache = new Map()
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args)
      if (cache.has(key)) {
        return cache.get(key)
      }
      const result = func(...args)
      cache.set(key, result)
      return result
    }) as T
  },

  // Batch updates
  batchUpdates: (updates: (() => void)[]): void => {
    // Use React's batching if available, otherwise run sequentially
    if (typeof window !== 'undefined' && 'React' in window) {
      // @ts-ignore
      window.React.unstable_batchedUpdates(() => {
        updates.forEach(update => update())
      })
    } else {
      updates.forEach(update => update())
    }
  },

  // Intersection Observer
  createIntersectionObserver: (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ): IntersectionObserver => {
    return new IntersectionObserver(callback, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options,
    })
  },

  // Resize Observer
  createResizeObserver: (callback: ResizeObserverCallback): ResizeObserver => {
    return new ResizeObserver(callback)
  },

  // Performance measurement
  measurePerformance: <T>(name: string, fn: () => T): T => {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    
    analyticsUtils.trackPerformance('custom_measurement', end - start, { name })
    
    return result
  },

  // Memory usage
  getMemoryUsage: (): { used: number; total: number; limit: number } => {
    return UIPerformanceService.getInstance().getMemoryInfo()
  },
}



