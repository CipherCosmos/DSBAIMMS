'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: string[]
  fallbackUrl?: string
}

export function RoleGuard({ children, allowedRoles, fallbackUrl = '/dashboard' }: RoleGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      router.push(fallbackUrl)
    }
  }, [user, isLoading, allowedRoles, fallbackUrl, router])

  if (isLoading) {
    return null
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return null
  }

  return <>{children}</>
}

// Specific role guards for convenience
export function AdminGuard({ children, fallbackUrl = '/dashboard' }: { children: React.ReactNode; fallbackUrl?: string }) {
  return <RoleGuard allowedRoles={['admin']} fallbackUrl={fallbackUrl}>{children}</RoleGuard>
}

export function HODGuard({ children, fallbackUrl = '/dashboard' }: { children: React.ReactNode; fallbackUrl?: string }) {
  return <RoleGuard allowedRoles={['admin', 'hod']} fallbackUrl={fallbackUrl}>{children}</RoleGuard>
}

export function TeacherGuard({ children, fallbackUrl = '/dashboard' }: { children: React.ReactNode; fallbackUrl?: string }) {
  return <RoleGuard allowedRoles={['admin', 'hod', 'teacher']} fallbackUrl={fallbackUrl}>{children}</RoleGuard>
}

export function StudentGuard({ children, fallbackUrl = '/dashboard' }: { children: React.ReactNode; fallbackUrl?: string }) {
  return <RoleGuard allowedRoles={['student']} fallbackUrl={fallbackUrl}>{children}</RoleGuard>
}

