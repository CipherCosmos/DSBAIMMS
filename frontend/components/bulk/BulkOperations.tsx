'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { 
  Upload, 
  Download, 
  FileText, 
  Users, 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  Info,
  X,
  Loader2,
  FileSpreadsheet,
  FileImage,
  File
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface BulkOperation {
  id: string
  type: 'users' | 'subjects' | 'classes' | 'marks' | 'questions'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  filename: string
  processedCount: number
  errorCount: number
  errors: string[]
  createdAt: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  preview: any[]
}

export function BulkOperations() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'upload' | 'templates' | 'history'>('upload')
  const [selectedType, setSelectedType] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [operations, setOperations] = useState<BulkOperation[]>([])
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const operationTypes = [
    {
      id: 'users',
      name: 'Users',
      description: 'Bulk upload users (students, teachers, HODs)',
      icon: Users,
      color: 'bg-blue-500',
      acceptedTypes: '.csv,.xlsx,.xls',
      maxSize: '5MB'
    },
    {
      id: 'subjects',
      name: 'Subjects',
      description: 'Bulk upload subjects with teacher assignments',
      icon: BookOpen,
      color: 'bg-green-500',
      acceptedTypes: '.csv,.xlsx,.xls',
      maxSize: '3MB'
    },
    {
      id: 'classes',
      name: 'Classes',
      description: 'Bulk upload classes and student enrollments',
      icon: BookOpen,
      color: 'bg-purple-500',
      acceptedTypes: '.csv,.xlsx,.xls',
      maxSize: '3MB'
    },
    {
      id: 'marks',
      name: 'Marks',
      description: 'Bulk upload student marks and grades',
      icon: FileText,
      color: 'bg-orange-500',
      acceptedTypes: '.csv,.xlsx,.xls',
      maxSize: '10MB'
    },
    {
      id: 'questions',
      name: 'Questions',
      description: 'Bulk upload questions for question banks',
      icon: FileText,
      color: 'bg-indigo-500',
      acceptedTypes: '.csv,.xlsx,.xls',
      maxSize: '5MB'
    }
  ]

  useEffect(() => {
    loadOperations()
  }, [])

  const loadOperations = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockOperations: BulkOperation[] = [
        {
          id: '1',
          type: 'users',
          status: 'completed',
          filename: 'students_batch_1.xlsx',
          processedCount: 150,
          errorCount: 3,
          errors: ['Row 45: Invalid email format', 'Row 67: Duplicate username', 'Row 89: Missing department'],
          createdAt: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          type: 'marks',
          status: 'processing',
          filename: 'exam_marks_midterm.csv',
          processedCount: 75,
          errorCount: 0,
          errors: [],
          createdAt: '2024-01-15T11:15:00Z'
        }
      ]
      setOperations(mockOperations)
    } catch (error) {
      console.error('Error loading operations:', error)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedType) return

    const file = files[0]
    const operationType = operationTypes.find(t => t.id === selectedType)
    
    if (!operationType) return

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!operationType.acceptedTypes.includes(fileExtension)) {
      toast.error(`Invalid file type. Accepted types: ${operationType.acceptedTypes}`)
      return
    }

    // Validate file size (convert MB to bytes)
    const maxSizeBytes = parseInt(operationType.maxSize) * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast.error(`File size exceeds limit of ${operationType.maxSize}`)
      return
    }

    try {
      setUploading(true)
      
      // First validate the file
      const validationFormData = new FormData()
      validationFormData.append('file', file)
      
      const validationResponse = await apiClient.post(
        `/api/bulk/validate/${selectedType}`,
        validationFormData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      setValidationResult(validationResponse)

      if (validationResponse.valid) {
        // Proceed with upload
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)

        const uploadResponse = await apiClient.post(
          `/api/bulk/upload/${selectedType}`,
          uploadFormData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        )

        toast.success(`Successfully uploaded ${uploadResponse.processed_count} records`)
        loadOperations()
        setValidationResult(null)
        setSelectedType('')
      } else {
        toast.error(`Validation failed: ${validationResponse.errors.join(', ')}`)
      }
    } catch (error: any) {
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
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
    handleFileUpload(e.dataTransfer.files)
  }

  const downloadTemplate = async (type: string) => {
    try {
      const response = await apiClient.get(`/api/bulk/template/${type}`, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type}_template.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Template downloaded successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to download template')
    }
  }

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-8 w-8 text-green-600" />
      case 'csv':
        return <FileText className="h-8 w-8 text-blue-600" />
      default:
        return <File className="h-8 w-8 text-gray-600" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return <Info className="h-5 w-5 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Operations</h1>
        <p className="text-gray-600">
          Upload large datasets efficiently with validation and error handling
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'upload', name: 'Upload Data', icon: Upload },
            { id: 'templates', name: 'Download Templates', icon: Download },
            { id: 'history', name: 'Operation History', icon: FileText }
          ].map((tab) => (
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

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Operation Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {operationTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedType === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <div className={`p-2 rounded-lg ${type.color} mr-3`}>
                      <type.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-medium text-gray-900">{type.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                  <div className="text-xs text-gray-500">
                    <div>Accepted: {type.acceptedTypes}</div>
                    <div>Max size: {type.maxSize}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedType && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload File</h2>
              
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
                  Drop your file here or click to browse
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  {operationTypes.find(t => t.id === selectedType)?.acceptedTypes} up to{' '}
                  {operationTypes.find(t => t.id === selectedType)?.maxSize}
                </p>
                <input
                  type="file"
                  accept={operationTypes.find(t => t.id === selectedType)?.acceptedTypes}
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Validation Results</h3>
                <button
                  onClick={() => setValidationResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  {validationResult.valid ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className={`font-medium ${
                    validationResult.valid ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {validationResult.valid ? 'Validation Passed' : 'Validation Failed'}
                  </span>
                </div>

                {validationResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-2">Warnings:</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.preview.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Preview (First 5 rows):</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(validationResult.preview[0]).map((key) => (
                              <th key={key} className="px-3 py-2 text-left font-medium text-gray-700">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {validationResult.preview.slice(0, 5).map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, colIndex) => (
                                <td key={colIndex} className="px-3 py-2 text-gray-900">
                                  {String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Download Templates</h2>
          <p className="text-gray-600 mb-6">
            Download Excel templates with the correct format and sample data for bulk uploads.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operationTypes.map((type) => (
              <div key={type.id} className="border rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <div className={`p-2 rounded-lg ${type.color} mr-3`}>
                    <type.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-medium text-gray-900">{type.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                <button
                  onClick={() => downloadTemplate(type.id)}
                  className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Operation History</h2>
          </div>
          
          {operations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No operations yet</h3>
              <p className="text-gray-600">Your bulk operations will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Errors
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {operations.map((operation) => (
                    <tr key={operation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getFileIcon(operation.filename)}
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {operation.filename}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {operation.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(operation.status)}
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
                            {operation.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {operation.processedCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {operation.errorCount > 0 ? (
                          <span className="text-red-600">{operation.errorCount}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(operation.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
