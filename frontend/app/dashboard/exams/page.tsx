'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Play, Pause, Calendar, Clock, Users, BookOpen, Filter, Settings, BarChart3, FileText, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface Exam {
  id: number
  title: string
  description: string
  subject_id: number
  class_id: number
  exam_type: string
  status: string
  total_marks: number
  duration_minutes: number
  exam_date: string
  subject_name: string
  class_name: string
  sections_count: number
  created_at: string
}

interface ExamTemplate {
  name: string
  description: string
  exam_type: string
  duration_minutes: number
  sections: Array<{
    name: string
    instructions: string
    total_marks: number
    total_questions: number
    questions_to_attempt: number
    question_type: string
  }>
  question_distribution: {
    bloom_levels: Record<string, number>
    difficulty: Record<string, number>
  }
}

interface SmartExamCreate {
  title: string
  description?: string
  subject_id: number
  class_id: number
  exam_type: string
  duration_minutes: number
  exam_date?: string
  start_time?: string
  end_time?: string
  sections: Array<any>
  auto_generate_questions: boolean
  question_distribution?: Record<string, any>
}

export default function ExamsPage() {
  const { user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [departments, setDepartments] = useState([])
  
  // Smart exam creation state
  const [showSmartCreate, setShowSmartCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<ExamTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null)
  const [smartFormData, setSmartFormData] = useState<SmartExamCreate>({
    title: '',
    description: '',
    subject_id: 0,
    class_id: 0,
    exam_type: 'internal',
    duration_minutes: 180,
    sections: [],
    auto_generate_questions: true,
    question_distribution: {}
  })

  useEffect(() => {
    loadExams()
    loadSubjects()
    loadClasses()
    loadDepartments()
    loadTemplates()
  }, [])

  const loadExams = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getExams()
      setExams(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading exams:', error)
      toast.error('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  const loadSubjects = async () => {
    try {
      const data = await apiClient.getSubjects()
      // Ensure data is an array
      setSubjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading subjects:', error)
      setSubjects([])
    }
  }

  const loadClasses = async () => {
    try {
      const data = await apiClient.getClasses()
      setClasses(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading classes:', error)
      setClasses([])
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await apiClient.getDepartments()
      setDepartments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading departments:', error)
      setDepartments([])
    }
  }

  const loadTemplates = async () => {
    try {
      const data = await apiClient.getExamTemplates()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading templates:', error)
      setTemplates([])
    }
  }

  const handleSearch = () => {
    loadExams()
  }

  const handlePublish = async (examId: number) => {
    try {
      await apiClient.publishExam(examId)
      toast.success('Exam published successfully')
      loadExams()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to publish exam')
    }
  }

  const handleDelete = async (examId: number) => {
    if (!confirm('Are you sure you want to delete this exam?')) return

    try {
      await apiClient.deleteExam(examId)
      toast.success('Exam deleted successfully')
      loadExams()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to delete exam')
    }
  }

  // Smart exam creation functions
  const handleSmartCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.createSmartExam(smartFormData)
      toast.success('Smart exam created successfully')
      setShowSmartCreate(false)
      setSmartFormData({
        title: '',
        description: '',
        subject_id: 0,
        class_id: 0,
        exam_type: 'internal',
        duration_minutes: 180,
        sections: [],
        auto_generate_questions: true,
        question_distribution: {}
      })
      loadExams()
    } catch (error: any) {
      console.error('Error creating smart exam:', error)
      toast.error('Failed to create smart exam')
    }
  }

  const handleTemplateSelect = (template: ExamTemplate) => {
    setSelectedTemplate(template)
    setSmartFormData(prev => ({
      ...prev,
      exam_type: template.exam_type,
      duration_minutes: template.duration_minutes,
      sections: template.sections,
      question_distribution: template.question_distribution
    }))
    setShowTemplates(false)
    setShowSmartCreate(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'published':
        return 'bg-green-100 text-green-800'
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'midterm':
        return 'bg-yellow-100 text-yellow-800'
      case 'final':
        return 'bg-red-100 text-red-800'
      case 'quiz':
        return 'bg-blue-100 text-blue-800'
      case 'assignment':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const matchesSearch = !searchTerm || 
        exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.subject_name.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = !selectedType || exam.exam_type === selectedType
      const matchesStatus = !selectedStatus || exam.status === selectedStatus
      const matchesSubject = !selectedSubject || exam.subject_id.toString() === selectedSubject
      
      return matchesSearch && matchesType && matchesStatus && matchesSubject
    })
  }, [exams, searchTerm, selectedType, selectedStatus, selectedSubject])

  const canCreate = user?.role === 'admin' || user?.role === 'hod' || user?.role === 'teacher'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Exams</h2>
          <p className="text-gray-600">Manage and monitor all exams with smart creation tools</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowTemplates(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Templates
            </Button>
            <Button
              onClick={() => setShowSmartCreate(true)}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Smart Create
            </Button>
            <Link href="/dashboard/exams/create">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Manual Create
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <Input
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Subjects</option>
                {subjects && Array.isArray(subjects) && subjects.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExams && Array.isArray(filteredExams) && filteredExams.map((exam) => (
          <Card key={exam.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{exam.title}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(exam.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getTypeColor(exam.exam_type)}>
                  {exam.exam_type}
                </Badge>
                <Badge className={getStatusColor(exam.status)}>
                  {exam.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>{exam.subject_name} - {exam.class_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(exam.exam_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{exam.duration_minutes} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{exam.sections_count} sections</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm">
                  <span className="font-medium">{exam.total_marks}</span> marks
                </div>
                {exam.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(exam.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Publish
                  </Button>
                )}
                {exam.status === 'published' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Active
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredExams && Array.isArray(filteredExams) && filteredExams.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No exams found</h3>
          <p className="text-gray-600">Get started by creating your first exam.</p>
        </div>
      )}

      {/* Smart Exam Creation Modal */}
      {showSmartCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Smart Exam Creation</h2>
            <form onSubmit={handleSmartCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Exam Title</label>
                  <input
                    type="text"
                    value={smartFormData.title}
                    onChange={(e) => setSmartFormData(prev => ({...prev, title: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., Midterm Exam - Data Structures"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Exam Type</label>
                  <select
                    value={smartFormData.exam_type}
                    onChange={(e) => setSmartFormData(prev => ({...prev, exam_type: e.target.value}))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="quiz">Quiz</option>
                    <option value="assignment">Assignment</option>
                    <option value="project">Project</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={smartFormData.description}
                  onChange={(e) => setSmartFormData(prev => ({...prev, description: e.target.value}))}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="Exam description and instructions..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <select
                    value={smartFormData.subject_id}
                    onChange={(e) => setSmartFormData(prev => ({...prev, subject_id: parseInt(e.target.value)}))}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value={0}>Select Subject</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Class</label>
                  <select
                    value={smartFormData.class_id}
                    onChange={(e) => setSmartFormData(prev => ({...prev, class_id: parseInt(e.target.value)}))}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value={0}>Select Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={smartFormData.duration_minutes}
                    onChange={(e) => setSmartFormData(prev => ({...prev, duration_minutes: parseInt(e.target.value)}))}
                    className="w-full px-3 py-2 border rounded-md"
                    min="30"
                    max="480"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_generate"
                  checked={smartFormData.auto_generate_questions}
                  onChange={(e) => setSmartFormData(prev => ({...prev, auto_generate_questions: e.target.checked}))}
                  className="rounded"
                />
                <label htmlFor="auto_generate" className="text-sm font-medium">
                  Auto-generate smart sections based on exam type
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Create Smart Exam
                </button>
                <button
                  type="button"
                  onClick={() => setShowSmartCreate(false)}
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
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Exam Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium">{template.exam_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">{template.duration_minutes} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sections:</span>
                      <span className="font-medium">{template.sections.length}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
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