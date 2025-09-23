'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, Search, Edit, Trash2, Eye, Play, Pause, Calendar, Clock, 
  Users, BookOpen, Filter, Settings, BarChart3, FileText, Zap,
  Upload, Download, Calculator, Target, Brain, TrendingUp, RefreshCw
} from 'lucide-react'
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

interface Section {
  id: number
  name: string
  instructions: string
  total_marks: number
  total_questions: number
  questions_to_attempt: number
  section_type: string
  optional_questions: number
  mandatory_questions: number
  question_marks: number
  is_optional_section: boolean
}

interface Question {
  id: number
  question_text: string
  marks: number
  bloom_level: string
  difficulty_level: string
  section_id: number
  co_id: number
  question_number: string
  is_optional: boolean
  is_sub_question: boolean
  sub_question_text?: string
  sub_question_marks?: number
  co_weight: number
  po_auto_mapped: boolean
}

interface Student {
  id: number
  student_id: string
  full_name: string
  class_id: number
}

interface SmartMarksResult {
  section_id: number
  section_name: string
  mandatory_marks: number
  optional_marks: number
  total_marks: number
  max_possible: number
  percentage: number
  mandatory_questions: number
  optional_questions: number
  questions_attempted: number
  mandatory_details: any[]
  optional_details: any[]
}

export default function EnhancedExamsPage() {
  const { user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  
  // Enhanced exam creation state
  const [showCreateExam, setShowCreateExam] = useState(false)
  const [showMarksEntry, setShowMarksEntry] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [smartMarksResult, setSmartMarksResult] = useState<SmartMarksResult | null>(null)

  useEffect(() => {
    loadExams()
    loadSubjects()
    loadClasses()
  }, [])

  const loadExams = async () => {
    try {
      const response = await apiClient.getExams()
      setExams(response)
    } catch (error) {
      console.error('Error loading exams:', error)
      toast.error('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  const loadSubjects = async () => {
    try {
      const response = await apiClient.getSubjects()
      setSubjects(response)
    } catch (error) {
      console.error('Error loading subjects:', error)
    }
  }

  const loadClasses = async () => {
    try {
      const response = await apiClient.getClasses()
      setClasses(response)
    } catch (error) {
      console.error('Error loading classes:', error)
    }
  }

  const loadExamDetails = async (examId: number) => {
    try {
      const [sectionsResponse, questionsResponse, studentsResponse] = await Promise.all([
        apiClient.get(`/api/exams/${examId}/sections`),
        apiClient.get(`/api/exams/${examId}/questions`),
        apiClient.getUsers({ role: 'student', class_id: selectedExam?.class_id })
      ])
      
      setSections(sectionsResponse)
      setQuestions(questionsResponse)
      setStudents(studentsResponse)
    } catch (error) {
      console.error('Error loading exam details:', error)
      toast.error('Failed to load exam details')
    }
  }

  const calculateSmartMarks = async (studentId: number, sectionId: number) => {
    try {
      const response = await apiClient.post(`/api/marks/smart-calculation`, {
        exam_id: selectedExam?.id,
        student_id: studentId,
        section_id: sectionId
      })
      setSmartMarksResult(response)
    } catch (error) {
      console.error('Error calculating smart marks:', error)
      toast.error('Failed to calculate smart marks')
    }
  }

  const exportAnalytics = async (examId: number, format: string) => {
    try {
      const response = await apiClient.get(`/api/exams/${examId}/export/analytics?format=${format}`)
      
      // Create download link
      const blob = new Blob([response], { 
        type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `exam_${examId}_analytics.${format === 'excel' ? 'xlsx' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success(`Analytics exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Error exporting analytics:', error)
      toast.error('Failed to export analytics')
    }
  }

  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = !selectedType || exam.exam_type === selectedType
      const matchesStatus = !selectedStatus || exam.status === selectedStatus
      const matchesSubject = !selectedSubject || exam.subject_id.toString() === selectedSubject
      
      return matchesSearch && matchesType && matchesStatus && matchesSubject
    })
  }, [exams, searchTerm, selectedType, selectedStatus, selectedSubject])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'published': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'internal': return 'bg-purple-100 text-purple-800'
      case 'external': return 'bg-orange-100 text-orange-800'
      case 'quiz': return 'bg-pink-100 text-pink-800'
      case 'assignment': return 'bg-indigo-100 text-indigo-800'
      default: return 'bg-gray-100 text-gray-800'
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
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Exam Management</h1>
          <p className="text-gray-600">Comprehensive exam management with smart marks calculation and analytics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateExam(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Exam
          </Button>
          <Button variant="outline" onClick={() => loadExams()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="internal">Internal</option>
              <option value="external">External</option>
              <option value="quiz">Quiz</option>
              <option value="assignment">Assignment</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {subjects.map((subject: any) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setSelectedType('')
              setSelectedStatus('')
              setSelectedSubject('')
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExams.map((exam) => (
          <Card key={exam.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{exam.title}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatusColor(exam.status)}>
                    {exam.status}
                  </Badge>
                  <Badge className={getTypeColor(exam.exam_type)}>
                    {exam.exam_type}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <BookOpen className="w-4 h-4 mr-2" />
                  {exam.subject_name}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  {exam.class_name}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Target className="w-4 h-4 mr-2" />
                  {exam.total_marks} marks
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  {exam.duration_minutes} minutes
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {exam.sections_count} sections
                </div>
                {exam.exam_date && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(exam.exam_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedExam(exam)
                    loadExamDetails(exam.id)
                    setShowMarksEntry(true)
                  }}
                  className="flex-1"
                >
                  <Calculator className="w-4 h-4 mr-1" />
                  Marks Entry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedExam(exam)
                    loadExamDetails(exam.id)
                    setShowAnalytics(true)
                  }}
                  className="flex-1"
                >
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Analytics
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAnalytics(exam.id, 'excel')}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Smart Marks Entry Modal */}
      {showMarksEntry && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Smart Marks Entry - {selectedExam.title}</h2>
              <Button variant="outline" onClick={() => setShowMarksEntry(false)}>
                Close
              </Button>
            </div>
            
            <Tabs defaultValue="sections" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="marks">Marks Entry</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sections" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {sections.map((section) => (
                    <Card key={section.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">Section {section.name}</CardTitle>
                        <p className="text-sm text-gray-600">{section.instructions}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Total Marks:</span>
                            <span className="text-sm">{section.total_marks}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Total Questions:</span>
                            <span className="text-sm">{section.total_questions}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">To Attempt:</span>
                            <span className="text-sm">{section.questions_to_attempt}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Optional:</span>
                            <span className="text-sm">{section.optional_questions}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Mandatory:</span>
                            <span className="text-sm">{section.mandatory_questions}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="questions" className="space-y-4">
                <div className="space-y-4">
                  {sections.map((section) => (
                    <Card key={section.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">Section {section.name} Questions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {questions
                            .filter(q => q.section_id === section.id)
                            .map((question) => (
                            <div key={question.id} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline">{question.question_number}</Badge>
                                    <Badge className={question.is_optional ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                                      {question.is_optional ? 'Optional' : 'Mandatory'}
                                    </Badge>
                                    <Badge variant="outline">{question.bloom_level}</Badge>
                                    <Badge variant="outline">{question.difficulty_level}</Badge>
                                  </div>
                                  <p className="text-sm text-gray-700">{question.question_text}</p>
                                  {question.is_sub_question && question.sub_question_text && (
                                    <p className="text-sm text-gray-600 mt-2 ml-4">
                                      <strong>Sub-question:</strong> {question.sub_question_text}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">{question.marks} marks</div>
                                  <div className="text-xs text-gray-500">CO Weight: {question.co_weight}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="marks" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Students</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {students.map((student) => (
                        <div key={student.id} className="p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{student.full_name}</div>
                              <div className="text-sm text-gray-600">ID: {student.student_id}</div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => calculateSmartMarks(student.id, sections[0]?.id)}
                            >
                              Calculate Marks
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Smart Marks Result</h3>
                    {smartMarksResult ? (
                      <Card>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {smartMarksResult.percentage}%
                              </div>
                              <div className="text-sm text-gray-600">
                                {smartMarksResult.total_marks} / {smartMarksResult.max_possible} marks
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="font-medium">Mandatory Marks</div>
                                <div className="text-gray-600">{smartMarksResult.mandatory_marks}</div>
                              </div>
                              <div>
                                <div className="font-medium">Optional Marks</div>
                                <div className="text-gray-600">{smartMarksResult.optional_marks}</div>
                              </div>
                              <div>
                                <div className="font-medium">Questions Attempted</div>
                                <div className="text-gray-600">{smartMarksResult.questions_attempted}</div>
                              </div>
                              <div>
                                <div className="font-medium">Section</div>
                                <div className="text-gray-600">{smartMarksResult.section_name}</div>
                              </div>
                            </div>
                            
                            <div className="pt-3 border-t">
                              <div className="text-sm font-medium mb-2">Question Details:</div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {smartMarksResult.mandatory_details.map((detail, index) => (
                                  <div key={index} className="flex justify-between text-xs">
                                    <span>Q{detail.question_number} (M)</span>
                                    <span>{detail.marks_obtained}/{detail.max_marks}</span>
                                  </div>
                                ))}
                                {smartMarksResult.optional_details.map((detail, index) => (
                                  <div key={index} className="flex justify-between text-xs">
                                    <span>Q{detail.question_number} (O) {detail.is_selected ? '✓' : '✗'}</span>
                                    <span>{detail.marks_obtained}/{detail.max_marks}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        Select a student to calculate smart marks
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Analytics - {selectedExam.title}</h2>
              <div className="flex gap-2">
                <Button onClick={() => exportAnalytics(selectedExam.id, 'excel')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={() => exportAnalytics(selectedExam.id, 'csv')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => setShowAnalytics(false)}>
                  Close
                </Button>
              </div>
            </div>
            
            <div className="text-center text-gray-500 py-8">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>Analytics data will be loaded here</p>
              <p className="text-sm">CO/PO attainment, Bloom&apos;s distribution, difficulty analysis, and more</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

