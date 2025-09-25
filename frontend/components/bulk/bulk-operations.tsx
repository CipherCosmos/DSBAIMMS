'use client'

import { useState, useRef } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Upload, Download, FileText, Users, BookOpen, Award, 
  CheckCircle, XCircle, AlertCircle, FileSpreadsheet,
  Database, RefreshCw, Eye, Trash2, Edit
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BulkUploadResponse {
  success_count: number
  error_count: number
  errors: Array<{
    row?: number
    field?: string
    error: string
    data?: any
  }>
  message: string
}

interface BulkOperation {
  id: string
  name: string
  description: string
  icon: any
  endpoint: string
  templateUrl: string
  fields: Array<{
    name: string
    type: 'text' | 'number' | 'email' | 'date' | 'select'
    required: boolean
    options?: string[]
  }>
}

const bulkOperations: BulkOperation[] = [
  {
    id: 'users',
    name: 'Bulk User Upload',
    description: 'Upload multiple users (students, teachers, HODs) at once',
    icon: Users,
    endpoint: '/api/users/bulk',
    templateUrl: '/templates/bulk-users-template.csv',
    fields: [
      { name: 'username', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'first_name', type: 'text', required: true },
      { name: 'last_name', type: 'text', required: true },
      { name: 'role', type: 'select', required: true, options: ['admin', 'hod', 'teacher', 'student'] },
      { name: 'department_id', type: 'number', required: false },
      { name: 'class_id', type: 'number', required: false },
      { name: 'student_id', type: 'text', required: false },
      { name: 'employee_id', type: 'text', required: false },
      { name: 'phone', type: 'text', required: false },
      { name: 'date_of_birth', type: 'date', required: false }
    ]
  },
  {
    id: 'subjects',
    name: 'Bulk Subject Upload',
    description: 'Upload multiple subjects with CO/PO mappings',
    icon: BookOpen,
    endpoint: '/api/subjects/bulk',
    templateUrl: '/templates/bulk-subjects-template.csv',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'code', type: 'text', required: true },
      { name: 'credits', type: 'number', required: true },
      { name: 'theory_marks', type: 'number', required: true },
      { name: 'practical_marks', type: 'number', required: false },
      { name: 'department_id', type: 'number', required: true },
      { name: 'class_id', type: 'number', required: true },
      { name: 'teacher_id', type: 'number', required: true },
      { name: 'semester_id', type: 'number', required: true }
    ]
  },
  {
    id: 'questions',
    name: 'Bulk Question Upload',
    description: 'Upload multiple questions for exams with CO/PO mappings',
    icon: FileText,
    endpoint: '/api/exams/bulk-questions',
    templateUrl: '/templates/bulk-questions-template.csv',
    fields: [
      { name: 'exam_id', type: 'number', required: true },
      { name: 'section_name', type: 'text', required: true },
      { name: 'question_text', type: 'text', required: true },
      { name: 'marks', type: 'number', required: true },
      { name: 'bloom_level', type: 'select', required: true, options: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] },
      { name: 'difficulty_level', type: 'select', required: true, options: ['easy', 'medium', 'hard'] },
      { name: 'co_id', type: 'number', required: true },
      { name: 'is_optional', type: 'select', required: false, options: ['true', 'false'] },
      { name: 'question_number', type: 'text', required: false },
      { name: 'order_index', type: 'number', required: false }
    ]
  },
  {
    id: 'marks',
    name: 'Bulk Marks Upload',
    description: 'Upload exam marks for multiple students',
    icon: Award,
    endpoint: '/api/exams/bulk-marks',
    templateUrl: '/templates/bulk-marks-template.csv',
    fields: [
      { name: 'exam_id', type: 'number', required: true },
      { name: 'student_id', type: 'number', required: true },
      { name: 'question_id', type: 'number', required: true },
      { name: 'marks_obtained', type: 'number', required: true },
      { name: 'remarks', type: 'text', required: false }
    ]
  },
  {
    id: 'co-po-mappings',
    name: 'CO/PO Mappings Upload',
    description: 'Upload Course Outcome and Program Outcome mappings',
    icon: Database,
    endpoint: '/api/co-po/bulk',
    templateUrl: '/templates/bulk-co-po-template.csv',
    fields: [
      { name: 'co_id', type: 'number', required: true },
      { name: 'po_id', type: 'number', required: true },
      { name: 'mapping_strength', type: 'number', required: true },
      { name: 'justification', type: 'text', required: false }
    ]
  }
]

export function BulkOperations() {
  const router = useRouter()
  const [selectedOperation, setSelectedOperation] = useState<BulkOperation | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (!selectedOperation) return

    setUploading(true)
    setUploadResult(null)

    const formData = new FormData()
    formData.append('file', file)

    apiClient.post(selectedOperation.endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    .then(response => {
      setUploadResult(response.data)
    })
    .catch(error => {
      console.error('Upload error:', error)
      setUploadResult({
        success_count: 0,
        error_count: 1,
        errors: [{ error: error.response?.data?.message || 'Upload failed' }],
        message: 'Upload failed'
      })
    })
    .finally(() => {
      setUploading(false)
    })
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const downloadTemplate = (operation: BulkOperation) => {
    const link = document.createElement('a')
    link.href = operation.templateUrl
    link.download = `${operation.name}-template.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const generateSampleData = (operation: BulkOperation) => {
    const headers = operation.fields.map(field => field.name)
    const sampleRow = operation.fields.map(field => {
      switch (field.type) {
        case 'text':
          return field.name === 'username' ? 'john_doe' : 'Sample Value'
        case 'email':
          return 'john.doe@example.com'
        case 'number':
          return '1'
        case 'date':
          return '1990-01-01'
        case 'select':
          return field.options?.[0] || 'option1'
        default:
          return 'Sample Value'
      }
    })

    const csvContent = [headers, sampleRow].map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${operation.name}-sample.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Operations</h1>
          <p className="text-gray-600">Upload and manage data in bulk</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Operation Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bulkOperations.map((operation) => (
          <div
            key={operation.id}
            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
              selectedOperation?.id === operation.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedOperation(operation)}
          >
            <div className="flex items-center mb-4">
              <operation.icon className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">{operation.name}</h3>
            </div>
            <p className="text-gray-600 mb-4">{operation.description}</p>
            <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  downloadTemplate(operation)
                }}
                className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                <Download className="h-4 w-4 mr-1" />
                Template
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  generateSampleData(operation)
                }}
                className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Sample
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Section */}
      {selectedOperation && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Upload {selectedOperation.name}
          </h3>

          {/* Field Requirements */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Required Fields:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {selectedOperation.fields.map((field) => (
                <div key={field.name} className="flex items-center text-sm">
                  <span className={`px-2 py-1 rounded text-xs mr-2 ${
                    field.required 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {field.required ? 'Required' : 'Optional'}
                  </span>
                  <span className="font-medium">{field.name}</span>
                  <span className="text-gray-500 ml-1">({field.type})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop your CSV file here or click to browse
            </p>
            <p className="text-gray-600 mb-4">
              Supported formats: CSV, Excel (.xlsx)
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0])
                }
              }}
              className="hidden"
            />
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="mt-6 p-4 rounded-lg bg-gray-50">
              <div className="flex items-center mb-4">
                {uploadResult.error_count === 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-yellow-500 mr-2" />
                )}
                <h4 className="text-lg font-semibold text-gray-900">
                  Upload Complete
                </h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {uploadResult.success_count}
                  </div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {uploadResult.error_count}
                  </div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {uploadResult.success_count + uploadResult.error_count}
                  </div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Errors:</h5>
                  <div className="max-h-40 overflow-y-auto">
                    {uploadResult.errors.map((error, index) => (
                      <div key={index} className="flex items-start p-2 bg-red-50 rounded mb-1">
                        <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <div className="font-medium text-red-800">
                            Row {error.row || 'Unknown'}: {error.field || 'General Error'}
                          </div>
                          <div className="text-red-600">{error.error}</div>
                          {error.data && (
                            <div className="text-xs text-gray-500 mt-1">
                              Data: {JSON.stringify(error.data)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => setUploadResult(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => setSelectedOperation(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
