'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useImageOptimization } from '@/lib/performance'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
  className?: string
  placeholder?: string
  lazy?: boolean
  priority?: boolean
  onLoad?: () => void
  onError?: () => void
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality = 80,
  format = 'webp',
  className,
  placeholder,
  lazy = true,
  priority = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const { optimizeImage, preloadImage } = useImageOptimization()
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isInView, setIsInView] = useState(!lazy)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Optimize image URL
  const optimizedSrc = optimizeImage(src, {
    width,
    height,
    quality,
    format,
  })

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
      observerRef.current = observer
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [lazy, isInView])

  // Preload image if priority
  useEffect(() => {
    if (priority && isInView) {
      preloadImage(optimizedSrc).catch(() => {
        setIsError(true)
        onError?.()
      })
    }
  }, [priority, isInView, optimizedSrc, preloadImage, onError])

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    setShowPlaceholder(false)
    onLoad?.()
  }, [onLoad])

  // Handle image error
  const handleError = useCallback(() => {
    setIsError(true)
    setShowPlaceholder(false)
    onError?.()
  }, [onError])

  // Handle placeholder click to load image
  const handlePlaceholderClick = useCallback(() => {
    if (!isInView) {
      setIsInView(true)
    }
  }, [isInView])

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Placeholder */}
      <AnimatePresence>
        {showPlaceholder && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-gray-200 flex items-center justify-center cursor-pointer"
            onClick={handlePlaceholderClick}
          >
            {placeholder ? (
              <div className="text-gray-500 text-sm">{placeholder}</div>
            ) : (
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gray-100 flex items-center justify-center"
          >
            <div className="text-center text-gray-500">
              <div className="w-8 h-8 mx-auto mb-2 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs">Failed to load</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optimized image */}
      {isInView && !isError && (
        <motion.img
          ref={imgRef}
          src={optimizedSrc}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      {/* Loading indicator */}
      <AnimatePresence>
        {isInView && !isLoaded && !isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-100 flex items-center justify-center"
          >
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

