'use client'

import { ReactNode, useEffect } from 'react'
import { useAuthStore, useUIStore } from '@/lib/stores'
import { getAccessToken } from '@/lib/cookies'

interface StoreProviderProps {
  children: ReactNode
}

export function StoreProvider({ children }: StoreProviderProps) {
  const { getCurrentUser, setUser } = useAuthStore()
  const { setGlobalLoading } = useUIStore()

  useEffect(() => {
    const initializeStores = async () => {
      const token = getAccessToken()
      
      if (token) {
        setGlobalLoading(true)
        try {
          await getCurrentUser()
        } catch (error) {
          console.error('Failed to initialize auth store:', error)
          setUser(null)
        } finally {
          setGlobalLoading(false)
        }
      }
    }

    initializeStores()
  }, [getCurrentUser, setUser, setGlobalLoading])

  return <>{children}</>
}

