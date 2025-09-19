'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { 
  Plus, Edit, Trash2, Users, GraduationCap, Search, Download, Upload, 
  Eye, Filter, RefreshCw, UserCheck, UserX, Mail, Phone, Calendar, 
  MapPin, Briefcase, Shield, MoreVertical, Settings, Key, Lock, Unlock, 
  AlertCircle, FileText
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'

interface User {
  id: number
  username: string
  email: string
  full_name: string
  first_name?: string
  last_name?: string
  role: string
  department_id?: number
  department_name?: string
  class_id?: number
  class_name?: string
  student_id?: string
  employee_id?: string
  phone?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
  last_login?: string
  profile_picture?: string
  address?: string
  date_of_birth?: string
  gender?: string
  qualification?: string
  experience_years?: number
  subjects?: string[]
  specializations?: string[]
}

interface Department {
  id: number
  name: string
  code: string
  description: string
  duration_years: number
  hod_id?: number
  hod_name?: string
  created_at: string
}

interface Class {
  id: number
  name: string
  department_id: number
  semester: number
  academic_year: string
}

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [bulkAction, setBulkAction] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [selectedUserDetails, setSelectedUserDetails] = useState<User | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byRole: {} as Record<string, number>
  })
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([])
  const [availableRoles, setAvailableRoles] = useState<any[]>([])
  const [fieldConfig, setFieldConfig] = useState<any>(null)
  const [formSelectedRole, setFormSelectedRole] = useState('student')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'student',
    department_id: '',
    class_id: '',
    student_id: '',
    employee_id: '',
    phone: '',
    address: '',
    date_of_birth: '',
    gender: '',
    qualification: '',
    experience_years: '',
    subjects: [] as string[],
    specializations: [] as string[]
  })

  useEffect(() => {
    loadUsers()
    loadInitialData()
  }, [])

  useEffect(() => {
    if (availableRoles.length > 0 && formSelectedRole) {
      loadFieldConfig(formSelectedRole)
    }
  }, [availableRoles, formSelectedRole])

  useEffect(() => {
    if (users.length > 0) {
      loadStats()
    }
  }, [users])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedRole) params.append('role', selectedRole)
      if (selectedDepartment) params.append('department_id', selectedDepartment)
      if (selectedClass) params.append('class_id', selectedClass)
      if (selectedStatus) params.append('is_active', selectedStatus)

      const data = await apiClient.getUsers(params.toString())
      setUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadInitialData = async () => {
    try {
      const [departmentsData, classesData, subjectsData, rolesData] = await Promise.all([
        apiClient.getDepartments(),
        apiClient.getClasses(),
        apiClient.getSubjects(),
        apiClient.getAvailableRoles()
      ])
      setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
      setClasses(Array.isArray(classesData) ? classesData : [])
      setAvailableSubjects(Array.isArray(subjectsData) ? subjectsData : [])
      setAvailableRoles(Array.isArray(rolesData) ? rolesData : [])
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const loadFieldConfig = async (role: string) => {
    try {
      const config = await apiClient.getFieldConfig(role)
      setFieldConfig(config)
    } catch (error) {
      console.error('Error loading field config:', error)
      setFieldConfig(null)
    }
  }

  const handleRoleChange = (role: string) => {
    setFormSelectedRole(role)
    setFormData(prev => ({ ...prev, role }))
    loadFieldConfig(role)
  }

  const loadStats = async () => {
    try {
      const data = await apiClient.getUserStats()
      console.log('Stats data:', data)
      setStats(data || { total: 0, active: 0, inactive: 0, byRole: {} })
    } catch (error) {
      console.error('Error loading stats:', error)
      // Calculate stats from users data as fallback
      const total = users.length
      const active = users.filter(u => u.is_active).length
      const inactive = total - active
      const byRole = users.reduce((acc, user) => {
        if (user.is_active) {
          acc[user.role] = (acc[user.role] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)
      setStats({ total, active, inactive, byRole })
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Convert form data to proper types before sending
      const createData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        role: formData.role,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        class_id: formData.class_id ? parseInt(formData.class_id) : null,
        student_id: formData.student_id || null,
        employee_id: formData.employee_id || null,
        phone: formData.phone || null,
        address: formData.address || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        qualification: formData.qualification || null,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
        subjects: formData.subjects,
        specializations: formData.specializations
      }

      await apiClient.createUser(createData)
      toast.success('User created successfully')
      setShowCreateForm(false)
      setFormData({
        username: '', email: '', password: '', first_name: '', last_name: '',
        role: 'student', department_id: '', class_id: '', student_id: '',
        employee_id: '', phone: '', address: '', date_of_birth: '', gender: '',
        qualification: '', experience_years: '', subjects: [], specializations: []
      })
      loadUsers()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await apiClient.deleteUser(id)
        toast.success('User deleted successfully')
        loadUsers()
        loadStats()
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to delete user')
      }
    }
  }

  const handleEdit = (userData: User) => {
    setEditingUser(userData)
    setFormData({
      username: userData.username,
      email: userData.email,
      password: '', // Don't pre-fill password
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      role: userData.role,
      department_id: userData.department_id?.toString() || '',
      class_id: userData.class_id?.toString() || '',
      student_id: userData.student_id || '',
      employee_id: userData.employee_id || '',
      phone: userData.phone || '',
      address: userData.address || '',
      date_of_birth: userData.date_of_birth || '',
      gender: userData.gender || '',
      qualification: userData.qualification || '',
      experience_years: userData.experience_years?.toString() || '',
      subjects: userData.subjects?.map((s: any) => s.name) || [],
      specializations: userData.specializations || []
    })
    setShowEditDialog(true)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      const updateData = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        class_id: formData.class_id ? parseInt(formData.class_id) : null,
        student_id: formData.student_id || null,
        employee_id: formData.employee_id || null,
        phone: formData.phone || null,
        address: formData.address || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        qualification: formData.qualification || null,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
        subjects: formData.subjects,
        specializations: formData.specializations
      }

      if (formData.password) {
        updateData.password = formData.password
      }

      await apiClient.updateUser(editingUser.id, updateData)
      toast.success('User updated successfully')
      setShowEditDialog(false)
      setEditingUser(null)
      loadUsers()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    }
  }

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await apiClient.updateUser(userId, { is_active: !currentStatus })
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`)
      loadUsers()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update user status')
    }
  }

  const handleViewUserDetails = (userData: User) => {
    setSelectedUserDetails(userData)
    setShowUserDetails(true)
  }

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Are you sure you want to reset this user\'s password?')) return

    try {
      await apiClient.resetUserPassword(userId)
      toast.success('Password reset email sent to user')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to reset password')
    }
  }

  const handleSearch = () => {
    loadUsers()
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedRole('')
    setSelectedDepartment('')
    setSelectedClass('')
    setSelectedStatus('')
    loadUsers()
  }

  const handleBulkAction = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first')
      return
    }

    if (!bulkAction) {
      toast.error('Please select an action')
      return
    }

    try {
      switch (bulkAction) {
        case 'activate':
          await apiClient.bulkUpdateUsers(selectedUsers, { is_active: true })
          toast.success(`${selectedUsers.length} users activated`)
          break
        case 'deactivate':
          await apiClient.bulkUpdateUsers(selectedUsers, { is_active: false })
          toast.success(`${selectedUsers.length} users deactivated`)
          break
        case 'delete':
          if (confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) {
            await apiClient.bulkDeleteUsers(selectedUsers)
            toast.success(`${selectedUsers.length} users deleted`)
          }
          break
      }
      setSelectedUsers([])
      setBulkAction('')
      loadUsers()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Bulk action failed')
    }
  }

  const handleSelectUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(users.map(u => u.id))
    }
  }

  const handleExport = async (format: string) => {
    try {
      setLoading(true)
      const data = await apiClient.exportUsers(format, selectedRole, selectedDepartment)
      
      if (format === 'csv') {
        const blob = new Blob([data.csv_data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast.success('CSV file downloaded successfully')
      } else if (format === 'pdf') {
        // For PDF, we'll use a simple HTML to PDF conversion
        const htmlContent = generatePDFContent(data.pdf_data)
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(htmlContent)
          printWindow.document.close()
          printWindow.print()
        }
        toast.success('PDF generated successfully')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const generatePDFContent = (users: any[]) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Users Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Users Export - ${new Date().toLocaleDateString()}</h1>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Class</th>
              <th>Status</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.full_name}</td>
                <td>${user.role}</td>
                <td>${user.department || '-'}</td>
                <td>${user.class || '-'}</td>
                <td>${user.status}</td>
                <td>${user.created_at}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `
  }

  // Utility functions
  const getRoleBadgeColor = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      hod: 'bg-purple-100 text-purple-800',
      teacher: 'bg-blue-100 text-blue-800',
      student: 'bg-green-100 text-green-800'
    }
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getRoleIcon = (role: string) => {
    const icons = {
      admin: Shield,
      hod: GraduationCap,
      teacher: Briefcase,
      student: UserCheck
    }
    return icons[role as keyof typeof icons] || UserCheck
  }

  const getRoleSpecificFields = (role: string) => {
    switch (role) {
      case 'student':
        return ['student_id', 'class_id', 'date_of_birth', 'gender']
      case 'teacher':
        return ['employee_id', 'qualification', 'experience_years', 'subjects', 'specializations']
      case 'hod':
        return ['employee_id', 'qualification', 'experience_years', 'department_id']
      case 'admin':
        return ['employee_id']
      default:
        return []
    }
  }

  const filteredUsers = users.filter(userData => {
    const matchesSearch = !searchTerm || 
      userData.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = !selectedRole || userData.role === selectedRole
    const matchesDepartment = !selectedDepartment || userData.department_id?.toString() === selectedDepartment
    const matchesClass = !selectedClass || userData.class_id?.toString() === selectedClass
    const matchesStatus = !selectedStatus || userData.is_active.toString() === selectedStatus

    return matchesSearch && matchesRole && matchesDepartment && matchesClass && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600">Comprehensive user management system with role-based features</p>
        </div>
        <div className="flex space-x-2">
          <div className="flex space-x-2">
            <Button 
              onClick={() => handleExport('csv')} 
              variant="outline"
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              onClick={() => handleExport('pdf')} 
              variant="outline"
              disabled={loading}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
          {(user?.role === 'admin' || user?.role === 'hod') && (
            <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
              Create User
              </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Roles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.roles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedUsers.length} user(s) selected
                </span>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select Action</option>
                  <option value="activate">Activate</option>
                  <option value="deactivate">Deactivate</option>
                  <option value="delete">Delete</option>
                  <option value="export">Export Selected</option>
                </select>
                <Button onClick={handleBulkAction} disabled={!bulkAction}>
                  Apply Action
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedUsers([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search & Filter</CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
              >
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
            <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  placeholder="Search users by name, email, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="hod">HOD</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Departments</option>
                    {departments && Array.isArray(departments) && departments.map((dept: any) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                      </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Classes</option>
                    {classes && Array.isArray(classes) && classes.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left p-3 font-medium text-gray-900">Name</th>
                  <th className="text-left p-3 font-medium text-gray-900">Username</th>
                  <th className="text-left p-3 font-medium text-gray-900">Email</th>
                  <th className="text-left p-3 font-medium text-gray-900">Role</th>
                  <th className="text-left p-3 font-medium text-gray-900">Department</th>
                  <th className="text-left p-3 font-medium text-gray-900">ID</th>
                  <th className="text-left p-3 font-medium text-gray-900">Status</th>
                  <th className="text-left p-3 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers && Array.isArray(filteredUsers) && filteredUsers.map((userData) => {
                  const RoleIcon = getRoleIcon(userData.role)
                  return (
                    <tr key={userData.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(userData.id)}
                          onChange={() => handleSelectUser(userData.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <div className="p-2 bg-gray-100 rounded-full mr-3">
                            <RoleIcon className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{userData.full_name}</div>
                            {userData.phone && (
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {userData.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{userData.username}</td>
                      <td className="p-3 text-gray-600 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {userData.email}
                      </td>
                      <td className="p-3">
                        <Badge className={getRoleBadgeColor(userData.role)}>
                          {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600">{userData.department_name || '-'}</td>
                      <td className="p-3 text-gray-600">
                        {userData.student_id || userData.employee_id || '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <Badge className={userData.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {userData.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleUserStatus(userData.id, userData.is_active)}
                            className={userData.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                          >
                            {userData.is_active ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewUserDetails(userData)}
                            title="View Details"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEdit(userData)}
                            title="Edit User"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleResetPassword(userData.id)}
                            title="Reset Password"
                            className="h-8 w-8 p-0"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {(user?.role === 'admin' || user?.role === 'hod') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDelete(userData.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {filteredUsers && Array.isArray(filteredUsers) && filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                <p className="text-gray-600">Try adjusting your search criteria or create a new user.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Basic Fields - Always Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {availableRoles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              {/* Role-Specific Fields */}
              {formData.role === 'student' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                        <span className="text-gray-500 text-xs ml-1">(Optional - can be assigned later)</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.hod_id ? '(Has HOD)' : '(Available)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
                      <Input
                        value={formData.student_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                      <select
                        value={formData.class_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, class_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Select Class</option>
                        {classes && Array.isArray(classes) && classes.map((cls: any) => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <Input
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'teacher' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Teacher Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                        <span className="text-gray-500 text-xs ml-1">(Optional - can be assigned later)</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.hod_id ? '(Has HOD)' : '(Available)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                      <Input
                        value={formData.qualification}
                        onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                        placeholder="e.g., M.Tech, Ph.D."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                      <Input
                        type="number"
                        value={formData.experience_years}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                        min="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subjects (comma-separated)</label>
                      <Input
                        value={formData.subjects?.join(', ') || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          subjects: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                        }))}
                        placeholder="e.g., Mathematics, Physics, Chemistry"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specializations (comma-separated)</label>
                      <Input
                        value={formData.specializations?.join(', ') || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          specializations: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                        }))}
                        placeholder="e.g., Machine Learning, Data Science, AI"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'hod' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">HOD Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                        <span className="text-gray-500 text-xs ml-1">(Optional - can be assigned later)</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.hod_id ? '(Has HOD)' : '(Available)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                      <Input
                        value={formData.qualification}
                        onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                        placeholder="e.g., M.Tech, Ph.D."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                      <Input
                        type="number"
                        value={formData.experience_years}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'admin' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Admin Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {showEditDialog && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Basic Fields - Always Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password (Leave blank to keep current)</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {availableRoles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              {/* Role-Specific Fields - Same as create form */}
              {formData.role === 'student' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                        <span className="text-gray-500 text-xs ml-1">(Optional - can be assigned later)</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.hod_id ? '(Has HOD)' : '(Available)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
                      <Input
                        value={formData.student_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                      <select
                        value={formData.class_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, class_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Select Class</option>
                        {classes && Array.isArray(classes) && classes.map((cls: any) => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <Input
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'teacher' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Teacher Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                        <span className="text-gray-500 text-xs ml-1">(Optional - can be assigned later)</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.hod_id ? '(Has HOD)' : '(Available)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                      <Input
                        value={formData.qualification}
                        onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                        placeholder="e.g., M.Tech, Ph.D."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                      <Input
                        type="number"
                        value={formData.experience_years}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                        min="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subjects (comma-separated)</label>
                      <Input
                        value={formData.subjects?.join(', ') || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          subjects: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                        }))}
                        placeholder="e.g., Mathematics, Physics, Chemistry"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specializations (comma-separated)</label>
                      <Input
                        value={formData.specializations?.join(', ') || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          specializations: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                        }))}
                        placeholder="e.g., Machine Learning, Data Science, AI"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'hod' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">HOD Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                        <span className="text-gray-500 text-xs ml-1">(Optional - can be assigned later)</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.hod_id ? '(Has HOD)' : '(Available)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                      <Input
                        value={formData.qualification}
                        onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                        placeholder="e.g., M.Tech, Ph.D."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                      <Input
                        type="number"
                        value={formData.experience_years}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'admin' && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Admin Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Department (Optional)</option>
                        {departments && Array.isArray(departments) && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingUser(null)
                    setFormData({
                      username: '', email: '', password: '', first_name: '', last_name: '',
                      role: 'student', department_id: '', class_id: '', student_id: '',
                      employee_id: '', phone: '', address: '', date_of_birth: '', gender: '',
                      qualification: '', experience_years: '', subjects: [], specializations: []
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Update User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Dialog */}
      {showUserDetails && selectedUserDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">User Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <p className="text-gray-900">{selectedUserDetails.full_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <p className="text-gray-900">{selectedUserDetails.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{selectedUserDetails.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <Badge className={getRoleBadgeColor(selectedUserDetails.role)}>
                    {selectedUserDetails.role.charAt(0).toUpperCase() + selectedUserDetails.role.slice(1)}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <p className="text-gray-900">{selectedUserDetails.phone || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <Badge className={selectedUserDetails.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {selectedUserDetails.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {selectedUserDetails.student_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Student ID</label>
                    <p className="text-gray-900">{selectedUserDetails.student_id}</p>
                  </div>
                )}
                {selectedUserDetails.employee_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                    <p className="text-gray-900">{selectedUserDetails.employee_id}</p>
                  </div>
                )}
                {selectedUserDetails.department_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <p className="text-gray-900">{selectedUserDetails.department_name}</p>
                  </div>
                )}
                {selectedUserDetails.class_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Class</label>
                    <p className="text-gray-900">{selectedUserDetails.class_name}</p>
                  </div>
                )}
                {selectedUserDetails.qualification && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Qualification</label>
                    <p className="text-gray-900">{selectedUserDetails.qualification}</p>
                  </div>
                )}
                {selectedUserDetails.experience_years && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Experience (Years)</label>
                    <p className="text-gray-900">{selectedUserDetails.experience_years}</p>
                  </div>
                )}
                {selectedUserDetails.subjects && selectedUserDetails.subjects.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Subjects</label>
                    <p className="text-gray-900">{selectedUserDetails.subjects.join(', ')}</p>
                  </div>
                )}
                {selectedUserDetails.specializations && selectedUserDetails.specializations.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Specializations</label>
                    <p className="text-gray-900">{selectedUserDetails.specializations.join(', ')}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created At</label>
                  <p className="text-gray-900">{selectedUserDetails.created_at ? new Date(selectedUserDetails.created_at).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Login</label>
                  <p className="text-gray-900">{selectedUserDetails.last_login ? new Date(selectedUserDetails.last_login).toLocaleDateString() : '-'}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowUserDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
