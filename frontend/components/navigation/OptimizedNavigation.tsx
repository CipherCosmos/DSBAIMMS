'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/hooks'
import { useNavigationOptimization, navigationUtils } from '@/lib/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Home, 
  Users, 
  Building, 
  BookOpen, 
  Book, 
  Calendar, 
  FileText, 
  CheckSquare, 
  UserCheck, 
  BarChart3, 
  FileBarChart, 
  Folder, 
  Bell, 
  Activity, 
  Upload, 
  TrendingUp, 
  Archive, 
  Target, 
  User,
  ChevronRight,
  ChevronDown,
  Menu,
  X
} from 'lucide-react'

interface OptimizedNavigationProps {
  className?: string
  collapsed?: boolean
  onToggle?: () => void
}

// Icon mapping
const iconMap: Record<string, any> = {
  Home,
  Users,
  Building,
  BookOpen,
  Book,
  Calendar,
  FileText,
  CheckSquare,
  UserCheck,
  BarChart3,
  FileBarChart,
  Folder,
  Bell,
  Activity,
  Upload,
  TrendingUp,
  Archive,
  Target,
  User,
}

export function OptimizedNavigation({ 
  className = '', 
  collapsed = false, 
  onToggle 
}: OptimizedNavigationProps) {
  const { user } = useAuth()
  const { navigateTo, activeItem, isNavigating } = useNavigationOptimization()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  // Get navigation items for current user role
  const navigationItems = user ? navigationUtils.getNavigationItems(user.role) : []
  const navigationHierarchy = user ? navigationUtils.getNavigationHierarchy(user.role) : null

  // Handle navigation
  const handleNavigation = useCallback(async (path: string) => {
    if (isNavigating) return
    
    await navigateTo(path, { prefetch: true })
  }, [navigateTo, isNavigating])

  // Handle item hover for prefetching
  const handleItemHover = useCallback((path: string) => {
    setHoveredItem(path)
    // Prefetch route on hover
    navigateTo(path, { prefetch: true })
  }, [navigateTo])

  // Toggle expanded state
  const toggleExpanded = useCallback((path: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])

  // Check if item is active
  const isActiveItem = useCallback((path: string) => {
    return navigationUtils.isActivePath(path, activeItem || '')
  }, [activeItem])

  // Render navigation item
  const renderNavigationItem = (item: any, level = 0) => {
    const Icon = iconMap[item.icon] || Home
    const isActive = isActiveItem(item.path)
    const isExpanded = expandedItems.has(item.path)
    const isHovered = hoveredItem === item.path
    const hasChildren = item.children && item.children.length > 0

    return (
      <motion.div
        key={item.path}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: level * 0.05 }}
        className="relative"
      >
        <div
          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
            isActive
              ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
              : isHovered
              ? 'bg-gray-100 text-gray-700'
              : 'text-gray-600 hover:bg-gray-50'
          } ${level > 0 ? 'ml-4' : ''}`}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.path)
            } else {
              handleNavigation(item.path)
            }
          }}
          onMouseEnter={() => handleItemHover(item.path)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className="flex items-center space-x-3">
            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
            {!collapsed && (
              <>
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </div>
          
          {!collapsed && hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </motion.div>
          )}
        </div>

        {/* Children */}
        {!collapsed && hasChildren && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1">
                  {item.children.map((child: any) => renderNavigationItem(child, level + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    )
  }

  // Render navigation section
  const renderNavigationSection = (title: string, items: any[], level = 0) => {
    if (items.length === 0) return null

    return (
      <div className="mb-6">
        {!collapsed && (
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
            {title}
          </h3>
        )}
        <div className="space-y-1">
          {items.map(item => renderNavigationItem(item, level))}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border-r border-gray-200 h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
          )}
          {onToggle && (
            <Button
              onClick={onToggle}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {navigationHierarchy && (
          <>
            {/* Main Navigation */}
            {renderNavigationSection('Main', navigationHierarchy.main)}
            
            {/* Management */}
            {renderNavigationSection('Management', navigationHierarchy.management)}
            
            {/* Academic */}
            {renderNavigationSection('Academic', navigationHierarchy.academic)}
            
            {/* Analytics */}
            {renderNavigationSection('Analytics', navigationHierarchy.analytics)}
            
            {/* Tools */}
            {renderNavigationSection('Tools', navigationHierarchy.tools)}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <div className="text-xs text-gray-500 text-center">
            {user && (
              <div>
                <div className="font-medium text-gray-700">{user.full_name}</div>
                <div className="capitalize">{user.role}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10"
        >
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </motion.div>
      )}
    </div>
  )
}

