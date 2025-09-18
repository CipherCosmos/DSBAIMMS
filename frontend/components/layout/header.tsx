'use client'

import { useAuth } from '@/hooks/useAuth'
import { Bell, ChevronDown, LogOut, User } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)

  if (!user) return null

  const getRoleDisplay = (role: string) => {
    const roleMap: { [key: string]: string } = {
      admin: 'Administrator',
      hod: 'Head of Department',
      teacher: 'Teacher',
      student: 'Student'
    }
    return roleMap[role] || role
  }

  const getRoleBadgeColor = (role: string) => {
    const colorMap: { [key: string]: string } = {
      admin: 'bg-red-100 text-red-800',
      hod: 'bg-purple-100 text-purple-800',
      teacher: 'bg-blue-100 text-blue-800',
      student: 'bg-green-100 text-green-800'
    }
    return colorMap[role] || 'bg-gray-100 text-gray-800'
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Welcome back, {user.full_name}!
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="p-2 text-gray-400 hover:text-gray-500">
            <Bell className="h-5 w-5" />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                    {getRoleDisplay(user.role)}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div className="py-1">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      logout()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}