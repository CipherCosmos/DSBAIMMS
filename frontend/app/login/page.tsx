'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { clearAuthTokens } from '@/lib/cookies'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const { login, user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      const redirectTo = searchParams.get('redirect') || '/dashboard'
      router.push(redirectTo)
    }
  }, [user, authLoading, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      console.log('Attempting login with:', username)
      console.log('Current cookies before login:', document.cookie)
      
      await login(username, password)
            console.log('Login successful, user:', user)
            console.log('Cookies after login:', document.cookie)
            
            // Check if tokens are stored
            const accessToken = document.cookie.split('; ').find(row => row.startsWith('access_token='))?.split('=')[1]
            const refreshToken = document.cookie.split('; ').find(row => row.startsWith('refresh_token='))?.split('=')[1]
            console.log('Access token stored:', !!accessToken)
            console.log('Refresh token stored:', !!refreshToken)
      
      toast.success('Welcome back!')
      
      // Add a small delay to ensure cookies are set
      setTimeout(() => {
        console.log('Redirecting to dashboard...')
        console.log('Final cookies before redirect:', document.cookie)
        // Redirect to intended page or dashboard
        const redirectTo = searchParams.get('redirect') || '/dashboard'
        router.push(redirectTo)
      }, 500)  // Increased delay to 500ms
    } catch (error: any) {
      console.error('Login failed:', error)
      toast.error(error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearAuth = () => {
    clearAuthTokens()
    toast.success('Auth data cleared')
    window.location.reload()
  }

  // Don't render if already authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (user) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md">
        <div className="p-6 space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary text-primary-foreground">
              <GraduationCap className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">LMS System (Dev Mode)</h1>
          <p className="text-muted-foreground">
            CO/PO-focused Learning Management System
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <div className="space-y-1">
              <p><strong>Demo Credentials:</strong></p>
              <p>Admin: admin / admin</p>
              <p><em>Note: Other user passwords need to be configured</em></p>
            </div>
            <button
              type="button"
              onClick={handleClearAuth}
              className="mt-4 px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
            >
              Clear Auth Data (Debug)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}