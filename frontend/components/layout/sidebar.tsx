'use client'

import { useAuth } from '@/hooks/useAuth'
import { useUserRoutes } from '@/hooks/useRouteGuard'
import { 
  GraduationCap, 
  LayoutDashboard, 
  Users, 
  Building, 
  BookOpen, 
  FileText, 
  BarChart3,
  Upload,
  Download,
  Settings,
  Bell,
  FolderOpen,
  Database,
  Monitor,
  Calendar,
  GraduationCap as GraduationCapIcon
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Icon mapping for routes
const iconMap: Record<string, any> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/users': Users,
  '/dashboard/departments': Building,
  '/dashboard/semesters': Calendar,
  '/dashboard/classes': BookOpen,
  '/dashboard/subjects': FileText,
  '/dashboard/exams': GraduationCap,
  '/dashboard/attendance': Calendar,
  '/dashboard/promotion': GraduationCapIcon,
  '/dashboard/questionbanks': Database,
  '/dashboard/files': FolderOpen,
  '/dashboard/notifications': Bell,
  '/dashboard/co-po': BarChart3,
  '/dashboard/analytics': BarChart3,
  '/dashboard/bulk': Upload,
  '/dashboard/reports': Download,
  '/dashboard/monitoring': Monitor,
  '/dashboard/marks': FileText,
  '/dashboard/courses': BookOpen,
  '/dashboard/profile': Settings
}

// Dynamic navigation based on user routes
function getNavigationItems(userRoutes: any[]) {
  return userRoutes
    .filter(route => route.requiresAuth !== false && !route.isPublic)
    .map(route => ({
      name: route.title,
      href: route.path,
      icon: iconMap[route.path] || LayoutDashboard,
      description: route.description
    }))
    .sort((a, b) => {
      // Sort by priority (dashboard first, then alphabetically)
      if (a.href === '/dashboard') return -1
      if (b.href === '/dashboard') return 1
      return a.name.localeCompare(b.name)
    })
}

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const userRoutes = useUserRoutes()

  if (!user) return null

  const userNavigation = getNavigationItems(userRoutes)

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white border-r">
        <div className="flex items-center flex-shrink-0 px-4">
          <GraduationCap className="h-8 w-8 text-primary" />
          <span className="ml-2 text-xl font-semibold">LMS System</span>
        </div>
        <div className="mt-5 flex-grow flex flex-col">
          <nav className="flex-1 px-2 space-y-1">
            {userNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-primary-foreground' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}