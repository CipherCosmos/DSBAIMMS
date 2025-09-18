'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Plus, Edit, Trash2, Users, GraduationCap } from 'lucide-react'
import Link from 'next/link'

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

export default function DepartmentsPage() {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration_years: 4,
    hod_id: ''
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      const data = await apiClient.getDepartments()
      // Ensure data is an array
      setDepartments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading departments:', error)
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.createDepartment({
        ...formData,
        hod_id: formData.hod_id ? parseInt(formData.hod_id) : undefined
      })
      setShowCreateForm(false)
      setFormData({ name: '', code: '', description: '', duration_years: 4, hod_id: '' })
      loadDepartments()
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
    if (confirm('Are you sure you want to delete this department?')) {
      try {
        await apiClient.deleteDepartment(id)
        loadDepartments()
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600">Manage academic departments</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Department
          </button>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Department</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration (Years)</label>
                <input
                  type="number"
                  value={formData.duration_years}
                  onChange={(e) => setFormData({...formData, duration_years: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-md"
                  min="1"
                  max="8"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">HOD ID (Optional)</label>
                <input
                  type="number"
                  value={formData.hod_id}
                  onChange={(e) => setFormData({...formData, hod_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter HOD user ID"
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

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments && Array.isArray(departments) && departments.map((dept) => (
          <div key={dept.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{dept.name}</h3>
                  <p className="text-sm text-gray-600">{dept.code}</p>
                </div>
              </div>
              {user?.role === 'admin' && (
                <div className="flex gap-2">
                  <button className="p-1 text-gray-400 hover:text-blue-600">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-4">{dept.description}</p>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{dept.duration_years} years</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">HOD:</span>
                <span className="font-medium">{dept.hod_name || 'Not assigned'}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href={`/dashboard/classes?department_id=${dept.id}`}
                className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1"
              >
                <Users className="h-4 w-4" />
                Classes
              </Link>
              <Link
                href={`/dashboard/analytics?department_id=${dept.id}`}
                className="flex-1 bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-green-100 flex items-center justify-center gap-1"
              >
                <GraduationCap className="h-4 w-4" />
                Analytics
              </Link>
            </div>
          </div>
        ))}
      </div>

      {departments && Array.isArray(departments) && departments.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
          <p className="text-gray-600">Get started by creating your first department.</p>
        </div>
      )}
    </div>
  )
}