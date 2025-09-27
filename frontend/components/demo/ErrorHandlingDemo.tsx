'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ErrorToast, 
  ErrorToastContainer, 
  useErrorToasts,
  RetryButton,
  RetryCard,
  useRetry,
  ErrorRecovery,
  useErrorRecovery,
  FeatureErrorBoundary
} from '@/components/error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  AlertTriangle, 
  RefreshCw, 
  XCircle, 
  Info, 
  CheckCircle,
  Bug,
  Network,
  Shield,
  Database
} from 'lucide-react'

// Error simulation functions
const simulateNetworkError = () => {
  throw new Error('Network request failed: Unable to connect to server')
}

const simulateValidationError = () => {
  throw new Error('Validation failed: Email format is invalid')
}

const simulateServerError = () => {
  throw new Error('Server error: Internal server error (500)')
}

const simulateAuthError = () => {
  const error = new Error('Authentication failed: Invalid credentials')
  error.name = 'AuthenticationError'
  return error
}

const simulateChunkLoadError = () => {
  const error = new Error('Failed to load script chunk')
  error.name = 'ChunkLoadError'
  return error
}

// Async operation simulation
const simulateAsyncOperation = async (shouldFail: boolean = false): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  if (shouldFail) {
    throw new Error('Async operation failed')
  }
  
  return 'Operation completed successfully'
}

export function ErrorHandlingDemo() {
  const [activeTab, setActiveTab] = useState('error-boundaries')
  const [customMessage, setCustomMessage] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  
  const { toasts, showError, showWarning, showInfo, showSuccess, removeToast } = useErrorToasts()
  const { showRecovery, hideRecovery, isVisible: isRecoveryVisible } = useErrorRecovery()
  
  const { 
    attempt, 
    isRetrying, 
    lastError, 
    retry, 
    reset, 
    canRetry, 
    isMaxRetries 
  } = useRetry({ maxRetries: 3, baseDelay: 1000 })

  // Error boundary test component
  const ErrorBoundaryTest = () => {
    const [shouldError, setShouldError] = useState(false)
    
    if (shouldError) {
      throw new Error('This is a test error for the error boundary')
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Boundary Test</CardTitle>
          <CardDescription>
            This component will throw an error when the button is clicked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShouldError(true)}
            variant="destructive"
            className="flex items-center space-x-2"
          >
            <Bug className="w-4 h-4" />
            <span>Throw Error</span>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Retry test component
  const RetryTest = () => {
    const handleRetry = async () => {
      await simulateAsyncOperation(retryCount < 2) // Fail first 2 attempts
      setRetryCount(prev => prev + 1)
    }

    return (
      <RetryCard
        title="Retry Test"
        description="This operation will fail twice before succeeding"
        onRetry={handleRetry}
        config={{ maxRetries: 3, baseDelay: 1000 }}
      >
        <div className="text-sm text-gray-600">
          <p>Attempts: {retryCount}</p>
          <p>Status: {retryCount < 2 ? 'Will fail' : 'Will succeed'}</p>
        </div>
      </RetryCard>
    )
  }

  const tabs = [
    { id: 'error-boundaries', label: 'Error Boundaries', icon: '🛡️' },
    { id: 'error-toasts', label: 'Error Toasts', icon: '🍞' },
    { id: 'retry-handling', label: 'Retry Handling', icon: '🔄' },
    { id: 'error-recovery', label: 'Error Recovery', icon: '🚑' },
    { id: 'error-simulation', label: 'Error Simulation', icon: '🧪' },
  ]

  const errorTypes = [
    {
      id: 'network',
      label: 'Network Error',
      icon: <Network className="w-4 h-4" />,
      action: () => {
        try {
          simulateNetworkError()
        } catch (error) {
          showError('Network Error', 'Failed to connect to the server', {
            retryable: true,
            onRetry: () => console.log('Retrying network request...'),
          })
        }
      },
    },
    {
      id: 'validation',
      label: 'Validation Error',
      icon: <Shield className="w-4 h-4" />,
      action: () => {
        try {
          simulateValidationError()
        } catch (error) {
          showWarning('Validation Error', 'Please check your input and try again')
        }
      },
    },
    {
      id: 'server',
      label: 'Server Error',
      icon: <Database className="w-4 h-4" />,
      action: () => {
        try {
          simulateServerError()
        } catch (error) {
          showError('Server Error', 'Something went wrong on our end', {
            retryable: true,
            onRetry: () => console.log('Retrying server request...'),
          })
        }
      },
    },
    {
      id: 'auth',
      label: 'Authentication Error',
      icon: <Shield className="w-4 h-4" />,
      action: () => {
        const error = simulateAuthError()
        showRecovery(error, 'authentication', [
          {
            id: 'login',
            label: 'Go to Login',
            description: 'Redirect to login page',
            icon: <Shield className="w-4 h-4" />,
            action: async () => {
              console.log('Redirecting to login...')
              hideRecovery()
            },
          },
        ])
      },
    },
    {
      id: 'chunk',
      label: 'Chunk Load Error',
      icon: <Bug className="w-4 h-4" />,
      action: () => {
        const error = simulateChunkLoadError()
        showRecovery(error, 'loading', [
          {
            id: 'reload',
            label: 'Reload Page',
            description: 'Reload the page to fix the issue',
            icon: <RefreshCw className="w-4 h-4" />,
            action: async () => {
              window.location.reload()
            },
          },
        ])
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Error Handling Demo</h1>
        <Badge variant="outline">Phase 4 Complete</Badge>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'error-boundaries' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Boundary Test</CardTitle>
                  <CardDescription>
                    Test the error boundary by triggering an error in a component
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FeatureErrorBoundary featureName="Error Boundary Test">
                    <ErrorBoundaryTest />
                  </FeatureErrorBoundary>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Boundary Features</CardTitle>
                  <CardDescription>
                    What happens when an error occurs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Error Capture</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Automatic error detection</li>
                        <li>• Error reporting and logging</li>
                        <li>• User-friendly error display</li>
                        <li>• Recovery options</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Recovery Options</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Try again button</li>
                        <li>• Page reload option</li>
                        <li>• Error details (dev mode)</li>
                        <li>• Support contact info</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'error-toasts' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Toast Notifications</CardTitle>
                  <CardDescription>
                    Test different types of error notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button
                      onClick={() => showError('Error', 'Something went wrong!')}
                      variant="destructive"
                      className="flex items-center space-x-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Error</span>
                    </Button>
                    
                    <Button
                      onClick={() => showWarning('Warning', 'Please check your input')}
                      variant="outline"
                      className="flex items-center space-x-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Warning</span>
                    </Button>
                    
                    <Button
                      onClick={() => showInfo('Info', 'Here is some information')}
                      variant="outline"
                      className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Info className="w-4 h-4" />
                      <span>Info</span>
                    </Button>
                    
                    <Button
                      onClick={() => showSuccess('Success', 'Operation completed successfully!')}
                      variant="outline"
                      className="flex items-center space-x-2 border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Success</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Error Toast</CardTitle>
                  <CardDescription>
                    Create a custom error message
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="custom-message">Custom Message</Label>
                      <Input
                        id="custom-message"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Enter your custom error message..."
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (customMessage) {
                          showError('Custom Error', customMessage, {
                            retryable: true,
                            onRetry: () => console.log('Retrying custom operation...'),
                            action: {
                              label: 'Learn More',
                              onClick: () => console.log('Learn more clicked'),
                            },
                          })
                        }
                      }}
                      disabled={!customMessage}
                      className="w-full"
                    >
                      Show Custom Error
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Toast Container */}
              <ErrorToastContainer toasts={toasts} onClose={removeToast} />
            </div>
          )}

          {activeTab === 'retry-handling' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Retry Handling</CardTitle>
                  <CardDescription>
                    Test automatic retry mechanisms with exponential backoff
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RetryTest />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Retry Button</CardTitle>
                  <CardDescription>
                    Simple retry button with automatic retry logic
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RetryButton
                    onRetry={async () => {
                      await simulateAsyncOperation(attempt < 2) // Fail first 2 attempts
                    }}
                    config={{ maxRetries: 3, baseDelay: 1000 }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Retry Statistics</CardTitle>
                  <CardDescription>
                    Current retry attempt information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{attempt}</div>
                      <div className="text-sm text-gray-600">Attempts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {isRetrying ? 'Yes' : 'No'}
                      </div>
                      <div className="text-sm text-gray-600">Retrying</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {canRetry ? 'Yes' : 'No'}
                      </div>
                      <div className="text-sm text-gray-600">Can Retry</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {isMaxRetries ? 'Yes' : 'No'}
                      </div>
                      <div className="text-sm text-gray-600">Max Retries</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'error-recovery' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Recovery</CardTitle>
                  <CardDescription>
                    Test error recovery mechanisms with custom actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {errorTypes.map((errorType) => (
                      <Button
                        key={errorType.id}
                        onClick={errorType.action}
                        variant="outline"
                        className="flex items-center space-x-2 h-auto p-4"
                      >
                        {errorType.icon}
                        <span>{errorType.label}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recovery Features</CardTitle>
                  <CardDescription>
                    What happens during error recovery
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Automatic Recovery</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Error classification</li>
                        <li>• Context-aware recovery</li>
                        <li>• Custom recovery actions</li>
                        <li>• User guidance</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Recovery Actions</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Retry operation</li>
                        <li>• Clear cache</li>
                        <li>• Reload page</li>
                        <li>• Contact support</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'error-simulation' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Simulation</CardTitle>
                  <CardDescription>
                    Simulate different types of errors to test error handling
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {errorTypes.map((errorType) => (
                      <Button
                        key={errorType.id}
                        onClick={errorType.action}
                        variant="outline"
                        className="flex items-center space-x-2 h-auto p-4"
                      >
                        {errorType.icon}
                        <span>{errorType.label}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Handling Statistics</CardTitle>
                  <CardDescription>
                    Overview of error handling capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">100%</div>
                      <div className="text-sm text-gray-600">Error Coverage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">5</div>
                      <div className="text-sm text-gray-600">Error Types</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">3</div>
                      <div className="text-sm text-gray-600">Max Retries</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">Auto</div>
                      <div className="text-sm text-gray-600">Recovery</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error Recovery Modal */}
      {isRecoveryVisible && (
        <ErrorRecovery
          error={new Error('Test error')}
          context="demo"
          onRecover={hideRecovery}
          onDismiss={hideRecovery}
        />
      )}
    </div>
  )
}

