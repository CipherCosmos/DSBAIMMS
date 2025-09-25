'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Calendar, Building, Users, BookOpen } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Semester {
  id: number
  name: string
  code: string
  start_date: string
  end_date: string
  department_id: number
  department_name?: string
  student_count: number
  subject_count: number
  class_count: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface SemesterFormData {
  name: string
  code: string
  start_date: string
  end_date: string
  department_id: number
  is_active: boolean
}

interface SemestersManagerProps {
  departmentId?: number
}

export default function SemestersManager({ departmentId }: SemestersManagerProps) {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null)
  const [formData, setFormData] = useState<SemesterFormData>({
    name: '',
    code: '',
    start_date: '',
    end_date: '',
    department_id: 0,
    is_active: false
  })
  const [departments, setDepartments] = useState<any[]>([])

  useEffect(() => {
    fetchSemesters()
    fetchDepartments()
  }, [departmentId])

  const fetchSemesters = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (departmentId) params.department_id = departmentId

      const data = await apiClient.getSemesters(params)
      setSemesters(data)
    } catch (error) {
      console.error('Failed to fetch semesters:', error)
      toast.error('Failed to fetch semesters')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const data = await apiClient.getDepartments()
      setDepartments(data)
    } catch (error) {
      console.error('Failed to fetch departments:', error)
    }
  }

  const handleCreateSemester = async () => {
    try {
      await apiClient.createSemester(formData)
      toast.success('Semester created successfully')
      setShowCreateModal(false)
      setFormData({
        name: '',
        code: '',
        start_date: '',
        end_date: '',
        department_id: 0,
        is_active: false
      })
      fetchSemesters()
    } catch (error) {
      console.error('Failed to create semester:', error)
      toast.error('Failed to create semester')
    }
  }

  const handleEditSemester = async () => {
    if (!selectedSemester) return

    try {
      await apiClient.updateSemester(selectedSemester.id, formData)
      toast.success('Semester updated successfully')
      setShowEditModal(false)
      setSelectedSemester(null)
      fetchSemesters()
    } catch (error) {
      console.error('Failed to update semester:', error)
      toast.error('Failed to update semester')
    }
  }

  const handleDeleteSemester = async (semesterId: number) => {
    if (!confirm('Are you sure you want to delete this semester?')) return

    try {
      await apiClient.deleteSemester(semesterId)
      toast.success('Semester deleted successfully')
      fetchSemesters()
    } catch (error) {
      console.error('Failed to delete semester:', error)
      toast.error('Failed to delete semester')
    }
  }

  const openEditModal = (semester: Semester) => {
    setSelectedSemester(semester)
    setFormData({
      name: semester.name,
      code: semester.code,
      start_date: semester.start_date,
      end_date: semester.end_date,
      department_id: semester.department_id,
      is_active: semester.is_active
    })
    setShowEditModal(true)
  }

  const filteredSemesters = semesters.filter(semester =>
    semester.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    semester.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    semester.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Semesters Management</h1>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Semester
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search semesters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSemesters.map((semester) => (
          <Card key={semester.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{semester.name}</CardTitle>
                  <p className="text-sm text-gray-500">{semester.code}</p>
                  <Badge className={`mt-1 ${getStatusColor(semester.is_active)}`}>
                    {semester.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(semester)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSemester(semester.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4 text-gray-400" />
                <span>{semester.department_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{formatDate(semester.start_date)} - {formatDate(semester.end_date)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>{semester.student_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  <span>{semester.subject_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{semester.class_count}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSemesters.length === 0 && !loading && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No semesters found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first semester.'}
          </p>
        </div>
      )}

      {/* Create Semester Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Semester</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Semester Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter semester name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter semester code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Active Semester
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreateSemester} className="flex-1">
                Create Semester
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Semester Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Semester</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Semester Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter semester name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter semester code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="edit_is_active" className="text-sm font-medium">
                  Active Semester
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleEditSemester} className="flex-1">
                Update Semester
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
