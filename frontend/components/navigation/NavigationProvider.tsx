'use client'

import { ReactNode, useEffect } from 'react'
import { useAuth } from '@/lib/hooks'
import { useNavigationOptimization } from '@/lib/routing'
import { NavigationProvider as RoutingNavigationProvider } from '@/lib/routing'
import { analyticsUtils } from '@/lib/monitoring'

interface NavigationProviderProps {
  children: ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const { user } = useAuth()
  const { navigateTo, activeItem, breadcrumbs } = useNavigationOptimization()

  // Track navigation analytics
  useEffect(() => {
    if (activeItem) {
      analyticsUtils.trackPage(activeItem, {
        path: activeItem,
        breadcrumbs: breadcrumbs,
        userRole: user?.role,
      })
    }
  }, [activeItem, breadcrumbs, user?.role])

  // Track user role changes
  useEffect(() => {
    if (user) {
      analyticsUtils.trackAction('role_change', 'user', {
        userId: user.id,
        role: user.role,
        fullName: user.full_name,
      })
    }
  }, [user])

  return (
    <RoutingNavigationProvider>
      {children}
    </RoutingNavigationProvider>
  )
}
