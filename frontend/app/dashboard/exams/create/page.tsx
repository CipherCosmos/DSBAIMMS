'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus, Save, Eye, Trash2, Clock, Calendar, BookOpen, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface Subject {
  id: number
  name: string
  code: string
  department_name: string
}

interface Class {
  id: number
  name: string
  department_name: string
}

interface CO {
  id: number
  name: string
  description: string
  subject_id: number
}

interface ExamSection {
  id?: number
  name: string
  description: string
  total_marks: number
  questions: Question[]
}

interface Question {
  id?: number
  question_text: string
  question_type: string
  marks: number
  difficulty_level: string
  bloom_level: string
  co_id: number
  sub_questions?: Question[]
}

export default function CreateExamPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [cos, setCos] = useState<CO[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Exam form data
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    subject_id: '',
    class_id: '',
    exam_type: 'midterm',
    total_marks: 0,
    duration_minutes: 120,
    exam_date: '',
    instructions: ''
  })

  const [sections, setSections] = useState<ExamSection[]>([
    {
      name: 'Section A',
      description: 'Multiple Choice Questions',
      total_marks: 0,
      questions: []
    }
  ])

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [subjectsData, classesData, cosData] = await Promise.all([
        apiClient.getSubjects(),
        apiClient.getClasses(),
        apiClient.getCOs()
      ])
      // Ensure data is an array
      setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
      setClasses(Array.isArray(classesData) ? classesData : [])
      setCos(Array.isArray(cosData) ? cosData : [])
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load initial data')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setExamData(prev => ({ ...prev, [field]: value }))
  }

  const addSection = () => {
    const sectionNumber = sections.length + 1
    setSections(prev => [...prev, {
      name: `Section ${String.fromCharCode(64 + sectionNumber)}`,
      description: '',
      total_marks: 0,
      questions: []
    }])
  }

  const removeSection = (index: number) => {
    if (sections.length > 1) {
      setSections(prev => prev.filter((_, i) => i !== index))
    }
  }

  const updateSection = (index: number, field: string, value: any) => {
    setSections(prev => prev.map((section, i) => 
      i === index ? { ...section, [field]: value } : section
    ))
  }

  const addQuestion = (sectionIndex: number) => {
    const newQuestion: Question = {
      question_text: '',
      question_type: 'multiple_choice',
      marks: 1,
      difficulty_level: 'medium',
      bloom_level: 'remember',
      co_id: cos[0]?.id || 0,
      sub_questions: []
    }

    setSections(prev => prev.map((section, i) => 
      i === sectionIndex 
        ? { ...section, questions: [...section.questions, newQuestion] }
        : section
    ))
  }

  const removeQuestion = (sectionIndex: number, questionIndex: number) => {
    setSections(prev => prev.map((section, i) => 
      i === sectionIndex 
        ? { ...section, questions: section.questions.filter((_, qIndex) => qIndex !== questionIndex) }
        : section
    ))
  }

  const updateQuestion = (sectionIndex: number, questionIndex: number, field: string, value: any) => {
    setSections(prev => prev.map((section, i) => 
      i === sectionIndex 
        ? {
            ...section,
            questions: section.questions.map((question, qIndex) => 
              qIndex === questionIndex ? { ...question, [field]: value } : question
            )
          }
        : section
    ))
  }

  const calculateTotalMarks = () => {
    return sections.reduce((total, section) => 
      total + section.questions.reduce((sectionTotal, question) => 
        sectionTotal + question.marks, 0
      ), 0
    )
  }

  const handleSave = async () => {
    if (!examData.title || !examData.subject_id || !examData.class_id) {
      toast.error('Please fill in all required fields')
      return
    }

    const totalMarks = calculateTotalMarks()
    if (totalMarks === 0) {
      toast.error('Please add at least one question')
      return
    }

    setSaving(true)
    try {
      // Create exam
      const examResponse = await apiClient.createExam({
        title: examData.title,
        description: examData.description,
        subject_id: parseInt(examData.subject_id),
        exam_type: examData.exam_type,
        total_marks: examData.total_marks,
        duration_minutes: examData.duration_minutes,
        exam_date: examData.exam_date,
        class_id: parseInt(examData.class_id)
      })

      // Create sections and questions
      for (const section of sections) {
        if (section.questions.length > 0) {
          const sectionResponse = await apiClient.createExamSection({
            exam_id: examResponse.id,
            name: section.name,
            description: section.description,
            total_marks: section.total_marks
          })

          for (const question of section.questions) {
            await apiClient.createQuestion({
              exam_id: examResponse.id,
              section_id: sectionResponse.id,
              question_text: question.question_text,
              question_type: question.question_type,
              marks: question.marks,
              difficulty_level: question.difficulty_level,
              bloom_level: question.bloom_level,
              co_id: question.co_id
            })
          }
        }
      }

      toast.success('Exam created successfully!')
      router.push('/dashboard/exams')
    } catch (error: any) {
      toast.error(error.detail || 'Failed to create exam')
    } finally {
      setSaving(false)
    }
  }

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
          <h2 className="text-2xl font-bold text-gray-900">Create New Exam</h2>
          <p className="text-gray-600">Design and configure your exam with sections and questions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Exam'}
          </Button>
        </div>
      </div>

      {/* Exam Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Exam Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title *</label>
              <Input
                value={examData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter exam title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <select
                value={examData.subject_id}
                onChange={(e) => handleInputChange('subject_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Subject</option>
                {subjects && Array.isArray(subjects) && subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
              <select
                value={examData.class_id}
                onChange={(e) => handleInputChange('class_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Class</option>
                {classes && Array.isArray(classes) && classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.department_name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
              <select
                value={examData.exam_type}
                onChange={(e) => handleInputChange('exam_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <Input
                type="number"
                value={examData.duration_minutes}
                onChange={(e) => handleInputChange('duration_minutes', parseInt(e.target.value))}
                placeholder="120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label>
              <Input
                type="datetime-local"
                value={examData.exam_date}
                onChange={(e) => handleInputChange('exam_date', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={examData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter exam description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              value={examData.instructions}
              onChange={(e) => handleInputChange('instructions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter exam instructions for students"
            />
          </div>
        </CardContent>
      </Card>

      {/* Exam Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Exam Sections</h3>
          <Button onClick={addSection} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        {sections && Array.isArray(sections) && sections.map((section, sectionIndex) => (
          <Card key={sectionIndex}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {section.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {section.questions.length} questions
                  </Badge>
                  <Badge variant="outline">
                    {section.questions.reduce((total, q) => total + q.marks, 0)} marks
                  </Badge>
                  {sections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSection(sectionIndex)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section Name</label>
                  <Input
                    value={section.name}
                    onChange={(e) => updateSection(sectionIndex, 'name', e.target.value)}
                    placeholder="Section A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Input
                    value={section.description}
                    onChange={(e) => updateSection(sectionIndex, 'description', e.target.value)}
                    placeholder="Multiple Choice Questions"
                  />
                </div>
              </div>

              {/* Questions in this section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Questions</h4>
                  <Button
                    onClick={() => addQuestion(sectionIndex)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>

                {section.questions && Array.isArray(section.questions) && section.questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-4">
                      <h5 className="font-medium">Question {questionIndex + 1}</h5>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(sectionIndex, questionIndex)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                        <textarea
                          value={question.question_text}
                          onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'question_text', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Enter your question here..."
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                          <Input
                            type="number"
                            value={question.marks}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'marks', parseInt(e.target.value))}
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={question.question_type}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'question_type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="short_answer">Short Answer</option>
                            <option value="essay">Essay</option>
                            <option value="true_false">True/False</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                          <select
                            value={question.difficulty_level}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'difficulty_level', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                          <select
                            value={question.bloom_level}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'bloom_level', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="remember">Remember</option>
                            <option value="understand">Understand</option>
                            <option value="apply">Apply</option>
                            <option value="analyze">Analyze</option>
                            <option value="evaluate">Evaluate</option>
                            <option value="create">Create</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Outcome (CO)</label>
                        <select
                          value={question.co_id}
                          onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'co_id', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {cos && Array.isArray(cos) && cos.filter(co => co.subject_id === parseInt(examData.subject_id)).map(co => (
                            <option key={co.id} value={co.id}>
                              {co.name} - {co.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exam Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Exam Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{sections.length}</div>
              <div className="text-sm text-gray-600">Sections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {sections.reduce((total, section) => total + section.questions.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{calculateTotalMarks()}</div>
              <div className="text-sm text-gray-600">Total Marks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{examData.duration_minutes}</div>
              <div className="text-sm text-gray-600">Duration (min)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
