'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, BookOpen, User, Calendar, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface Subject {
  id: number
  name: string
  code: string
  credits: number
  department_id: number
  department_name?: string
  semester_id: number
  semester_name?: string
  class_id?: number
  class_name?: string
  teacher_id?: number
  teacher_name?: string
  student_count: number
  created_at: string
  updated_at?: string
}

interface SubjectFormData {
  name: string
  code: string
  credits: number
  department_id: number
  semester_id: number
  class_id?: number
  teacher_id?: number
}

interface SubjectsManagerProps {
  departmentId?: number
}

export default function SubjectsManager({ departmentId }: SubjectsManagerProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState<SubjectFormData>({
    name: '',
    code: '',
    credits: 0,
    department_id: 0,
    semester_id: 0,
    class_id: 0,
    teacher_id: 0
  })
  const [semesters, setSemesters] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  useEffect(() => {
    fetchSubjects()
    fetchInitialData()
  }, [departmentId])

  const fetchSubjects = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (departmentId) params.department_id = departmentId

      const data = await apiClient.getSubjects(params)
      setSubjects(data.data || [])
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
      toast.error('Failed to fetch subjects')
    } finally {
      setLoading(false)
    }
  }

  const fetchInitialData = async () => {
    try {
      const [semestersData, departmentsData, classesData, teachersData] = await Promise.all([
        apiClient.getSemesters(),
        apiClient.getDepartments(),
        apiClient.getClasses(),
        apiClient.getUsers({ role: 'teacher' })
      ])

      setSemesters(semestersData?.data || [])
      setDepartments(departmentsData?.data || [])
      setClasses(classesData?.data || [])
      setTeachers(teachersData?.data || [])
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
    }
  }

  const handleCreateSubject = async () => {
    try {
      const submitData = { ...formData }
      if (submitData.class_id === 0) delete submitData.class_id
      if (submitData.teacher_id === 0) delete submitData.teacher_id

      await apiClient.createSubject(submitData)
      toast.success('Subject created successfully')
      setShowCreateModal(false)
      setFormData({
        name: '',
        code: '',
        credits: 0,
        department_id: 0,
        semester_id: 0,
        class_id: 0,
        teacher_id: 0
      })
      fetchSubjects()
    } catch (error) {
      console.error('Failed to create subject:', error)
      toast.error('Failed to create subject')
    }
  }

  const handleEditSubject = async () => {
    if (!selectedSubject) return

    try {
      const submitData = { ...formData }
      if (submitData.class_id === 0) delete submitData.class_id
      if (submitData.teacher_id === 0) delete submitData.teacher_id

      await apiClient.updateSubject(selectedSubject.id, submitData)
      toast.success('Subject updated successfully')
      setShowEditModal(false)
      setSelectedSubject(null)
      fetchSubjects()
    } catch (error) {
      console.error('Failed to update subject:', error)
      toast.error('Failed to update subject')
    }
  }

  const handleDeleteSubject = async (subjectId: number) => {
    if (!confirm('Are you sure you want to delete this subject?')) return

    try {
      await apiClient.deleteSubject(subjectId)
      toast.success('Subject deleted successfully')
      fetchSubjects()
    } catch (error) {
      console.error('Failed to delete subject:', error)
      toast.error('Failed to delete subject')
    }
  }

  const openEditModal = (subject: Subject) => {
    setSelectedSubject(subject)
    setFormData({
      name: subject.name,
      code: subject.code,
      credits: subject.credits,
      department_id: subject.department_id,
      semester_id: subject.semester_id,
      class_id: subject.class_id || 0,
      teacher_id: subject.teacher_id || 0
    })
    setShowEditModal(true)
  }

  const filteredSubjects = subjects.filter(subject =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.semester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Subjects Management</h1>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Subject
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSubjects.map((subject) => (
          <Card key={subject.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{subject.name}</CardTitle>
                  <p className="text-sm text-gray-500">{subject.code}</p>
                  <Badge variant="secondary" className="mt-1">
                    {subject.credits} Credits
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(subject)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSubject(subject.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{subject.semester_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <span>{subject.department_name}</span>
              </div>
              {subject.class_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>Class: {subject.class_name}</span>
                </div>
              )}
              {subject.teacher_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Teacher: {subject.teacher_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{subject.student_count} students</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSubjects.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first subject.'}
          </p>
        </div>
      )}

      {/* Create Subject Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Subject</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter subject name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter subject code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Credits</label>
                <Input
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) })}
                  placeholder="Enter credits"
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
                <label className="block text-sm font-medium mb-1">Class (Optional)</label>
                <select
                  value={formData.class_id || 0}
                  onChange={(e) => setFormData({ ...formData, class_id: parseInt(e.target.value) || undefined })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teacher (Optional)</label>
                <select
                  value={formData.teacher_id || 0}
                  onChange={(e) => setFormData({ ...formData, teacher_id: parseInt(e.target.value) || undefined })}
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
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreateSubject} className="flex-1">
                Create Subject
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

      {/* Edit Subject Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Subject</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter subject name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter subject code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Credits</label>
                <Input
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) })}
                  placeholder="Enter credits"
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
                <label className="block text-sm font-medium mb-1">Class (Optional)</label>
                <select
                  value={formData.class_id || 0}
                  onChange={(e) => setFormData({ ...formData, class_id: parseInt(e.target.value) || undefined })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teacher (Optional)</label>
                <select
                  value={formData.teacher_id || 0}
                  onChange={(e) => setFormData({ ...formData, teacher_id: parseInt(e.target.value) || undefined })}
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
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleEditSubject} className="flex-1">
                Update Subject
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
