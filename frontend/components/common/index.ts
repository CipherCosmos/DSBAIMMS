// Export all common components for easy importing
export { LazyWrapper, withLazyLoading, createLazyComponent } from './LazyWrapper'
export { VirtualizedList, useVirtualizedList } from './VirtualizedList'
export { InfiniteScroll, useInfiniteScroll, useInfiniteData } from './InfiniteScroll'
export { PerformanceOptimizedTable } from './PerformanceOptimizedTable'
export { ImageOptimizer, useImageOptimization, generateResponsiveSizes, generateBlurDataURL } from './ImageOptimizer'
export { PerformanceMonitor } from './PerformanceMonitor'

// Re-export types for better TypeScript support
// Type exports are now defined inline in the component files
