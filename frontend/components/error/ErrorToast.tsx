'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ErrorToastProps {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  duration?: number
  onClose: (id: string) => void
  onRetry?: () => void
  retryable?: boolean
  persistent?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

const toastIcons = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
}

const toastColors = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    title: 'text-red-800',
    message: 'text-red-700',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    title: 'text-yellow-800',
    message: 'text-yellow-700',
    button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    message: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    title: 'text-green-800',
    message: 'text-green-700',
    button: 'bg-green-600 hover:bg-green-700 text-white',
  },
}

export function ErrorToast({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
  onRetry,
  retryable = false,
  persistent = false,
  action,
}: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [timeLeft, setTimeLeft] = useState(duration)
  const [isPaused, setIsPaused] = useState(false)

  const Icon = toastIcons[type]
  const colors = toastColors[type]

  // Auto-close timer
  useEffect(() => {
    if (persistent || isPaused) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          setIsVisible(false)
          setTimeout(() => onClose(id), 300)
          return 0
        }
        return prev - 100
      })
    }, 100)

    return () => clearInterval(timer)
  }, [id, onClose, persistent, isPaused])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(id), 300)
  }

  const handleRetry = () => {
    onRetry?.()
    handleClose()
  }

  const handleAction = () => {
    action?.onClick()
    handleClose()
  }

  const progress = ((duration - timeLeft) / duration) * 100

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`relative max-w-sm w-full ${colors.bg} ${colors.border} border rounded-lg shadow-lg overflow-hidden`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Progress bar */}
          {!persistent && (
            <div className="absolute top-0 left-0 h-1 bg-gray-200 w-full">
              <motion.div
                className={`h-full ${colors.icon.replace('text-', 'bg-')}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium ${colors.title}`}>
                  {title}
                </h4>
                <p className={`mt-1 text-sm ${colors.message}`}>
                  {message}
                </p>
                
                {/* Action buttons */}
                <div className="mt-3 flex space-x-2">
                  {retryable && onRetry && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetry}
                      className="text-xs"
                    >
                      Retry
                    </Button>
                  )}
                  
                  {action && (
                    <Button
                      size="sm"
                      onClick={handleAction}
                      className={`text-xs ${colors.button}`}
                    >
                      {action.label}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex-shrink-0">
                <button
                  onClick={handleClose}
                  className={`${colors.icon} hover:opacity-75 transition-opacity`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Toast container component
export function ErrorToastContainer({ toasts, onClose }: { 
  toasts: ErrorToastProps[]
  onClose: (id: string) => void 
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ErrorToast
          key={toast.id}
          {...toast}
          onClose={onClose}
        />
      ))}
    </div>
  )
}

// Hook for managing error toasts
export function useErrorToasts() {
  const [toasts, setToasts] = useState<ErrorToastProps[]>([])

  const addToast = (toast: Omit<ErrorToastProps, 'id' | 'onClose'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newToast: ErrorToastProps = {
      ...toast,
      id,
      onClose: removeToast,
    }
    
    setToasts(prev => [...prev, newToast])
    return id
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const clearAllToasts = () => {
    setToasts([])
  }

  const showError = (title: string, message: string, options?: Partial<ErrorToastProps>) => {
    return addToast({
      type: 'error',
      title,
      message,
      ...options,
    })
  }

  const showWarning = (title: string, message: string, options?: Partial<ErrorToastProps>) => {
    return addToast({
      type: 'warning',
      title,
      message,
      ...options,
    })
  }

  const showInfo = (title: string, message: string, options?: Partial<ErrorToastProps>) => {
    return addToast({
      type: 'info',
      title,
      message,
      ...options,
    })
  }

  const showSuccess = (title: string, message: string, options?: Partial<ErrorToastProps>) => {
    return addToast({
      type: 'success',
      title,
      message,
      ...options,
    })
  }

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showError,
    showWarning,
    showInfo,
    showSuccess,
  }
}

