'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, Trash2, Save, Eye, Target, Brain, Zap, 
  Calculator, Settings, BookOpen, Users, Clock
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Section {
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
  question_text: string
  marks: number
  bloom_level: string
  difficulty_level: string
  co_id: number
  question_number: string
  is_optional: boolean
  is_sub_question: boolean
  sub_question_text?: string
  sub_question_marks?: number
  co_weight: number
  po_auto_mapped: boolean
}

interface ExamFormData {
  title: string
  description: string
  subject_id: number
  class_id: number
  exam_type: string
  duration_minutes: number
  total_marks: number
  exam_date: string
  start_time: string
  end_time: string
  sections: Section[]
}

interface EnhancedExamCreationFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function EnhancedExamCreationForm({ onClose, onSuccess }: EnhancedExamCreationFormProps) {
  const [formData, setFormData] = useState<ExamFormData>({
    title: '',
    description: '',
    subject_id: 0,
    class_id: 0,
    exam_type: 'internal',
    duration_minutes: 180,
    total_marks: 100,
    exam_date: '',
    start_time: '',
    end_time: '',
    sections: []
  })

  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [cos, setCos] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
  const difficultyLevels = ['easy', 'medium', 'hard']
  const examTypes = [
    { value: 'internal', label: 'Internal Exam', description: 'Standard internal examination' },
    { value: 'external', label: 'External Exam', description: 'External/board examination' },
    { value: 'quiz', label: 'Quiz', description: 'Quick assessment quiz' },
    { value: 'assignment', label: 'Assignment', description: 'Project-based assignment' }
  ]

  useEffect(() => {
    loadSubjects()
    loadClasses()
    loadCos()
  }, [])

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

  const loadCos = async () => {
    try {
      const response = await apiClient.getCos()
      setCos(response)
    } catch (error) {
      console.error('Error loading COs:', error)
    }
  }

  const generateSmartSections = () => {
    const sections: Section[] = []
    
    if (formData.exam_type === 'internal') {
      // Section A: 20% - Short answers
      sections.push({
        name: 'A',
        instructions: 'Answer all questions. Each question carries 2 marks.',
        total_marks: Math.round(formData.total_marks * 0.2),
        total_questions: Math.round(formData.total_marks * 0.1),
        questions_to_attempt: Math.round(formData.total_marks * 0.1),
        section_type: 'mandatory',
        optional_questions: 0,
        mandatory_questions: Math.round(formData.total_marks * 0.1),
        question_marks: 2,
        is_optional_section: false
      })
      
      // Section B: 40% - Long answers with optional questions
      const sectionBMarks = Math.round(formData.total_marks * 0.4)
      const sectionBQuestions = 6
      const sectionBToAttempt = 4
      sections.push({
        name: 'B',
        instructions: `Answer any ${sectionBToAttempt} out of ${sectionBQuestions} questions. Each question carries ${Math.round(sectionBMarks / sectionBToAttempt)} marks.`,
        total_marks: sectionBMarks,
        total_questions: sectionBQuestions,
        questions_to_attempt: sectionBToAttempt,
        section_type: 'optional',
        optional_questions: sectionBQuestions - sectionBToAttempt,
        mandatory_questions: 0,
        question_marks: Math.round(sectionBMarks / sectionBToAttempt),
        is_optional_section: true
      })
      
      // Section C: 40% - Essay questions with optional questions
      const sectionCMarks = Math.round(formData.total_marks * 0.4)
      const sectionCQuestions = 4
      const sectionCToAttempt = 2
      sections.push({
        name: 'C',
        instructions: `Answer any ${sectionCToAttempt} out of ${sectionCQuestions} questions. Each question carries ${Math.round(sectionCMarks / sectionCToAttempt)} marks.`,
        total_marks: sectionCMarks,
        total_questions: sectionCQuestions,
        questions_to_attempt: sectionCToAttempt,
        section_type: 'optional',
        optional_questions: sectionCQuestions - sectionCToAttempt,
        mandatory_questions: 0,
        question_marks: Math.round(sectionCMarks / sectionCToAttempt),
        is_optional_section: true
      })
    } else if (formData.exam_type === 'quiz') {
      sections.push({
        name: 'Quiz',
        instructions: 'Answer all questions. Each question carries equal marks.',
        total_marks: formData.total_marks,
        total_questions: 20,
        questions_to_attempt: 20,
        section_type: 'mandatory',
        optional_questions: 0,
        mandatory_questions: 20,
        question_marks: Math.round(formData.total_marks / 20),
        is_optional_section: false
      })
    }
    
    setFormData(prev => ({ ...prev, sections }))
    toast.success('Smart sections generated successfully!')
  }

  const addSection = () => {
    const newSection: Section = {
      name: String.fromCharCode(65 + formData.sections.length), // A, B, C, etc.
      instructions: '',
      total_marks: 0,
      total_questions: 0,
      questions_to_attempt: 0,
      section_type: 'mandatory',
      optional_questions: 0,
      mandatory_questions: 0,
      question_marks: 0,
      is_optional_section: false
    }
    
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
  }

  const updateSection = (index: number, field: keyof Section, value: any) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.map((section, i) => 
        i === index ? { ...section, [field]: value } : section
      )
    }))
  }

  const removeSection = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }))
  }

  const calculateTotalMarks = () => {
    return formData.sections.reduce((total, section) => total + section.total_marks, 0)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      // Validate form
      if (!formData.title || !formData.subject_id || !formData.class_id) {
        toast.error('Please fill in all required fields')
        return
      }
      
      if (formData.sections.length === 0) {
        toast.error('Please add at least one section')
        return
      }
      
      // Update total marks based on sections
      const calculatedTotal = calculateTotalMarks()
      const examData = {
        ...formData,
        total_marks: calculatedTotal
      }
      
      await apiClient.createExam(examData)
      toast.success('Exam created successfully!')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating exam:', error)
      toast.error('Failed to create exam')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Create Enhanced Exam</h2>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exam Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Exam Title *</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter exam title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Exam Type *</label>
                    <select
                      value={formData.exam_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, exam_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {examTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter exam description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Subject *</label>
                    <select
                      value={formData.subject_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject_id: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Select Subject</option>
                      {subjects.map((subject: any) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Class *</label>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, class_id: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Select Class</option>
                      {classes.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                    <Input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                      placeholder="180"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Total Marks</label>
                    <Input
                      type="number"
                      value={formData.total_marks}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_marks: parseInt(e.target.value) }))}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Calculated Total</label>
                    <Input
                      value={calculateTotalMarks()}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Exam Date</label>
                    <Input
                      type="date"
                      value={formData.exam_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, exam_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Time</label>
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">End Time</label>
                    <Input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Exam Sections</CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={generateSmartSections} variant="outline">
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Smart Sections
                    </Button>
                    <Button onClick={addSection}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Section
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.sections.map((section, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">Section {section.name}</CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeSection(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Instructions</label>
                            <textarea
                              value={section.instructions}
                              onChange={(e) => updateSection(index, 'instructions', e.target.value)}
                              placeholder="Enter section instructions"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Section Type</label>
                            <select
                              value={section.section_type}
                              onChange={(e) => updateSection(index, 'section_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="mandatory">Mandatory</option>
                              <option value="optional">Optional</option>
                              <option value="mixed">Mixed</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Total Marks</label>
                            <Input
                              type="number"
                              value={section.total_marks}
                              onChange={(e) => updateSection(index, 'total_marks', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Total Questions</label>
                            <Input
                              type="number"
                              value={section.total_questions}
                              onChange={(e) => updateSection(index, 'total_questions', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">To Attempt</label>
                            <Input
                              type="number"
                              value={section.questions_to_attempt}
                              onChange={(e) => updateSection(index, 'questions_to_attempt', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Question Marks</label>
                            <Input
                              type="number"
                              value={section.question_marks}
                              onChange={(e) => updateSection(index, 'question_marks', parseInt(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Mandatory Questions</label>
                            <Input
                              type="number"
                              value={section.mandatory_questions}
                              onChange={(e) => updateSection(index, 'mandatory_questions', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Optional Questions</label>
                            <Input
                              type="number"
                              value={section.optional_questions}
                              onChange={(e) => updateSection(index, 'optional_questions', parseInt(e.target.value))}
                            />
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={section.is_optional_section}
                              onChange={(e) => updateSection(index, 'is_optional_section', e.target.checked)}
                              className="mr-2"
                            />
                            <label className="text-sm font-medium">Optional Section</label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Questions Management</CardTitle>
                <p className="text-sm text-gray-600">
                  Questions will be managed after exam creation. You can add questions to each section.
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Questions will be added after exam creation</p>
                  <p className="text-sm text-gray-400">
                    You can add questions with Bloom's taxonomy, difficulty levels, CO mapping, and optional questions
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exam Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{formData.title}</h3>
                      <p className="text-gray-600">{formData.description}</p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-blue-100 text-blue-800">
                        {formData.exam_type}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Duration</div>
                      <div className="text-gray-600">{formData.duration_minutes} minutes</div>
                    </div>
                    <div>
                      <div className="font-medium">Total Marks</div>
                      <div className="text-gray-600">{calculateTotalMarks()}</div>
                    </div>
                    <div>
                      <div className="font-medium">Sections</div>
                      <div className="text-gray-600">{formData.sections.length}</div>
                    </div>
                    <div>
                      <div className="font-medium">Questions</div>
                      <div className="text-gray-600">
                        {formData.sections.reduce((total, section) => total + section.total_questions, 0)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Sections:</h4>
                    <div className="space-y-2">
                      {formData.sections.map((section, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">Section {section.name}</div>
                              <div className="text-sm text-gray-600">{section.instructions}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div>{section.total_marks} marks</div>
                              <div>{section.questions_to_attempt} of {section.total_questions} questions</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Exam'}
          </Button>
        </div>
      </div>
    </div>
  )
}

