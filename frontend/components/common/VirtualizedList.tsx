'use client'
// @ts-nocheck

import { useMemo, useCallback, useState, useEffect } from 'react'
import { List as VirtualList } from 'react-window'
import { motion, AnimatePresence } from 'framer-motion'

interface VirtualizedListProps<T> {
  items: T[]
  height: number
  itemHeight: number
  renderItem: (props: { index: number; style: React.CSSProperties; item: T }) => React.ReactNode
  className?: string
  overscanCount?: number
  onScroll?: (scrollTop: number) => void
  loading?: boolean
  emptyState?: React.ReactNode
  searchTerm?: string
  filterFn?: (item: T, searchTerm: string) => boolean
}

// Default empty state
const DefaultEmptyState = () => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-gray-400 mb-4">
      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
    <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
  </div>
)

// Loading skeleton
const LoadingSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.1 }}
        className="animate-pulse bg-gray-200 rounded-lg h-16"
      />
    ))}
  </div>
)

export function VirtualizedList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className = '',
  overscanCount = 5,
  onScroll,
  loading = false,
  emptyState = <DefaultEmptyState />,
  searchTerm = '',
  filterFn,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm || !filterFn) return items
    return items.filter(item => filterFn(item, searchTerm))
  }, [items, searchTerm, filterFn])

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    onScroll?.(newScrollTop)
  }, [onScroll])

  // Memoized item renderer
  const ItemRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index]
    if (!item) return null

    return (
      <motion.div
        style={style}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.02 }}
      >
        {renderItem({ index, style, item })}
      </motion.div>
    )
  }, [filteredItems, renderItem])

  // Show loading state
  if (loading) {
    return (
      <div className={className} style={{ height }}>
        <LoadingSkeleton count={Math.ceil(height / itemHeight)} />
      </div>
    )
  }

  // Show empty state
  if (filteredItems.length === 0) {
    return (
      <div className={className} style={{ height }}>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex items-center justify-center"
          >
            {emptyState}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* @ts-ignore */}
      <VirtualList
        height={height}
        itemCount={filteredItems.length}
        itemSize={itemHeight}
        overscanCount={overscanCount}
        onScroll={(e: any) => handleScroll(e)}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
ItemRenderer
      </VirtualList>
    </div>
  )
}

// Hook for virtualized list with search and filtering
export function useVirtualizedList<T>(
  items: T[],
  searchTerm: string = '',
  filterFn?: (item: T, searchTerm: string) => boolean
) {
  const [loading, setLoading] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)

  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Filter items
  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm || !filterFn) return items
    return items.filter(item => filterFn(item, debouncedSearchTerm))
  }, [items, debouncedSearchTerm, filterFn])

  // Scroll to top when search changes
  useEffect(() => {
    setScrollPosition(0)
  }, [debouncedSearchTerm])

  return {
    filteredItems,
    loading,
    scrollPosition,
    setLoading,
    setScrollPosition,
  }
}
