import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { getAccessToken } from '../cookies'

export interface ServiceConfig {
  baseURL: string
  timeout?: number
  retries?: number
}

export interface ApiResponse<T = any> {
  data: T
  message?: string
  status: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export class BaseService {
  protected client: AxiosInstance
  protected config: ServiceConfig

  constructor(config: ServiceConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    }

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      withCredentials: true,  // Enable cookies for cross-origin requests
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          // Handle token refresh here if needed
          window.location.href = '/login'
          return Promise.reject(error)
        }

        return Promise.reject(this.handleError(error))
      }
    )
  }

  private handleError(error: any) {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.message || 'An error occurred',
        status: error.response.status,
        data: error.response.data
      }
    } else if (error.request) {
      // Request was made but no response received
      return {
        message: 'Network error - please check your connection',
        status: 0,
        data: null
      }
    } else {
      // Something else happened
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0,
        data: null
      }
    }
  }

  // Generic HTTP methods
  protected async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, config)
    return {
      data: response.data,
      message: response.data?.message,
      status: response.status
    }
  }

  // Paginated GET method
  protected async getPaginated<T = any>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
    const response = await this.client.get(url, config)
    return {
      data: response.data?.data || response.data,
      message: response.data?.message,
      status: response.status,
      pagination: response.data?.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      }
    }
  }

  protected async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data, config)
    return {
      data: response.data,
      message: response.data?.message,
      status: response.status
    }
  }

  protected async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data, config)
    return {
      data: response.data,
      message: response.data?.message,
      status: response.status
    }
  }

  protected async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url, config)
    return {
      data: response.data,
      message: response.data?.message,
      status: response.status
    }
  }

  protected async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.patch(url, data, config)
    return {
      data: response.data,
      message: response.data?.message,
      status: response.status
    }
  }

  // File upload helper
  protected async upload<T = any>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return {
      data: response.data,
      message: response.data?.message,
      status: response.status
    }
  }

  // Download helper
  protected async download(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob'
    })

    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }
}
