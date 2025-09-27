'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Users, Calendar, BookOpen, UserCheck } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface Class {
  id: number
  name: string
  code: string
  semester_id: number
  semester_name?: string
  department_id: number
  department_name?: string
  class_teacher_id?: number
  class_teacher_name?: string
  class_representative_id?: number
  class_representative_name?: string
  student_count: number
  created_at: string
  updated_at?: string
}

interface ClassFormData {
  name: string
  code: string
  semester_id: number
  department_id: number
  class_teacher_id?: number
  class_representative_id?: number
}

interface ClassesManagerProps {
  departmentId?: number
}

export default function ClassesManager({ departmentId }: ClassesManagerProps) {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState<ClassFormData>({
    name: '',
    code: '',
    semester_id: 0,
    department_id: 0,
    class_teacher_id: 0,
    class_representative_id: 0
  })
  const [semesters, setSemesters] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])

  useEffect(() => {
    fetchClasses()
    fetchInitialData()
  }, [departmentId])

  const fetchClasses = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (departmentId) params.department_id = departmentId

      const data = await apiClient.getClasses(params)
      setClasses(data.data || [])
    } catch (error) {
      console.error('Failed to fetch classes:', error)
      toast.error('Failed to fetch classes')
    } finally {
      setLoading(false)
    }
  }

  const fetchInitialData = async () => {
    try {
      const [semestersData, departmentsData, teachersData, studentsData] = await Promise.all([
        apiClient.getSemesters(),
        apiClient.getDepartments(),
        apiClient.getUsers({ role: 'teacher' }),
        apiClient.getUsers({ role: 'student' })
      ])

      setSemesters(semestersData.data || [])
      setDepartments(departmentsData.data || [])
      setTeachers(teachersData.data || [])
      setStudents(studentsData.data || [])
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
    }
  }

  const handleCreateClass = async () => {
    try {
      await apiClient.createClass(formData)
      toast.success('Class created successfully')
      setShowCreateModal(false)
      setFormData({
        name: '',
        code: '',
        semester_id: 0,
        department_id: 0,
        class_teacher_id: 0,
        class_representative_id: 0
      })
      fetchClasses()
    } catch (error) {
      console.error('Failed to create class:', error)
      toast.error('Failed to create class')
    }
  }

  const handleEditClass = async () => {
    if (!selectedClass) return

    try {
      await apiClient.updateClass(selectedClass.id, formData)
      toast.success('Class updated successfully')
      setShowEditModal(false)
      setSelectedClass(null)
      fetchClasses()
    } catch (error) {
      console.error('Failed to update class:', error)
      toast.error('Failed to update class')
    }
  }

  const handleDeleteClass = async (classId: number) => {
    if (!confirm('Are you sure you want to delete this class?')) return

    try {
      await apiClient.deleteClass(classId)
      toast.success('Class deleted successfully')
      fetchClasses()
    } catch (error) {
      console.error('Failed to delete class:', error)
      toast.error('Failed to delete class')
    }
  }

  const openEditModal = (classItem: Class) => {
    setSelectedClass(classItem)
    setFormData({
      name: classItem.name,
      code: classItem.code,
      semester_id: classItem.semester_id,
      department_id: classItem.department_id,
      class_teacher_id: classItem.class_teacher_id || 0,
      class_representative_id: classItem.class_representative_id || 0
    })
    setShowEditModal(true)
  }

  const filteredClasses = classes.filter(classItem =>
    classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classItem.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classItem.semester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classItem.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Classes Management</h1>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Class
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredClasses.map((classItem) => (
          <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{classItem.name}</CardTitle>
                  <p className="text-sm text-gray-500">{classItem.code}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(classItem)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClass(classItem.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{classItem.semester_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <span>{classItem.department_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{classItem.student_count} students</span>
              </div>
              {classItem.class_teacher_name && (
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-gray-400" />
                  <span>Teacher: {classItem.class_teacher_name}</span>
                </div>
              )}
              {classItem.class_representative_name && (
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-gray-400" />
                  <span>CR: {classItem.class_representative_name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClasses.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first class.'}
          </p>
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Class</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter class name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter class code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester</label>
                <select
                  value={formData.semester_id}
                  onChange={(e) => setFormData({ ...formData, semester_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Semester</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
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
              <div>
                <label className="block text-sm font-medium mb-1">Class Teacher (Optional)</label>
                <select
                  value={formData.class_teacher_id || 0}
                  onChange={(e) => setFormData({ ...formData, class_teacher_id: parseInt(e.target.value) || undefined })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Representative (Optional)</label>
                <select
                  value={formData.class_representative_id || 0}
                  onChange={(e) => setFormData({ ...formData, class_representative_id: parseInt(e.target.value) || undefined })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreateClass} className="flex-1">
                Create Class
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

      {/* Edit Class Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Class</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter class name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter class code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester</label>
                <select
                  value={formData.semester_id}
                  onChange={(e) => setFormData({ ...formData, semester_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Semester</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
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
              <div>
                <label className="block text-sm font-medium mb-1">Class Teacher (Optional)</label>
                <select
                  value={formData.class_teacher_id || 0}
                  onChange={(e) => setFormData({ ...formData, class_teacher_id: parseInt(e.target.value) || undefined })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Representative (Optional)</label>
                <select
                  value={formData.class_representative_id || 0}
                  onChange={(e) => setFormData({ ...formData, class_representative_id: parseInt(e.target.value) || undefined })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleEditClass} className="flex-1">
                Update Class
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
