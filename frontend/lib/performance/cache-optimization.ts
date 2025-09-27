// Cache optimization utilities for UI performance
import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { analyticsUtils } from '@/lib/monitoring'

// Cache optimization service
export class CacheOptimizationService {
  private static instance: CacheOptimizationService
  private memoryCache = new Map<string, any>()
  private localStorageCache = new Map<string, any>()
  private sessionStorageCache = new Map<string, any>()
  private cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
  }

  static getInstance(): CacheOptimizationService {
    if (!CacheOptimizationService.instance) {
      CacheOptimizationService.instance = new CacheOptimizationService()
    }
    return CacheOptimizationService.instance
  }

  // Memory cache operations
  setMemory(key: string, value: any, ttl?: number): void {
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl || 0,
    }
    
    this.memoryCache.set(key, item)
    this.cacheStats.sets++
    this.cacheStats.size = this.memoryCache.size
  }

  getMemory(key: string): any {
    const item = this.memoryCache.get(key)
    if (!item) {
      this.cacheStats.misses++
      return null
    }

    // Check TTL
    if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
      this.memoryCache.delete(key)
      this.cacheStats.misses++
      this.cacheStats.size = this.memoryCache.size
      return null
    }

    this.cacheStats.hits++
    return item.value
  }

  deleteMemory(key: string): boolean {
    const deleted = this.memoryCache.delete(key)
    if (deleted) {
      this.cacheStats.deletes++
      this.cacheStats.size = this.memoryCache.size
    }
    return deleted
  }

  // Local storage cache operations
  setLocalStorage(key: string, value: any, ttl?: number): void {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl: ttl || 0,
      }
      
      localStorage.setItem(key, JSON.stringify(item))
      this.cacheStats.sets++
    } catch (error) {
      console.warn('LocalStorage cache set failed:', error)
    }
  }

  getLocalStorage(key: string): any {
    try {
      const itemStr = localStorage.getItem(key)
      if (!itemStr) {
        this.cacheStats.misses++
        return null
      }

      const item = JSON.parse(itemStr)
      
      // Check TTL
      if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(key)
        this.cacheStats.misses++
        return null
      }

      this.cacheStats.hits++
      return item.value
    } catch (error) {
      console.warn('LocalStorage cache get failed:', error)
      this.cacheStats.misses++
      return null
    }
  }

  deleteLocalStorage(key: string): boolean {
    try {
      localStorage.removeItem(key)
      this.cacheStats.deletes++
      return true
    } catch (error) {
      console.warn('LocalStorage cache delete failed:', error)
      return false
    }
  }

  // Session storage cache operations
  setSessionStorage(key: string, value: any, ttl?: number): void {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl: ttl || 0,
      }
      
      sessionStorage.setItem(key, JSON.stringify(item))
      this.cacheStats.sets++
    } catch (error) {
      console.warn('SessionStorage cache set failed:', error)
    }
  }

  getSessionStorage(key: string): any {
    try {
      const itemStr = sessionStorage.getItem(key)
      if (!itemStr) {
        this.cacheStats.misses++
        return null
      }

      const item = JSON.parse(itemStr)
      
      // Check TTL
      if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
        sessionStorage.removeItem(key)
        this.cacheStats.misses++
        return null
      }

      this.cacheStats.hits++
      return item.value
    } catch (error) {
      console.warn('SessionStorage cache get failed:', error)
      this.cacheStats.misses++
      return null
    }
  }

  deleteSessionStorage(key: string): boolean {
    try {
      sessionStorage.removeItem(key)
      this.cacheStats.deletes++
      return true
    } catch (error) {
      console.warn('SessionStorage cache delete failed:', error)
      return false
    }
  }

  // Cache statistics
  getStats() {
    return {
      ...this.cacheStats,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100,
      memorySize: this.memoryCache.size,
    }
  }

  // Clear all caches
  clearAll(): void {
    this.memoryCache.clear()
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
    }
  }

  // Clear expired items
  clearExpired(): void {
    const now = Date.now()
    
    // Clear expired memory cache items
    const entries = Array.from(this.memoryCache.entries())
    for (const [key, item] of entries) {
      if (item.ttl > 0 && now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key)
      }
    }

    // Clear expired localStorage items
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const itemStr = localStorage.getItem(key)
          if (itemStr) {
            const item = JSON.parse(itemStr)
            if (item.ttl > 0 && now - item.timestamp > item.ttl) {
              localStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.warn('Clear expired localStorage failed:', error)
    }

    // Clear expired sessionStorage items
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) {
          const itemStr = sessionStorage.getItem(key)
          if (itemStr) {
            const item = JSON.parse(itemStr)
            if (item.ttl > 0 && now - item.timestamp > item.ttl) {
              sessionStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.warn('Clear expired sessionStorage failed:', error)
    }
  }
}

// Cache optimization hooks
export function useCacheOptimization() {
  const service = CacheOptimizationService.getInstance()

  const setCache = useCallback((key: string, value: any, options?: {
    type?: 'memory' | 'localStorage' | 'sessionStorage'
    ttl?: number
  }) => {
    const { type = 'memory', ttl } = options || {}
    
    switch (type) {
      case 'localStorage':
        service.setLocalStorage(key, value, ttl)
        break
      case 'sessionStorage':
        service.setSessionStorage(key, value, ttl)
        break
      default:
        service.setMemory(key, value, ttl)
    }
  }, [service])

  const getCache = useCallback((key: string, type: 'memory' | 'localStorage' | 'sessionStorage' = 'memory') => {
    switch (type) {
      case 'localStorage':
        return service.getLocalStorage(key)
      case 'sessionStorage':
        return service.getSessionStorage(key)
      default:
        return service.getMemory(key)
    }
  }, [service])

  const deleteCache = useCallback((key: string, type: 'memory' | 'localStorage' | 'sessionStorage' = 'memory') => {
    switch (type) {
      case 'localStorage':
        return service.deleteLocalStorage(key)
      case 'sessionStorage':
        return service.deleteSessionStorage(key)
      default:
        return service.deleteMemory(key)
    }
  }, [service])

  const clearAll = useCallback(() => {
    service.clearAll()
  }, [service])

  const clearExpired = useCallback(() => {
    service.clearExpired()
  }, [service])

  const getStats = useCallback(() => {
    return service.getStats()
  }, [service])

  return {
    setCache,
    getCache,
    deleteCache,
    clearAll,
    clearExpired,
    getStats,
  }
}

// Component cache hook
export function useComponentCache<T>(key: string, factory: () => T, options?: {
  type?: 'memory' | 'localStorage' | 'sessionStorage'
  ttl?: number
}): T {
  const { setCache, getCache } = useCacheOptimization()
  
  return useMemo(() => {
    const cached = getCache(key, options?.type)
    if (cached) {
      return cached
    }
    
    const component = factory()
    setCache(key, component, options)
    return component
  }, [key, factory, setCache, getCache, options])
}

// Data cache hook
export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    type?: 'memory' | 'localStorage' | 'sessionStorage'
    ttl?: number
    enabled?: boolean
  }
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const { setCache, getCache } = useCacheOptimization()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!options?.enabled) return

    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cached = getCache(key, options?.type)
      if (cached) {
        setData(cached)
        setLoading(false)
        return
      }

      // Fetch new data
      const result = await fetcher()
      setData(result)
      setCache(key, result, options)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, setCache, getCache, options])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

// Cache performance monitoring hook
export function useCachePerformance() {
  const service = CacheOptimizationService.getInstance()
  const [stats, setStats] = useState(service.getStats())

  const updateStats = useCallback(() => {
    setStats(service.getStats())
  }, [service])

  useEffect(() => {
    const interval = setInterval(updateStats, 5000)
    return () => clearInterval(interval)
  }, [updateStats])

  return {
    stats,
    updateStats,
  }
}

// Cache optimization utilities
export const cacheOptimizationUtils = {
  // Generate cache key
  generateKey: (prefix: string, ...parts: string[]): string => {
    return `${prefix}:${parts.join(':')}`
  },

  // Cache size estimation
  estimateSize: (data: any): number => {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return 0
    }
  },

  // Cache compression
  compress: (data: any): string => {
    try {
      return JSON.stringify(data)
    } catch {
      return ''
    }
  },

  // Cache decompression
  decompress: (compressed: string): any => {
    try {
      return JSON.parse(compressed)
    } catch {
      return null
    }
  },

  // Cache validation
  isValid: (data: any): boolean => {
    return data !== null && data !== undefined
  },

  // Cache cleanup
  cleanup: (keys: string[], type: 'memory' | 'localStorage' | 'sessionStorage' = 'memory'): void => {
    const service = CacheOptimizationService.getInstance()
    
    keys.forEach(key => {
      switch (type) {
        case 'localStorage':
          service.deleteLocalStorage(key)
          break
        case 'sessionStorage':
          service.deleteSessionStorage(key)
          break
        default:
          service.deleteMemory(key)
      }
    })
  },

  // Cache warming
  warmCache: async (keys: string[], fetchers: (() => Promise<any>)[], options?: {
    type?: 'memory' | 'localStorage' | 'sessionStorage'
    ttl?: number
  }): Promise<void> => {
    const service = CacheOptimizationService.getInstance()
    
    const promises = keys.map(async (key, index) => {
      try {
        const data = await fetchers[index]()
        const { type = 'memory', ttl } = options || {}
        
        switch (type) {
          case 'localStorage':
            service.setLocalStorage(key, data, ttl)
            break
          case 'sessionStorage':
            service.setSessionStorage(key, data, ttl)
            break
          default:
            service.setMemory(key, data, ttl)
        }
      } catch (error) {
        console.warn(`Cache warming failed for key ${key}:`, error)
      }
    })

    await Promise.all(promises)
  },
}

// Initialize cache optimization service
if (typeof window !== 'undefined') {
  const service = CacheOptimizationService.getInstance()
  
  // Clear expired items on startup
  service.clearExpired()
  
  // Clear expired items every 5 minutes
  setInterval(() => {
    service.clearExpired()
  }, 5 * 60 * 1000)
}
