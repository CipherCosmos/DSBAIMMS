'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { motion, AnimatePresence } from 'framer-motion'

interface InfiniteScrollProps<T> {
  items: T[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  loadingComponent?: React.ReactNode
  endComponent?: React.ReactNode
  errorComponent?: React.ReactNode
  error?: Error | null
  retry?: () => void
  threshold?: number
  rootMargin?: string
}

// Default loading component
const DefaultLoadingComponent = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex items-center justify-center p-4"
  >
    <div className="flex items-center space-x-2">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      <span className="text-sm text-gray-600">Loading more...</span>
    </div>
  </motion.div>
)

// Default end component
const DefaultEndComponent = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex items-center justify-center p-4"
  >
    <div className="text-sm text-gray-500">You&apos;ve reached the end</div>
  </motion.div>
)

// Default error component
const DefaultErrorComponent = ({ error, retry }: { error: Error; retry?: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center p-4 text-center"
  >
    <div className="text-red-600 mb-2">
      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <p className="text-sm text-gray-600 mb-3">
      {process.env.NODE_ENV === 'development' ? error.message : 'Failed to load more items'}
    </p>
    {retry && (
      <button
        onClick={retry}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Try again
      </button>
    )}
  </motion.div>
)

export function InfiniteScroll<T>({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  renderItem,
  className = '',
  loadingComponent = <DefaultLoadingComponent />,
  endComponent = <DefaultEndComponent />,
  errorComponent,
  error,
  retry,
  threshold = 0.1,
  rootMargin = '100px',
}: InfiniteScrollProps<T>) {
  const [isVisible, setIsVisible] = useState(false)
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: false,
  })

  // Trigger fetch when in view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Show error state
  if (error) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
        <div ref={ref}>
          {errorComponent || <DefaultErrorComponent error={error} retry={retry} />}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <AnimatePresence>
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Loading trigger */}
      <div ref={ref}>
        {isFetchingNextPage && loadingComponent}
        {!hasNextPage && items.length > 0 && endComponent}
      </div>
    </div>
  )
}

// Hook for infinite scroll functionality
export function useInfiniteScroll<T>(
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  threshold: number = 0.1,
  rootMargin: string = '100px'
) {
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: false,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return { ref, inView }
}

// Hook for paginated data with infinite scroll
export function useInfiniteData<T>(
  initialData: T[] = [],
  pageSize: number = 20
) {
  const [data, setData] = useState<T[]>(initialData)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchNextPage = useCallback(async () => {
    if (isLoading || !hasNextPage) return

    setIsLoading(true)
    setError(null)

    try {
      // This would be replaced with actual API call
      // const newData = await fetchData(currentPage + 1, pageSize)
      // setData(prev => [...prev, ...newData])
      // setCurrentPage(prev => prev + 1)
      // setHasNextPage(newData.length === pageSize)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, pageSize, hasNextPage, isLoading])

  const reset = useCallback(() => {
    setData(initialData)
    setCurrentPage(1)
    setHasNextPage(true)
    setIsLoading(false)
    setError(null)
  }, [initialData])

  return {
    data,
    currentPage,
    hasNextPage,
    isLoading,
    error,
    fetchNextPage,
    reset,
  }
}
