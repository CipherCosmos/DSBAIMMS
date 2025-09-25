'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  BookOpen, Plus, Edit, Trash2, Save, X, Eye, 
  RefreshCw, Download, Upload, Filter, Search,
  Users, GraduationCap, Calendar, Building
} from 'lucide-react'

interface Class {
  id: number
  name: string
  year: number
  semester_id: number
  semester_name?: string
  section: string
  department_id: number
  department_name?: string
  class_teacher_id?: number
  class_teacher_name?: string
  cr_id?: number
  cr_name?: string
  created_at: string
  updated_at?: string
}

interface Semester {
  id: number
  name: string
  department_id: number
  department_name?: string
}

interface Department {
  id: number
  name: string
  code: string
}

interface User {
  id: number
  full_name: string
  role: string
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [filterDepartment, setFilterDepartment] = useState<number | null>(null)
  const [filterSemester, setFilterSemester] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    semester_id: 0,
    section: '',
    department_id: 0,
    class_teacher_id: 0,
    cr_id: 0
  })

  useEffect(() => {
    loadData()
  }, [filterDepartment, filterSemester])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [classesResponse, semestersResponse, departmentsResponse, usersResponse] = await Promise.all([
        apiClient.get('/api/classes'),
        apiClient.get('/api/semesters'),
        apiClient.get('/api/departments'),
        apiClient.get('/api/users')
      ])

      let classesData = classesResponse.data || []
      const semestersData = semestersResponse.data || []
      const departmentsData = departmentsResponse.data || []
      const usersData = usersResponse.data || []

      // Filter by department if selected
      if (filterDepartment) {
        classesData = classesData.filter((c: Class) => c.department_id === filterDepartment)
      }

      // Filter by semester if selected
      if (filterSemester) {
        classesData = classesData.filter((c: Class) => c.semester_id === filterSemester)
      }

      // Filter by search term
      if (searchTerm) {
        classesData = classesData.filter((c: Class) => 
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.section.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      // Separate teachers and students
      const teachersData = usersData.filter((u: User) => u.role === 'teacher')
      const studentsData = usersData.filter((u: User) => u.role === 'student')

      setClasses(classesData)
      setSemesters(semestersData)
      setDepartments(departmentsData)
      setTeachers(teachersData)
      setStudents(studentsData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingClass) {
        await apiClient.put(`/api/classes/${editingClass.id}`, formData)
      } else {
        await apiClient.post('/api/classes', formData)
      }
      setShowForm(false)
      setEditingClass(null)
      setFormData({
        name: '',
        year: new Date().getFullYear(),
        semester_id: 0,
        section: '',
        department_id: 0,
        class_teacher_id: 0,
        cr_id: 0
      })
      loadData()
    } catch (error) {
      console.error('Error saving class:', error)
      setError('Failed to save class')
    }
  }

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem)
    setFormData({
      name: classItem.name,
      year: classItem.year,
      semester_id: classItem.semester_id,
      section: classItem.section,
      department_id: classItem.department_id,
      class_teacher_id: classItem.class_teacher_id || 0,
      cr_id: classItem.cr_id || 0
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this class?')) return

    try {
      await apiClient.delete(`/api/classes/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting class:', error)
      setError('Failed to delete class')
    }
  }

  const exportData = async () => {
    try {
      const csvContent = convertToCSV(classes)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'classes.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: Class[]) => {
    if (data.length === 0) return ''
    
    const headers = ['ID', 'Name', 'Year', 'Section', 'Department', 'Semester', 'Class Teacher', 'CR']
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        row.name,
        row.year,
        row.section,
        row.department_name || '',
        row.semester_name || '',
        row.class_teacher_name || '',
        row.cr_name || ''
      ].join(','))
    ]
    return csvRows.join('\n')
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
          <h1 className="text-3xl font-bold text-gray-900">Class Management</h1>
          <p className="text-gray-600">Manage academic classes and their assignments</p>
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
            Add Class
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={filterDepartment || ''}
              onChange={(e) => setFilterDepartment(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              value={filterSemester || ''}
              onChange={(e) => setFilterSemester(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Semesters</option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>{sem.name}</option>
              ))}
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
                placeholder="Search classes..."
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

      {/* Classes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CR</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {classes.map((classItem) => (
              <tr key={classItem.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{classItem.name}</div>
                      <div className="text-sm text-gray-500">{classItem.year} - {classItem.section}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Building className="h-4 w-4 mr-1" />
                    {classItem.department_name || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {classItem.semester_name || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {classItem.class_teacher_name || 'Not assigned'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <GraduationCap className="h-4 w-4 mr-1" />
                    {classItem.cr_name || 'Not assigned'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(classItem)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(classItem.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingClass ? 'Edit Class' : 'Add New Class'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Class Name</label>
                <input
                  type="text"
                  placeholder="BCA 2nd Year"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Section</label>
                  <input
                    type="text"
                    placeholder="A"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value={0}>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Semester</label>
                <select
                  value={formData.semester_id}
                  onChange={(e) => setFormData({ ...formData, semester_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value={0}>Select Semester</option>
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>{sem.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Class Teacher</label>
                <select
                  value={formData.class_teacher_id}
                  onChange={(e) => setFormData({ ...formData, class_teacher_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select Class Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Class Representative (CR)</label>
                <select
                  value={formData.cr_id}
                  onChange={(e) => setFormData({ ...formData, cr_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select CR</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingClass(null)
                    setFormData({
                      name: '',
                      year: new Date().getFullYear(),
                      semester_id: 0,
                      section: '',
                      department_id: 0,
                      class_teacher_id: 0,
                      cr_id: 0
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
                  {editingClass ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}