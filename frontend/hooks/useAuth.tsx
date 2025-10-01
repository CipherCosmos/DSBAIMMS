'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores'
import { getAccessToken, clearAuthTokens } from '@/lib/cookies'

interface AuthContextType {
  user: any
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, getCurrentUser, setUser } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken()
      
      // Always check token validity on app start
      if (token) {
        try {
          await getCurrentUser()
        } catch (error: any) {
          // Clear tokens and user data on any error
          clearAuthTokens()
          setUser(null)
        }
      } else {
        // No token, ensure user is not authenticated
        setUser(null)
      }
    }

    initAuth()
  }, [getCurrentUser, setUser])

  const login = async (username: string, password: string) => {
    try {
      await useAuthStore.getState().login({ username, password })
    } catch (error: any) {
      throw new Error(error.message || 'Login failed')
    }
  }

  const logout = async () => {
    try {
      await useAuthStore.getState().logout()
    } catch (error) {
      // Ignore logout errors
    } finally {
      // Backend will clear cookies automatically
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