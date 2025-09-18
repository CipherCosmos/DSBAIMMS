'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Eye, BarChart3, Users, BookOpen } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface QuestionBank {
  id: number
  name: string
  description: string
  department_id: number
  subject_id: number
  is_public: boolean
  created_at: string
  department_name?: string
  subject_name?: string
  creator_name?: string
  questions_count?: number
}

export default function QuestionBanksPage() {
  const { user } = useAuth()
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [departments, setDepartments] = useState([])
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    loadQuestionBanks()
    loadDepartments()
    loadSubjects()
  }, [])

  const loadQuestionBanks = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getQuestionBanks()
      setQuestionBanks(data)
    } catch (error) {
      console.error('Error loading question banks:', error)
      toast.error('Failed to load question banks')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await apiClient.getDepartments()
      setDepartments(data)
    } catch (error) {
      console.error('Error loading data:', error)
      // Set empty arrays to prevent map errors
      if ('setSubjects' in this) setSubjects([])
      if ('setClasses' in this) setClasses([])
      if ('setDepartments' in this) setDepartments([])
      if ('setExams' in this) setExams([])
      if ('setMarks' in this) setMarks([])
      if ('setUsers' in this) setUsers([])
    }
  }

  const loadSubjects = async () => {
    try {
      const data = await apiClient.getSubjects()
      setSubjects(data)
    } catch (error) {
      console.error('Error loading data:', error)
      // Set empty arrays to prevent map errors
      if ('setSubjects' in this) setSubjects([])
      if ('setClasses' in this) setClasses([])
      if ('setDepartments' in this) setDepartments([])
      if ('setExams' in this) setExams([])
      if ('setMarks' in this) setMarks([])
      if ('setUsers' in this) setUsers([])
    }
  }

  const handleSearch = () => {
    loadQuestionBanks()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const bankData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      department_id: parseInt(formData.get('department_id') as string),
      subject_id: parseInt(formData.get('subject_id') as string),
      is_public: formData.get('is_public') === 'on'
    }

    try {
      await apiClient.createQuestionBank(bankData)
      toast.success('Question bank created successfully')
      setShowCreateDialog(false)
      loadQuestionBanks()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to create question bank')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question bank?')) return

    try {
      await apiClient.deleteQuestionBank(id)
      toast.success('Question bank deleted successfully')
      loadQuestionBanks()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to delete question bank')
    }
  }

  const filteredBanks = questionBanks.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <h2 className="text-2xl font-bold text-gray-900">Question Banks</h2>
          <p className="text-gray-600">Manage question banks for different subjects</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Question Bank
        </Button>
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
                placeholder="Search question banks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments && Array.isArray(departments) && departments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
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

      {/* Question Banks Grid */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBanks && Array.isArray(filteredBanks) && filteredBanks.map((bank) => (
            <div
              key={bank.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{bank.name}</h3>
                    <p className="text-sm text-gray-600">{bank.department_name} - {bank.subject_name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(bank.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4">{bank.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span>{bank.questions_count || 0} questions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{bank.creator_name}</span>
                  </div>
                </div>
                <Badge variant={bank.is_public ? "default" : "secondary"}>
                  {bank.is_public ? "Public" : "Private"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredBanks && Array.isArray(filteredBanks) && filteredBanks.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No question banks found</h3>
          <p className="text-gray-600">Get started by creating your first question bank.</p>
        </div>
      )}

      {/* Create Question Bank Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Question Bank</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input name="name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  name="department_id"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  {departments && Array.isArray(departments) && departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  name="subject_id"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Subject</option>
                  {subjects && Array.isArray(subjects) && subjects.map((subject: any) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_public"
                  id="is_public"
                  className="mr-2"
                />
                <label htmlFor="is_public" className="text-sm text-gray-700">
                  Make this question bank public
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


