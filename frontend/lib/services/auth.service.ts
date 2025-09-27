import { BaseService, ApiResponse } from './base.service'

export interface LoginCredentials {
  username: string
  password: string
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

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
  expires_in: number
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export class AuthService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    return this.post('/api/auth/login', credentials)
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.post('/api/auth/logout')
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.get('/api/auth/me')
  }

  async changePassword(passwordData: ChangePasswordRequest): Promise<ApiResponse<void>> {
    return this.post('/api/auth/change-password', passwordData)
  }

  async refreshToken(): Promise<ApiResponse<{ access_token: string }>> {
    return this.post('/api/auth/refresh')
  }

  async resetPassword(email: string): Promise<ApiResponse<void>> {
    return this.post('/api/auth/reset-password', { email })
  }

  async verifyResetToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post('/api/auth/verify-reset-token', { token })
  }

  async confirmResetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.post('/api/auth/confirm-reset-password', { token, new_password: newPassword })
  }
}

