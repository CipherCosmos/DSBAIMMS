'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { 
  Plus, 
  Calendar, 
  Building, 
  Users, 
  BookOpen, 
  Edit, 
  Trash2, 
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Semester {
  id: number
  department_id: number
  semester_number: number
  academic_year: string
  name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  is_completed: boolean
  department_name: string
  classes_count: number
  students_count: number
  created_at: string
  updated_at: string | null
}

interface Department {
  id: number
  name: string
  code: string
}

export default function SemestersPage() {
  const { user } = useAuth()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null)
  const [filterDepartment, setFilterDepartment] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [semestersData, departmentsData] = await Promise.all([
        apiClient.get('/api/semesters'),
        apiClient.get('/api/departments')
      ])
    setSemesters(semestersData || [])
    setDepartments(departmentsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSemester = async (semesterData: any) => {
    try {
      await apiClient.post('/api/semesters', semesterData)
      toast.success('Semester created successfully')
      setShowCreateForm(false)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create semester')
    }
  }

  const handleUpdateSemester = async (semesterData: any) => {
    try {
      await apiClient.put(`/api/semesters/${editingSemester?.id}`, semesterData)
      toast.success('Semester updated successfully')
      setEditingSemester(null)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update semester')
    }
  }

  const handleDeleteSemester = async (semesterId: number) => {
    if (!confirm('Are you sure you want to delete this semester?')) return
    
    try {
      await apiClient.delete(`/api/semesters/${semesterId}`)
      toast.success('Semester deleted successfully')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete semester')
    }
  }

  const handleToggleActive = async (semester: Semester) => {
    try {
      await apiClient.put(`/api/semesters/${semester.id}`, {
        is_active: !semester.is_active
      })
      toast.success(`Semester ${!semester.is_active ? 'activated' : 'deactivated'} successfully`)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update semester status')
    }
  }

  const filteredSemesters = semesters.filter(semester => 
    !filterDepartment || semester.department_id === filterDepartment
  )

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
          <h1 className="text-3xl font-bold text-gray-900">Semester Management</h1>
          <p className="text-gray-600">Manage academic semesters and enrollment periods</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'hod') && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Semester
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by Department:</label>
          <select
            value={filterDepartment || ''}
            onChange={(e) => setFilterDepartment(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Semesters Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Semester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Academic Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Students
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {semesters.map((semester) => (
                <tr key={semester.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {semester.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Semester {semester.semester_number}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{semester.department_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {semester.academic_year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {semester.start_date && semester.end_date ? (
                      <div>
                        <div>{new Date(semester.start_date).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">
                          to {new Date(semester.end_date).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {semester.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      ) : semester.is_completed ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">{semester.classes_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">{semester.students_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingSemester(semester)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(semester)}
                        className={`${
                          semester.is_active 
                            ? 'text-yellow-600 hover:text-yellow-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                        title={semester.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {semester.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </button>
                      {(user?.role === 'admin' || user?.role === 'hod') && (
                        <button
                          onClick={() => handleDeleteSemester(semester.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingSemester) && (
        <SemesterForm
          semester={editingSemester}
          departments={departments}
          onSubmit={editingSemester ? handleUpdateSemester : handleCreateSemester}
          onCancel={() => {
            setShowCreateForm(false)
            setEditingSemester(null)
          }}
        />
      )}
    </div>
  )
}

// Semester Form Component
interface SemesterFormProps {
  semester?: Semester | null
  departments: Department[]
  onSubmit: (data: any) => void
  onCancel: () => void
}

function SemesterForm({ semester, departments, onSubmit, onCancel }: SemesterFormProps) {
  const [formData, setFormData] = useState({
    department_id: semester?.department_id || '',
    semester_number: semester?.semester_number || '',
    academic_year: semester?.academic_year || '',
    name: semester?.name || '',
    start_date: semester?.start_date || '',
    end_date: semester?.end_date || '',
    is_active: semester?.is_active || false,
    is_completed: semester?.is_completed || false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {semester ? 'Edit Semester' : 'Create New Semester'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester Number
              </label>
              <input
                type="number"
                name="semester_number"
                value={formData.semester_number}
                onChange={handleChange}
                required
                min="1"
                max="8"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year
              </label>
              <input
                type="text"
                name="academic_year"
                value={formData.academic_year}
                onChange={handleChange}
                required
                placeholder="e.g., 2024-2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Semester 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_completed"
                  checked={formData.is_completed}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Completed</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {semester ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}