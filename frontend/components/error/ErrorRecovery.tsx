'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RefreshCw, Download, Upload, Trash2, Settings } from 'lucide-react'

export interface RecoveryAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => Promise<void>
  destructive?: boolean
}

interface ErrorRecoveryProps {
  error: Error
  context?: string
  onRecover?: () => void
  onDismiss?: () => void
  customActions?: RecoveryAction[]
}

// Default recovery actions
const getDefaultRecoveryActions = (context?: string): RecoveryAction[] => {
  const actions: RecoveryAction[] = [
    {
      id: 'refresh',
      label: 'Refresh Page',
      description: 'Reload the current page to clear any temporary issues',
      icon: <RefreshCw className="w-4 h-4" />,
      action: async () => {
        window.location.reload()
      },
    },
    {
      id: 'clear-cache',
      label: 'Clear Cache',
      description: 'Clear browser cache and reload the page',
      icon: <Trash2 className="w-4 h-4" />,
      action: async () => {
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map(name => caches.delete(name)))
        }
        window.location.reload()
      },
    },
  ]

  // Add context-specific actions
  if (context === 'network') {
    actions.unshift({
      id: 'check-connection',
      label: 'Check Connection',
      description: 'Verify your internet connection and try again',
      icon: <Settings className="w-4 h-4" />,
      action: async () => {
        // This would typically check network connectivity
        console.log('Checking network connection...')
      },
    })
  }

  if (context === 'data') {
    actions.unshift({
      id: 'reload-data',
      label: 'Reload Data',
      description: 'Fetch fresh data from the server',
      icon: <Download className="w-4 h-4" />,
      action: async () => {
        // This would typically trigger a data refresh
        console.log('Reloading data...')
      },
    })
  }

  return actions
}

export function ErrorRecovery({ 
  error, 
  context, 
  onRecover, 
  onDismiss, 
  customActions 
}: ErrorRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState<string | null>(null)
  const [recoveryActions] = useState(() => 
    customActions || getDefaultRecoveryActions(context)
  )

  const handleRecovery = useCallback(async (action: RecoveryAction) => {
    setIsRecovering(true)
    setRecoveryStep(action.id)

    try {
      await action.action()
      onRecover?.()
    } catch (recoveryError) {
      console.error('Recovery action failed:', recoveryError)
      // Could show another error or fallback
    } finally {
      setIsRecovering(false)
      setRecoveryStep(null)
    }
  }, [onRecover])

  const getErrorType = (error: Error): string => {
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return 'Network Error'
    }
    if (error.name === 'ChunkLoadError' || error.message.includes('chunk')) {
      return 'Loading Error'
    }
    if (error.name === 'TypeError' || error.message.includes('undefined')) {
      return 'Data Error'
    }
    return 'Unknown Error'
  }

  const getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' => {
    if (error.name === 'NetworkError') return 'medium'
    if (error.name === 'ChunkLoadError') return 'high'
    if (error.name === 'TypeError') return 'medium'
    return 'low'
  }

  const errorType = getErrorType(error)
  const errorSeverity = getErrorSeverity(error)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-800">{errorType}</CardTitle>
              <CardDescription className="text-red-600">
                {context ? `${context} error occurred` : 'An error occurred'}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge 
              variant={errorSeverity === 'high' ? 'destructive' : errorSeverity === 'medium' ? 'default' : 'secondary'}
            >
              {errorSeverity} severity
            </Badge>
            {context && (
              <Badge variant="outline">{context}</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error details */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-1">Error Details</h4>
            <p className="text-sm text-red-700">
              {process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'}
            </p>
            {process.env.NODE_ENV === 'development' && error.stack && (
              <details className="mt-2">
                <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                  Stack Trace
                </summary>
                <pre className="mt-1 text-xs text-red-600 overflow-auto max-h-32 bg-red-100 p-2 rounded">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          {/* Recovery actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Recovery Options</h4>
            {recoveryActions.map((action) => (
              <motion.div
                key={action.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={() => handleRecovery(action)}
                  disabled={isRecovering}
                  variant={action.destructive ? 'destructive' : 'outline'}
                  className="w-full justify-start h-auto p-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {isRecovering && recoveryStep === action.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        action.icon
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{action.label}</div>
                      <div className="text-xs opacity-75">{action.description}</div>
                    </div>
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Dismiss button */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
            <Button
              onClick={onDismiss}
              variant="ghost"
              disabled={isRecovering}
            >
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Error recovery hook
export function useErrorRecovery() {
  const [error, setError] = useState<Error | null>(null)
  const [context, setContext] = useState<string | undefined>()
  const [customActions, setCustomActions] = useState<RecoveryAction[] | undefined>()

  const showRecovery = useCallback((error: Error, context?: string, actions?: RecoveryAction[]) => {
    setError(error)
    setContext(context)
    setCustomActions(actions)
  }, [])

  const hideRecovery = useCallback(() => {
    setError(null)
    setContext(undefined)
    setCustomActions(undefined)
  }, [])

  const handleRecover = useCallback(() => {
    hideRecovery()
  }, [hideRecovery])

  return {
    error,
    context,
    customActions,
    showRecovery,
    hideRecovery,
    handleRecover,
    isVisible: error !== null,
  }
}

// Error recovery provider component
export function ErrorRecoveryProvider({ children }: { children: React.ReactNode }) {
  const { error, context, customActions, hideRecovery, handleRecover, isVisible } = useErrorRecovery()

  return (
    <>
      {children}
      <AnimatePresence>
        {isVisible && error && (
          <ErrorRecovery
            error={error}
            context={context}
            customActions={customActions}
            onRecover={handleRecover}
            onDismiss={hideRecovery}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// Utility function to create recovery actions
export function createRecoveryAction(
  id: string,
  label: string,
  description: string,
  icon: React.ReactNode,
  action: () => Promise<void>,
  destructive = false
): RecoveryAction {
  return {
    id,
    label,
    description,
    icon,
    action,
    destructive,
  }
}

// Common recovery actions
export const commonRecoveryActions = {
  refresh: createRecoveryAction(
    'refresh',
    'Refresh Page',
    'Reload the current page',
    <RefreshCw className="w-4 h-4" />,
    async () => window.location.reload()
  ),
  
  clearCache: createRecoveryAction(
    'clear-cache',
    'Clear Cache',
    'Clear browser cache and reload',
    <Trash2 className="w-4 h-4" />,
    async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
      window.location.reload()
    }
  ),
  
  retry: createRecoveryAction(
    'retry',
    'Try Again',
    'Retry the failed operation',
    <RefreshCw className="w-4 h-4" />,
    async () => {
      // This would be implemented based on the specific operation
      console.log('Retrying operation...')
    }
  ),
}
