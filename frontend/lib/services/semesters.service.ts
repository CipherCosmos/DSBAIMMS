import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateSemesterRequest {
  name: string
  department_id: number
  academic_year: number
  start_date: string
  end_date: string
  is_current?: boolean
}

export interface UpdateSemesterRequest {
  name?: string
  academic_year?: number
  start_date?: string
  end_date?: string
  is_current?: boolean
  is_active?: boolean
}

export interface Semester {
  id: number
  name: string
  department_id: number
  department_name: string
  academic_year: number
  start_date: string
  end_date: string
  is_current: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PromotionRequest {
  current_semester_id: number
  next_semester_id: number
  student_ids?: number[]
}

export interface PromotionStatus {
  eligible_students: number
  already_promoted: number
  pending_promotion: number
}

export class SemestersService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getSemesters(params?: {
    page?: number
    limit?: number
    department_id?: number
    academic_year?: number
    is_current?: boolean
    is_active?: boolean
  }): Promise<PaginatedResponse<Semester>> {
    return this.getPaginated('/api/semesters', { params })
  }

  async getSemester(id: number): Promise<ApiResponse<Semester>> {
    return this.get(`/api/semesters/${id}`)
  }

  async createSemester(semesterData: CreateSemesterRequest): Promise<ApiResponse<Semester>> {
    return this.post('/api/semesters', semesterData)
  }

  async updateSemester(id: number, semesterData: UpdateSemesterRequest): Promise<ApiResponse<Semester>> {
    return this.put(`/api/semesters/${id}`, semesterData)
  }

  async deleteSemester(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/semesters/${id}`)
  }

  async promoteStudents(promotionData: PromotionRequest): Promise<ApiResponse<{ promoted_count: number }>> {
    return this.post(`/api/semesters/${promotionData.current_semester_id}/promote-students`, {
      next_semester_id: promotionData.next_semester_id,
      student_ids: promotionData.student_ids
    })
  }

  async getPromotionStatus(semesterId: number): Promise<ApiResponse<PromotionStatus>> {
    return this.get(`/api/semesters/${semesterId}/promotion-status`)
  }

  async getSemesterEnrollments(params?: {
    page?: number
    limit?: number
    semester_id?: number
    student_id?: number
  }): Promise<PaginatedResponse<any>> {
    return this.getPaginated('/api/semester-enrollments', { params })
  }

  async createSemesterEnrollment(enrollmentData: {
    student_id: number
    semester_id: number
    class_id?: number
  }): Promise<ApiResponse<any>> {
    return this.post('/api/semester-enrollments', enrollmentData)
  }

  async updateSemesterEnrollment(id: number, enrollmentData: {
    class_id?: number
    status?: string
  }): Promise<ApiResponse<any>> {
    return this.put(`/api/semester-enrollments/${id}`, enrollmentData)
  }

  async deleteSemesterEnrollment(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/semester-enrollments/${id}`)
  }

  async bulkUpdateSemesters(updates: Array<{ id: number; data: UpdateSemesterRequest }>): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/semesters/bulk-update', updates)
  }

  async bulkDeleteSemesters(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/semesters/bulk-delete', ids)
  }

  async exportSemesters(format: 'csv' | 'excel' = 'csv', params?: {
    department_id?: number
  }): Promise<void> {
    return this.download(`/api/semesters/export/${format}`, `semesters.${format}`)
  }
}
