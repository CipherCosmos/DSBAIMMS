'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Database, Plus, Edit, Trash2, Save, X, Eye, 
  RefreshCw, Download, Upload, Filter, Search,
  BookOpen, Target, Award, Users, Calendar, Building,
  FileText, BarChart3, Clock, CheckCircle, XCircle
} from 'lucide-react'

interface QuestionBank {
  id: number
  name: string
  description?: string
  department_id: number
  department_name?: string
  subject_id?: number
  subject_name?: string
  is_public: boolean
  created_by: number
  created_by_name?: string
  question_count: number
  created_at: string
  updated_at?: string
}

interface QuestionBankItem {
  id: number
  question_bank_id: number
  question_text: string
  marks: number
  bloom_level: string
  difficulty_level: string
  co_id?: number
  co_name?: string
  question_type: string
  options?: string[]
  correct_answer?: string
  explanation?: string
  created_at: string
}

interface Department {
  id: number
  name: string
  code: string
}

interface Subject {
  id: number
  name: string
  code: string
  department_id: number
}

interface CO {
  id: number
  name: string
  description: string
  subject_id: number
}

export default function QuestionBanksPage() {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([])
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cos, setCos] = useState<CO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null)
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null)
  const [filterDepartment, setFilterDepartment] = useState<number | null>(null)
  const [filterSubject, setFilterSubject] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'banks' | 'questions'>('banks')

  const [bankFormData, setBankFormData] = useState({
    name: '',
    description: '',
    department_id: 0,
    subject_id: 0,
    is_public: false
  })

  const [questionFormData, setQuestionFormData] = useState({
    question_bank_id: 0,
    question_text: '',
    marks: 1,
    bloom_level: 'remember',
    difficulty_level: 'easy',
    co_id: 0,
    question_type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: ''
  })

  const bloomLevels = [
    { value: 'remember', label: 'Remember' },
    { value: 'understand', label: 'Understand' },
    { value: 'apply', label: 'Apply' },
    { value: 'analyze', label: 'Analyze' },
    { value: 'evaluate', label: 'Evaluate' },
    { value: 'create', label: 'Create' }
  ]

  const difficultyLevels = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ]

  const questionTypes = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True/False' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' },
    { value: 'fill_blank', label: 'Fill in the Blank' }
  ]

  useEffect(() => {
    loadData()
  }, [filterDepartment, filterSubject, selectedBank])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [banksResponse, departmentsResponse, subjectsResponse, cosResponse] = await Promise.all([
        apiClient.get('/api/questionbanks'),
        apiClient.get('/api/departments'),
        apiClient.get('/api/subjects'),
        apiClient.get('/api/cos')
      ])

      let banksData = banksResponse.data || []
      const departmentsData = departmentsResponse.data || []
      const subjectsData = subjectsResponse.data || []
      const cosData = cosResponse.data || []

      // Filter by department if selected
      if (filterDepartment) {
        banksData = banksData.filter((b: QuestionBank) => b.department_id === filterDepartment)
      }

      // Filter by subject if selected
      if (filterSubject) {
        banksData = banksData.filter((b: QuestionBank) => b.subject_id === filterSubject)
      }

      // Filter by search term
      if (searchTerm) {
        banksData = banksData.filter((b: QuestionBank) => 
          b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setQuestionBanks(banksData)
      setDepartments(departmentsData)
      setSubjects(subjectsData)
      setCos(cosData)

      // Load questions if a bank is selected
      if (selectedBank) {
        try {
          const questionsResponse = await apiClient.get(`/api/questionbanks/${selectedBank.id}/questions`)
          setQuestionBankItems(questionsResponse.data || [])
        } catch (error) {
          console.error('Error loading questions:', error)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load question banks')
    } finally {
      setLoading(false)
    }
  }

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingBank) {
        await apiClient.put(`/api/questionbanks/${editingBank.id}`, bankFormData)
      } else {
        await apiClient.post('/api/questionbanks', bankFormData)
      }
      setShowBankForm(false)
      setEditingBank(null)
      setBankFormData({
        name: '',
        description: '',
        department_id: 0,
        subject_id: 0,
        is_public: false
      })
      loadData()
    } catch (error) {
      console.error('Error saving question bank:', error)
      setError('Failed to save question bank')
    }
  }

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingQuestion) {
        await apiClient.put(`/api/questionbanks/${selectedBank?.id}/questions/${editingQuestion.id}`, questionFormData)
      } else {
        await apiClient.post(`/api/questionbanks/${selectedBank?.id}/questions`, questionFormData)
      }
      setShowQuestionForm(false)
      setEditingQuestion(null)
      setQuestionFormData({
        question_bank_id: selectedBank?.id || 0,
        question_text: '',
        marks: 1,
        bloom_level: 'remember',
        difficulty_level: 'easy',
        co_id: 0,
        question_type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: '',
        explanation: ''
      })
      loadData()
    } catch (error) {
      console.error('Error saving question:', error)
      setError('Failed to save question')
    }
  }

  const handleBankEdit = (bank: QuestionBank) => {
    setEditingBank(bank)
    setBankFormData({
      name: bank.name,
      description: bank.description || '',
      department_id: bank.department_id,
      subject_id: bank.subject_id || 0,
      is_public: bank.is_public
    })
    setShowBankForm(true)
  }

  const handleQuestionEdit = (question: QuestionBankItem) => {
    setEditingQuestion(question)
    setQuestionFormData({
      question_bank_id: question.question_bank_id,
      question_text: question.question_text,
      marks: question.marks,
      bloom_level: question.bloom_level,
      difficulty_level: question.difficulty_level,
      co_id: question.co_id || 0,
      question_type: question.question_type,
      options: question.options || ['', '', '', ''],
      correct_answer: question.correct_answer || '',
      explanation: question.explanation || ''
    })
    setShowQuestionForm(true)
  }

  const handleBankDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question bank?')) return

    try {
      await apiClient.delete(`/api/questionbanks/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting question bank:', error)
      setError('Failed to delete question bank')
    }
  }

  const handleQuestionDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      await apiClient.delete(`/api/questionbanks/${selectedBank?.id}/questions/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting question:', error)
      setError('Failed to delete question')
    }
  }

  const handleBankSelect = (bank: QuestionBank) => {
    setSelectedBank(bank)
    setActiveTab('questions')
  }

  const exportData = async () => {
    try {
      const data = activeTab === 'banks' ? questionBanks : questionBankItems
      const csvContent = convertToCSV(data)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${activeTab === 'banks' ? 'question-banks' : 'questions'}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]
          return typeof value === 'object' ? JSON.stringify(value) : value
        }).join(',')
      )
    ]
    return csvRows.join('\n')
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
          <h1 className="text-3xl font-bold text-gray-900">Question Bank Management</h1>
          <p className="text-gray-600">Manage question banks and questions</p>
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
            onClick={() => setShowBankForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question Bank
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('banks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'banks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="h-4 w-4 inline mr-2" />
            Question Banks
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'questions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            disabled={!selectedBank}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Questions {selectedBank && `(${selectedBank.name})`}
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={filterDepartment || ''}
              onChange={(e) => setFilterDepartment(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search question banks..."
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

      {/* Question Banks Tab */}
      {activeTab === 'banks' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question Bank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {questionBanks.map((bank) => (
                <tr key={bank.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleBankSelect(bank)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Database className="h-5 w-5 text-blue-500 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{bank.name}</div>
                        <div className="text-sm text-gray-500">{bank.description || 'No description'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-1" />
                      {bank.department_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {bank.subject_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-1" />
                      {bank.question_count} questions
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      bank.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {bank.is_public ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBankEdit(bank)
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBankDelete(bank.id)
                        }}
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
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && selectedBank && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Questions in {selectedBank.name}
            </h3>
            <button
              onClick={() => setShowQuestionForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bloom Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CO</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questionBankItems.map((question) => (
                  <tr key={question.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {question.question_text}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {question.question_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {question.marks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        {question.bloom_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        question.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                        question.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {question.difficulty_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {question.co_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleQuestionEdit(question)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleQuestionDelete(question.id)}
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
        </div>
      )}

      {/* Question Bank Form Modal */}
      {showBankForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingBank ? 'Edit Question Bank' : 'Add New Question Bank'}
            </h3>
            <form onSubmit={handleBankSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  placeholder="Data Structures Question Bank"
                  value={bankFormData.name}
                  onChange={(e) => setBankFormData({ ...bankFormData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  placeholder="Question bank description..."
                  value={bankFormData.description}
                  onChange={(e) => setBankFormData({ ...bankFormData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <select
                  value={bankFormData.department_id}
                  onChange={(e) => setBankFormData({ ...bankFormData, department_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value={0}>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <select
                  value={bankFormData.subject_id}
                  onChange={(e) => setBankFormData({ ...bankFormData, subject_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select Subject (Optional)</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={bankFormData.is_public}
                  onChange={(e) => setBankFormData({ ...bankFormData, is_public: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">Public (visible to all users)</label>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBankForm(false)
                    setEditingBank(null)
                    setBankFormData({
                      name: '',
                      description: '',
                      department_id: 0,
                      subject_id: 0,
                      is_public: false
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
                  {editingBank ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Form Modal */}
      {showQuestionForm && selectedBank && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </h3>
            <form onSubmit={handleQuestionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Question Text</label>
                <textarea
                  placeholder="Enter your question here..."
                  value={questionFormData.question_text}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Marks</label>
                  <input
                    type="number"
                    min="1"
                    value={questionFormData.marks}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, marks: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bloom Level</label>
                  <select
                    value={questionFormData.bloom_level}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, bloom_level: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    {bloomLevels.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Difficulty</label>
                  <select
                    value={questionFormData.difficulty_level}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, difficulty_level: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    {difficultyLevels.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Question Type</label>
                  <select
                    value={questionFormData.question_type}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_type: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    {questionTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course Outcome</label>
                  <select
                    value={questionFormData.co_id}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, co_id: Number(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value={0}>Select CO (Optional)</option>
                    {cos.map((co) => (
                      <option key={co.id} value={co.id}>{co.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Options for multiple choice questions */}
              {questionFormData.question_type === 'multiple_choice' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                  {questionFormData.options.map((option, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <input
                        type="radio"
                        name="correct_answer"
                        value={option}
                        checked={questionFormData.correct_answer === option}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                        className="mr-2"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...questionFormData.options]
                          newOptions[index] = e.target.value
                          setQuestionFormData({ ...questionFormData, options: newOptions })
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Correct answer for other question types */}
              {questionFormData.question_type !== 'multiple_choice' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                  <input
                    type="text"
                    value={questionFormData.correct_answer}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                    placeholder="Enter correct answer..."
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Explanation</label>
                <textarea
                  placeholder="Explanation for the answer..."
                  value={questionFormData.explanation}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionForm(false)
                    setEditingQuestion(null)
                    setQuestionFormData({
                      question_bank_id: selectedBank?.id || 0,
                      question_text: '',
                      marks: 1,
                      bloom_level: 'remember',
                      difficulty_level: 'easy',
                      co_id: 0,
                      question_type: 'multiple_choice',
                      options: ['', '', '', ''],
                      correct_answer: '',
                      explanation: ''
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
                  {editingQuestion ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}