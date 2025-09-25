'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'

interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: string
  department_id?: number
  class_id?: number
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (_username: string, _password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token')
      console.log('Initializing auth, token exists:', !!token)
      
      if (token) {
        try {
          console.log('Getting current user with token...')
          const response = await apiClient.getCurrentUser()
          console.log('Current user data received:', response.data)
          setUser(response.data)
        } catch (error: any) {
          console.error('Failed to get current user:', error)
          // Only clear tokens if it's a 401 error (unauthorized)
          // Other errors (network, 500, etc.) should not clear tokens
          if (error.response?.status === 401) {
            console.log('401 error, clearing tokens')
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
          }
        }
      }
      console.log('Auth initialization complete, setting loading to false')
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = async (_username: string, _password: string) => {
    try {
      console.log('Attempting login for user:', _username)
      const response = await apiClient.login(_username, _password)
      console.log('Login successful, setting tokens and user data')
      localStorage.setItem('access_token', response.data.access_token)
      localStorage.setItem('refresh_token', response.data.refresh_token)
      setUser(response.data.user)
      console.log('User set in context:', response.data.user)
    } catch (error: any) {
      console.error('Login failed:', error)
      throw new Error(error.detail || 'Login failed')
    }
  }

  const logout = async () => {
    try {
      await apiClient.logout()
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setUser(null)
      router.push('/login')
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}