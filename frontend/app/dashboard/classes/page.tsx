'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Plus, Edit, Trash2, Users, BookOpen, User } from 'lucide-react'
import Link from 'next/link'

interface Class {
  id: number
  name: string
  year: number
  semester: number
  section: string
  department_id: number
  department_name: string
  class_teacher_id?: number
  class_teacher_name?: string
  cr_id?: number
  cr_name?: string
  created_at: string
}

export default function ClassesPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const departmentId = searchParams.get('department_id')

  const [classes, setClasses] = useState<Class[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    semester: 1,
    section: 'A',
    department_id: departmentId || '',
    class_teacher_id: '',
    cr_id: ''
  })

  useEffect(() => {
    loadData()
  }, [departmentId])

  const loadData = async () => {
    try {
      const [classesData, departmentsData] = await Promise.all([
        apiClient.getClasses(departmentId ? { department_id: departmentId } : {}),
        apiClient.getDepartments()
      ])
      // Ensure data is an array
      setClasses(Array.isArray(classesData) ? classesData : [])
      setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
    } catch (error) {
      console.error('Error loading data:', error)
      setClasses([])
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.createClass({
        ...formData,
        department_id: parseInt(formData.department_id),
        class_teacher_id: formData.class_teacher_id ? parseInt(formData.class_teacher_id) : undefined,
        cr_id: formData.cr_id ? parseInt(formData.cr_id) : undefined
      })
      setShowCreateForm(false)
      setFormData({
        name: '',
        year: new Date().getFullYear(),
        semester: 1,
        section: 'A',
        department_id: departmentId || '',
        class_teacher_id: '',
        cr_id: ''
      })
      loadData()
    } catch (error) {
      console.error('Error loading data:', error)
      // Set empty arrays to prevent map errors
      if ('setSubjects' in this) setSubjects([])
      if ('setClasses' in this) setClasses([])
      if ('setDepartments' in this) setDepartments([])
      if ('setExams' in this) setExams([])
      if ('setMarks' in this) setMarks([])
      if ('setUsers' in this) setUsers([])
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this class?')) {
      try {
        await apiClient.deleteClass(id)
        loadData()
      } catch (error) {
      console.error('Error loading data:', error)
      // Set empty arrays to prevent map errors
      if ('setSubjects' in this) setSubjects([])
      if ('setClasses' in this) setClasses([])
      if ('setDepartments' in this) setDepartments([])
      if ('setExams' in this) setExams([])
      if ('setMarks' in this) setMarks([])
      if ('setUsers' in this) setUsers([])
    }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const canCreate = user?.role === 'admin' || (user?.role === 'hod' && departmentId)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-600">Manage class sections and assignments</p>
          {departmentId && (
            <p className="text-sm text-blue-600 mt-1">
              Filtered by Department ID: {departmentId}
            </p>
          )}
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Class
          </button>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Class</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., CSE-A-2024"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md"
                    min="2020"
                    max="2030"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({...formData, semester: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    {Array.from({length: 8}, (_, i) => i + 1).map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Section</label>
                <select
                  value={formData.section}
                  onChange={(e) => setFormData({...formData, section: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {['A', 'B', 'C', 'D', 'E', 'F'].map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Department</option>
                  {departments && Array.isArray(departments) && departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Teacher ID (Optional)</label>
                <input
                  type="number"
                  value={formData.class_teacher_id}
                  onChange={(e) => setFormData({...formData, class_teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter teacher user ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CR ID (Optional)</label>
                <input
                  type="number"
                  value={formData.cr_id}
                  onChange={(e) => setFormData({...formData, cr_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter student user ID"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes && Array.isArray(classes) && classes.map((cls) => (
          <div key={cls.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{cls.name}</h3>
                  <p className="text-sm text-gray-600">{cls.department_name}</p>
                </div>
              </div>
              {canCreate && (
                <div className="flex gap-2">
                  <button className="p-1 text-gray-400 hover:text-blue-600">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cls.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Year:</span>
                <span className="font-medium">{cls.year}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Semester:</span>
                <span className="font-medium">{cls.semester}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Section:</span>
                <span className="font-medium">{cls.section}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Class Teacher:</span>
                <span className="font-medium">{cls.class_teacher_name || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CR:</span>
                <span className="font-medium">{cls.cr_name || 'Not assigned'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/dashboard/subjects?class_id=${cls.id}`}
                className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1"
              >
                <BookOpen className="h-4 w-4" />
                Subjects
              </Link>
              <Link
                href={`/dashboard/users?class_id=${cls.id}&role=student`}
                className="flex-1 bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-green-100 flex items-center justify-center gap-1"
              >
                <User className="h-4 w-4" />
                Students
              </Link>
            </div>
          </div>
        ))}
      </div>

      {classes && Array.isArray(classes) && classes.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
          <p className="text-gray-600">
            {departmentId
              ? "No classes found for this department."
              : "Get started by creating your first class."
            }
          </p>
        </div>
      )}
    </div>
  )
}