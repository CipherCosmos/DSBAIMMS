'use client'

import { useAuth } from '@/hooks/useAuth'
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
  Monitor
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = {
  admin: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/dashboard/users', icon: Users },
    { name: 'Departments', href: '/dashboard/departments', icon: Building },
    { name: 'Classes', href: '/dashboard/classes', icon: BookOpen },
    { name: 'Subjects', href: '/dashboard/subjects', icon: FileText },
    { name: 'Exams', href: '/dashboard/exams', icon: FileText },
    { name: 'Question Banks', href: '/dashboard/questionbanks', icon: Database },
    { name: 'Files', href: '/dashboard/files', icon: FolderOpen },
    { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    { name: 'CO/PO Management', href: '/dashboard/co-po', icon: FileText },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Bulk Operations', href: '/dashboard/bulk', icon: Upload },
    { name: 'Reports', href: '/dashboard/reports', icon: Download },
    { name: 'System Monitoring', href: '/dashboard/monitoring', icon: Monitor },
  ],
  hod: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/dashboard/users', icon: Users },
    { name: 'Classes', href: '/dashboard/classes', icon: BookOpen },
    { name: 'Subjects', href: '/dashboard/subjects', icon: FileText },
    { name: 'Exams', href: '/dashboard/exams', icon: FileText },
    { name: 'Question Banks', href: '/dashboard/questionbanks', icon: Database },
    { name: 'Files', href: '/dashboard/files', icon: FolderOpen },
    { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    { name: 'CO/PO Management', href: '/dashboard/co-po', icon: FileText },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Reports', href: '/dashboard/reports', icon: Download },
  ],
  teacher: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Subjects', href: '/dashboard/subjects', icon: BookOpen },
    { name: 'Exams', href: '/dashboard/exams', icon: FileText },
    { name: 'Question Banks', href: '/dashboard/questionbanks', icon: Database },
    { name: 'Files', href: '/dashboard/files', icon: FolderOpen },
    { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    { name: 'Marks Entry', href: '/dashboard/marks', icon: Upload },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Reports', href: '/dashboard/reports', icon: Download },
  ],
  student: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Courses', href: '/dashboard/courses', icon: BookOpen },
    { name: 'Exams', href: '/dashboard/exams', icon: FileText },
    { name: 'Files', href: '/dashboard/files', icon: FolderOpen },
    { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    { name: 'Marks', href: '/dashboard/marks', icon: BarChart3 },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Profile', href: '/dashboard/profile', icon: Settings },
  ],
}

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const userNavigation = navigation[user.role as keyof typeof navigation] || []

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