'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Bell, Plus, Edit, Trash2, Save, X, Eye, 
  RefreshCw, Download, Upload, Filter, Search,
  BookOpen, Target, Award, Users, Calendar, Building,
  FileText, BarChart3, Clock, CheckCircle, XCircle,
  Mail, AlertTriangle, Info, CheckCircle2
} from 'lucide-react'

interface Notification {
  id: number
  title: string
  message: string
  type: string
  priority: string
  target_audience: string
  target_roles?: string[]
  target_departments?: number[]
  target_classes?: number[]
  target_users?: number[]
  is_published: boolean
  scheduled_at?: string
  expires_at?: string
  created_by: number
  created_by_name?: string
  created_at: string
  updated_at?: string
  read_count: number
  total_recipients: number
}

interface Department {
  id: number
  name: string
  code: string
}

interface Class {
  id: number
  name: string
  department_id: number
  department_name?: string
}

interface User {
  id: number
  full_name: string
  role: string
  department_id?: number
  class_id?: number
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    target_audience: 'all',
    target_roles: [] as string[],
    target_departments: [] as number[],
    target_classes: [] as number[],
    target_users: [] as number[],
    is_published: false,
    scheduled_at: '',
    expires_at: ''
  })

  const notificationTypes = [
    { value: 'info', label: 'Information', icon: Info, color: 'bg-blue-100 text-blue-800' },
    { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800' },
    { value: 'success', label: 'Success', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
    { value: 'error', label: 'Error', icon: XCircle, color: 'bg-red-100 text-red-800' },
    { value: 'announcement', label: 'Announcement', icon: Bell, color: 'bg-purple-100 text-purple-800' }
  ]

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ]

  const targetAudiences = [
    { value: 'all', label: 'All Users' },
    { value: 'roles', label: 'Specific Roles' },
    { value: 'departments', label: 'Specific Departments' },
    { value: 'classes', label: 'Specific Classes' },
    { value: 'users', label: 'Specific Users' }
  ]

  const roles = ['admin', 'hod', 'teacher', 'student']

  useEffect(() => {
    loadData()
  }, [filterType, filterPriority, filterStatus])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [notificationsResponse, departmentsResponse, classesResponse, usersResponse] = await Promise.all([
        apiClient.getNotifications(),
        apiClient.getDepartments(),
        apiClient.getClasses(),
        apiClient.getUsers()
      ])

      let notificationsData = notificationsResponse.success ? notificationsResponse.data || [] : []
      const departmentsData = departmentsResponse.success ? departmentsResponse.data || [] : []
      const classesData = classesResponse.success ? classesResponse.data || [] : []
      const usersData = usersResponse.success ? usersResponse.data || [] : []

      // Apply filters
      if (filterType) {
        notificationsData = notificationsData.filter((n: Notification) => n.type === filterType)
      }
      if (filterPriority) {
        notificationsData = notificationsData.filter((n: Notification) => n.priority === filterPriority)
      }
      if (filterStatus) {
        if (filterStatus === 'published') {
          notificationsData = notificationsData.filter((n: Notification) => n.is_published)
        } else if (filterStatus === 'draft') {
          notificationsData = notificationsData.filter((n: Notification) => !n.is_published)
        }
      }
      if (searchTerm) {
        notificationsData = notificationsData.filter((n: Notification) => 
          n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.message.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setNotifications(notificationsData)
      setDepartments(departmentsData)
      setClasses(classesData)
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingNotification) {
        await apiClient.put(`/api/notifications/${editingNotification.id}`, formData)
      } else {
        await apiClient.post('/api/notifications', formData)
      }
      setShowForm(false)
      setEditingNotification(null)
      setFormData({
        title: '',
        message: '',
        type: 'info',
        priority: 'medium',
        target_audience: 'all',
        target_roles: [],
        target_departments: [],
        target_classes: [],
        target_users: [],
        is_published: false,
        scheduled_at: '',
        expires_at: ''
      })
      loadData()
    } catch (error) {
      console.error('Error saving notification:', error)
      setError('Failed to save notification')
    }
  }

  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification)
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      target_audience: notification.target_audience,
      target_roles: notification.target_roles || [],
      target_departments: notification.target_departments || [],
      target_classes: notification.target_classes || [],
      target_users: notification.target_users || [],
      is_published: notification.is_published,
      scheduled_at: notification.scheduled_at || '',
      expires_at: notification.expires_at || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this notification?')) return

    try {
      await apiClient.delete(`/api/notifications/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting notification:', error)
      setError('Failed to delete notification')
    }
  }

  const handlePublish = async (notification: Notification) => {
    try {
      await apiClient.put(`/api/notifications/${notification.id}`, {
        ...notification,
        is_published: !notification.is_published
      })
      loadData()
    } catch (error) {
      console.error('Error updating notification:', error)
      setError('Failed to update notification')
    }
  }

  const exportData = async () => {
    try {
      const csvContent = convertToCSV(notifications)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'notifications.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: Notification[]) => {
    if (data.length === 0) return ''
    
    const headers = ['ID', 'Title', 'Message', 'Type', 'Priority', 'Target Audience', 'Published', 'Read Count', 'Total Recipients', 'Created By', 'Created At']
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        row.title,
        row.message,
        row.type,
        row.priority,
        row.target_audience,
        row.is_published ? 'Yes' : 'No',
        row.read_count,
        row.total_recipients,
        row.created_by_name || '',
        row.created_at
      ].join(','))
    ]
    return csvRows.join('\n')
  }

  const getTypeIcon = (type: string) => {
    const typeConfig = notificationTypes.find(t => t.value === type)
    return typeConfig ? typeConfig.icon : Info
  }

  const getTypeColor = (type: string) => {
    const typeConfig = notificationTypes.find(t => t.value === type)
    return typeConfig ? typeConfig.color : 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: string) => {
    const priorityConfig = priorities.find(p => p.value === priority)
    return priorityConfig ? priorityConfig.color : 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notification Management</h1>
          <p className="text-gray-600">Manage system notifications and announcements</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Notification
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Types</option>
              {notificationTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filterPriority || ''}
              onChange={(e) => setFilterPriority(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Priorities</option>
              {priorities.map((priority) => (
                <option key={priority.value} value={priority.value}>{priority.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadData}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notification</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {notifications.map((notification) => {
              const TypeIcon = getTypeIcon(notification.type)
              return (
                <tr key={notification.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <TypeIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                        <div className="text-sm text-gray-500 max-w-xs truncate">{notification.message}</div>
                        <div className="text-xs text-gray-400">
                          By {notification.created_by_name || 'Unknown'} • {new Date(notification.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(notification.type)}`}>
                      {notification.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(notification.priority)}`}>
                      {notification.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="text-xs">
                      <div className="font-medium">{notification.target_audience}</div>
                      {notification.target_roles && notification.target_roles.length > 0 && (
                        <div className="text-gray-400">Roles: {notification.target_roles.join(', ')}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      {notification.is_published ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                      )}
                      <span className={notification.is_published ? 'text-green-600' : 'text-gray-600'}>
                        {notification.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="text-xs">
                      <div>Read: {notification.read_count}</div>
                      <div>Total: {notification.total_recipients}</div>
                      <div className="text-gray-400">
                        {notification.total_recipients > 0 ? 
                          Math.round((notification.read_count / notification.total_recipients) * 100) : 0}% read
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePublish(notification)}
                        className={`${
                          notification.is_published 
                            ? 'text-orange-600 hover:text-orange-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                        title={notification.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {notification.is_published ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(notification)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingNotification ? 'Edit Notification' : 'Create New Notification'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  placeholder="Notification title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  placeholder="Notification message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={4}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    {notificationTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    {priorities.map((priority) => (
                      <option key={priority.value} value={priority.value}>{priority.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Audience</label>
                <select
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  {targetAudiences.map((audience) => (
                    <option key={audience.value} value={audience.value}>{audience.label}</option>
                  ))}
                </select>
              </div>

              {/* Role Selection */}
              {formData.target_audience === 'roles' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Roles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((role) => (
                      <label key={role} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.target_roles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, target_roles: [...formData.target_roles, role] })
                            } else {
                              setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== role) })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Department Selection */}
              {formData.target_audience === 'departments' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Departments</label>
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((dept) => (
                      <label key={dept.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.target_departments.includes(dept.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, target_departments: [...formData.target_departments, dept.id] })
                            } else {
                              setFormData({ ...formData, target_departments: formData.target_departments.filter(d => d !== dept.id) })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Class Selection */}
              {formData.target_audience === 'classes' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Classes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {classes.map((cls) => (
                      <label key={cls.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.target_classes.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, target_classes: [...formData.target_classes, cls.id] })
                            } else {
                              setFormData({ ...formData, target_classes: formData.target_classes.filter(c => c !== cls.id) })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{cls.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* User Selection */}
              {formData.target_audience === 'users' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Users</label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {users.map((user) => (
                      <label key={user.id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={formData.target_users.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, target_users: [...formData.target_users, user.id] })
                            } else {
                              setFormData({ ...formData, target_users: formData.target_users.filter(u => u !== user.id) })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{user.full_name} ({user.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Schedule At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expires At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">Publish immediately</label>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingNotification(null)
                    setFormData({
                      title: '',
                      message: '',
                      type: 'info',
                      priority: 'medium',
                      target_audience: 'all',
                      target_roles: [],
                      target_departments: [],
                      target_classes: [],
                      target_users: [],
                      is_published: false,
                      scheduled_at: '',
                      expires_at: ''
                    })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingNotification ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}