'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from './useAuth'
import { getRouteConfig, isRouteAllowed, getDefaultRouteForRole, getRoutesForRole } from '@/lib/routes'

export function useRouteGuard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return

    // Skip guard for public routes
    const route = getRouteConfig(pathname)
    if (route?.isPublic) return

    // Redirect to login if not authenticated
    if (!user) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`
      router.push(loginUrl)
      return
    }

    // Check if user has permission for this route
    if (!isRouteAllowed(pathname, user.role)) {
      // Redirect to appropriate dashboard based on role
      const defaultRoute = getDefaultRouteForRole(user.role)
      router.push(defaultRoute)
      return
    }
  }, [user, isLoading, pathname, router])

  return {
    user,
    isLoading,
    hasAccess: user ? isRouteAllowed(pathname, user.role) : false
  }
}

// Hook for checking specific permissions
export function usePermission(permission: string | string[]) {
  const { user } = useAuth()
  
  if (!user) return false
  
  if (Array.isArray(permission)) {
    return permission.includes(user.role)
  }
  
  return permission === user.role
}

// Hook for getting user's accessible routes
export function useUserRoutes() {
  const { user } = useAuth()
  
  if (!user) return []
  
  return getRoutesForRole(user.role)
}
