import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  full_name: string
  role: string
  department_id?: number
  class_id?: number
  is_active?: boolean
}

export interface UpdateUserRequest {
  username?: string
  email?: string
  full_name?: string
  role?: string
  department_id?: number
  class_id?: number
  is_active?: boolean
}

export interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: string
  department_id?: number
  class_id?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserStats {
  total_users: number
  active_users: number
  users_by_role: Record<string, number>
  recent_signups: number
}

export interface BulkUpdateRequest {
  user_ids: number[]
  update_data: Partial<UpdateUserRequest>
}

export class UsersService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getUsers(params?: {
    page?: number
    limit?: number
    role?: string
    department_id?: number
    is_active?: boolean
    search?: string
  }): Promise<PaginatedResponse<User>> {
    return this.getPaginated('/api/users', { params })
  }

  async getUser(id: number): Promise<ApiResponse<User>> {
    return this.get(`/api/users/${id}`)
  }

  async createUser(userData: CreateUserRequest): Promise<ApiResponse<User>> {
    return this.post('/api/users', userData)
  }

  async updateUser(id: number, userData: UpdateUserRequest): Promise<ApiResponse<User>> {
    return this.put(`/api/users/${id}`, userData)
  }

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/users/${id}`)
  }

  async bulkUpdateUsers(request: BulkUpdateRequest): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/users/bulk-update', request)
  }

  async bulkDeleteUsers(userIds: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/users/bulk-delete', { user_ids: userIds })
  }

  async resetUserPassword(userId: number): Promise<ApiResponse<{ new_password: string }>> {
    return this.post(`/api/users/${userId}/reset-password`)
  }

  async getUserStats(): Promise<ApiResponse<UserStats>> {
    return this.get('/api/users/stats')
  }

  async getFieldConfig(role: string): Promise<ApiResponse<any>> {
    return this.get(`/api/users/field-config/${role}`)
  }

  async getAvailableRoles(): Promise<ApiResponse<string[]>> {
    return this.get('/api/users/available-roles')
  }

  async getUserSubjects(departmentId?: number): Promise<ApiResponse<any[]>> {
    return this.get('/api/users/subjects', { params: { department_id: departmentId } })
  }

  async assignSubjects(userId: number, subjectIds: number[]): Promise<ApiResponse<void>> {
    return this.post(`/api/users/${userId}/subjects`, { subject_ids: subjectIds })
  }

  async exportUsers(format: 'csv' | 'excel' = 'csv', params?: {
    role?: string
    department_id?: number
  }): Promise<void> {
    return this.download(`/api/exports/users/${format}`, `users.${format}`)
  }
}
