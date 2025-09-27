'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { AdminGuard } from '@/components/auth/RoleGuard'
import { Plus, Edit, Trash2, Users, GraduationCap, Calendar, Clock, BookOpen, UserCheck, Search, Filter, Download, Upload, BarChart3, Building, FileText, Copy } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { SYSTEM_CONFIG, hasPermission, getAcademicYearString } from '@/lib/config'

// Utility function to extract error messages
const getErrorMessage = (error: any, defaultMessage: string): string => {
  console.log('Full error object:', error)
  console.log('Error response:', error.response)
  console.log('Error response data:', error.response?.data)
  
  // Check if error has response.data (Axios error structure)
  if (error.response?.data) {
    const data = error.response.data
    
    // Handle string response
    if (typeof data === 'string') {
      return data
    }
    
    // Handle object response
    if (typeof data === 'object') {
      // Check for detail field
      if (data.detail) {
        if (typeof data.detail === 'string') {
          return data.detail
        } else if (Array.isArray(data.detail)) {
          return data.detail.map((err: any) => err.msg || err.message || err).join(', ')
        }
      }
      
      // Check for message field
      if (data.message) {
        return data.message
      }
      
      // Check for error field
      if (data.error) {
        return data.error
      }
    }
  }
  
  // Check if error has direct detail field (fallback)
  if (error.detail) {
    return error.detail
  }
  
  // Check for direct error message
  if (error.message) {
    return error.message
  }
  
  return defaultMessage
}

interface Department {
  id: number
  name: string
  code: string
  description: string
  duration_years: number
  hod_id?: number
  hod_name?: string
  academic_year: string
  semester_count: number
  current_semester: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface HOD {
  id: number
  name: string
  email: string
  username: string
  department_id?: number
  has_department: boolean
}

function DepartmentsPage() {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [hods, setHODs] = useState<HOD[]>([])
  const [loading, setLoading] = useState(true)

  // RBAC checks
  const canCreate = user && hasPermission(user.role, 'create_departments')
  const canUpdate = user && hasPermission(user.role, 'update_departments')
  const canDelete = user && hasPermission(user.role, 'delete_departments')
  const canViewAll = user && hasPermission(user.role, 'view_all_departments')
  const canAssignHODs = user && hasPermission(user.role, 'assign_hods')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showBulkCreateForm, setShowBulkCreateForm] = useState(false)
  const [showBulkUpdateForm, setShowBulkUpdateForm] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showDepartmentAnalytics, setShowDepartmentAnalytics] = useState(false)
  const [departmentAnalytics, setDepartmentAnalytics] = useState<any>(null)
  const [showDepartmentStructure, setShowDepartmentStructure] = useState(false)
  const [departmentStructure, setDepartmentStructure] = useState<any>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'created_at'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration_years: 4,
    hod_id: '',
    academic_year: new Date().getFullYear().toString(),
    semester_count: 8,
    current_semester: 1,
    is_active: true
  })

  const [bulkFormData, setBulkFormData] = useState({
    departments: [
      { name: '', code: '', description: '', duration_years: 4, hod_id: '', academic_year: new Date().getFullYear().toString(), semester_count: 8, current_semester: 1, is_active: true }
    ]
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([loadDepartments(), loadHODs()])
      } catch (error) {
        console.error('Error loading initial data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const loadDepartments = async () => {
    try {
      const response = await apiClient.getDepartments()
      // Ensure data is an array
      setDepartments(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Error loading departments:', error)
      setDepartments([])
    }
  }

  const loadHODs = async () => {
    try {
      const response = await apiClient.getAvailableHODs()
      setHODs(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Error loading HODs:', error)
      setHODs([])
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.createDepartment({
        ...formData,
        hod_id: formData.hod_id ? parseInt(formData.hod_id) : undefined
      })
      toast.success('Department created successfully')
      setShowCreateForm(false)
      setFormData({ name: '', code: '', description: '', duration_years: 4, hod_id: '', academic_year: new Date().getFullYear().toString(), semester_count: 8, current_semester: 1, is_active: true })
      loadDepartments()
      loadHODs() // Refresh HOD list
    } catch (error: any) {
      console.error('Error creating department:', error)
      const errorMessage = getErrorMessage(error, 'Failed to create department')
      toast.error(errorMessage)
    }
  }

  const handleEdit = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      code: department.code,
      description: department.description,
      duration_years: department.duration_years,
      hod_id: department.hod_id?.toString() || '',
      academic_year: new Date().getFullYear().toString(),
      semester_count: 8,
      current_semester: 1,
      is_active: true
    })
    setShowEditForm(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDepartment) return
    
    try {
      await apiClient.updateDepartment(editingDepartment.id, {
        ...formData,
        hod_id: formData.hod_id ? parseInt(formData.hod_id) : undefined
      })
      toast.success('Department updated successfully')
      setShowEditForm(false)
      setEditingDepartment(null)
      setFormData({ name: '', code: '', description: '', duration_years: 4, hod_id: '', academic_year: new Date().getFullYear().toString(), semester_count: 8, current_semester: 1, is_active: true })
      loadDepartments()
      loadHODs() // Refresh HOD list
    } catch (error: any) {
      console.error('Error updating department:', error)
      console.error('Error response:', error.response)
      console.error('Error response data:', error.response?.data)
      const errorMessage = getErrorMessage(error, 'Failed to update department')
      console.error('Extracted error message:', errorMessage)
      toast.error(errorMessage)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this department?')) {
      try {
        await apiClient.deleteDepartment(id)
        toast.success('Department deleted successfully')
        loadDepartments()
      } catch (error: any) {
        console.error('Error deleting department:', error)
        const errorMessage = getErrorMessage(error, 'Failed to delete department')
        toast.error(errorMessage)
      }
    }
  }

  const handleRemoveHOD = async (departmentId: number) => {
    if (confirm('Are you sure you want to remove the HOD from this department?')) {
      try {
        await apiClient.updateDepartment(departmentId, { hod_id: null })
        toast.success('HOD removed from department successfully')
        loadDepartments()
        loadHODs() // Refresh HOD list
      } catch (error: any) {
        console.error('Error removing HOD:', error)
        const errorMessage = getErrorMessage(error, 'Failed to remove HOD from department')
        toast.error(errorMessage)
      }
    }
  }

  const handleBulkDelete = async () => {
    if (selectedDepartments.length === 0) return
    
    if (confirm(`Are you sure you want to delete ${selectedDepartments.length} departments?`)) {
      try {
        await apiClient.bulkDeleteDepartments(selectedDepartments)
        setSelectedDepartments([])
        setShowBulkActions(false)
        loadDepartments()
        toast.success('Departments deleted successfully')
      } catch (error: any) {
        console.error('Error bulk deleting departments:', error)
        const errorMessage = getErrorMessage(error, 'Failed to delete departments')
        toast.error(errorMessage)
      }
    }
  }

  const handleBulkCreate = async (departmentsData: any[]) => {
    try {
      await apiClient.bulkCreateDepartments(departmentsData)
      setShowBulkActions(false)
      loadDepartments()
      toast.success('Departments created successfully')
    } catch (error: any) {
      console.error('Error bulk creating departments:', error)
      const errorMessage = getErrorMessage(error, 'Failed to create departments')
      toast.error(errorMessage)
    }
  }

  const handleBulkUpdate = async (updates: any[]) => {
    try {
      await apiClient.bulkUpdateDepartments(updates)
      setShowBulkActions(false)
      loadDepartments()
      toast.success('Departments updated successfully')
    } catch (error: any) {
      console.error('Error bulk updating departments:', error)
      const errorMessage = getErrorMessage(error, 'Failed to update departments')
      toast.error(errorMessage)
    }
  }

  const handleBulkCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const departmentsToCreate = bulkFormData.departments.map(dept => ({
        ...dept,
        hod_id: dept.hod_id ? parseInt(dept.hod_id) : undefined,
        duration_years: parseInt(dept.duration_years.toString()),
        semester_count: parseInt(dept.semester_count.toString()),
        current_semester: parseInt(dept.current_semester.toString())
      }))
      
      await handleBulkCreate(departmentsToCreate)
      setShowBulkCreateForm(false)
      setBulkFormData({
        departments: [
          { name: '', code: '', description: '', duration_years: 4, hod_id: '', academic_year: new Date().getFullYear().toString(), semester_count: 8, current_semester: 1, is_active: true }
        ]
      })
    } catch (error: any) {
      console.error('Error in bulk create form:', error)
    }
  }

  const addDepartmentToBulk = () => {
    setBulkFormData(prev => ({
      ...prev,
      departments: [...prev.departments, { name: '', code: '', description: '', duration_years: 4, hod_id: '', academic_year: new Date().getFullYear().toString(), semester_count: 8, current_semester: 1, is_active: true }]
    }))
  }

  const removeDepartmentFromBulk = (index: number) => {
    if (bulkFormData.departments.length > 1) {
      setBulkFormData(prev => ({
        ...prev,
        departments: prev.departments.filter((_, i) => i !== index)
      }))
    }
  }

  const handleSelectDepartment = (id: number) => {
    setSelectedDepartments(prev => 
      prev.includes(id) 
        ? prev.filter(depId => depId !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([])
    } else {
      setSelectedDepartments(departments.map(dept => dept.id))
    }
  }

  // Filter and sort departments (memoized for performance)
  const filteredAndSortedDepartments = useMemo(() => {
    return departments
      .filter(dept => {
        const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             dept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             dept.description.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesActive = filterActive === null || dept.is_active === filterActive
        return matchesSearch && matchesActive
      })
      .sort((a, b) => {
        let aValue, bValue
        switch (sortBy) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'code':
            aValue = a.code.toLowerCase()
            bValue = b.code.toLowerCase()
            break
          case 'created_at':
            aValue = new Date(a.created_at).getTime()
            bValue = new Date(b.created_at).getTime()
            break
          default:
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
        }
      })
  }, [departments, searchTerm, filterActive, sortBy, sortOrder])

  const getHODName = useCallback((hodId: number | undefined) => {
    if (!hodId) return 'No HOD assigned'
    const hod = hods.find(h => h.id === hodId)
    return hod ? hod.name : 'Unknown HOD'
  }, [hods])

  // Advanced department management functions
  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import')
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', importFile)
      
      const response = await apiClient.post('/api/departments/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      toast.success(`Successfully imported ${response.data.imported_count} departments`)
      setShowBulkImport(false)
      setImportFile(null)
      loadDepartments()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDepartmentAnalytics = async (departmentId: number) => {
    try {
      const response = await apiClient.get(`/api/departments/${departmentId}/analytics`)
      setDepartmentAnalytics(response.data?.data || null)
      setShowDepartmentAnalytics(true)
    } catch (error: any) {
      toast.error('Failed to load department analytics')
    }
  }

  const handleDepartmentStructure = async (departmentId: number) => {
    try {
      const response = await apiClient.get(`/api/departments/${departmentId}/structure`)
      setDepartmentStructure(response.data?.data || null)
      setShowDepartmentStructure(true)
    } catch (error: any) {
      toast.error('Failed to load department structure')
    }
  }

  const handleGenerateDepartmentReport = async (departmentId: number) => {
    try {
      const response = await apiClient.get(`/api/departments/${departmentId}/report`, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `department_report_${departmentId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Department report generated successfully')
    } catch (error: any) {
      toast.error('Failed to generate department report')
    }
  }

  const handleDuplicateDepartment = async (department: Department) => {
    try {
      const duplicateData = {
        name: `${department.name} (Copy)`,
        code: `${department.code}_COPY`,
        description: department.description,
        duration_years: department.duration_years,
        hod_id: department.hod_id,
        academic_year: department.academic_year,
        semester_count: department.semester_count,
        current_semester: department.current_semester,
        is_active: false // Start as inactive for review
      }
      
      await apiClient.createDepartment(duplicateData)
      toast.success('Department duplicated successfully')
      loadDepartments()
    } catch (error: any) {
      toast.error('Failed to duplicate department')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
            <p className="text-gray-600">Manage academic departments and their configurations</p>
          </div>
          <div className="flex gap-2">
            {selectedDepartments.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkCreateForm(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Bulk Create
                </button>
                <button
                  onClick={() => setShowBulkUpdateForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Bulk Update
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected ({selectedDepartments.length})
                </button>
                <button
                  onClick={() => {
                    setSelectedDepartments([])
                    setShowBulkActions(false)
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
        </div>
            )}
        {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Bulk Actions
                </button>
          {canCreate && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          )}
              </>
            )}
          </div>
        </div>

        {/* Advanced Features Toolbar */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Advanced Filters
            </button>
            <button
              onClick={() => setShowBulkImport(!showBulkImport)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created Date From</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created Date To</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">All Years</option>
                  <option value="2023-24">2023-24</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">All Durations</option>
                  <option value="2">2 Years</option>
                  <option value="3">3 Years</option>
                  <option value="4">4 Years</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAdvancedFilters(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close Filters
              </button>
            </div>
          </div>
        )}

        {/* Bulk Import */}
        {showBulkImport && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Bulk Import Departments</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select CSV/Excel File</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleBulkImport}
                  disabled={!importFile || loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Import Departments
                </button>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search departments by name, code, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filterActive === null ? 'all' : filterActive.toString()}
                onChange={(e) => setFilterActive(e.target.value === 'all' ? null : e.target.value === 'true')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {SYSTEM_CONFIG.STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
                  setSortBy(field as 'name' | 'code' | 'created_at')
                  setSortOrder(order as 'asc' | 'desc')
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {SYSTEM_CONFIG.SORT_OPTIONS.departments.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              Create Department
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium mb-1">Department Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Computer Science"
                  required
                />
              </div>
              <div>
                  <label className="block text-sm font-medium mb-1">Department Code *</label>
                <input
                  type="text"
                  value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., CS"
                  required
                />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Brief description of the department..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (Years) *</label>
                  <select
                    value={formData.duration_years}
                    onChange={(e) => setFormData({...formData, duration_years: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {SYSTEM_CONFIG.DURATION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Academic Year *</label>
                  <input
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({...formData, academic_year: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="2024-25"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Semester Count *</label>
                  <select
                    value={formData.semester_count}
                    onChange={(e) => setFormData({...formData, semester_count: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {SYSTEM_CONFIG.SEMESTER_COUNT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Head of Department (HOD)</label>
                <select
                  value={formData.hod_id}
                  onChange={(e) => setFormData({...formData, hod_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No HOD assigned</option>
                  {hods.map((hod) => (
                    <option key={hod.id} value={hod.id}>
                      {hod.name} {hod.has_department ? '(Already assigned)' : ''}
                    </option>
                  ))}
                </select>
                {hods.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">No HODs available. Create HOD users first.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active Department
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Department
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && editingDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit Department
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Department Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (Years) *</label>
                  <select
                    value={formData.duration_years}
                    onChange={(e) => setFormData({...formData, duration_years: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {SYSTEM_CONFIG.DURATION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Academic Year *</label>
                  <input
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({...formData, academic_year: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Semester Count *</label>
                  <select
                    value={formData.semester_count}
                    onChange={(e) => setFormData({...formData, semester_count: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {SYSTEM_CONFIG.SEMESTER_COUNT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Head of Department (HOD)</label>
                <select
                  value={formData.hod_id}
                  onChange={(e) => setFormData({...formData, hod_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No HOD assigned</option>
                  {hods.map((hod) => (
                    <option key={hod.id} value={hod.id}>
                      {hod.name} {hod.has_department && hod.department_id !== editingDepartment.id ? '(Already assigned)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700">
                  Active Department
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Update Department
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingDepartment(null)
                  }}
                  className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Form Modal */}
      {showBulkCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Bulk Create Departments
            </h2>
            <form onSubmit={handleBulkCreateSubmit} className="space-y-4">
              {bulkFormData.departments.map((dept, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Department {index + 1}</h3>
                    {bulkFormData.departments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDepartmentFromBulk(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name *</label>
                      <input
                        type="text"
                        value={dept.name}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].name = e.target.value
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Computer Science"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Code *</label>
                      <input
                        type="text"
                        value={dept.code}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].code = e.target.value
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., CS"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={dept.description}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].description = e.target.value
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Brief description of the department..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Duration (Years) *</label>
                      <select
                        value={dept.duration_years}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].duration_years = parseInt(e.target.value)
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        {SYSTEM_CONFIG.DURATION_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Academic Year *</label>
                      <input
                        type="text"
                        value={dept.academic_year}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].academic_year = e.target.value
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="2024-25"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Semester Count *</label>
                      <select
                        value={dept.semester_count}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].semester_count = parseInt(e.target.value)
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        {SYSTEM_CONFIG.SEMESTER_COUNT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">HOD (Optional)</label>
                      <select
                        value={dept.hod_id}
                        onChange={(e) => {
                          const newDepartments = [...bulkFormData.departments]
                          newDepartments[index].hod_id = e.target.value
                          setBulkFormData({...bulkFormData, departments: newDepartments})
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No HOD assigned</option>
                        {hods.map((hod) => (
                          <option key={hod.id} value={hod.id}>
                            {hod.name} {hod.has_department ? '(Already has department)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={addDepartmentToBulk}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Department
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create {bulkFormData.departments.length} Departments
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkCreateForm(false)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments && Array.isArray(departments) && departments.map((dept) => (
          <div key={dept.id} className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${dept.is_active ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {showBulkActions && (
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(dept.id)}
                    onChange={() => handleSelectDepartment(dept.id)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                )}
                <div className={`p-2 rounded-lg ${dept.is_active ? 'bg-green-100' : 'bg-red-100'}`}>
                  <GraduationCap className={`h-6 w-6 ${dept.is_active ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{dept.name}</h3>
                  <p className="text-sm text-gray-600">{dept.code}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 text-xs rounded-full ${dept.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              {user?.role === 'admin' && !showBulkActions && (
                <div className="flex gap-1">
                  {canUpdate && (
                    <button 
                      onClick={() => handleEdit(dept)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit Department"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDepartmentAnalytics(dept.id)}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Department Analytics"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDepartmentStructure(dept.id)}
                    className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                    title="Department Structure"
                  >
                    <Building className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleGenerateDepartmentReport(dept.id)}
                    className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                    title="Generate Report"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDuplicateDepartment(dept)}
                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Duplicate Department"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{dept.description || 'No description provided'}</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="text-sm font-medium">{dept.duration_years} years</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Academic Year</p>
                    <p className="text-sm font-medium">{dept.academic_year || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Semesters</p>
                    <p className="text-sm font-medium">{dept.semester_count || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">HOD</p>
                    <p className="text-sm font-medium">{getHODName(dept.hod_id)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Created: {new Date(dept.created_at).toLocaleDateString()}</span>
                  {dept.updated_at && (
                    <span>Updated: {new Date(dept.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => handleEdit(dept)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                >
                  View Details
                </button>
                <div className="flex gap-2">
                  {dept.hod_id ? (
                    <>
                      <button
                        onClick={() => handleEdit(dept)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="Reassign HOD"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveHOD(dept.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Remove HOD from this Department"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEdit(dept)}
                      className="text-green-500 hover:text-green-700 transition-colors"
                      title="Assign HOD to this Department"
                    >
                      <UserCheck className="h-4 w-4" />
                    </button>
                  )}
                  <Link
                    href={`/dashboard/users?department_id=${dept.id}`}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    title="View Users in this Department"
                  >
                    <Users className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/dashboard/classes?department_id=${dept.id}`}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    title="View Classes in this Department"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {departments.length === 0 && !loading && (
        <div className="text-center py-12">
          <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterActive !== null 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Get started by creating your first department.'
            }
          </p>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Create Department
            </button>
          )}
        </div>
      )}

      {/* Department Analytics Modal */}
      {showDepartmentAnalytics && departmentAnalytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Department Analytics</h3>
              <button
                onClick={() => setShowDepartmentAnalytics(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900">Total Students</h4>
                <p className="text-2xl font-bold text-blue-600">{departmentAnalytics.total_students || 0}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900">Active Classes</h4>
                <p className="text-2xl font-bold text-green-600">{departmentAnalytics.active_classes || 0}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-900">Total Subjects</h4>
                <p className="text-2xl font-bold text-purple-600">{departmentAnalytics.total_subjects || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Structure Modal */}
      {showDepartmentStructure && departmentStructure && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Department Structure</h3>
              <button
                onClick={() => setShowDepartmentStructure(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              {departmentStructure.semesters?.map((semester: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Semester {semester.number}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Classes: {semester.classes?.length || 0}</p>
                      <p className="text-sm text-gray-600">Students: {semester.students || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Subjects: {semester.subjects?.length || 0}</p>
                      <p className="text-sm text-gray-600">Teachers: {semester.teachers || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DepartmentsPageWithGuard() {
  return (
    <AdminGuard>
      <DepartmentsPage />
    </AdminGuard>
  )
}