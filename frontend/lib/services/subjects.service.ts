import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateSubjectRequest {
  name: string
  code: string
  department_id: number
  semester_id: number
  credits: number
  description?: string
  prerequisites?: string[]
  teacher_id?: number
}

export interface UpdateSubjectRequest {
  name?: string
  code?: string
  credits?: number
  description?: string
  prerequisites?: string[]
  teacher_id?: number
  is_active?: boolean
}

export interface Subject {
  id: number
  name: string
  code: string
  department_id: number
  department_name: string
  semester_id: number
  semester_name: string
  credits: number
  description?: string
  prerequisites?: string[]
  teacher_id?: number
  teacher_name?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SubjectAnalytics {
  total_students: number
  average_marks: number
  pass_rate: number
  attendance_rate: number
  co_attainment: Array<{
    co_id: number
    co_name: string
    attainment_percentage: number
  }>
}

export class SubjectsService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getSubjects(params?: {
    page?: number
    limit?: number
    department_id?: number
    semester_id?: number
    teacher_id?: number
    is_active?: boolean
    search?: string
  }): Promise<PaginatedResponse<Subject>> {
    return this.getPaginated('/api/subjects', { params })
  }

  async getSubject(id: number): Promise<ApiResponse<Subject>> {
    return this.get(`/api/subjects/${id}`)
  }

  async createSubject(subjectData: CreateSubjectRequest): Promise<ApiResponse<Subject>> {
    return this.post('/api/subjects', subjectData)
  }

  async updateSubject(id: number, subjectData: UpdateSubjectRequest): Promise<ApiResponse<Subject>> {
    return this.put(`/api/subjects/${id}`, subjectData)
  }

  async deleteSubject(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/subjects/${id}`)
  }

  async getSubjectStudents(id: number, params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<any>> {
    return this.getPaginated(`/api/subjects/${id}/students`, { params })
  }

  async assignTeacherToSubject(subjectId: number, teacherId: number): Promise<ApiResponse<void>> {
    return this.post(`/api/subjects/${subjectId}/teachers`, { teacher_id: teacherId })
  }

  async removeTeacherFromSubject(subjectId: number, teacherId: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/subjects/${subjectId}/teachers/${teacherId}`)
  }

  async getSubjectAnalytics(id: number): Promise<ApiResponse<SubjectAnalytics>> {
    return this.get(`/api/subjects/${id}/analytics`)
  }

  async getSubjectStats(params?: {
    department_id?: number
    semester_id?: number
  }): Promise<ApiResponse<{
    total_subjects: number
    active_subjects: number
    average_credits: number
    subjects_by_department: Record<string, number>
  }>> {
    return this.get('/api/subjects/stats', { params })
  }

  async bulkUpdateSubjects(updates: Array<{ id: number; data: UpdateSubjectRequest }>): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/subjects/bulk-update', updates)
  }

  async bulkDeleteSubjects(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/subjects/bulk-delete', ids)
  }

  async exportSubjects(format: 'csv' | 'excel' = 'csv', params?: {
    department_id?: number
    semester_id?: number
  }): Promise<void> {
    return this.download(`/api/subjects/export/${format}`, `subjects.${format}`)
  }
}
