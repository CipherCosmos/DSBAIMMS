'use client'
// @ts-nocheck

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { List as VirtualList } from 'react-window'
import { useRenderOptimization } from '@/lib/performance'
import { cn } from '@/lib/utils'

interface OptimizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  height?: number
  itemHeight?: number | ((index: number) => number)
  width?: number | string
  className?: string
  virtualized?: boolean
  lazy?: boolean
  threshold?: number
  onLoadMore?: () => void
  loading?: boolean
  hasMore?: boolean
}

export function OptimizedList<T>({
  items,
  renderItem,
  height = 400,
  itemHeight = 50,
  width = '100%',
  className,
  virtualized = true,
  lazy = true,
  threshold = 0.8,
  onLoadMore,
  loading = false,
  hasMore = true,
}: OptimizedListProps<T>) {
  const { renderTime } = useRenderOptimization('OptimizedList')
  const [visibleItems, setVisibleItems] = useState<T[]>(items.slice(0, 20))
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const listRef = useRef<any>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef<HTMLDivElement>(null)

  // Memoized item renderer for virtualized list
  const ItemRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index]
    if (!item) return null

    return (
      <div style={style} className="px-4 py-2">
        {renderItem(item, index)}
      </div>
    )
  }, [items, renderItem])

  // Variable item height renderer
  const VariableItemRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index]
    if (!item) return null

    return (
      <div style={style} className="px-4 py-2">
        {renderItem(item, index)}
      </div>
    )
  }, [items, renderItem])

  // Get item size for variable height
  const getItemSize = useCallback((index: number) => {
    if (typeof itemHeight === 'function') {
      return itemHeight(index)
    }
    return itemHeight
  }, [itemHeight])

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || !onLoadMore || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true)
          onLoadMore()
        }
      },
      {
        rootMargin: '100px',
        threshold,
      }
    )

    if (loadingRef.current) {
      observer.observe(loadingRef.current)
      observerRef.current = observer
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [lazy, onLoadMore, hasMore, isLoadingMore, threshold])

  // Reset loading state when items change
  useEffect(() => {
    if (isLoadingMore) {
      setIsLoadingMore(false)
    }
  }, [items.length, isLoadingMore])

  // Update visible items for non-virtualized list
  useEffect(() => {
    if (!virtualized) {
      setVisibleItems(items)
    }
  }, [items, virtualized])

  // Scroll to top when items change
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0, 'start')
    }
  }, [])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(items.length - 1, 'end')
    }
  }, [items.length])

  // Scroll to specific item
  const scrollToItem = useCallback((index: number) => {
    if (listRef.current) {
      listRef.current.scrollToItem(index, 'center')
    }
  }, [])

  // Render virtualized list
  const renderVirtualizedList = () => {
    return (
      <>
        {/* @ts-ignore */}
        <VirtualList
          ref={listRef}
          height={height}
          itemCount={items.length}
          itemSize={typeof itemHeight === 'function' ? getItemSize : itemHeight}
          width={width}
          className={cn('scrollbar-thin scrollbar-thumb-gray-300', className)}
        >
          {typeof itemHeight === 'function' ? VariableItemRenderer : ItemRenderer}
        </VirtualList>
      </>
    )
  }

  // Render non-virtualized list
  const renderRegularList = () => {
    return (
      <div
        className={cn('overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300', className)}
        style={{ height, width }}
      >
        <AnimatePresence>
          {visibleItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
              className="px-4 py-2"
            >
              {renderItem(item, index)}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading more indicator */}
        {lazy && onLoadMore && hasMore && (
          <div ref={loadingRef} className="flex justify-center py-4">
            {loading || isLoadingMore ? (
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <div className="text-gray-500 text-sm">Scroll to load more</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Performance indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          Render: {renderTime.toFixed(2)}ms
        </div>
      )}

      {/* List controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          {items.length} items
          {virtualized && ` (virtualized)`}
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={scrollToTop}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            Top
          </button>
          <button
            onClick={scrollToBottom}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            Bottom
          </button>
        </div>
      </div>

      {/* List content */}
      {virtualized ? renderVirtualizedList() : renderRegularList()}

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              <div className="text-sm text-gray-600">Loading...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
