'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Plus, Edit, Trash2, BookOpen, GraduationCap } from 'lucide-react'
import Link from 'next/link'

interface Subject {
  id: number
  name: string
  code: string
  credits: number
  theory_marks: number
  practical_marks: number
  department_id: number
  department_name: string
  class_id: number
  class_name: string
  teacher_id: number
  teacher_name: string
  created_at: string
}

export default function SubjectsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const classId = searchParams.get('class_id')
  const teacherId = searchParams.get('teacher_id')

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    credits: 3,
    theory_marks: 100,
    practical_marks: 0,
    department_id: '',
    class_id: classId || '',
    teacher_id: teacherId || ''
  })

  useEffect(() => {
    loadData()
  }, [classId, teacherId])

  const loadData = async () => {
    try {
      const params: any = {}
      if (classId) params.class_id = classId
      if (teacherId) params.teacher_id = teacherId

      const [subjectsData, departmentsData, classesData, teachersData] = await Promise.all([
        apiClient.getSubjects(params),
        apiClient.getDepartments(),
        apiClient.getClasses(),
        apiClient.getUsers({ role: 'teacher' })
      ])

      setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
      setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
      setClasses(Array.isArray(classesData) ? classesData : [])
      setTeachers(Array.isArray(teachersData) ? teachersData : [])
    } catch (error) {
      console.error('Error loading data:', error)
      // Set empty arrays to prevent map errors
      if ('setSubjects' in this) setSubjects([])
      if ('setClasses' in this) setClasses([])
      if ('setDepartments' in this) setDepartments([])
      if ('setExams' in this) setExams([])
      if ('setMarks' in this) setMarks([])
      if ('setUsers' in this) setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.createSubject({
        ...formData,
        department_id: parseInt(formData.department_id),
        class_id: parseInt(formData.class_id),
        teacher_id: parseInt(formData.teacher_id),
        credits: parseInt(formData.credits.toString()),
        theory_marks: parseInt(formData.theory_marks.toString()),
        practical_marks: parseInt(formData.practical_marks.toString())
      })
      setShowCreateForm(false)
      setFormData({
        name: '',
        code: '',
        credits: 3,
        theory_marks: 100,
        practical_marks: 0,
        department_id: '',
        class_id: classId || '',
        teacher_id: teacherId || ''
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
    if (confirm('Are you sure you want to delete this subject?')) {
      try {
        await apiClient.deleteSubject(id)
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

  const canCreate = user?.role === 'admin' || user?.role === 'hod'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="text-gray-600">Manage course subjects and assignments</p>
          {classId && (
            <p className="text-sm text-blue-600 mt-1">
              Filtered by Class ID: {classId}
            </p>
          )}
          {teacherId && (
            <p className="text-sm text-green-600 mt-1">
              Filtered by Teacher ID: {teacherId}
            </p>
          )}
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Subject
          </button>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Subject</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Data Structures and Algorithms"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., CS201"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Credits</label>
                  <input
                    type="number"
                    value={formData.credits}
                    onChange={(e) => setFormData({...formData, credits: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md"
                    min="1"
                    max="6"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Theory Marks</label>
                  <input
                    type="number"
                    value={formData.theory_marks}
                    onChange={(e) => setFormData({...formData, theory_marks: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Practical Marks</label>
                  <input
                    type="number"
                    value={formData.practical_marks}
                    onChange={(e) => setFormData({...formData, practical_marks: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md"
                    min="0"
                  />
                </div>
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
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({...formData, class_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Class</option>
                  {classes && Array.isArray(classes) && classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} - {cls.department_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teacher</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Teacher</option>
                  {teachers && Array.isArray(teachers) && teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.full_name} ({teacher.username})</option>
                  ))}
                </select>
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

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects && Array.isArray(subjects) && subjects.map((subject) => (
          <div key={subject.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{subject.name}</h3>
                  <p className="text-sm text-gray-600">{subject.code}</p>
                </div>
              </div>
              {canCreate && (
                <div className="flex gap-2">
                  <button className="p-1 text-gray-400 hover:text-blue-600">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Credits:</span>
                <span className="font-medium">{subject.credits}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Theory:</span>
                <span className="font-medium">{subject.theory_marks} marks</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Practical:</span>
                <span className="font-medium">{subject.practical_marks} marks</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Department:</span>
                <span className="font-medium">{subject.department_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Class:</span>
                <span className="font-medium">{subject.class_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Teacher:</span>
                <span className="font-medium">{subject.teacher_name}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/dashboard/exams?subject_id=${subject.id}`}
                className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1"
              >
                <BookOpen className="h-4 w-4" />
                Exams
              </Link>
              <Link
                href={`/dashboard/co-po?subject_id=${subject.id}`}
                className="flex-1 bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-green-100 flex items-center justify-center gap-1"
              >
                <GraduationCap className="h-4 w-4" />
                CO/PO
              </Link>
            </div>
          </div>
        ))}
      </div>

      {subjects && Array.isArray(subjects) && subjects.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects found</h3>
          <p className="text-gray-600">
            {classId || teacherId
              ? "No subjects found for the selected filters."
              : "Get started by creating your first subject."
            }
          </p>
        </div>
      )}
    </div>
  )
}