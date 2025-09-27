'use client'

import React from 'react'
import { Loader2, Database, Users, BookOpen, GraduationCap } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  variant?: 'default' | 'page' | 'card' | 'inline'
  icon?: 'default' | 'database' | 'users' | 'book' | 'graduation'
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
}

const iconMap = {
  default: Loader2,
  database: Database,
  users: Users,
  book: BookOpen,
  graduation: GraduationCap
}

export function LoadingSpinner({ 
  size = 'md', 
  text, 
  variant = 'default',
  icon = 'default'
}: LoadingSpinnerProps) {
  const IconComponent = iconMap[icon]
  const sizeClass = sizeClasses[size]

  if (variant === 'page') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <IconComponent className={`${sizeClasses.lg} text-primary animate-spin`} />
          </div>
          {text && (
            <p className="text-lg font-medium text-gray-900 mb-2">{text}</p>
          )}
          <p className="text-sm text-gray-500">Please wait while we load your data...</p>
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <IconComponent className={`${sizeClasses.lg} text-primary animate-spin`} />
          </div>
          {text && (
            <p className="text-base font-medium text-gray-900 mb-2">{text}</p>
          )}
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center space-x-2">
        <IconComponent className={`${sizeClass} animate-spin text-primary`} />
        {text && <span className="text-sm text-gray-600">{text}</span>}
      </div>
    )
  }

  // Default variant
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center">
        <IconComponent className={`${sizeClass} animate-spin text-primary mx-auto mb-2`} />
        {text && <p className="text-sm text-gray-600">{text}</p>}
      </div>
    </div>
  )
}

// Specialized loading components for different contexts
export function PageLoading({ text = 'Loading page...' }: { text?: string }) {
  return <LoadingSpinner variant="page" size="lg" text={text} />
}

export function CardLoading({ text = 'Loading data...' }: { text?: string }) {
  return <LoadingSpinner variant="card" size="md" text={text} />
}

export function InlineLoading({ text, size = 'sm' }: { text?: string; size?: 'sm' | 'md' }) {
  return <LoadingSpinner variant="inline" size={size} text={text} />
}

// Loading states for specific data types
export function UsersLoading() {
  return <LoadingSpinner variant="page" size="lg" text="Loading users..." icon="users" />
}

export function DatabaseLoading() {
  return <LoadingSpinner variant="page" size="lg" text="Connecting to database..." icon="database" />
}

export function BooksLoading() {
  return <LoadingSpinner variant="page" size="lg" text="Loading academic content..." icon="book" />
}

export function GraduationLoading() {
  return <LoadingSpinner variant="page" size="lg" text="Loading academic data..." icon="graduation" />
}

// Skeleton loading components
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 bg-gray-200 rounded animate-pulse flex-1"
              style={{ 
                width: `${Math.random() * 40 + 60}%` // Random width between 60-100%
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      ))}
    </div>
  )
}
