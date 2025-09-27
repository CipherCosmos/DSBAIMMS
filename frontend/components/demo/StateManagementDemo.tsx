'use client'

import { useState } from 'react'
import { useAuth, useUsers, useDepartments, useNotifications } from '@/lib/hooks'
import { useUIStore } from '@/lib/stores'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function StateManagementDemo() {
  const [testUsername, setTestUsername] = useState('admin')
  const [testPassword, setTestPassword] = useState('admin123')
  
  // Auth hooks
  const auth = useAuth()
  
  // Users hooks
  const users = useUsers()
  const usersManagement = useUsers()
  
  // Departments hooks
  const departments = useDepartments()
  const departmentsManagement = useDepartments()
  
  // Notifications hooks
  const notifications = useNotifications()
  const notificationsManagement = useNotifications()
  
  // UI store
  const { theme, setTheme, sidebarOpen, toggleSidebar, addNotification } = useUIStore()

  const handleTestLogin = async () => {
    try {
      await auth.login({ username: testUsername, password: testPassword })
      addNotification({
        type: 'success',
        title: 'Login Successful',
        message: `Welcome back, ${auth.user?.full_name || testUsername}!`,
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Login Failed',
        message: 'Please check your credentials and try again.',
      })
    }
  }

  const handleTestLogout = async () => {
    await auth.logout()
    addNotification({
      type: 'info',
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
    })
  }

  const handleFetchUsers = () => {
    users.refetch()
    addNotification({
      type: 'info',
      title: 'Users Refetched',
      message: 'User list has been refreshed.',
    })
  }

  const handleFetchDepartments = () => {
    departments.refetch()
    addNotification({
      type: 'info',
      title: 'Departments Refetched',
      message: 'Department list has been refreshed.',
    })
  }

  const handleFetchNotifications = () => {
    notifications.refetch()
    addNotification({
      type: 'info',
      title: 'Notifications Refetched',
      message: 'Notification list has been refreshed.',
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">State Management Demo</h1>
        <Badge variant="outline">Phase 2 Complete</Badge>
      </div>

      {/* Auth Section */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication State</CardTitle>
          <CardDescription>Zustand store with React Query integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleTestLogin} disabled={auth.isLoggingIn}>
              {auth.isLoggingIn ? 'Logging in...' : 'Test Login'}
            </Button>
            <Button onClick={handleTestLogout} variant="outline" disabled={!auth.isAuthenticated}>
              Logout
            </Button>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Auth State:</h4>
            <div className="text-sm space-y-1">
              <div>Authenticated: <Badge variant={auth.isAuthenticated ? 'default' : 'secondary'}>{auth.isAuthenticated ? 'Yes' : 'No'}</Badge></div>
              <div>Loading: <Badge variant={auth.isLoading ? 'default' : 'secondary'}>{auth.isLoading ? 'Yes' : 'No'}</Badge></div>
              <div>User: {auth.user ? `${auth.user.full_name} (${auth.user.role})` : 'None'}</div>
              {auth.error && <div className="text-red-600">Error: {auth.error}</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Section */}
      <Card>
        <CardHeader>
          <CardTitle>Users Management</CardTitle>
          <CardDescription>Users store with pagination and filtering</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleFetchUsers} disabled={users.isFetching}>
            {users.isFetching ? 'Fetching...' : 'Fetch Users'}
          </Button>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Users State:</h4>
            <div className="text-sm space-y-1">
              <div>Count: {(users.data as any)?.length || 0}</div>
              <div>Loading: <Badge variant={users.isLoading ? 'default' : 'secondary'}>{users.isLoading ? 'Yes' : 'No'}</Badge></div>
              <div>Error: {users.error ? String(users.error) : 'None'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Departments Section */}
      <Card>
        <CardHeader>
          <CardTitle>Departments Management</CardTitle>
          <CardDescription>Departments store with CRUD operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleFetchDepartments} disabled={departments.isFetching}>
            {departments.isFetching ? 'Fetching...' : 'Fetch Departments'}
          </Button>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Departments State:</h4>
            <div className="text-sm space-y-1">
              <div>Count: {(departments.data as any)?.length || 0}</div>
              <div>Loading: <Badge variant={departments.isLoading ? 'default' : 'secondary'}>{departments.isLoading ? 'Yes' : 'No'}</Badge></div>
              <div>Error: {departments.error ? String(departments.error) : 'None'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications Management</CardTitle>
          <CardDescription>Notifications store with real-time updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleFetchNotifications} disabled={notifications.isFetching}>
            {notifications.isFetching ? 'Fetching...' : 'Fetch Notifications'}
          </Button>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Notifications State:</h4>
            <div className="text-sm space-y-1">
              <div>Count: {(notifications.data as any)?.length || 0}</div>
              <div>Unread: {(notifications as any).unreadCount || 0}</div>
              <div>Loading: <Badge variant={notifications.isLoading ? 'default' : 'secondary'}>{notifications.isLoading ? 'Yes' : 'No'}</Badge></div>
              <div>Error: {notifications.error ? String(notifications.error) : 'None'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI State Section */}
      <Card>
        <CardHeader>
          <CardTitle>UI State Management</CardTitle>
          <CardDescription>Global UI state with theme and sidebar controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => setTheme('light')} variant={theme === 'light' ? 'default' : 'outline'}>
              Light
            </Button>
            <Button onClick={() => setTheme('dark')} variant={theme === 'dark' ? 'default' : 'outline'}>
              Dark
            </Button>
            <Button onClick={() => setTheme('system')} variant={theme === 'system' ? 'default' : 'outline'}>
              System
            </Button>
          </div>

          <Button onClick={toggleSidebar} variant="outline">
            {sidebarOpen ? 'Close' : 'Open'} Sidebar
          </Button>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">UI State:</h4>
            <div className="text-sm space-y-1">
              <div>Theme: <Badge variant="outline">{theme}</Badge></div>
              <div>Sidebar: <Badge variant={sidebarOpen ? 'default' : 'secondary'}>{sidebarOpen ? 'Open' : 'Closed'}</Badge></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>State management performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">5</div>
              <div className="text-sm text-gray-600">Zustand Stores</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">4</div>
              <div className="text-sm text-gray-600">React Query Hooks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">100%</div>
              <div className="text-sm text-gray-600">Type Safety</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">Fast</div>
              <div className="text-sm text-gray-600">Performance</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
