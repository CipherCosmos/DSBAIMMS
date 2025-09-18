'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Upload, Download, Users, BookOpen, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface BulkOperation {
  id: string
  type: 'users' | 'questions' | 'marks'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRecords: number
  processedRecords: number
  errors: string[]
  createdAt: string
}

export default function BulkOperationsPage() {
  const { } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'questions' | 'marks'>('users')
  const [uploading, setUploading] = useState(false)
  const [operations, setOperations] = useState<BulkOperation[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileUpload = async (type: 'users' | 'questions' | 'marks') => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      let result
      switch (type) {
        case 'users':
          result = await apiClient.bulkCreateUsers(formData)
          break
        case 'questions':
          result = await apiClient.bulkCreateQuestions(formData)
          break
        case 'marks':
          result = await apiClient.bulkCreateMarks(formData)
          break
      }

      // Add to operations list
      const newOperation: BulkOperation = {
        id: Date.now().toString(),
        type,
        status: result.success ? 'completed' : 'failed',
        totalRecords: result.processed_count,
        processedRecords: result.processed_count - result.error_count,
        errors: result.errors,
        createdAt: new Date().toISOString()
      }

      setOperations(prev => [newOperation, ...prev])
      setSelectedFile(null)

      alert(result.success ? 'Bulk operation completed successfully!' : 'Bulk operation completed with errors.')

    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Error uploading file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = (type: 'users' | 'questions' | 'marks') => {
    let headers = []
    let filename = ''

    switch (type) {
      case 'users':
        headers = ['username', 'email', 'full_name', 'role', 'department_id', 'class_id', 'student_id', 'employee_id']
        filename = 'users_template.csv'
        break
      case 'questions':
        headers = ['question_text', 'marks', 'bloom_level', 'difficulty_level', 'section_id', 'co_id', 'question_number']
        filename = 'questions_template.csv'
        break
      case 'marks':
        headers = ['student_id', 'question_id', 'marks_obtained']
        filename = 'marks_template.csv'
        break
    }

    const csvContent = headers.join(',') + '\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'processing':
        return <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      default:
        return <div className="h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
    }
  }

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'completed':
  //       return 'text-green-600'
  //     case 'failed':
  //       return 'text-red-600'
  //     case 'processing':
  //       return 'text-blue-600'
  //     default:
  //       return 'text-gray-600'
  //   }
  // }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Operations</h1>
          <p className="text-gray-600">Upload multiple records at once using Excel/CSV files</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'users', name: 'Users', icon: Users },
            { id: 'questions', name: 'Questions', icon: BookOpen },
            { id: 'marks', name: 'Marks', icon: FileText }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Upload Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold capitalize">{activeTab} Bulk Upload</h2>
            <p className="text-gray-600 mt-1">
              Upload {activeTab} data using Excel (.xlsx) or CSV files
            </p>
          </div>
          <button
            onClick={() => downloadTemplate(activeTab)}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Template
          </button>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <div className="text-center">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="mb-4">
              <label className="cursor-pointer">
                <span className="text-primary hover:text-primary/80 font-medium">
                  Click to upload
                </span>
                <span className="text-gray-600"> or drag and drop</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">
              Excel (.xlsx, .xls) or CSV files only, max 10MB
            </p>
            {selectedFile && (
              <p className="text-sm text-green-600 mt-2">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => handleFileUpload(activeTab)}
            disabled={!selectedFile || uploading}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {uploading && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      {/* Operations History */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Recent Operations</h2>

        {operations && Array.isArray(operations) && operations.length === 0 ? (
          <div className="text-center py-8">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No operations yet</h3>
            <p className="text-gray-600">Your bulk operations will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {operations && Array.isArray(operations) && operations.map((operation) => (
              <div key={operation.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(operation.status)}
                    <div>
                      <h3 className="font-medium capitalize">{operation.type} Upload</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(operation.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    operation.status === 'completed' ? 'bg-green-100 text-green-800' :
                    operation.status === 'failed' ? 'bg-red-100 text-red-800' :
                    operation.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {operation.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Records:</span>
                    <span className="ml-2 font-medium">{operation.totalRecords}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Processed:</span>
                    <span className="ml-2 font-medium">{operation.processedRecords}</span>
                  </div>
                </div>

                {operation.errors.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-red-800 mb-2">Errors:</h4>
                    <div className="max-h-32 overflow-y-auto bg-red-50 p-3 rounded text-xs text-red-700">
                      {operation.errors.map((error, index) => (
                        <div key={index} className="mb-1">{error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Upload Instructions</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>Users:</strong> Include columns: username, email, full_name, role, department_id, class_id, student_id, employee_id</p>
          <p><strong>Questions:</strong> Include columns: question_text, marks, bloom_level, difficulty_level, section_id, co_id, question_number</p>
          <p><strong>Marks:</strong> Include columns: student_id, question_id, marks_obtained</p>
          <p>• Download the template first to ensure correct column format</p>
          <p>• All required fields must be filled</p>
          <p>• Invalid records will be skipped with error messages</p>
        </div>
      </div>
    </div>
  )
}