'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string | string[]
  fallbackUrl?: string
}

export function AuthGuard({ children, requiredRole, fallbackUrl = '/dashboard' }: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // User is not authenticated, redirect to login
        const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`
        router.push(loginUrl)
        return
      }

      // Check role-based access
      if (requiredRole) {
        const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
        if (!allowedRoles.includes(user.role)) {
          // User doesn't have required role, redirect to appropriate page
          router.push(fallbackUrl)
          return
        }
      }
    }
  }, [user, isLoading, requiredRole, fallbackUrl, pathname, router])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if user is not authenticated
  if (!user) {
    return null
  }

  // Don't render children if user doesn't have required role
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowedRoles.includes(user.role)) {
      return null
    }
  }

  return <>{children}</>
}

