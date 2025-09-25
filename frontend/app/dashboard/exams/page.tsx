'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { EnhancedExamCreationForm } from '@/components/exams/EnhancedExamCreationForm'
import { 
  Award, Plus, Edit, Trash2, Save, X, Eye, 
  RefreshCw, Download, Upload, Filter, Search,
  Users, BookOpen, Calendar, Building, Clock, FileText, Target
} from 'lucide-react'

interface Exam {
  id: number
  title: string
  description?: string
  subject_id: number
  subject_name?: string
  class_id: number
  class_name?: string
  exam_type: string
  status: string
  total_marks: number
  duration_minutes: number
  exam_date?: string
  start_time?: string
  end_time?: string
  created_at: string
  updated_at?: string
}

interface Subject {
  id: number
  name: string
  code: string
  class_id: number
  class_name?: string
}

interface Class {
  id: number
  name: string
  department_id: number
  department_name?: string
}

interface ExamSection {
  id: number
  exam_id: number
  name: string
  instructions?: string
  total_marks: number
  total_questions: number
  questions_to_attempt: number
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [examSections, setExamSections] = useState<ExamSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showEnhancedForm, setShowEnhancedForm] = useState(false)
  const [editingExam, setEditingExam] = useState<Exam | null>(null)
  const [filterSubject, setFilterSubject] = useState<number | null>(null)
  const [filterClass, setFilterClass] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject_id: 0,
    class_id: 0,
    exam_type: 'internal',
    duration_minutes: 180,
    exam_date: '',
    start_time: '',
    end_time: ''
  })

  const examTypes = [
    { value: 'internal', label: 'Internal' },
    { value: 'external', label: 'External' },
    { value: 'assignment', label: 'Assignment' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'project', label: 'Project' }
  ]

  const examStatuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' }
  ]

  useEffect(() => {
    loadData()
  }, [filterSubject, filterClass, filterStatus])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [examsResponse, subjectsResponse, classesResponse] = await Promise.all([
        apiClient.get('/api/exams'),
        apiClient.get('/api/subjects'),
        apiClient.get('/api/classes')
      ])

      let examsData = examsResponse.data || []
      const subjectsData = subjectsResponse.data || []
      const classesData = classesResponse.data || []

      // Filter by subject if selected
      if (filterSubject) {
        examsData = examsData.filter((e: Exam) => e.subject_id === filterSubject)
      }

      // Filter by class if selected
      if (filterClass) {
        examsData = examsData.filter((e: Exam) => e.class_id === filterClass)
      }

      // Filter by status if selected
      if (filterStatus) {
        examsData = examsData.filter((e: Exam) => e.status === filterStatus)
      }

      // Filter by search term
      if (searchTerm) {
        examsData = examsData.filter((e: Exam) => 
          e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setExams(examsData)
      setSubjects(subjectsData)
      setClasses(classesData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingExam) {
        await apiClient.put(`/api/exams/${editingExam.id}`, formData)
      } else {
        await apiClient.post('/api/exams', formData)
      }
      setShowForm(false)
      setEditingExam(null)
      setFormData({
        title: '',
        description: '',
        subject_id: 0,
        class_id: 0,
        exam_type: 'internal',
        duration_minutes: 180,
        exam_date: '',
        start_time: '',
        end_time: ''
      })
      loadData()
    } catch (error) {
      console.error('Error saving exam:', error)
      setError('Failed to save exam')
    }
  }

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam)
    setFormData({
      title: exam.title,
      description: exam.description || '',
      subject_id: exam.subject_id,
      class_id: exam.class_id,
      exam_type: exam.exam_type,
      duration_minutes: exam.duration_minutes,
      exam_date: exam.exam_date || '',
      start_time: exam.start_time || '',
      end_time: exam.end_time || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this exam?')) return

    try {
      await apiClient.delete(`/api/exams/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting exam:', error)
      setError('Failed to delete exam')
    }
  }

  const handleStatusChange = async (exam: Exam, newStatus: string) => {
    try {
      await apiClient.put(`/api/exams/${exam.id}`, {
        ...exam,
        status: newStatus
      })
      loadData()
    } catch (error) {
      console.error('Error updating exam status:', error)
      setError('Failed to update exam status')
    }
  }

  const exportData = async () => {
    try {
      const csvContent = convertToCSV(exams)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'exams.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: Exam[]) => {
    if (data.length === 0) return ''
    
    const headers = ['ID', 'Title', 'Subject', 'Class', 'Type', 'Status', 'Total Marks', 'Duration', 'Exam Date']
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        row.title,
        row.subject_name || '',
        row.class_name || '',
        row.exam_type,
        row.status,
        row.total_marks,
        row.duration_minutes,
        row.exam_date || ''
      ].join(','))
    ]
    return csvRows.join('\n')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'published':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'archived':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'internal':
        return 'bg-purple-100 text-purple-800'
      case 'external':
        return 'bg-red-100 text-red-800'
      case 'assignment':
        return 'bg-blue-100 text-blue-800'
      case 'quiz':
        return 'bg-green-100 text-green-800'
      case 'project':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Exam Management</h1>
          <p className="text-gray-600">Manage exams and their configurations</p>
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
            onClick={() => setShowEnhancedForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Exam
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={filterSubject || ''}
              onChange={(e) => setFilterSubject(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Statuses</option>
              {examStatuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
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
                placeholder="Search exams..."
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

      {/* Exams Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Award className="h-5 w-5 text-blue-500 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{exam.title}</div>
                      <div className="text-sm text-gray-500">{exam.description || 'No description'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    {exam.subject_name || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {exam.class_name || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(exam.exam_type)}`}>
                    {exam.exam_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    value={exam.status}
                    onChange={(e) => handleStatusChange(exam, e.target.value)}
                    className={`px-2 py-1 text-xs font-medium rounded-full border-0 ${getStatusColor(exam.status)}`}
                  >
                    {examStatuses.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="text-xs">
                    <div className="flex items-center">
                      <Target className="h-3 w-3 mr-1" />
                      {exam.total_marks} marks
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {exam.duration_minutes} min
                    </div>
                    {exam.exam_date && (
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(exam.exam_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(exam)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
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

      {/* Enhanced Form Modal */}
      {showEnhancedForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto z-50">
          <div className="relative">
            <EnhancedExamCreationForm
              examId={editingExam?.id}
              onSave={(exam) => {
                setShowEnhancedForm(false)
                setEditingExam(null)
                loadData()
              }}
              onCancel={() => {
                setShowEnhancedForm(false)
                setEditingExam(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Simple Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingExam ? 'Edit Exam' : 'Add New Exam'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Exam Title</label>
                <input
                  type="text"
                  placeholder="Mid-term Examination"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  placeholder="Exam description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <select
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    <option value={0}>Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Exam Type</label>
                  <select
                    value={formData.exam_type}
                    onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    {examTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                  <input
                    type="number"
                    min="30"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Exam Date</label>
                  <input
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingExam(null)
                    setFormData({
                      title: '',
                      description: '',
                      subject_id: 0,
                      class_id: 0,
                      exam_type: 'internal',
                      duration_minutes: 180,
                      exam_date: '',
                      start_time: '',
                      end_time: ''
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
                  {editingExam ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}