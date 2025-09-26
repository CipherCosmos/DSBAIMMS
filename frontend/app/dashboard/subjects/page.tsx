'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  FileText, Plus, Edit, Trash2, Save, X, Eye, 
  RefreshCw, Download, Upload, Filter, Search,
  Users, BookOpen, Calendar, Building, Target, Award
} from 'lucide-react'

interface Subject {
  id: number
  name: string
  code: string
  credits: number
  theory_marks: number
  practical_marks: number
  department_id: number
  department_name?: string
  class_id: number
  class_name?: string
  teacher_id: number
  teacher_name?: string
  semester_id?: number
  semester_name?: string
  created_at: string
  updated_at?: string
}

interface Class {
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

interface CO {
  id: number
  name: string
  description: string
  subject_id: number
}

interface PO {
  id: number
  name: string
  description: string
  department_id: number
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [cos, setCos] = useState<CO[]>([])
  const [pos, setPos] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [filterDepartment, setFilterDepartment] = useState<number | null>(null)
  const [filterClass, setFilterClass] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    credits: 3,
    theory_marks: 100,
    practical_marks: 0,
    department_id: 0,
    class_id: 0,
    teacher_id: 0,
    semester_id: 0
  })

  useEffect(() => {
    loadData()
  }, [filterDepartment, filterClass])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [subjectsResponse, classesResponse, departmentsResponse, usersResponse, cosResponse, posResponse] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/classes'),
        apiClient.get('/api/departments'),
        apiClient.get('/api/users'),
        apiClient.get('/api/cos'),
        apiClient.get('/api/pos')
      ])

    let subjectsData = subjectsResponse || []
    const classesData = classesResponse || []
    const departmentsData = departmentsResponse || []
    const usersData = usersResponse || []
    const cosData = cosResponse || []
    const posData = posResponse || []

      // Filter by department if selected
      if (filterDepartment) {
        subjectsData = subjectsData.filter((s: Subject) => s.department_id === filterDepartment)
      }

      // Filter by class if selected
      if (filterClass) {
        subjectsData = subjectsData.filter((s: Subject) => s.class_id === filterClass)
      }

      // Filter by search term
      if (searchTerm) {
        subjectsData = subjectsData.filter((s: Subject) => 
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.code.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      // Separate teachers
      const teachersData = usersData.filter((u: User) => u.role === 'teacher')

      setSubjects(subjectsData)
      setClasses(classesData)
      setDepartments(departmentsData)
      setTeachers(teachersData)
      setCos(cosData)
      setPos(posData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingSubject) {
        await apiClient.put(`/api/subjects/${editingSubject.id}`, formData)
      } else {
        await apiClient.post('/api/subjects', formData)
      }
      setShowForm(false)
      setEditingSubject(null)
      setFormData({
        name: '',
        code: '',
        credits: 3,
        theory_marks: 100,
        practical_marks: 0,
        department_id: 0,
        class_id: 0,
        teacher_id: 0,
        semester_id: 0
      })
      loadData()
    } catch (error) {
      console.error('Error saving subject:', error)
      setError('Failed to save subject')
    }
  }

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      code: subject.code,
      credits: subject.credits,
      theory_marks: subject.theory_marks,
      practical_marks: subject.practical_marks,
      department_id: subject.department_id,
      class_id: subject.class_id,
      teacher_id: subject.teacher_id,
      semester_id: subject.semester_id || 0
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subject?')) return

    try {
      await apiClient.delete(`/api/subjects/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting subject:', error)
      setError('Failed to delete subject')
    }
  }

  const exportData = async () => {
    try {
      const csvContent = convertToCSV(subjects)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'subjects.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: Subject[]) => {
    if (data.length === 0) return ''
    
    const headers = ['ID', 'Name', 'Code', 'Credits', 'Theory Marks', 'Practical Marks', 'Department', 'Class', 'Teacher', 'Semester']
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        row.name,
        row.code,
        row.credits,
        row.theory_marks,
        row.practical_marks,
        row.department_name || '',
        row.class_name || '',
        row.teacher_name || '',
        row.semester_name || ''
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
          <h1 className="text-3xl font-bold text-gray-900">Subject Management</h1>
          <p className="text-gray-600">Manage academic subjects and their assignments</p>
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
            Add Subject
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={filterClass || ''}
              onChange={(e) => setFilterClass(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
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
                placeholder="Search subjects..."
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

      {/* Subjects Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marks</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-blue-500 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                      <div className="text-sm text-gray-500">{subject.code} • {subject.credits} credits</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Building className="h-4 w-4 mr-1" />
                    {subject.department_name || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    {subject.class_name || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {subject.teacher_name || 'Not assigned'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="text-xs">
                    <div>Theory: {subject.theory_marks}</div>
                    <div>Practical: {subject.practical_marks}</div>
                    <div>Total: {subject.theory_marks + subject.practical_marks}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(subject)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(subject.id)}
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
              {editingSubject ? 'Edit Subject' : 'Add New Subject'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject Name</label>
                <input
                  type="text"
                  placeholder="Data Structures and Algorithms"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject Code</label>
                <input
                  type="text"
                  placeholder="CS201"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Theory Marks</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.theory_marks}
                    onChange={(e) => setFormData({ ...formData, theory_marks: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Practical Marks</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.practical_marks}
                    onChange={(e) => setFormData({ ...formData, practical_marks: Number(e.target.value) })}
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
                <label className="block text-sm font-medium text-gray-700">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value={0}>Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teacher</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({ ...formData, teacher_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value={0}>Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSubject(null)
                    setFormData({
                      name: '',
                      code: '',
                      credits: 3,
                      theory_marks: 100,
                      practical_marks: 0,
                      department_id: 0,
                      class_id: 0,
                      teacher_id: 0,
                      semester_id: 0
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
                  {editingSubject ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}