'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Save, X } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ExamSection {
  name: string
  instructions: string
  total_marks: number
  total_questions: number
  questions_to_attempt: number
}

interface Question {
  question_text: string
  marks: number
  bloom_level: string
  difficulty_level: string
  co_id: number
  question_number: string
  is_optional: boolean
  sub_questions?: {
    text: string
    marks: number
  }[]
}

interface ExamCreationFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function ExamCreationForm({ onClose, onSuccess }: ExamCreationFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [cos, setCos] = useState<any[]>([])
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    subject_id: '',
    class_id: '',
    exam_type: 'INTERNAL',
    total_marks: 0,
    duration_minutes: 180,
    exam_date: '',
    start_time: '',
    end_time: ''
  })
  const [sections, setSections] = useState<ExamSection[]>([
    { name: 'A', instructions: 'Answer all questions', total_marks: 20, total_questions: 6, questions_to_attempt: 4 },
    { name: 'B', instructions: 'Answer all questions', total_marks: 30, total_questions: 4, questions_to_attempt: 4 },
    { name: 'C', instructions: 'Answer all questions', total_marks: 50, total_questions: 3, questions_to_attempt: 3 }
  ])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentSection, setCurrentSection] = useState('A')
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [questionForm, setQuestionForm] = useState<Question>({
    question_text: '',
    marks: 0,
    bloom_level: 'REMEMBER',
    difficulty_level: 'MEDIUM',
    co_id: 0,
    question_number: '',
    is_optional: false,
    sub_questions: []
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [subjectsData, classesData, cosData] = await Promise.all([
        apiClient.getSubjects({ teacher_id: user?.id }),
        apiClient.getClasses(),
        apiClient.getCOs()
      ])
      setSubjects(subjectsData)
      setClasses(classesData)
      setCos(cosData)
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load data')
    }
  }

  const handleExamDataChange = (field: string, value: any) => {
    setExamData(prev => ({ ...prev, [field]: value }))
  }

  const handleSectionChange = (index: number, field: string, value: any) => {
    const newSections = [...sections]
    newSections[index] = { ...newSections[index], [field]: value }
    setSections(newSections)
    
    // Recalculate total marks
    const totalMarks = newSections.reduce((sum, section) => sum + section.total_marks, 0)
    setExamData(prev => ({ ...prev, total_marks: totalMarks }))
  }

  const addSection = () => {
    const newSection: ExamSection = {
      name: String.fromCharCode(65 + sections.length), // A, B, C, D, etc.
      instructions: 'Answer all questions',
      total_marks: 0,
      total_questions: 0,
      questions_to_attempt: 0
    }
    setSections([...sections, newSection])
  }

  const removeSection = (index: number) => {
    if (sections.length > 1) {
      const newSections = sections.filter((_, i) => i !== index)
      setSections(newSections)
    }
  }

  const handleQuestionChange = (field: string, value: any) => {
    setQuestionForm(prev => ({ ...prev, [field]: value }))
  }

  const addSubQuestion = () => {
    setQuestionForm(prev => ({
      ...prev,
      sub_questions: [...(prev.sub_questions || []), { text: '', marks: 0 }]
    }))
  }

  const removeSubQuestion = (index: number) => {
    setQuestionForm(prev => ({
      ...prev,
      sub_questions: prev.sub_questions?.filter((_, i) => i !== index) || []
    }))
  }

  const handleSubQuestionChange = (index: number, field: string, value: any) => {
    setQuestionForm(prev => ({
      ...prev,
      sub_questions: prev.sub_questions?.map((sq, i) => 
        i === index ? { ...sq, [field]: value } : sq
      ) || []
    }))
  }

  const addQuestion = () => {
    if (!questionForm.question_text.trim()) {
      toast.error('Question text is required')
      return
    }

    const newQuestion: Question = {
      ...questionForm,
      question_number: `${currentSection}${questions.filter(q => q.question_number.startsWith(currentSection)).length + 1}`
    }

    setQuestions([...questions, newQuestion])
    setQuestionForm({
      question_text: '',
      marks: 0,
      bloom_level: 'REMEMBER',
      difficulty_level: 'MEDIUM',
      co_id: 0,
      question_number: '',
      is_optional: false,
      sub_questions: []
    })
    setShowQuestionForm(false)
    toast.success('Question added successfully')
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!examData.title || !examData.subject_id || !examData.class_id) {
      toast.error('Please fill in all required fields')
      return
    }

    if (sections.length === 0) {
      toast.error('At least one section is required')
      return
    }

    if (questions.length === 0) {
      toast.error('At least one question is required')
      return
    }

    setLoading(true)
    try {
      // Create exam
      const examResponse = await apiClient.createExam({
        ...examData,
        subject_id: parseInt(examData.subject_id),
        class_id: parseInt(examData.class_id),
        total_marks: sections.reduce((sum, section) => sum + section.total_marks, 0)
      })

      const examId = examResponse.id

      // Create sections
      for (const section of sections) {
        await apiClient.createExamSection({
          exam_id: examId,
          ...section
        })
      }

      // Create questions
      for (const question of questions) {
        if (question.sub_questions && question.sub_questions.length > 0) {
          // Create enhanced question with sub-questions
          await apiClient.createEnhancedQuestion({
            exam_id: examId,
            section_name: currentSection,
            main_question: {
              question_text: question.question_text,
              marks: question.marks,
              bloom_level: question.bloom_level,
              difficulty_level: question.difficulty_level,
              co_id: question.co_id,
              question_number: question.question_number,
              is_optional: question.is_optional
            },
            sub_questions: question.sub_questions.map(sq => ({
              text: sq.text,
              marks: sq.marks
            }))
          })
        } else {
          // Create regular question
          await apiClient.createQuestion({
            exam_id: examId,
            section_name: currentSection,
            ...question
          })
        }
      }

      toast.success('Exam created successfully')
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Create New Exam</h2>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exam Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Exam Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Exam Title *</Label>
                  <Input
                    id="title"
                    value={examData.title}
                    onChange={(e) => handleExamDataChange('title', e.target.value)}
                    placeholder="Enter exam title"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={examData.description}
                    onChange={(e) => handleExamDataChange('description', e.target.value)}
                    placeholder="Enter exam description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Select value={examData.subject_id} onValueChange={(value) => handleExamDataChange('subject_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map(subject => (
                          <SelectItem key={subject.id} value={subject.id.toString()}>
                            {subject.name} ({subject.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="class">Class *</Label>
                    <Select value={examData.class_id} onValueChange={(value) => handleExamDataChange('class_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(cls => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name} - {cls.section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={examData.duration_minutes}
                      onChange={(e) => handleExamDataChange('duration_minutes', parseInt(e.target.value))}
                      min="30"
                      max="480"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exam_date">Exam Date</Label>
                    <Input
                      id="exam_date"
                      type="date"
                      value={examData.exam_date}
                      onChange={(e) => handleExamDataChange('exam_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={examData.start_time}
                      onChange={(e) => handleExamDataChange('start_time', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sections Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Exam Sections
                  <Button onClick={addSection} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Section
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sections.map((section, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">Section {section.name}</h4>
                      {sections.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSection(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Total Questions</Label>
                        <Input
                          type="number"
                          value={section.total_questions}
                          onChange={(e) => handleSectionChange(index, 'total_questions', parseInt(e.target.value))}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label>Questions to Attempt</Label>
                        <Input
                          type="number"
                          value={section.questions_to_attempt}
                          onChange={(e) => handleSectionChange(index, 'questions_to_attempt', parseInt(e.target.value))}
                          min="1"
                          max={section.total_questions}
                        />
                      </div>
                      <div>
                        <Label>Total Marks</Label>
                        <Input
                          type="number"
                          value={section.total_marks}
                          onChange={(e) => handleSectionChange(index, 'total_marks', parseInt(e.target.value))}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label>Instructions</Label>
                        <Input
                          value={section.instructions}
                          onChange={(e) => handleSectionChange(index, 'instructions', e.target.value)}
                          placeholder="Section instructions"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-sm text-gray-600">
                  <strong>Total Exam Marks:</strong> {sections.reduce((sum, section) => sum + section.total_marks, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Questions Management */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Questions Management
                <div className="flex gap-2">
                  <Select value={currentSection} onValueChange={setCurrentSection}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map(section => (
                        <SelectItem key={section.name} value={section.name}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setShowQuestionForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Question
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No questions added yet. Click &quot;Add Question&quot; to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{question.question_number}</span>
                          {question.is_optional && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Optional
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{question.question_text}</p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Marks: {question.marks}</span>
                        <span>Bloom: {question.bloom_level}</span>
                        <span>Difficulty: {question.difficulty_level}</span>
                        <span>CO: {question.co_id}</span>
                      </div>
                      {question.sub_questions && question.sub_questions.length > 0 && (
                        <div className="mt-2 ml-4">
                          <p className="text-xs font-medium text-gray-600 mb-1">Sub-questions:</p>
                          {question.sub_questions.map((sq, sqIndex) => (
                            <div key={sqIndex} className="text-xs text-gray-600">
                              {sqIndex + 1}. {sq.text} ({sq.marks} marks)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Question Form Modal */}
          {showQuestionForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
              <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Add Question to Section {currentSection}</h3>
                    <Button variant="ghost" onClick={() => setShowQuestionForm(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="question_text">Question Text *</Label>
                      <Textarea
                        id="question_text"
                        value={questionForm.question_text}
                        onChange={(e) => handleQuestionChange('question_text', e.target.value)}
                        placeholder="Enter the question text"
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="marks">Marks *</Label>
                        <Input
                          id="marks"
                          type="number"
                          value={questionForm.marks}
                          onChange={(e) => handleQuestionChange('marks', parseInt(e.target.value))}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="co_id">Course Outcome *</Label>
                        <Select value={questionForm.co_id.toString()} onValueChange={(value) => handleQuestionChange('co_id', parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CO" />
                          </SelectTrigger>
                          <SelectContent>
                            {cos.map(co => (
                              <SelectItem key={co.id} value={co.id.toString()}>
                                {co.name} - {co.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bloom_level">Bloom&apos;s Level</Label>
                        <Select value={questionForm.bloom_level} onValueChange={(value) => handleQuestionChange('bloom_level', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="REMEMBER">Remember</SelectItem>
                            <SelectItem value="UNDERSTAND">Understand</SelectItem>
                            <SelectItem value="APPLY">Apply</SelectItem>
                            <SelectItem value="ANALYZE">Analyze</SelectItem>
                            <SelectItem value="EVALUATE">Evaluate</SelectItem>
                            <SelectItem value="CREATE">Create</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="difficulty_level">Difficulty Level</Label>
                        <Select value={questionForm.difficulty_level} onValueChange={(value) => handleQuestionChange('difficulty_level', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EASY">Easy</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HARD">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_optional"
                        checked={questionForm.is_optional}
                        onCheckedChange={(checked) => handleQuestionChange('is_optional', checked)}
                      />
                      <Label htmlFor="is_optional">This is an optional question</Label>
                    </div>

                    {/* Sub-questions */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label>Sub-questions (Optional)</Label>
                        <Button onClick={addSubQuestion} size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Sub-question
                        </Button>
                      </div>
                      {questionForm.sub_questions?.map((sq, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            value={sq.text}
                            onChange={(e) => handleSubQuestionChange(index, 'text', e.target.value)}
                            placeholder="Sub-question text"
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={sq.marks}
                            onChange={(e) => handleSubQuestionChange(index, 'marks', parseInt(e.target.value))}
                            placeholder="Marks"
                            className="w-20"
                            min="0"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubQuestion(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button onClick={addQuestion} disabled={loading}>
                        <Save className="h-4 w-4 mr-1" />
                        Add Question
                      </Button>
                      <Button variant="outline" onClick={() => setShowQuestionForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
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
    </div>
  )
}
