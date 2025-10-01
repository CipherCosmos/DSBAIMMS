'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Upload, Download, Calculator, BarChart3, Filter, FileSpreadsheet } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Mark {
  id: number
  student_id: number
  exam_id: number
  question_id: number
  marks_obtained: number
  max_marks: number
  feedback: string
  graded_by: number
  graded_at: string
  student_name?: string
  exam_title?: string
  question_text?: string
  grader_name?: string
}

interface Exam {
  id: number
  title: string
  subject_name: string
  class_name: string
  total_marks: number
  exam_date: string
  status: string
}

interface Student {
  id: number
  name: string
  roll_number: string
  class_name: string
}

export default function MarksPage() {
  const { user } = useAuth()
  const [marks, setMarks] = useState<Mark[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadMarks()
    loadExams()
    loadStudents()
  }, [])

  const loadMarks = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getMarks()
      if (response.success) {
        setMarks(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      console.error('Error loading marks:', error)
      toast.error('Failed to load marks')
    } finally {
      setLoading(false)
    }
  }

  const loadExams = async () => {
    try {
      const response = await apiClient.getExams()
      if (response.success) {
        setExams(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      console.error('Error loading exams:', error)
      setExams([])
    }
  }

  const loadStudents = async () => {
    try {
      const response = await apiClient.getUsers()
      if (response.success) {
        setStudents(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      console.error('Error loading students:', error)
      setStudents([])
    }
  }

  const handleSearch = () => {
    loadMarks()
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!selectedExam) {
      toast.error('Please select an exam first')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      await apiClient.post('/api/marks/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { exam_id: selectedExam }
      })
      toast.success('Marks uploaded successfully')
      loadMarks()
      setShowBulkUpload(false)
    } catch (error: any) {
      toast.error(error.detail || 'Failed to upload marks')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (!selectedExam) {
      toast.error('Please select an exam first')
      return
    }

    try {
      const blob = await apiClient.downloadMarksTemplate(Number(selectedExam))
      const url = window.URL.createObjectURL(blob.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `marks_template_exam_${selectedExam}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      toast.error(error.detail || 'Failed to download template')
    }
  }

  const handleCalculateCOAttainment = async () => {
    if (!selectedExam) {
      toast.error('Please select an exam first')
      return
    }

    try {
      const result = await apiClient.calculateCOAttainment(Number(selectedExam))
      toast.success('CO Attainment calculated successfully')
      console.log('CO Attainment:', result)
    } catch (error: any) {
      toast.error(error.detail || 'Failed to calculate CO attainment')
    }
  }

  const handleDelete = async (markId: number) => {
    if (!confirm('Are you sure you want to delete this mark?')) return

    try {
      await apiClient.deleteMark(markId)
      toast.success('Mark deleted successfully')
      loadMarks()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to delete mark')
    }
  }

  const filteredMarks = marks.filter(mark =>
    mark.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mark.exam_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mark.question_text?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold text-gray-900">Marks Management</h2>
          <p className="text-gray-600">Manage student marks and calculate attainments</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBulkUpload(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={!selectedExam}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button
            onClick={handleCalculateCOAttainment}
            disabled={!selectedExam}
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calculate CO Attainment
          </Button>
        </div>
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
                placeholder="Search marks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Exams</option>
                {exams && Array.isArray(exams) && exams.map(exam => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} - {exam.subject_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Students</option>
                {students && Array.isArray(students) && students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.roll_number})
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

      {/* Marks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Marks ({filteredMarks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Student</th>
                  <th className="text-left py-3 px-4">Exam</th>
                  <th className="text-left py-3 px-4">Question</th>
                  <th className="text-left py-3 px-4">Marks</th>
                  <th className="text-left py-3 px-4">Feedback</th>
                  <th className="text-left py-3 px-4">Graded By</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarks && Array.isArray(filteredMarks) && filteredMarks.map((mark) => (
                  <tr key={mark.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">{mark.student_name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">{mark.exam_title}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm max-w-xs truncate">
                        {mark.question_text}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{mark.marks_obtained}</span>
                        <span className="text-gray-500">/ {mark.max_marks}</span>
                        <Badge variant="outline" className="ml-2">
                          {Math.round((mark.marks_obtained / mark.max_marks) * 100)}%
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm max-w-xs truncate">
                        {mark.feedback || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">{mark.grader_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {new Date(mark.graded_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
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
                          onClick={() => handleDelete(mark.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredMarks && Array.isArray(filteredMarks) && filteredMarks.length === 0 && (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No marks found</h3>
              <p className="text-gray-600">Upload marks or create them manually.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Upload Dialog */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Bulk Upload Marks</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
                <select
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Exam</option>
                  {exams && Array.isArray(exams) && exams.map(exam => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} - {exam.subject_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Excel File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={uploading || !selectedExam}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  disabled={!selectedExam}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button
                  onClick={() => setShowBulkUpload(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}