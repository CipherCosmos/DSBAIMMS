import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateClassRequest {
  name: string
  department_id: number
  semester_id: number
  section: string
  year: number
  class_teacher_id?: number
  cr_id?: number
  max_students?: number
}

export interface UpdateClassRequest {
  name?: string
  section?: string
  year?: number
  class_teacher_id?: number
  cr_id?: number
  max_students?: number
  is_active?: boolean
}

export interface Class {
  id: number
  name: string
  department_id: number
  department_name: string
  semester_id: number
  semester_name: string
  section: string
  year: number
  class_teacher_id?: number
  class_teacher_name?: string
  cr_id?: number
  cr_name?: string
  max_students?: number
  current_students: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClassStudent {
  id: number
  username: string
  full_name: string
  email: string
  roll_number?: string
  enrollment_date: string
}

export interface ClassAnalytics {
  total_students: number
  attendance_rate: number
  average_performance: number
  top_performers: Array<{
    student_id: number
    student_name: string
    average_marks: number
  }>
}

export class ClassesService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getClasses(params?: {
    page?: number
    limit?: number
    department_id?: number
    semester_id?: number
    year?: number
    is_active?: boolean
    search?: string
  }): Promise<PaginatedResponse<Class>> {
    return this.getPaginated('/api/classes', { params })
  }

  async getClass(id: number): Promise<ApiResponse<Class>> {
    return this.get(`/api/classes/${id}`)
  }

  async createClass(classData: CreateClassRequest): Promise<ApiResponse<Class>> {
    return this.post('/api/classes', classData)
  }

  async updateClass(id: number, classData: UpdateClassRequest): Promise<ApiResponse<Class>> {
    return this.put(`/api/classes/${id}`, classData)
  }

  async deleteClass(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/classes/${id}`)
  }

  async getClassStudents(id: number, params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<ClassStudent>> {
    return this.getPaginated(`/api/classes/${id}/students`, { params })
  }

  async addStudentToClass(classId: number, studentId: number): Promise<ApiResponse<void>> {
    return this.post(`/api/classes/${classId}/students`, { student_id: studentId })
  }

  async removeStudentFromClass(classId: number, studentId: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/classes/${classId}/students/${studentId}`)
  }

  async getClassAnalytics(id: number): Promise<ApiResponse<ClassAnalytics>> {
    return this.get(`/api/classes/${id}/analytics`)
  }

  async getClassStats(params?: {
    department_id?: number
    semester_id?: number
  }): Promise<ApiResponse<{
    total_classes: number
    active_classes: number
    total_students: number
    average_class_size: number
  }>> {
    return this.get('/api/classes/stats', { params })
  }

  async bulkUpdateClasses(updates: Array<{ id: number; data: UpdateClassRequest }>): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/classes/bulk-update', updates)
  }

  async bulkDeleteClasses(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/classes/bulk-delete', ids)
  }

  async exportClasses(format: 'csv' | 'excel' = 'csv', params?: {
    department_id?: number
    semester_id?: number
  }): Promise<void> {
    return this.download(`/api/classes/export/${format}`, `classes.${format}`)
  }
}
