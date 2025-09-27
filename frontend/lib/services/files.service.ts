import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface UploadFileRequest {
  file: File
  category: string
  description?: string
  tags?: string[]
  is_public?: boolean
}

export interface FileRecord {
  id: number
  filename: string
  original_filename: string
  file_path: string
  file_size: number
  mime_type: string
  category: string
  description?: string
  tags?: string[]
  is_public: boolean
  uploaded_by: number
  uploader_name: string
  created_at: string
  updated_at: string
}

export interface FileCategory {
  id: number
  name: string
  description?: string
  allowed_extensions: string[]
  max_file_size: number
  is_active: boolean
}

export interface StorageStats {
  total_files: number
  total_size_bytes: number
  total_size_mb: number
  files_by_category: Record<string, number>
  storage_usage_by_user: Array<{
    user_id: number
    user_name: string
    file_count: number
    total_size_mb: number
  }>
}

export class FilesService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 60000 // Longer timeout for file uploads
    })
  }

  async uploadFile(fileData: UploadFileRequest): Promise<ApiResponse<FileRecord>> {
    const formData = new FormData()
    formData.append('file', fileData.file)
    formData.append('category', fileData.category)
    if (fileData.description) formData.append('description', fileData.description)
    if (fileData.tags) formData.append('tags', JSON.stringify(fileData.tags))
    if (fileData.is_public !== undefined) formData.append('is_public', fileData.is_public.toString())

    return this.upload('/api/files/upload', formData)
  }

  async getFiles(params?: {
    page?: number
    limit?: number
    category?: string
    uploaded_by?: number
    is_public?: boolean
    search?: string
    tags?: string[]
  }): Promise<PaginatedResponse<FileRecord>> {
    return this.getPaginated('/api/files', { params })
  }

  async getFile(id: number): Promise<ApiResponse<FileRecord>> {
    return this.get(`/api/files/${id}`)
  }

  async downloadFile(id: number, filename?: string): Promise<void> {
    return this.download(`/api/files/${id}/download`, filename)
  }

  async previewFile(id: number): Promise<ApiResponse<{
    preview_url: string
    file_type: string
    can_preview: boolean
  }>> {
    return this.get(`/api/files/${id}/preview`)
  }

  async deleteFile(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/files/${id}`)
  }

  async updateFileMetadata(id: number, metadata: {
    description?: string
    tags?: string[]
    is_public?: boolean
  }): Promise<ApiResponse<FileRecord>> {
    return this.put(`/api/files/${id}`, metadata)
  }

  async getFileCategories(): Promise<ApiResponse<FileCategory[]>> {
    return this.get('/api/files/categories')
  }

  async createFileCategory(categoryData: {
    name: string
    description?: string
    allowed_extensions: string[]
    max_file_size: number
  }): Promise<ApiResponse<FileCategory>> {
    return this.post('/api/files/categories', categoryData)
  }

  async updateFileCategory(id: number, categoryData: Partial<FileCategory>): Promise<ApiResponse<FileCategory>> {
    return this.put(`/api/files/categories/${id}`, categoryData)
  }

  async deleteFileCategory(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/files/categories/${id}`)
  }

  async getStorageStats(): Promise<ApiResponse<StorageStats>> {
    return this.get('/api/files/storage-stats')
  }

  async bulkDeleteFiles(fileIds: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/files/bulk-delete', { file_ids: fileIds })
  }

  async bulkUpdateFiles(updates: Array<{
    id: number
    metadata: {
      description?: string
      tags?: string[]
      is_public?: boolean
    }
  }>): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/files/bulk-update', updates)
  }

  async getFileVersions(id: number): Promise<ApiResponse<Array<{
    id: number
    version: number
    file_path: string
    file_size: number
    created_at: string
    created_by: number
  }>>> {
    return this.get(`/api/files/${id}/versions`)
  }

  async restoreFileVersion(fileId: number, versionId: number): Promise<ApiResponse<FileRecord>> {
    return this.post(`/api/files/${fileId}/restore/${versionId}`)
  }

  async shareFile(id: number, shareData: {
    expires_at?: string
    password?: string
    max_downloads?: number
  }): Promise<ApiResponse<{
    share_token: string
    share_url: string
    expires_at?: string
  }>> {
    return this.post(`/api/files/${id}/share`, shareData)
  }

  async getSharedFile(shareToken: string): Promise<ApiResponse<FileRecord>> {
    return this.get(`/api/files/shared/${shareToken}`)
  }

  async downloadSharedFile(shareToken: string, password?: string): Promise<void> {
    const params = password ? { password } : {}
    return this.download(`/api/files/shared/${shareToken}/download`, undefined)
  }

  async revokeFileShare(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/files/${id}/share`)
  }

  async exportFilesList(format: 'csv' | 'excel' = 'csv', params?: {
    category?: string
    uploaded_by?: number
  }): Promise<void> {
    return this.download(`/api/files/export/${format}`, `files_list.${format}`)
  }
}
