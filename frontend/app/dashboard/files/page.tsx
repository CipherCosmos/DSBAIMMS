'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Search, Download, Eye, Trash2, File, Image, FileText, Archive } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface FileUpload {
  id: number
  filename: string
  original_filename: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: number
  entity_type?: string
  entity_id?: number
  is_public: boolean
  created_at: string
  uploaded_by_name?: string
}

export default function FilesPage() {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [storageStats, setStorageStats] = useState<any>(null)

  useEffect(() => {
    loadFiles()
    loadStorageStats()
  }, [])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getFiles()
      setFiles(data)
    } catch (error) {
      console.error('Error loading files:', error)
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  const loadStorageStats = async () => {
    try {
      const stats = await apiClient.getStorageStats()
      setStorageStats(stats)
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
    loadFiles()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', 'general')
      formData.append('is_public', 'false')

      await apiClient.uploadFile(formData)
      toast.success('File uploaded successfully')
      loadFiles()
      loadStorageStats()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (file: FileUpload) => {
    try {
      const blob = await apiClient.downloadFile()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      toast.error(error.detail || 'Failed to download file')
    }
  }

  const handlePreview = async (file: FileUpload) => {
    try {
      const previewUrl = await apiClient.previewFile()
      window.open(previewUrl, '_blank')
    } catch (error: any) {
      toast.error(error.detail || 'Failed to preview file')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      await apiClient.deleteFile(id)
      toast.success('File deleted successfully')
      loadFiles()
      loadStorageStats()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to delete file')
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-6 w-6 text-green-600" />
    if (mimeType.includes('pdf')) return <FileText className="h-6 w-6 text-red-600" />
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="h-6 w-6 text-purple-600" />
    return <File className="h-6 w-6 text-gray-600" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredFiles = files.filter(file =>
    file.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold text-gray-900">File Management</h2>
          <p className="text-gray-600">Upload, manage, and organize files</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <Button asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Storage Stats */}
      {storageStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <File className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Files</p>
                  <p className="text-2xl font-semibold">{storageStats.total_files}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Archive className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Size</p>
                  <p className="text-2xl font-semibold">{formatFileSize(storageStats.total_size)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FileText className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Available Space</p>
                  <p className="text-2xl font-semibold">{formatFileSize(storageStats.available_space)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Image className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Usage</p>
                  <p className="text-2xl font-semibold">{storageStats.usage_percentage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="exam">Exam Files</option>
                <option value="question">Question Files</option>
                <option value="user">User Files</option>
                <option value="general">General Files</option>
              </select>
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Files ({filteredFiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredFiles && Array.isArray(filteredFiles) && filteredFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  {getFileIcon(file.mime_type)}
                  <div>
                    <h4 className="font-medium text-gray-900">{file.original_filename}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{file.mime_type}</span>
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      <span>by {file.uploaded_by_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={file.is_public ? "default" : "secondary"}>
                    {file.is_public ? "Public" : "Private"}
                  </Badge>
                  {file.entity_type && (
                    <Badge variant="outline">
                      {file.entity_type}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(file)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredFiles && Array.isArray(filteredFiles) && filteredFiles.length === 0 && (
            <div className="text-center py-12">
              <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-600">Upload your first file to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


