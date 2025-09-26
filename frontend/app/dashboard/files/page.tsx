'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient } from '@/lib/api'
import { 
  FolderOpen, Plus, Edit, Trash2, Save, X, Eye, 
  RefreshCw, Download, Upload, Filter, Search,
  BookOpen, Target, Award, Users, Calendar, Building,
  FileText, BarChart3, Clock, CheckCircle, XCircle,
  Image, File, FileSpreadsheet, FileVideo, FileAudio
} from 'lucide-react'

interface FileUpload {
  id: number
  filename: string
  original_filename: string
  file_path: string
  file_size: number
  mime_type?: string
  file_type?: string
  uploaded_by: number
  uploaded_by_name?: string
  department_id?: number
  department_name?: string
  class_id?: number
  class_name?: string
  subject_id?: number
  subject_name?: string
  semester_id?: number
  semester_name?: string
  is_public: boolean
  download_count: number
  created_at: string
  updated_at?: string
}

interface Department {
  id: number
  name: string
  code: string
}

interface Class {
  id: number
  name: string
  department_id: number
  department_name?: string
}

interface Subject {
  id: number
  name: string
  code: string
  department_id: number
}

interface Semester {
  id: number
  name: string
  department_id: number
  department_name?: string
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileUpload[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [editingFile, setEditingFile] = useState<FileUpload | null>(null)
  const [filterDepartment, setFilterDepartment] = useState<number | null>(null)
  const [filterClass, setFilterClass] = useState<number | null>(null)
  const [filterSubject, setFilterSubject] = useState<number | null>(null)
  const [filterFileType, setFilterFileType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    department_id: 0,
    class_id: 0,
    subject_id: 0,
    semester_id: 0,
    is_public: false
  })

  const fileTypes = [
    { value: 'document', label: 'Document', icon: FileText },
    { value: 'image', label: 'Image', icon: Image },
    { value: 'spreadsheet', label: 'Spreadsheet', icon: FileSpreadsheet },
    { value: 'video', label: 'Video', icon: FileVideo },
    { value: 'audio', label: 'Audio', icon: FileAudio },
    { value: 'other', label: 'Other', icon: File }
  ]

  useEffect(() => {
    loadData()
  }, [filterDepartment, filterClass, filterSubject, filterFileType])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [filesResponse, departmentsResponse, classesResponse, subjectsResponse, semestersResponse] = await Promise.all([
        apiClient.get('/api/files'),
        apiClient.get('/api/departments'),
        apiClient.get('/api/classes'),
        apiClient.get('/api/subjects'),
        apiClient.get('/api/semesters')
      ])

    let filesData = filesResponse || []
    const departmentsData = departmentsResponse || []
    const classesData = classesResponse || []
    const subjectsData = subjectsResponse || []
    const semestersData = semestersResponse || []

      // Apply filters
      if (filterDepartment) {
        filesData = filesData.filter((f: FileUpload) => f.department_id === filterDepartment)
      }
      if (filterClass) {
        filesData = filesData.filter((f: FileUpload) => f.class_id === filterClass)
      }
      if (filterSubject) {
        filesData = filesData.filter((f: FileUpload) => f.subject_id === filterSubject)
      }
      if (filterFileType) {
        filesData = filesData.filter((f: FileUpload) => f.file_type === filterFileType)
      }
      if (searchTerm) {
        filesData = filesData.filter((f: FileUpload) => 
          f.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.filename.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setFiles(filesData)
      setDepartments(departmentsData)
      setClasses(classesData)
      setSubjects(subjectsData)
      setSemesters(semestersData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('department_id', formData.department_id.toString())
      formData.append('class_id', formData.class_id.toString())
      formData.append('subject_id', formData.subject_id.toString())
      formData.append('semester_id', formData.semester_id.toString())
      formData.append('is_public', formData.is_public.toString())

      await apiClient.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      loadData()
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('Failed to upload file')
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0])
    }
  }

  const handleEdit = (file: FileUpload) => {
    setEditingFile(file)
    setFormData({
      department_id: file.department_id || 0,
      class_id: file.class_id || 0,
      subject_id: file.subject_id || 0,
      semester_id: file.semester_id || 0,
      is_public: file.is_public
    })
    setShowUploadForm(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.put(`/api/files/${editingFile?.id}`, formData)
      setShowUploadForm(false)
      setEditingFile(null)
      setFormData({
        department_id: 0,
        class_id: 0,
        subject_id: 0,
        semester_id: 0,
        is_public: false
      })
      loadData()
    } catch (error) {
      console.error('Error updating file:', error)
      setError('Failed to update file')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      await apiClient.delete(`/api/files/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting file:', error)
      setError('Failed to delete file')
    }
  }

  const handleDownload = async (file: FileUpload) => {
    try {
      const response = await apiClient.get(`/api/files/${file.id}/download`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      // Update download count
      loadData()
    } catch (error) {
      console.error('Error downloading file:', error)
      setError('Failed to download file')
    }
  }

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return File
    
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.startsWith('video/')) return FileVideo
    if (mimeType.startsWith('audio/')) return FileAudio
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText
    return File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const exportData = async () => {
    try {
      const csvContent = convertToCSV(files)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'files.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: FileUpload[]) => {
    if (data.length === 0) return ''
    
    const headers = ['ID', 'Filename', 'Original Filename', 'File Size', 'Type', 'Department', 'Class', 'Subject', 'Semester', 'Public', 'Downloads', 'Uploaded By', 'Created At']
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        row.filename,
        row.original_filename,
        formatFileSize(row.file_size),
        row.file_type || '',
        row.department_name || '',
        row.class_name || '',
        row.subject_name || '',
        row.semester_name || '',
        row.is_public ? 'Yes' : 'No',
        row.download_count,
        row.uploaded_by_name || '',
        row.created_at
      ].join(','))
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
          <h1 className="text-3xl font-bold text-gray-900">File Management</h1>
          <p className="text-gray-600">Manage files and documents</p>
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
            onClick={() => setShowUploadForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload File
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={filterClass || ''}
              onChange={(e) => setFilterClass(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
            <select
              value={filterFileType || ''}
              onChange={(e) => setFilterFileType(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Types</option>
              {fileTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
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
                placeholder="Search files..."
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
          Drop your files here or click to browse
        </p>
        <p className="text-gray-600 mb-4">
          Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, Images, Videos, Audio
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Choose Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Files Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mime_type)
              return (
                <tr key={file.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileIcon className="h-5 w-5 text-blue-500 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{file.original_filename}</div>
                        <div className="text-sm text-gray-500">Uploaded by {file.uploaded_by_name || 'Unknown'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(file.file_size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {file.file_type || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-1" />
                      {file.department_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {file.class_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {file.subject_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-1" />
                      {file.download_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      file.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {file.is_public ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(file)}
                        className="text-green-600 hover:text-green-900"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(file)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingFile ? 'Edit File Details' : 'Upload File'}
            </h3>
            <form onSubmit={editingFile ? handleUpdate : (e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select Department (Optional)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select Class (Optional)</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select Subject (Optional)</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Semester</label>
                <select
                  value={formData.semester_id}
                  onChange={(e) => setFormData({ ...formData, semester_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={0}>Select Semester (Optional)</option>
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>{sem.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">Public (visible to all users)</label>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false)
                    setEditingFile(null)
                    setFormData({
                      department_id: 0,
                      class_id: 0,
                      subject_id: 0,
                      semester_id: 0,
                      is_public: false
                    })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                {editingFile && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}