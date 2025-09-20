'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Plus, Edit, Trash2, BookOpen, GraduationCap, Search, Filter, Download, Upload, Copy, Wand2, Zap, Layers, UserPlus, Crown, Users, Eye } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

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

interface Teacher {
  id: number
  name: string
  email: string
  department_id?: number
  department_name?: string
  is_available: boolean
}

interface Class {
  id: number
  name: string
  year: number
  semester: number
  section: string
  department_id: number
  department_name: string
}

interface SubjectTemplate {
  id: string
  name: string
  description: string
  pattern: {
    credits: number
    theory_marks: number
    practical_marks: number
    common_subjects: string[]
  }
}

export default function SubjectsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const classId = searchParams.get('class_id')
  const teacherId = searchParams.get('teacher_id')

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDetailsForm, setShowDetailsForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [viewingSubject, setViewingSubject] = useState<Subject | null>(null)
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
  const [bulkFormData, setBulkFormData] = useState({
    department_id: '',
    class_id: '',
    teacher_id: '',
    subjects: [
      { name: '', code: '', credits: 3, theory_marks: 100, practical_marks: 0 }
    ]
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'created_at'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadData()
  }, [classId, teacherId])

  const loadData = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (classId) params.class_id = classId
      if (teacherId) params.teacher_id = teacherId

      const [subjectsData, departmentsData, classesData, teachersData] = await Promise.all([
        apiClient.getSubjects(params),
        apiClient.getDepartments(),
        apiClient.getClasses(),
        apiClient.getUsers({ role: 'teacher' })
      ])

      // Format subjects data
      setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
      setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
      
      // Format classes data
      const formattedClasses = Array.isArray(classesData) ? classesData.map(cls => ({
        id: cls.id,
        name: cls.name,
        year: cls.year,
        semester: cls.semester,
        section: cls.section,
        department_id: cls.department_id,
        department_name: cls.department_name
      })) : []
      setClasses(formattedClasses)
      
      // Format teachers data
      const formattedTeachers = Array.isArray(teachersData) ? teachersData.map(teacher => ({
        id: teacher.id,
        name: teacher.full_name || teacher.username,
        email: teacher.email,
        department_id: teacher.department_id,
        department_name: teacher.department_name,
        is_available: true // Teachers are generally available for subject assignment
      })) : []
      setTeachers(formattedTeachers)
    } catch (error) {
      console.error('Error loading data:', error)
      setSubjects([])
      setDepartments([])
      setClasses([])
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }

  // Smart subject code generation
  const generateSubjectCode = useCallback((subjectName: string, departmentCode: string, classCode: string) => {
    if (!subjectName || !departmentCode) return ''
    
    // Extract key words from subject name
    const words = subjectName.toLowerCase().split(' ')
    const keyWords = words.filter(word => 
      !['and', 'of', 'the', 'for', 'in', 'on', 'at', 'to', 'with', 'by'].includes(word)
    )
    
    // Create code from key words and department
    const subjectCode = keyWords.map(word => word.charAt(0).toUpperCase()).join('')
    const deptCode = departmentCode.substring(0, 3).toUpperCase()
    const classCodeShort = classCode ? classCode.substring(0, 2).toUpperCase() : ''
    
    return `${deptCode}${classCodeShort}${subjectCode}`.substring(0, 8)
  }, [])

  // Auto-generate subject code when form data changes
  useEffect(() => {
    if (formData.name && formData.department_id && formData.class_id) {
      const department = departments.find(d => d.id.toString() === formData.department_id)
      const classItem = classes.find(c => c.id.toString() === formData.class_id)
      
      if (department && classItem) {
        const generatedCode = generateSubjectCode(formData.name, department.code, classItem.name)
        setFormData(prev => ({ ...prev, code: generatedCode }))
      }
    }
  }, [formData.name, formData.department_id, formData.class_id, departments, classes, generateSubjectCode])

  // Get available teachers for selected department
  const availableTeachers = useMemo(() => {
    if (!formData.department_id) return teachers
    return teachers.filter(teacher => 
      teacher.department_id?.toString() === formData.department_id
    )
  }, [teachers, formData.department_id])

  // Get available classes for selected department
  const availableClasses = useMemo(() => {
    if (!formData.department_id) return classes
    return classes.filter(cls => 
      cls.department_id?.toString() === formData.department_id
    )
  }, [classes, formData.department_id])

  // Subject templates
  const subjectTemplates: SubjectTemplate[] = [
    {
      id: 'engineering-core',
      name: 'Engineering Core Subjects',
      description: 'Common engineering subjects with standard credit distribution',
      pattern: {
        credits: 4,
        theory_marks: 100,
        practical_marks: 50,
        common_subjects: ['Mathematics', 'Physics', 'Chemistry', 'Programming', 'Data Structures']
      }
    },
    {
      id: 'computer-science',
      name: 'Computer Science Subjects',
      description: 'CS subjects with programming and theory components',
      pattern: {
        credits: 3,
        theory_marks: 100,
        practical_marks: 100,
        common_subjects: ['Algorithms', 'Database Systems', 'Software Engineering', 'Computer Networks']
      }
    },
    {
      id: 'management',
      name: 'Management Subjects',
      description: 'Business and management subjects',
      pattern: {
        credits: 3,
        theory_marks: 100,
        practical_marks: 0,
        common_subjects: ['Business Management', 'Economics', 'Marketing', 'Finance']
      }
    },
    {
      id: 'mathematics',
      name: 'Mathematics Subjects',
      description: 'Pure and applied mathematics subjects',
      pattern: {
        credits: 4,
        theory_marks: 100,
        practical_marks: 0,
        common_subjects: ['Calculus', 'Linear Algebra', 'Statistics', 'Discrete Mathematics']
      }
    }
  ]

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
      toast.success('Subject created successfully')
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
    } catch (error: any) {
      console.error('Error creating subject:', error)
      toast.error('Failed to create subject')
    }
  }

  // View subject details handler
  const handleViewDetails = (subjectItem: Subject) => {
    setViewingSubject(subjectItem)
    setShowDetailsForm(true)
  }

  // Edit subject handler
  const handleEdit = (subjectItem: Subject) => {
    if (canCreate) {
      setEditingSubject(subjectItem)
      setFormData({
        name: subjectItem.name,
        code: subjectItem.code,
        credits: subjectItem.credits,
        theory_marks: subjectItem.theory_marks,
        practical_marks: subjectItem.practical_marks,
        department_id: subjectItem.department_id.toString(),
        class_id: subjectItem.class_id.toString(),
        teacher_id: subjectItem.teacher_id.toString()
      })
      setShowEditForm(true)
    } else {
      handleViewDetails(subjectItem)
    }
  }

  // Update subject handler
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSubject) return

    try {
      await apiClient.updateSubject(editingSubject.id, {
        ...formData,
        department_id: parseInt(formData.department_id),
        class_id: parseInt(formData.class_id),
        teacher_id: parseInt(formData.teacher_id),
        credits: parseInt(formData.credits.toString()),
        theory_marks: parseInt(formData.theory_marks.toString()),
        practical_marks: parseInt(formData.practical_marks.toString())
      })
      toast.success('Subject updated successfully')
      setShowEditForm(false)
      setEditingSubject(null)
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
    } catch (error: any) {
      console.error('Error updating subject:', error)
      toast.error('Failed to update subject')
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this subject?')) {
      try {
        await apiClient.deleteSubject(id)
        toast.success('Subject deleted successfully')
        loadData()
      } catch (error: any) {
        console.error('Error deleting subject:', error)
        toast.error('Failed to delete subject')
      }
    }
  }

  // Bulk subject creation
  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const subjectsToCreate = bulkFormData.subjects.map(subject => ({
        ...subject,
        department_id: parseInt(bulkFormData.department_id),
        class_id: parseInt(bulkFormData.class_id),
        teacher_id: parseInt(bulkFormData.teacher_id),
        credits: parseInt(subject.credits.toString()),
        theory_marks: parseInt(subject.theory_marks.toString()),
        practical_marks: parseInt(subject.practical_marks.toString())
      }))

      // Create subjects one by one
      for (const subjectData of subjectsToCreate) {
        await apiClient.createSubject(subjectData)
      }

      toast.success(`${subjectsToCreate.length} subjects created successfully`)
      setShowBulkForm(false)
      setBulkFormData({
        department_id: '',
        class_id: '',
        teacher_id: '',
        subjects: [{ name: '', code: '', credits: 3, theory_marks: 100, practical_marks: 0 }]
      })
      loadData()
    } catch (error: any) {
      console.error('Error creating subjects:', error)
      toast.error('Failed to create subjects')
    }
  }

  // Apply template
  const applyTemplate = (template: SubjectTemplate) => {
    const templateSubjects = template.pattern.common_subjects.map(subjectName => ({
      name: subjectName,
      code: '',
      credits: template.pattern.credits,
      theory_marks: template.pattern.theory_marks,
      practical_marks: template.pattern.practical_marks
    }))
    
    setBulkFormData(prev => ({
      ...prev,
      subjects: templateSubjects
    }))
    setShowTemplates(false)
    setShowBulkForm(true)
  }

  // Add subject to bulk form
  const addSubject = () => {
    setBulkFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { name: '', code: '', credits: 3, theory_marks: 100, practical_marks: 0 }]
    }))
  }

  // Remove subject from bulk form
  const removeSubject = (index: number) => {
    if (bulkFormData.subjects.length > 1) {
      setBulkFormData(prev => ({
        ...prev,
        subjects: prev.subjects.filter((_, i) => i !== index)
      }))
    }
  }

  // Filter and sort subjects
  const filteredAndSortedSubjects = useMemo(() => {
    return subjects
      .filter(subject => {
        const matchesSearch = subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             subject.department_name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesDepartment = !filterDepartment || subject.department_id.toString() === filterDepartment
        const matchesClass = !filterClass || subject.class_id.toString() === filterClass
        const matchesTeacher = !filterTeacher || subject.teacher_id.toString() === filterTeacher
        return matchesSearch && matchesDepartment && matchesClass && matchesTeacher
      })
      .sort((a, b) => {
        let aValue, bValue
        switch (sortBy) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'code':
            aValue = a.code.toLowerCase()
            bValue = b.code.toLowerCase()
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
  }, [subjects, searchTerm, filterDepartment, filterClass, filterTeacher, sortBy, sortOrder])

  const canCreate = user?.role === 'admin' || user?.role === 'hod' || user?.role === 'teacher'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2"
              title="Use Templates"
            >
              <Wand2 className="h-4 w-4" />
              Templates
            </button>
            <button
              onClick={() => setShowBulkForm(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center gap-2"
              title="Bulk Create"
            >
              <Layers className="h-4 w-4" />
              Bulk Create
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Subject
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search subjects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
          <select
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Teachers</option>
            {teachers.map(teacher => (
              <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-between items-center mt-4">
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'code' | 'created_at')}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="code">Sort by Code</option>
              <option value="created_at">Sort by Date</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 border rounded-md text-sm hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {filteredAndSortedSubjects.length} of {subjects.length} subjects
          </div>
        </div>
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

      {/* Edit Form Modal */}
      {showEditForm && editingSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Subject</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
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
                  placeholder="e.g., CS301"
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
                    required
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
                    max="200"
                    required
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
                    max="200"
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
                  {departments.map(dept => (
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
                  {availableClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
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
                  {availableTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} {teacher.is_available ? '(Available)' : '(Assigned)'}
                    </option>
                  ))}
                </select>
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
                    setEditingSubject(null)
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
      {showDetailsForm && viewingSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Subject Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Subject Name</label>
                  <p className="text-lg font-semibold">{viewingSubject.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Subject Code</label>
                  <p className="text-lg font-semibold font-mono">{viewingSubject.code}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Credits</label>
                  <p className="text-lg font-semibold">{viewingSubject.credits}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Theory Marks</label>
                  <p className="text-lg font-semibold">{viewingSubject.theory_marks}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Practical Marks</label>
                  <p className="text-lg font-semibold">{viewingSubject.practical_marks}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Department</label>
                <p className="text-lg font-semibold">{viewingSubject.department_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Class</label>
                <p className="text-lg font-semibold">{viewingSubject.class_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Teacher</label>
                <p className="text-lg font-semibold">{viewingSubject.teacher_name || 'Not assigned'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Created</label>
                <p className="text-sm text-gray-600">{new Date(viewingSubject.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {canCreate && (
                <button
                  onClick={() => {
                    setShowDetailsForm(false)
                    setViewingSubject(null)
                    handleEdit(viewingSubject)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Edit Subject
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailsForm(false)
                  setViewingSubject(null)
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedSubjects.map((subject) => (
          <div key={subject.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{subject.name}</h3>
                  <p className="text-sm text-gray-600 font-mono">{subject.code}</p>
                  <p className="text-sm text-blue-600">{subject.department_name}</p>
                </div>
                {canCreate && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(subject)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edit Subject"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(subject.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete Subject"
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
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleViewDetails(subject)}
                className="flex-1 bg-gray-50 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 flex items-center justify-center gap-1"
                title="View Subject Details"
              >
                <Eye className="h-4 w-4" />
                Details
              </button>
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

      {filteredAndSortedSubjects.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects found</h3>
          <p className="text-gray-600">
            {searchTerm || filterDepartment || filterClass || filterTeacher
              ? "Try adjusting your search or filters."
              : "Get started by creating your first subject."
            }
          </p>
          {canCreate && (
            <div className="mt-6">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Add Subject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Bulk Create Subjects</h2>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
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
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Class</label>
                  <select
                    value={bulkFormData.class_id}
                    onChange={(e) => setBulkFormData({...bulkFormData, class_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teacher</label>
                  <select
                    value={bulkFormData.teacher_id}
                    onChange={(e) => setBulkFormData({...bulkFormData, teacher_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Subjects</h3>
                  <button
                    type="button"
                    onClick={addSubject}
                    className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700"
                  >
                    Add Subject
                  </button>
                </div>
                
                {bulkFormData.subjects.map((subject, index) => (
                  <div key={index} className="grid grid-cols-6 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={subject.name}
                        onChange={(e) => {
                          const newSubjects = [...bulkFormData.subjects]
                          newSubjects[index].name = e.target.value
                          setBulkFormData({...bulkFormData, subjects: newSubjects})
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Subject name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Code</label>
                      <input
                        type="text"
                        value={subject.code}
                        onChange={(e) => {
                          const newSubjects = [...bulkFormData.subjects]
                          newSubjects[index].code = e.target.value
                          setBulkFormData({...bulkFormData, subjects: newSubjects})
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Code"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Credits</label>
                      <input
                        type="number"
                        value={subject.credits}
                        onChange={(e) => {
                          const newSubjects = [...bulkFormData.subjects]
                          newSubjects[index].credits = parseInt(e.target.value)
                          setBulkFormData({...bulkFormData, subjects: newSubjects})
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                        min="1"
                        max="6"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Theory</label>
                      <input
                        type="number"
                        value={subject.theory_marks}
                        onChange={(e) => {
                          const newSubjects = [...bulkFormData.subjects]
                          newSubjects[index].theory_marks = parseInt(e.target.value)
                          setBulkFormData({...bulkFormData, subjects: newSubjects})
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                        min="0"
                        max="200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Practical</label>
                      <input
                        type="number"
                        value={subject.practical_marks}
                        onChange={(e) => {
                          const newSubjects = [...bulkFormData.subjects]
                          newSubjects[index].practical_marks = parseInt(e.target.value)
                          setBulkFormData({...bulkFormData, subjects: newSubjects})
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                        min="0"
                        max="200"
                      />
                    </div>
                    {bulkFormData.subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSubject(index)}
                        className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Create {bulkFormData.subjects.length} Subjects
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

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Subject Creation Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjectTemplates.map(template => (
                <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Credits:</span>
                      <span className="font-medium">{template.pattern.credits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Theory Marks:</span>
                      <span className="font-medium">{template.pattern.theory_marks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Practical Marks:</span>
                      <span className="font-medium">{template.pattern.practical_marks}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-gray-600">Subjects:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.pattern.common_subjects.map((subject, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => applyTemplate(template)}
                    className="w-full mt-4 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTemplates(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}