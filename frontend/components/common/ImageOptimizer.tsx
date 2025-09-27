'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface ImageOptimizerProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  sizes?: string
  fill?: boolean
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: () => void
  fallback?: React.ReactNode
  loadingComponent?: React.ReactNode
  errorComponent?: React.ReactNode
  lazy?: boolean
  threshold?: number
  rootMargin?: string
}

// Default loading component
const DefaultLoadingComponent = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex items-center justify-center bg-gray-200 rounded-lg"
  >
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </motion.div>
)

// Default error component
const DefaultErrorComponent = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4"
  >
    <div className="text-gray-400 mb-2">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <span className="text-xs text-gray-500">Failed to load</span>
  </motion.div>
)

export function ImageOptimizer({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  sizes,
  fill = false,
  style,
  onLoad,
  onError,
  fallback,
  loadingComponent = <DefaultLoadingComponent />,
  errorComponent = <DefaultErrorComponent />,
  lazy = true,
  threshold = 0.1,
  rootMargin = '50px',
}: ImageOptimizerProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(!lazy)
  const imgRef = useRef<HTMLImageElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || !imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [lazy, threshold, rootMargin])

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    onLoad?.()
  }, [onLoad])

  // Handle image error
  const handleError = useCallback(() => {
    setHasError(true)
    onError?.()
  }, [onError])

  // Generate blur data URL if not provided
  const generateBlurDataURL = useCallback((w: number, h: number) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    canvas.width = w
    canvas.height = h

    // Create a simple gradient blur
    const gradient = ctx.createLinearGradient(0, 0, w, h)
    gradient.addColorStop(0, '#f3f4f6')
    gradient.addColorStop(1, '#e5e7eb')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    return canvas.toDataURL()
  }, [])

  // Get blur data URL
  const finalBlurDataURL = useMemo(() => {
    if (blurDataURL) return blurDataURL
    if (width && height) return generateBlurDataURL(width, height)
    return generateBlurDataURL(400, 300) // Default size
  }, [blurDataURL, width, height, generateBlurDataURL])

  // Show error state
  if (hasError) {
    return (
      <div ref={imgRef} className={className} style={style}>
        {errorComponent}
      </div>
    )
  }

  // Show loading state
  if (!isInView || !isLoaded) {
    return (
      <div ref={imgRef} className={className} style={style}>
        {loadingComponent}
      </div>
    )
  }

  return (
    <div ref={imgRef} className={className} style={style}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            quality={quality}
            placeholder={placeholder}
            blurDataURL={finalBlurDataURL}
            sizes={sizes}
            fill={fill}
            onLoad={handleLoad}
            onError={handleError}
            className="transition-opacity duration-300"
            style={{
              opacity: isLoaded ? 1 : 0,
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// Hook for image optimization
export function useImageOptimization(src: string) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const img = new window.Image()
    
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      setIsLoaded(true)
    }
    
    img.onerror = () => {
      setHasError(true)
    }
    
    img.src = src

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  return {
    isLoaded,
    hasError,
    dimensions,
  }
}

// Utility function to generate responsive image sizes
export function generateResponsiveSizes(breakpoints: number[] = [640, 768, 1024, 1280, 1536]) {
  return breakpoints
    .map((breakpoint, index) => {
      const nextBreakpoint = breakpoints[index + 1]
      if (nextBreakpoint) {
        return `(max-width: ${nextBreakpoint - 1}px) ${breakpoint}px`
      }
      return `${breakpoint}px`
    })
    .join(', ')
}

// Utility function to generate blur data URL
export function generateBlurDataURL(width: number, height: number): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  canvas.width = width
  canvas.height = height

  // Create a simple gradient blur
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#f3f4f6')
  gradient.addColorStop(1, '#e5e7eb')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  return canvas.toDataURL()
}
