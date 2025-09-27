'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationOptimization, navigationUtils } from '@/lib/routing'
import { Button } from '@/components/ui/button'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbNavigationProps {
  className?: string
  showHome?: boolean
  maxItems?: number
}

export function BreadcrumbNavigation({ 
  className = '', 
  showHome = true, 
  maxItems = 5 
}: BreadcrumbNavigationProps) {
  const { navigateTo, breadcrumbs, activeItem } = useNavigationOptimization()

  // Handle breadcrumb click
  const handleBreadcrumbClick = useCallback(async (path: string) => {
    await navigateTo(path, { replace: true })
  }, [navigateTo])

  // Get breadcrumb labels
  const breadcrumbLabels = navigationUtils.getBreadcrumbLabels(breadcrumbs)

  // Limit breadcrumbs if needed
  const limitedBreadcrumbs = breadcrumbs.length > maxItems 
    ? breadcrumbs.slice(-maxItems)
    : breadcrumbs

  const limitedLabels = breadcrumbLabels.length > maxItems
    ? breadcrumbLabels.slice(-maxItems)
    : breadcrumbLabels

  // Show ellipsis if breadcrumbs are limited
  const showEllipsis = breadcrumbs.length > maxItems

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`}>
      {/* Home Button */}
      {showHome && (
        <Button
          onClick={() => handleBreadcrumbClick('/dashboard')}
          variant="ghost"
          size="sm"
          className="p-2 h-8 w-8"
        >
          <Home className="w-4 h-4" />
        </Button>
      )}

      {/* Ellipsis */}
      {showEllipsis && (
        <>
          <span className="text-gray-400">...</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </>
      )}

      {/* Breadcrumb Items */}
      {limitedBreadcrumbs.map((path, index) => {
        const label = limitedLabels[index]
        const isLast = index === limitedBreadcrumbs.length - 1
        const isActive = path === activeItem

        return (
          <motion.div
            key={path}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center space-x-2"
          >
            {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
            
            <Button
              onClick={() => handleBreadcrumbClick(path)}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className={`h-8 px-3 ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </Button>
          </motion.div>
        )
      })}
    </nav>
  )
}

