import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateDepartmentRequest {
  name: string
  code: string
  description?: string
  hod_id?: number
  academic_year: number
  duration_years: number
  semester_count: number
}

export interface UpdateDepartmentRequest {
  name?: string
  code?: string
  description?: string
  hod_id?: number
  academic_year?: number
  duration_years?: number
  semester_count?: number
  is_active?: boolean
}

export interface Department {
  id: number
  name: string
  code: string
  description?: string
  hod_id?: number
  hod_name?: string
  academic_year: number
  duration_years: number
  semester_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AvailableHOD {
  id: number
  username: string
  full_name: string
  email: string
}

export class DepartmentsService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getDepartments(params?: {
    page?: number
    limit?: number
    is_active?: boolean
    search?: string
  }): Promise<PaginatedResponse<Department>> {
    return this.getPaginated('/api/departments', { params })
  }

  async getDepartment(id: number): Promise<ApiResponse<Department>> {
    return this.get(`/api/departments/${id}`)
  }

  async createDepartment(departmentData: CreateDepartmentRequest): Promise<ApiResponse<Department>> {
    return this.post('/api/departments', departmentData)
  }

  async updateDepartment(id: number, departmentData: UpdateDepartmentRequest): Promise<ApiResponse<Department>> {
    return this.put(`/api/departments/${id}`, departmentData)
  }

  async deleteDepartment(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/departments/${id}`)
  }

  async bulkCreateDepartments(departments: CreateDepartmentRequest[]): Promise<ApiResponse<{ created_count: number }>> {
    return this.post('/api/departments/bulk-create', departments)
  }

  async bulkUpdateDepartments(updates: Array<{ id: number; data: UpdateDepartmentRequest }>): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/departments/bulk-update', updates)
  }

  async bulkDeleteDepartments(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/departments/bulk-delete', ids)
  }

  async getAvailableHODs(): Promise<ApiResponse<AvailableHOD[]>> {
    return this.get('/api/departments/available-hods')
  }

  async getDepartmentStats(departmentId: number): Promise<ApiResponse<{
    total_students: number
    total_teachers: number
    total_classes: number
    total_subjects: number
    active_semesters: number
  }>> {
    return this.get(`/api/departments/${departmentId}/stats`)
  }

  async exportDepartments(format: 'csv' | 'excel' = 'csv'): Promise<void> {
    return this.download(`/api/departments/export/${format}`, `departments.${format}`)
  }
}
