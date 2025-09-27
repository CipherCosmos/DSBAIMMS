'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Eye, 
  Target,
  BookOpen,
  Users,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ExamSection {
  id?: number
  name: string
  instructions: string
  total_marks: number
  total_questions: number
  questions_to_attempt: number
  section_type: 'standard' | 'optional' | 'mixed'
  optional_questions: number
  mandatory_questions: number
  question_marks: number
  is_optional_section: boolean
}

interface Question {
  id?: number
  question_text: string
  marks: number
  bloom_level: string
  difficulty_level: string
  section_id: number
  co_id: number
  parent_question_id?: number
  question_number: string
  order_index: number
  is_optional: boolean
  is_sub_question: boolean
  sub_question_text?: string
  sub_question_marks?: number
  co_weight: number
  po_auto_mapped: boolean
}

interface CO {
  id: number
  name: string
  description: string
  subject_id: number
}

interface Subject {
  id: number
  name: string
  code: string
}

interface Class {
  id: number
  name: string
  section: string
}

interface EnhancedExamFormProps {
  examId?: number
  onSave?: (exam: any) => void
  onCancel?: () => void
}

export function EnhancedExamCreationForm({ examId, onSave, onCancel }: EnhancedExamFormProps) {
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    subject_id: '',
    class_id: '',
    exam_type: 'internal',
    total_marks: 100,
    duration_minutes: 180,
    exam_date: '',
    start_time: '',
    end_time: ''
  })

  const [sections, setSections] = useState<ExamSection[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [cos, setCos] = useState<CO[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'sections' | 'questions' | 'preview'>('basic')
  const [selectedSection, setSelectedSection] = useState<ExamSection | null>(null)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)

  const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
  const difficultyLevels = ['easy', 'medium', 'hard']

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (examData.subject_id) {
      loadCOs(Number(examData.subject_id))
    }
  }, [examData.subject_id])

  const loadInitialData = async () => {
    try {
      const [subjectsData, classesData] = await Promise.all([
        apiClient.get('/api/subjects'),
        apiClient.get('/api/classes')
      ])
      setSubjects(subjectsData?.data || [])
      setClasses(classesData?.data || [])
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load initial data')
    }
  }

  const loadCOs = async (subjectId: number) => {
    try {
      const cosData = await apiClient.get(`/api/cos?subject_id=${subjectId}`)
      setCos(cosData.data || [])
    } catch (error) {
      console.error('Error loading COs:', error)
    }
  }

  const addSection = () => {
    const newSection: ExamSection = {
      name: '',
      instructions: '',
      total_marks: 0,
      total_questions: 0,
      questions_to_attempt: 0,
      section_type: 'standard',
      optional_questions: 0,
      mandatory_questions: 0,
      question_marks: 0,
      is_optional_section: false
    }
    setSections([...sections, newSection])
  }

  const updateSection = (index: number, updatedSection: ExamSection) => {
    const newSections = [...sections]
    newSections[index] = updatedSection
    
    // Auto-calculate fields based on section type
    if (updatedSection.section_type === 'optional') {
      newSections[index].mandatory_questions = 0
      newSections[index].questions_to_attempt = updatedSection.optional_questions
    } else if (updatedSection.section_type === 'mixed') {
      newSections[index].questions_to_attempt = 
        updatedSection.mandatory_questions + updatedSection.optional_questions
    } else {
      newSections[index].optional_questions = 0
      newSections[index].mandatory_questions = updatedSection.total_questions
      newSections[index].questions_to_attempt = updatedSection.total_questions
    }

    // Auto-calculate question marks
    if (updatedSection.total_questions > 0) {
      newSections[index].question_marks = updatedSection.total_marks / updatedSection.total_questions
    }

    setSections(newSections)
  }

  const deleteSection = (index: number) => {
    const newSections = sections.filter((_, i) => i !== index)
    setSections(newSections)
  }

  const addQuestion = (sectionId: number) => {
    const section = sections.find(s => sections.indexOf(s) === sectionId)
    if (!section) return

    const newQuestion: Question = {
      question_text: '',
      marks: section.question_marks || 0,
      bloom_level: 'remember',
      difficulty_level: 'medium',
      section_id: sectionId,
      co_id: cos[0]?.id || 0,
      question_number: `Q${questions.filter(q => q.section_id === sectionId).length + 1}`,
      order_index: questions.filter(q => q.section_id === sectionId).length,
      is_optional: section.section_type === 'optional' || section.section_type === 'mixed',
      is_sub_question: false,
      co_weight: 1.0,
      po_auto_mapped: false
    }

    setEditingQuestion(newQuestion)
    setShowQuestionForm(true)
  }

  const saveQuestion = (question: Question) => {
    if (editingQuestion) {
      // Update existing question
      const newQuestions = questions.map(q => 
        q === editingQuestion ? question : q
      )
      setQuestions(newQuestions)
    } else {
      // Add new question
      setQuestions([...questions, question])
    }
    setShowQuestionForm(false)
    setEditingQuestion(null)
  }

  const deleteQuestion = (questionIndex: number) => {
    const newQuestions = questions.filter((_, i) => i !== questionIndex)
    setQuestions(newQuestions)
  }

  const calculateTotalMarks = () => {
    return sections.reduce((total, section) => total + section.total_marks, 0)
  }

  const calculateTotalQuestions = () => {
    return sections.reduce((total, section) => total + section.total_questions, 0)
  }

  const validateExam = () => {
    const errors = []

    if (!examData.title) errors.push('Exam title is required')
    if (!examData.subject_id) errors.push('Subject is required')
    if (!examData.class_id) errors.push('Class is required')
    if (sections.length === 0) errors.push('At least one section is required')
    
    for (const section of sections) {
      if (!section.name) errors.push(`Section name is required`)
      if (section.total_marks <= 0) errors.push(`Section ${section.name} must have positive marks`)
      if (section.total_questions <= 0) errors.push(`Section ${section.name} must have positive question count`)
    }

    const sectionQuestions = questions.filter(q => q.section_id < sections.length)
    if (sectionQuestions.length === 0) errors.push('At least one question is required')

    return errors
  }

  const handleSave = async () => {
    const errors = validateExam()
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }

    try {
      setLoading(true)
      const examPayload = {
        ...examData,
        sections: sections.map((section, index) => ({
          ...section,
          id: section.id || `temp_${index}`,
          questions: questions.filter(q => q.section_id === index)
        }))
      }

      let savedExam
      if (examId) {
        savedExam = await apiClient.put(`/api/exams/${examId}`, examPayload)
      } else {
        savedExam = await apiClient.post('/api/exams', examPayload)
      }

      toast.success('Exam saved successfully')
      onSave?.(savedExam)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save exam')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'basic', name: 'Basic Info', icon: Info },
    { id: 'sections', name: 'Sections', icon: FileText },
    { id: 'questions', name: 'Questions', icon: Target },
    { id: 'preview', name: 'Preview', icon: Eye }
  ]

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {examId ? 'Edit Exam' : 'Create New Exam'}
        </h2>
        <p className="text-gray-600">
          Create comprehensive exams with optional questions and advanced features
        </p>
      </div>

      {/* Progress Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exam Title *
              </label>
              <input
                type="text"
                value={examData.title}
                onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter exam title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exam Type
              </label>
              <select
                value={examData.exam_type}
                onChange={(e) => setExamData({ ...examData, exam_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="project">Project</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={examData.description}
              onChange={(e) => setExamData({ ...examData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter exam description"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <select
                value={examData.subject_id}
                onChange={(e) => setExamData({ ...examData, subject_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class *
              </label>
              <select
                value={examData.class_id}
                onChange={(e) => setExamData({ ...examData, class_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - {cls.section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Marks
              </label>
              <input
                type="number"
                value={examData.total_marks}
                onChange={(e) => setExamData({ ...examData, total_marks: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={examData.duration_minutes}
                onChange={(e) => setExamData({ ...examData, duration_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exam Date
              </label>
              <input
                type="date"
                value={examData.exam_date}
                onChange={(e) => setExamData({ ...examData, exam_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Exam Sections</h3>
            <button
              onClick={addSection}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </button>
          </div>

          {sections.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sections added</h3>
              <p className="text-gray-600 mb-4">Add sections to organize your exam questions</p>
              <button
                onClick={addSection}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Section
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section, index) => (
                <SectionCard
                  key={index}
                  section={section}
                  index={index}
                  onUpdate={(updatedSection) => updateSection(index, updatedSection)}
                  onDelete={() => deleteSection(index)}
                />
              ))}
            </div>
          )}

          {/* Section Summary */}
          {sections.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Section Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Total Sections:</span>
                  <span className="ml-2 font-medium">{sections.length}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Marks:</span>
                  <span className="ml-2 font-medium">{calculateTotalMarks()}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Questions:</span>
                  <span className="ml-2 font-medium">{calculateTotalQuestions()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
            <div className="text-sm text-gray-600">
              {questions.length} questions added
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="text-center py-12 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-yellow-900 mb-2">No sections available</h3>
              <p className="text-yellow-700">Please add sections first before adding questions</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((section, sectionIndex) => {
                const sectionQuestions = questions.filter(q => q.section_id === sectionIndex)
                return (
                  <div key={sectionIndex} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-medium text-gray-900">{section.name}</h4>
                        <p className="text-sm text-gray-600">
                          {sectionQuestions.length} questions • {section.total_marks} marks
                        </p>
                      </div>
                      <button
                        onClick={() => addQuestion(sectionIndex)}
                        className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Question
                      </button>
                    </div>

                    {sectionQuestions.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No questions in this section</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sectionQuestions.map((question, questionIndex) => (
                          <QuestionCard
                            key={questionIndex}
                            question={question}
                            onEdit={() => {
                              setEditingQuestion(question)
                              setShowQuestionForm(true)
                            }}
                            onDelete={() => deleteQuestion(questions.indexOf(question))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Exam Preview</h3>
          
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="text-xl font-bold">{examData.title || 'Untitled Exam'}</h2>
              <p className="text-gray-600">{examData.description}</p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
              <div>
                <span className="font-medium">Type:</span> {examData.exam_type}
              </div>
              <div>
                <span className="font-medium">Duration:</span> {examData.duration_minutes} minutes
              </div>
              <div>
                <span className="font-medium">Total Marks:</span> {calculateTotalMarks()}
              </div>
              <div>
                <span className="font-medium">Total Questions:</span> {calculateTotalQuestions()}
              </div>
            </div>

            <div className="space-y-4">
              {sections.map((section, index) => {
                const sectionQuestions = questions.filter(q => q.section_id === index)
                return (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{section.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{section.instructions}</p>
                    <p className="text-sm">
                      <span className="font-medium">Marks:</span> {section.total_marks} • 
                      <span className="font-medium ml-2">Questions:</span> {sectionQuestions.length} • 
                      <span className="font-medium ml-2">Attempt:</span> {section.questions_to_attempt}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <div className="flex space-x-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Exam
              </>
            )}
          </button>
        </div>
      </div>

      {/* Question Form Modal */}
      {showQuestionForm && (
        <QuestionForm
          question={editingQuestion}
          cos={cos}
          bloomLevels={bloomLevels}
          difficultyLevels={difficultyLevels}
          onSubmit={saveQuestion}
          onCancel={() => {
            setShowQuestionForm(false)
            setEditingQuestion(null)
          }}
        />
      )}
    </div>
  )
}

// Section Card Component
interface SectionCardProps {
  section: ExamSection
  index: number
  onUpdate: (section: ExamSection) => void
  onDelete: () => void
}

function SectionCard({ section, index, onUpdate, onDelete }: SectionCardProps) {
  const handleChange = (field: keyof ExamSection, value: any) => {
    onUpdate({ ...section, [field]: value })
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section Name *
          </label>
          <input
            type="text"
            value={section.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Section A"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section Type
          </label>
          <select
            value={section.section_type}
            onChange={(e) => handleChange('section_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="standard">Standard (All questions mandatory)</option>
            <option value="optional">Optional (Choose questions to attempt)</option>
            <option value="mixed">Mixed (Some mandatory, some optional)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Instructions
        </label>
        <textarea
          value={section.instructions}
          onChange={(e) => handleChange('instructions', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Section instructions for students"
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Marks *
          </label>
          <input
            type="number"
            value={section.total_marks}
            onChange={(e) => handleChange('total_marks', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Questions *
          </label>
          <input
            type="number"
            value={section.total_questions}
            onChange={(e) => handleChange('total_questions', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {section.section_type === 'mixed' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mandatory Questions
              </label>
              <input
                type="number"
                value={section.mandatory_questions}
                onChange={(e) => handleChange('mandatory_questions', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Optional Questions
              </label>
              <input
                type="number"
                value={section.optional_questions}
                onChange={(e) => handleChange('optional_questions', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        {section.section_type === 'optional' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Questions to Attempt
            </label>
            <input
              type="number"
              value={section.questions_to_attempt}
              onChange={(e) => handleChange('questions_to_attempt', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={onDelete}
          className="flex items-center px-3 py-1 text-red-600 hover:text-red-800"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </button>
      </div>
    </div>
  )
}

// Question Card Component
interface QuestionCardProps {
  question: Question
  onEdit: () => void
  onDelete: () => void
}

function QuestionCard({ question, onEdit, onDelete }: QuestionCardProps) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm">{question.question_number}</span>
          {question.is_optional && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Optional
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-700 mb-2 line-clamp-2">
        {question.question_text}
      </p>
      <div className="flex items-center space-x-4 text-xs text-gray-500">
        <span>{question.marks} marks</span>
        <span>{question.bloom_level}</span>
        <span>{question.difficulty_level}</span>
      </div>
    </div>
  )
}

// Question Form Component
interface QuestionFormProps {
  question: Question | null
  cos: CO[]
  bloomLevels: string[]
  difficultyLevels: string[]
  onSubmit: (question: Question) => void
  onCancel: () => void
}

function QuestionForm({ question, cos, bloomLevels, difficultyLevels, onSubmit, onCancel }: QuestionFormProps) {
  const [formData, setFormData] = useState({
    question_text: question?.question_text || '',
    marks: question?.marks || 0,
    bloom_level: question?.bloom_level || 'remember',
    difficulty_level: question?.difficulty_level || 'medium',
    co_id: question?.co_id || cos[0]?.id || 0,
    question_number: question?.question_number || '',
    is_optional: question?.is_optional || false,
    is_sub_question: question?.is_sub_question || false,
    sub_question_text: question?.sub_question_text || '',
    sub_question_marks: question?.sub_question_marks || 0,
    co_weight: question?.co_weight || 1.0,
    po_auto_mapped: question?.po_auto_mapped || false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData as Question)
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {question ? 'Edit Question' : 'Add New Question'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text *
              </label>
              <textarea
                value={formData.question_text}
                onChange={(e) => handleChange('question_text', e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the question text"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marks *
                </label>
                <input
                  type="number"
                  value={formData.marks}
                  onChange={(e) => handleChange('marks', Number(e.target.value))}
                  required
                  min="0"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bloom&apos;s Level
                </label>
                <select
                  value={formData.bloom_level}
                  onChange={(e) => handleChange('bloom_level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {bloomLevels.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty_level}
                  onChange={(e) => handleChange('difficulty_level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Outcome (CO)
              </label>
              <select
                value={formData.co_id}
                onChange={(e) => handleChange('co_id', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {cos.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.name}: {co.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_optional}
                  onChange={(e) => handleChange('is_optional', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Optional Question</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.po_auto_mapped}
                  onChange={(e) => handleChange('po_auto_mapped', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Auto-map to PO</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {question ? 'Update' : 'Add'} Question
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}