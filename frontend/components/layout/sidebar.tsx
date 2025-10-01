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
  GraduationCap as GraduationCapIcon,
  ChevronDown,
  ChevronRight,
  User,
  School,
  ClipboardList,
  TrendingUp,
  Shield,
  BookMarked,
  MessageSquare,
  Activity,
  Archive,
  UserCheck,
  Award,
  PieChart,
  FileSpreadsheet,
  Cog,
  PlusCircle,
  Edit3,
  Eye,
  Target,
  Brain,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

// Navigation categories based on LMS specification
interface NavigationItem {
  name: string
  href: string
  icon: any
  description?: string
  allowedRoles: string[]
  children?: NavigationItem[]
}

interface NavigationCategory {
  name: string
  icon: any
  items: NavigationItem[]
  allowedRoles: string[]
  collapsible?: boolean
}

// Enhanced navigation structure with categories
const navigationCategories: NavigationCategory[] = [
  {
    name: 'Overview',
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Main dashboard overview',
        allowedRoles: ['admin', 'hod', 'teacher', 'student']
      }
    ]
  },
  {
    name: 'Administration',
    icon: Shield,
    allowedRoles: ['admin', 'hod'],
    collapsible: true,
    items: [
      {
        name: 'User Management',
        href: '/dashboard/users',
        icon: Users,
        description: 'Manage system users',
        allowedRoles: ['admin']
      },
      {
        name: 'Departments',
        href: '/dashboard/departments',
        icon: Building,
        description: 'Manage departments and HODs',
        allowedRoles: ['admin']
      },
      {
        name: 'Semesters',
        href: '/dashboard/semesters',
        icon: Calendar,
        description: 'Manage academic semesters',
        allowedRoles: ['admin', 'hod']
      },
      {
        name: 'Classes',
        href: '/dashboard/classes',
        icon: School,
        description: 'Manage classes and sections',
        allowedRoles: ['admin', 'hod']
      },
    ]
  },
  {
    name: 'Academic Management',
    icon: BookOpen,
    allowedRoles: ['admin', 'hod', 'teacher'],
    collapsible: true,
    items: [
      {
        name: 'Subjects',
        href: '/dashboard/subjects',
        icon: FileText,
        description: 'Manage subjects and courses',
        allowedRoles: ['admin', 'hod', 'teacher']
      },
      {
        name: 'CO/PO Management',
        href: '/dashboard/co-po',
        icon: Target,
        description: 'Course and Program Outcomes',
        allowedRoles: ['admin', 'hod', 'teacher']
      }
    ]
  },
  {
    name: 'Student Activities',
    icon: UserCheck,
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    collapsible: true,
    items: [
      {
        name: 'Marks Management',
        href: '/dashboard/marks',
        icon: FileSpreadsheet,
        description: 'Manage student marks',
        allowedRoles: ['admin', 'hod', 'teacher', 'student']
      },
      {
        name: 'Student Promotion',
        href: '/dashboard/promotion',
        icon: GraduationCapIcon,
        description: 'Manage student promotion',
        allowedRoles: ['admin', 'hod']
      },
      {
        name: 'My Courses',
        href: '/dashboard/courses',
        icon: BookMarked,
        description: 'View enrolled courses',
        allowedRoles: ['student']
      }
    ]
  },
  {
    name: 'Analytics & Reports',
    icon: TrendingUp,
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    collapsible: true,
    items: [
      {
        name: 'Analytics Dashboard',
        href: '/dashboard/analytics',
        icon: BarChart3,
        description: 'System analytics and insights',
        allowedRoles: ['admin', 'hod', 'teacher', 'student']
      },
      {
        name: 'Performance Analytics',
        href: '/dashboard/analytics/performance',
        icon: Brain,
        description: 'Performance analysis',
        allowedRoles: ['admin', 'hod', 'teacher']
      }
    ]
  },
  {
    name: 'System Operations',
    icon: Cog,
    allowedRoles: ['admin', 'hod'],
    collapsible: true,
    items: [
      {
        name: 'Bulk Operations',
        href: '/dashboard/bulk-operations',
        icon: Upload,
        description: 'Bulk import/export operations',
        allowedRoles: ['admin', 'hod']
      },
      {
        name: 'Exam Management',
        href: '/dashboard/exams',
        icon: ClipboardList,
        description: 'Advanced exam management',
        allowedRoles: ['admin', 'hod', 'teacher']
      }
    ]
  },
  {
    name: 'Communication',
    icon: MessageSquare,
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    collapsible: true,
    items: [
      {
        name: 'Notifications',
        href: '/dashboard/notifications',
        icon: Bell,
        description: 'System notifications',
        allowedRoles: ['admin', 'hod', 'teacher', 'student']
      }
    ]
  },
  {
    name: 'Profile',
    icon: User,
    allowedRoles: ['admin', 'hod', 'teacher', 'student'],
    items: [
      {
        name: 'My Profile',
        href: '/dashboard/profile',
        icon: Settings,
        description: 'User profile management',
        allowedRoles: ['admin', 'hod', 'teacher', 'student']
      }
    ]
  }
]

// Filter navigation based on user role
function getFilteredNavigation(userRole: string): NavigationCategory[] {
  return navigationCategories
    .filter(category => category.allowedRoles.includes(userRole))
    .map(category => ({
      ...category,
      items: category.items.filter(item => item.allowedRoles.includes(userRole))
        .map(item => ({
          ...item,
          children: item.children?.filter(child => child.allowedRoles.includes(userRole))
        }))
    }))
    .filter(category => category.items.length > 0)
}

// Collapsible category component
function CollapsibleCategory({ 
  category, 
  pathname, 
  expandedCategories, 
  toggleCategory 
}: {
  category: NavigationCategory
  pathname: string
  expandedCategories: Set<string>
  toggleCategory: (name: string) => void
}) {
  const isExpanded = expandedCategories.has(category.name)
  const CategoryIcon = category.icon

  return (
    <div className="space-y-1">
      <button
        onClick={() => toggleCategory(category.name)}
        className="group flex w-full items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
      >
        <CategoryIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
        <span className="flex-1 text-left">{category.name}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="ml-6 space-y-1">
          {category.items.map((item) => (
            <NavigationItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  )
}

// Navigation item component
function NavigationItem({ 
  item, 
  pathname 
}: { 
  item: NavigationItem
  pathname: string 
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const ItemIcon = item.icon

  return (
    <div className="space-y-1">
      <Link
        href={item.href}
        className={`
          group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
          ${isActive 
            ? 'bg-primary text-primary-foreground' 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }
        `}
      >
        <ItemIcon
          className={`mr-3 h-5 w-5 ${
            isActive ? 'text-primary-foreground' : 'text-gray-400 group-hover:text-gray-500'
          }`}
        />
        <span className="flex-1">{item.name}</span>
      </Link>
      
      {/* Render children if any */}
      {item.children && isActive && (
        <div className="ml-6 space-y-1">
          {item.children.map((child) => {
            const ChildIcon = child.icon
            const isChildActive = pathname === child.href
            
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                  ${isChildActive 
                    ? 'bg-primary/20 text-primary border-l-2 border-primary' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }
                `}
              >
                <ChildIcon
                  className={`mr-3 h-4 w-4 ${
                    isChildActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'
                  }`}
                />
                <span className="flex-1">{child.name}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Overview', 'Profile']))

  if (!user) return null

  const filteredNavigation = getFilteredNavigation(user.role)

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  // Auto-expand categories containing active items
  const getActiveCategory = () => {
    for (const category of filteredNavigation) {
      if (category.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
        return category.name
      }
    }
    return null
  }

  const activeCategory = getActiveCategory()
  if (activeCategory && !expandedCategories.has(activeCategory)) {
    setExpandedCategories(prev => new Set([...prev, activeCategory]))
  }

  return (
    <div className="hidden md:flex md:w-72 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white border-r shadow-sm">
        {/* Header */}
        <div className="flex items-center flex-shrink-0 px-4 mb-6">
          <div className="flex items-center">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">LMS System</h1>
              <p className="text-xs text-gray-500 capitalize">{user.role} Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-grow flex flex-col">
          <nav className="flex-1 px-3 space-y-2">
            {filteredNavigation.map((category) => {
              if (category.collapsible) {
                return (
                  <CollapsibleCategory
                    key={category.name}
                    category={category}
                    pathname={pathname}
                    expandedCategories={expandedCategories}
                    toggleCategory={toggleCategory}
                  />
                )
              } else {
                return (
                  <div key={category.name} className="space-y-1">
                    {category.items.map((item) => (
                      <NavigationItem key={item.href} item={item} pathname={pathname} />
                    ))}
                  </div>
                )
              }
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role} • {user.department_name || 'System'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}