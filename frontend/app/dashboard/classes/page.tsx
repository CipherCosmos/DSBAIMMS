'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Plus, Edit, Trash2, Users, BookOpen, User, Copy, Wand2, Zap, Layers, UserPlus, Crown, Search, Filter, Download, Upload } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

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

interface Teacher {
  id: number
  name: string
  email: string
  department_id?: number
  department_name?: string
  is_available: boolean
}

interface Student {
  id: number
  name: string
  email: string
  student_id: string
  department_id?: number
  department_name?: string
  class_id?: number
  class_name?: string
}

interface ClassTemplate {
  id: string
  name: string
  description: string
  pattern: {
    year: number
    semester: number
    sections: string[]
  }
}

export default function ClassesPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const departmentId = searchParams.get('department_id')

  const [classes, setClasses] = useState<Class[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDetailsForm, setShowDetailsForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [viewingClass, setViewingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    semester: 1,
    section: 'A',
    department_id: departmentId || '',
    class_teacher_id: '',
    cr_id: ''
  })
  const [bulkFormData, setBulkFormData] = useState({
    department_id: departmentId || '',
    year: new Date().getFullYear(),
    semester: 1,
    sections: ['A', 'B'],
    class_teacher_id: '',
    cr_id: ''
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'year' | 'created_at'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadData()
  }, [departmentId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [classesData, departmentsData, teachersData, studentsData] = await Promise.all([
        apiClient.getClasses(departmentId ? { department_id: departmentId } : {}),
        apiClient.getDepartments(),
        apiClient.getUsers({ role: 'teacher' }),
        apiClient.getUsers({ role: 'student' })
      ])
      
      // Ensure data is an array and format properly
      setClasses(Array.isArray(classesData) ? classesData : [])
      setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
      
      // Format teachers data
      const formattedTeachers = Array.isArray(teachersData) ? teachersData.map(teacher => ({
        id: teacher.id,
        name: teacher.full_name || teacher.username,
        email: teacher.email,
        department_id: teacher.department_id,
        department_name: teacher.department_name,
        is_available: !teacher.class_id // Not assigned to any class
      })) : []
      setTeachers(formattedTeachers)
      
      // Format students data
      const formattedStudents = Array.isArray(studentsData) ? studentsData.map(student => ({
        id: student.id,
        name: student.full_name || student.username,
        email: student.email,
        student_id: student.student_id || '',
        department_id: student.department_id,
        department_name: student.department_name,
        class_id: student.class_id,
        class_name: student.class_name
      })) : []
      setStudents(formattedStudents)
    } catch (error) {
      console.error('Error loading data:', error)
      setClasses([])
      setDepartments([])
      setTeachers([])
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  // Smart class name generation
  const generateClassName = useCallback((deptId: string, year: number, semester: number, section: string) => {
    if (!deptId) return ''
    const department = departments.find(d => d.id.toString() === deptId)
    if (!department) return ''
    
    const deptCode = department.code || department.name.substring(0, 3).toUpperCase()
    return `${deptCode}-${section}-${year}-S${semester}`
  }, [departments])

  // Auto-generate class name when form data changes
  useEffect(() => {
    if (formData.department_id && formData.year && formData.semester && formData.section) {
      const generatedName = generateClassName(formData.department_id, formData.year, formData.semester, formData.section)
      setFormData(prev => ({ ...prev, name: generatedName }))
    }
  }, [formData.department_id, formData.year, formData.semester, formData.section, generateClassName])

  // Get available teachers for selected department
  const availableTeachers = useMemo(() => {
    if (!formData.department_id) return teachers
    return teachers.filter(teacher => 
      teacher.department_id?.toString() === formData.department_id && teacher.is_available
    )
  }, [teachers, formData.department_id])

  // Get available students for selected department
  const availableStudents = useMemo(() => {
    if (!formData.department_id) return students
    return students.filter(student => 
      student.department_id?.toString() === formData.department_id && !student.class_id
    )
  }, [students, formData.department_id])

  // Class templates
  const classTemplates: ClassTemplate[] = [
    {
      id: 'first-year',
      name: 'First Year Classes',
      description: 'Create classes for first year students (Semester 1 & 2)',
      pattern: { year: new Date().getFullYear(), semester: 1, sections: ['A', 'B', 'C'] }
    },
    {
      id: 'second-year',
      name: 'Second Year Classes',
      description: 'Create classes for second year students (Semester 3 & 4)',
      pattern: { year: new Date().getFullYear() - 1, semester: 3, sections: ['A', 'B'] }
    },
    {
      id: 'third-year',
      name: 'Third Year Classes',
      description: 'Create classes for third year students (Semester 5 & 6)',
      pattern: { year: new Date().getFullYear() - 2, semester: 5, sections: ['A', 'B'] }
    },
    {
      id: 'final-year',
      name: 'Final Year Classes',
      description: 'Create classes for final year students (Semester 7 & 8)',
      pattern: { year: new Date().getFullYear() - 3, semester: 7, sections: ['A', 'B'] }
    }
  ]

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
    } catch (error: any) {
      console.error('Error creating class:', error)
      toast.error('Failed to create class')
    }
  }

  // Bulk class creation
  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const classesToCreate = bulkFormData.sections.map(section => ({
        name: generateClassName(bulkFormData.department_id, bulkFormData.year, bulkFormData.semester, section),
        year: bulkFormData.year,
        semester: bulkFormData.semester,
        section: section,
        department_id: parseInt(bulkFormData.department_id),
        class_teacher_id: bulkFormData.class_teacher_id ? parseInt(bulkFormData.class_teacher_id) : undefined,
        cr_id: bulkFormData.cr_id ? parseInt(bulkFormData.cr_id) : undefined
      }))

      // Create classes one by one (or implement bulk API if available)
      for (const classData of classesToCreate) {
        await apiClient.createClass(classData)
      }

      toast.success(`${classesToCreate.length} classes created successfully`)
      setShowBulkForm(false)
      setBulkFormData({
        department_id: departmentId || '',
        year: new Date().getFullYear(),
        semester: 1,
        sections: ['A', 'B'],
        class_teacher_id: '',
        cr_id: ''
      })
      loadData()
    } catch (error: any) {
      console.error('Error creating classes:', error)
      toast.error('Failed to create classes')
    }
  }

  // Apply template
  const applyTemplate = (template: ClassTemplate) => {
    setBulkFormData(prev => ({
      ...prev,
      year: template.pattern.year,
      semester: template.pattern.semester,
      sections: template.pattern.sections
    }))
    setShowTemplates(false)
    setShowBulkForm(true)
  }

  // Add section to bulk form
  const addSection = () => {
    const nextSection = String.fromCharCode(65 + bulkFormData.sections.length)
    setBulkFormData(prev => ({
      ...prev,
      sections: [...prev.sections, nextSection]
    }))
  }

  // Remove section from bulk form
  const removeSection = (index: number) => {
    if (bulkFormData.sections.length > 1) {
      setBulkFormData(prev => ({
        ...prev,
        sections: prev.sections.filter((_, i) => i !== index)
      }))
    }
  }

  // Filter and sort classes
  const filteredAndSortedClasses = useMemo(() => {
    return classes
      .filter(cls => {
        const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             cls.department_name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesDepartment = !filterDepartment || cls.department_id.toString() === filterDepartment
        const matchesYear = !filterYear || cls.year.toString() === filterYear
        return matchesSearch && matchesDepartment && matchesYear
      })
      .sort((a, b) => {
        let aValue, bValue
        switch (sortBy) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'year':
            aValue = a.year
            bValue = b.year
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
  }, [classes, searchTerm, filterDepartment, filterYear, sortBy, sortOrder])

  // View class details handler
  const handleViewDetails = (classItem: Class) => {
    setViewingClass(classItem)
    setShowDetailsForm(true)
  }

  // Edit class handler
  const handleEdit = (classItem: Class) => {
    if (canCreate) {
      setEditingClass(classItem)
      setFormData({
        name: classItem.name,
        year: classItem.year,
        semester: classItem.semester,
        section: classItem.section,
        department_id: classItem.department_id.toString(),
        class_teacher_id: classItem.class_teacher_id?.toString() || '',
        cr_id: classItem.cr_id?.toString() || ''
      })
      setShowEditForm(true)
    } else {
      handleViewDetails(classItem)
    }
  }

  // Update class handler
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClass) return

    try {
      await apiClient.updateClass(editingClass.id, {
        ...formData,
        department_id: parseInt(formData.department_id),
        class_teacher_id: formData.class_teacher_id ? parseInt(formData.class_teacher_id) : undefined,
        cr_id: formData.cr_id ? parseInt(formData.cr_id) : undefined
      })
      toast.success('Class updated successfully')
      setShowEditForm(false)
      setEditingClass(null)
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
    } catch (error: any) {
      console.error('Error updating class:', error)
      toast.error('Failed to update class')
    }
  }

  // Delete class handler
  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this class?')) {
      try {
        await apiClient.deleteClass(id)
        toast.success('Class deleted successfully')
        loadData()
      } catch (error: any) {
        console.error('Error deleting class:', error)
        toast.error('Failed to delete class')
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              Templates
            </button>
            <button
              onClick={() => setShowBulkForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Bulk Create
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Class
            </button>
          </div>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as 'name' | 'year' | 'created_at')
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="year-desc">Year (Newest)</option>
              <option value="year-asc">Year (Oldest)</option>
              <option value="created_at-desc">Recently Created</option>
              <option value="created_at-asc">Oldest Created</option>
            </select>
          </div>
        </div>
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
                <label className="block text-sm font-medium mb-1">Class Teacher (Optional)</label>
                <select
                  value={formData.class_teacher_id}
                  onChange={(e) => setFormData({...formData, class_teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class Teacher</option>
                  {availableTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} {teacher.is_available ? '(Available)' : '(Assigned)'}
                    </option>
                  ))}
                </select>
                {availableTeachers.length === 0 && formData.department_id && (
                  <p className="text-sm text-gray-500 mt-1">No available teachers in this department</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Representative (Optional)</label>
                <select
                  value={formData.cr_id}
                  onChange={(e) => setFormData({...formData, cr_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class Representative</option>
                  {availableStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.student_id}) {student.class_id ? '(Already in class)' : '(Available)'}
                    </option>
                  ))}
                </select>
                {availableStudents.length === 0 && formData.department_id && (
                  <p className="text-sm text-gray-500 mt-1">No available students in this department</p>
                )}
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

      {/* Edit Form Modal */}
      {showEditForm && editingClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Class</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
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
                <label className="block text-sm font-medium mb-1">Class Teacher (Optional)</label>
                <select
                  value={formData.class_teacher_id}
                  onChange={(e) => setFormData({...formData, class_teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class Teacher</option>
                  {availableTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} {teacher.is_available ? '(Available)' : '(Assigned)'}
                    </option>
                  ))}
                </select>
                {availableTeachers.length === 0 && formData.department_id && (
                  <p className="text-sm text-gray-500 mt-1">No available teachers in this department</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Representative (Optional)</label>
                <select
                  value={formData.cr_id}
                  onChange={(e) => setFormData({...formData, cr_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class Representative</option>
                  {availableStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.student_id}) {student.class_id ? '(Already in class)' : '(Available)'}
                    </option>
                  ))}
                </select>
                {availableStudents.length === 0 && formData.department_id && (
                  <p className="text-sm text-gray-500 mt-1">No available students in this department</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingClass(null)
                    setFormData({
                      name: '',
                      year: new Date().getFullYear(),
                      semester: 1,
                      section: 'A',
                      department_id: departmentId || '',
                      class_teacher_id: '',
                      cr_id: ''
                    })
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailsForm && viewingClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Class Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Class Name</label>
                  <p className="text-lg font-semibold">{viewingClass.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Department</label>
                  <p className="text-lg font-semibold">{viewingClass.department_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Year</label>
                  <p className="text-lg font-semibold">{viewingClass.year}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Semester</label>
                  <p className="text-lg font-semibold">{viewingClass.semester}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Section</label>
                  <p className="text-lg font-semibold">{viewingClass.section}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Class Teacher</label>
                <p className="text-lg font-semibold">{viewingClass.class_teacher_name || 'Not assigned'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Class Representative</label>
                <p className="text-lg font-semibold">{viewingClass.cr_name || 'Not assigned'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Created</label>
                <p className="text-sm text-gray-600">{new Date(viewingClass.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {canCreate && (
                <button
                  onClick={() => {
                    setShowDetailsForm(false)
                    setViewingClass(null)
                    handleEdit(viewingClass)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Edit Class
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailsForm(false)
                  setViewingClass(null)
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Class Creation Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classTemplates.map(template => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
                     onClick={() => applyTemplate(template)}>
                  <div className="flex items-center gap-3 mb-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold">{template.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="text-xs text-gray-500">
                    <p>Year: {template.pattern.year}</p>
                    <p>Semester: {template.pattern.semester}</p>
                    <p>Sections: {template.pattern.sections.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTemplates(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Creation Modal */}
      {showBulkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Bulk Create Classes</h2>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <select
                    value={bulkFormData.department_id}
                    onChange={(e) => setBulkFormData({...bulkFormData, department_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input
                    type="number"
                    value={bulkFormData.year}
                    onChange={(e) => setBulkFormData({...bulkFormData, year: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md"
                    min="2020"
                    max="2030"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester</label>
                <select
                  value={bulkFormData.semester}
                  onChange={(e) => setBulkFormData({...bulkFormData, semester: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {Array.from({length: 8}, (_, i) => i + 1).map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sections</label>
                <div className="space-y-2">
                  {bulkFormData.sections.map((section, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={section}
                        onChange={(e) => {
                          const newSections = [...bulkFormData.sections]
                          newSections[index] = e.target.value
                          setBulkFormData({...bulkFormData, sections: newSections})
                        }}
                        className="flex-1 px-3 py-2 border rounded-md"
                        placeholder="Section letter"
                      />
                      {bulkFormData.sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSection}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Section
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Teacher (Optional)</label>
                <select
                  value={bulkFormData.class_teacher_id}
                  onChange={(e) => setBulkFormData({...bulkFormData, class_teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class Teacher</option>
                  {teachers.filter(t => t.department_id?.toString() === bulkFormData.department_id).map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} {teacher.is_available ? '(Available)' : '(Assigned)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class Representative (Optional)</label>
                <select
                  value={bulkFormData.cr_id}
                  onChange={(e) => setBulkFormData({...bulkFormData, cr_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class Representative</option>
                  {students.filter(s => s.department_id?.toString() === bulkFormData.department_id).map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.student_id}) {student.class_id ? '(Already in class)' : '(Available)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">Preview Classes to be Created:</h4>
                <div className="space-y-1">
                  {bulkFormData.sections.map(section => (
                    <div key={section} className="text-sm text-blue-800">
                      {generateClassName(bulkFormData.department_id, bulkFormData.year, bulkFormData.semester, section)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Create {bulkFormData.sections.length} Classes
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkForm(false)}
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
        {filteredAndSortedClasses.map((cls) => (
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
                  <button 
                    onClick={() => handleEdit(cls)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Edit Class"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cls.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete Class"
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
              <button
                onClick={() => handleEdit(cls)}
                className="flex-1 bg-gray-50 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 flex items-center justify-center gap-1"
                title="View Class Details"
              >
                <Users className="h-4 w-4" />
                Details
              </button>
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

      {filteredAndSortedClasses.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
          <p className="text-gray-600">
            {searchTerm || filterDepartment || filterYear
              ? "No classes match your search criteria. Try adjusting your filters."
              : departmentId
              ? "No classes found for this department."
              : "Get started by creating your first class."
            }
          </p>
          {canCreate && (searchTerm || filterDepartment || filterYear) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterDepartment('')
                setFilterYear('')
              }}
              className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}