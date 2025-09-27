'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
}

interface RetryState {
  attempt: number
  isRetrying: boolean
  lastError: Error | null
  nextRetryIn: number
}

interface RetryHandlerProps {
  onRetry: () => Promise<void>
  config?: Partial<RetryConfig>
  children: (state: RetryState & { retry: () => void; reset: () => void }) => React.ReactNode
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
}

export function RetryHandler({ onRetry, config = {}, children }: RetryHandlerProps) {
  const finalConfig = { ...defaultConfig, ...config }
  const [state, setState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
    lastError: null,
    nextRetryIn: 0,
  })

  const calculateDelay = useCallback((attempt: number): number => {
    const delay = Math.min(
      finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
      finalConfig.maxDelay
    )
    
    if (finalConfig.jitter) {
      // Add jitter to prevent thundering herd
      const jitterAmount = delay * 0.1
      return delay + (Math.random() - 0.5) * jitterAmount
    }
    
    return delay
  }, [finalConfig])

  const retry = useCallback(async () => {
    if (state.isRetrying || state.attempt >= finalConfig.maxRetries) {
      return
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      lastError: null,
    }))

    try {
      await onRetry()
      setState(prev => ({
        ...prev,
        attempt: 0,
        isRetrying: false,
        lastError: null,
        nextRetryIn: 0,
      }))
    } catch (error) {
      const nextAttempt = state.attempt + 1
      const nextRetryIn = nextAttempt < finalConfig.maxRetries ? calculateDelay(nextAttempt) : 0

      setState(prev => ({
        ...prev,
        attempt: nextAttempt,
        isRetrying: false,
        lastError: error as Error,
        nextRetryIn,
      }))
    }
  }, [state.isRetrying, state.attempt, finalConfig.maxRetries, onRetry, calculateDelay])

  const reset = useCallback(() => {
    setState({
      attempt: 0,
      isRetrying: false,
      lastError: null,
      nextRetryIn: 0,
    })
  }, [])

  // Auto-retry countdown
  useEffect(() => {
    if (state.nextRetryIn <= 0 || state.isRetrying) return

    const timer = setInterval(() => {
      setState(prev => ({
        ...prev,
        nextRetryIn: Math.max(0, prev.nextRetryIn - 100),
      }))
    }, 100)

    return () => clearInterval(timer)
  }, [state.nextRetryIn, state.isRetrying])

  // Auto-retry when countdown reaches 0
  useEffect(() => {
    if (state.nextRetryIn === 0 && state.attempt > 0 && state.attempt < finalConfig.maxRetries && !state.isRetrying) {
      retry()
    }
  }, [state.nextRetryIn, state.attempt, finalConfig.maxRetries, state.isRetrying, retry])

  return <>{children({ ...state, retry, reset })}</>
}

// Retry button component
export function RetryButton({ 
  onRetry, 
  config, 
  className = '' 
}: { 
  onRetry: () => Promise<void>
  config?: Partial<RetryConfig>
  className?: string
}) {
  return (
    <RetryHandler onRetry={onRetry} config={config}>
      {({ attempt, isRetrying, lastError, nextRetryIn, retry, reset }) => (
        <div className={className}>
          {lastError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-red-800">Operation Failed</h4>
                  <p className="text-sm text-red-700 mt-1">
                    {process.env.NODE_ENV === 'development' ? lastError.message : 'An error occurred'}
                  </p>
                  {attempt > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Attempt {attempt} of {config?.maxRetries || 3}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="border-red-300 text-red-700">
                  {attempt >= (config?.maxRetries || 3) ? 'Max Retries' : 'Retryable'}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Button
              onClick={retry}
              disabled={isRetrying || attempt >= (config?.maxRetries || 3)}
              variant={lastError ? 'destructive' : 'default'}
              className="flex items-center space-x-2"
            >
              {isRetrying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Retrying...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Retry</span>
                </>
              )}
            </Button>

            {nextRetryIn > 0 && (
              <div className="text-sm text-gray-600">
                Next retry in {Math.ceil(nextRetryIn / 1000)}s
              </div>
            )}

            {attempt > 0 && (
              <Button onClick={reset} variant="outline" size="sm">
                Reset
              </Button>
            )}
          </div>
        </div>
      )}
    </RetryHandler>
  )
}

// Retry card component
export function RetryCard({ 
  title, 
  description, 
  onRetry, 
  config, 
  children 
}: { 
  title: string
  description?: string
  onRetry: () => Promise<void>
  config?: Partial<RetryConfig>
  children?: React.ReactNode
}) {
  return (
    <RetryHandler onRetry={onRetry} config={config}>
      {({ attempt, isRetrying, lastError, nextRetryIn, retry, reset }) => (
        <Card className={lastError ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className={lastError ? 'text-red-800' : ''}>{title}</CardTitle>
                {description && (
                  <CardDescription className={lastError ? 'text-red-600' : ''}>
                    {description}
                  </CardDescription>
                )}
              </div>
              {attempt > 0 && (
                <Badge variant={lastError ? 'destructive' : 'secondary'}>
                  Attempt {attempt}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {lastError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  {process.env.NODE_ENV === 'development' ? lastError.message : 'An error occurred'}
                </p>
                {nextRetryIn > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Auto-retry in {Math.ceil(nextRetryIn / 1000)} seconds
                  </p>
                )}
              </div>
            )}

            {children}

            <div className="flex items-center space-x-2 mt-4">
              <Button
                onClick={retry}
                disabled={isRetrying || attempt >= (config?.maxRetries || 3)}
                variant={lastError ? 'destructive' : 'default'}
                size="sm"
                className="flex items-center space-x-2"
              >
                {isRetrying ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Retry</span>
                  </>
                )}
              </Button>

              {attempt > 0 && (
                <Button onClick={reset} variant="outline" size="sm">
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </RetryHandler>
  )
}

// Hook for retry functionality
export function useRetry(config?: Partial<RetryConfig>) {
  const [state, setState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
    lastError: null,
    nextRetryIn: 0,
  })

  const finalConfig = { ...defaultConfig, ...config }

  const calculateDelay = useCallback((attempt: number): number => {
    const delay = Math.min(
      finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
      finalConfig.maxDelay
    )
    
    if (finalConfig.jitter) {
      const jitterAmount = delay * 0.1
      return delay + (Math.random() - 0.5) * jitterAmount
    }
    
    return delay
  }, [finalConfig])

  const retry = useCallback(async (operation: () => Promise<void>) => {
    if (state.isRetrying || state.attempt >= finalConfig.maxRetries) {
      return
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      lastError: null,
    }))

    try {
      await operation()
      setState(prev => ({
        ...prev,
        attempt: 0,
        isRetrying: false,
        lastError: null,
        nextRetryIn: 0,
      }))
    } catch (error) {
      const nextAttempt = state.attempt + 1
      const nextRetryIn = nextAttempt < finalConfig.maxRetries ? calculateDelay(nextAttempt) : 0

      setState(prev => ({
        ...prev,
        attempt: nextAttempt,
        isRetrying: false,
        lastError: error as Error,
        nextRetryIn,
      }))
    }
  }, [state.isRetrying, state.attempt, finalConfig.maxRetries, calculateDelay])

  const reset = useCallback(() => {
    setState({
      attempt: 0,
      isRetrying: false,
      lastError: null,
      nextRetryIn: 0,
    })
  }, [])

  return {
    ...state,
    retry,
    reset,
    canRetry: state.attempt < finalConfig.maxRetries,
    isMaxRetries: state.attempt >= finalConfig.maxRetries,
  }
}

