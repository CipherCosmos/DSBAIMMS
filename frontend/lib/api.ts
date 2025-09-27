import axios from 'axios'
import { getAccessToken } from './cookies'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased timeout to 30 seconds
  })

  // Generic HTTP methods with consistent response handling
  async get(url: string, config?: any) {
    try {
      const response = await this.client.get(url, config)
      return {
        data: response.data?.data || response.data,
        status: response.status,
        success: true
      }
    } catch (error: any) {
      throw error
    }
  }

  async post(url: string, data?: any, config?: any) {
    try {
      const response = await this.client.post(url, data, config)
      return {
        data: response.data?.data || response.data,
        status: response.status,
        success: true
      }
    } catch (error: any) {
      throw error
    }
  }

  async put(url: string, data?: any, config?: any) {
    try {
      const response = await this.client.put(url, data, config)
      return {
        data: response.data?.data || response.data,
        status: response.status,
        success: true
      }
    } catch (error: any) {
      throw error
    }
  }

  async delete(url: string, config?: any) {
    try {
      const response = await this.client.delete(url, config)
      return {
        data: response.data?.data || response.data,
        status: response.status,
        success: true
      }
    } catch (error: any) {
      throw error
    }
  }

  // Helper method for direct service calls
  private async directServiceCall(serviceUrl: string, method: string, endpoint: string, data?: any, params?: any) {
    const directClient = axios.create({
      baseURL: serviceUrl,
      timeout: 30000, // Increased timeout to 30 seconds
    })
    
    // Add auth token
    const token = getAccessToken()
    if (token) {
      directClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    
    const response = await (directClient as any)[method](endpoint, data, { params })
    return response.data
  }

  // ==================== AUTH SERVICE ====================
  async login(username: string, password: string) {
    return this.post('/api/auth/login', { username, password })
  }

  async logout() {
    return this.post('/api/auth/logout')
  }

  async getCurrentUser() {
    return this.get('/api/auth/me')
  }

  async refreshToken() {
    return this.post('/api/auth/refresh-token')
  }

  async changePassword(passwordData: { current_password: string; new_password: string }) {
    return this.post('/api/auth/change-password', passwordData)
  }

  // ==================== USER SERVICE ====================
  async getUsers(params?: any) {
    return this.get('/api/users', { params })
  }

  async getUser(userId: number) {
    return this.get(`/api/users/${userId}`)
  }

  async createUser(userData: any) {
    return this.post('/api/users', userData)
  }

  async updateUser(userId: number, userData: any) {
    return this.put(`/api/users/${userId}`, userData)
  }

  async deleteUser(userId: number) {
    return this.delete(`/api/users/${userId}`)
  }

  async getUserStats() {
    return this.get('/api/users/stats')
  }

  async assignSubjects(userId: number, subjects: number[]) {
    return this.post(`/api/users/${userId}/subjects`, { subjects })
  }

  // ==================== DEPARTMENT SERVICE ====================
  async getDepartments(params?: any) {
    return this.get('/api/departments', { params })
  }

  async getDepartment(departmentId: number) {
    return this.get(`/api/departments/${departmentId}`)
  }

  async createDepartment(departmentData: any) {
    return this.post('/api/departments', departmentData)
  }

  async updateDepartment(departmentId: number, departmentData: any) {
    return this.put(`/api/departments/${departmentId}`, departmentData)
  }

  async deleteDepartment(departmentId: number) {
    return this.delete(`/api/departments/${departmentId}`)
  }

  // ==================== CLASSES SERVICE ====================
  async getClasses(params?: any) {
    return this.get('/api/classes', { params })
  }

  async getClass(classId: number) {
    return this.get(`/api/classes/${classId}`)
  }

  async createClass(classData: any) {
    return this.post('/api/classes', classData)
  }

  async updateClass(classId: number, classData: any) {
    return this.put(`/api/classes/${classId}`, classData)
  }

  async deleteClass(classId: number) {
    return this.delete(`/api/classes/${classId}`)
  }

  async getClassStudents(classId: number, params?: any) {
    return this.get(`/api/classes/${classId}/students`, { params })
  }

  async getClassesAnalytics(params?: any) {
    return this.get('/api/classes/analytics', { params })
  }

  // ==================== SUBJECTS SERVICE ====================
  async getSubjects(params?: any) {
    return this.get('/api/subjects', { params })
  }

  async getSubject(subjectId: number) {
    return this.get(`/api/subjects/${subjectId}`)
  }

  async createSubject(subjectData: any) {
    return this.post('/api/subjects', subjectData)
  }

  async updateSubject(subjectId: number, subjectData: any) {
    return this.put(`/api/subjects/${subjectId}`, subjectData)
  }

  async deleteSubject(subjectId: number) {
    return this.delete(`/api/subjects/${subjectId}`)
  }

  async getSubjectAnalytics(params?: any) {
    return this.get('/api/subjects/analytics', { params })
  }

  // ==================== SEMESTERS SERVICE ====================
  async getSemesters(params?: any) {
    return this.get('/api/semesters', { params })
  }

  async getSemester(semesterId: number) {
    return this.get(`/api/semesters/${semesterId}`)
  }

  async createSemester(semesterData: any) {
    return this.post('/api/semesters', semesterData)
  }

  async updateSemester(semesterId: number, semesterData: any) {
    return this.put(`/api/semesters/${semesterId}`, semesterData)
  }

  async deleteSemester(semesterId: number) {
    return this.delete(`/api/semesters/${semesterId}`)
  }

  async enrollStudentInSemester(semesterId: number, enrollmentData: any) {
    return this.post(`/api/semesters/${semesterId}/enroll-student`, enrollmentData)
  }

  async getSemesterAnalytics(semesterId: number) {
    return this.get(`/api/semesters/${semesterId}/analytics`)
  }

  // ==================== PROFILE SERVICE ====================
  async getProfile() {
    return this.get('/api/profile')
  }

  async getUserProfile(userId: number) {
    return this.get(`/api/profile/${userId}`)
  }

  async updateProfile(profileData: any) {
    return this.put('/api/profile', profileData)
  }

  async changePassword(passwordData: any) {
    return this.post('/api/profile/change-password', passwordData)
  }

  async uploadProfilePicture(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return this.post('/api/profile/upload-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }

  async deleteProfilePicture() {
    return this.delete('/api/profile/picture')
  }

  async getProfileStats() {
    return this.get('/api/profile/stats')
  }

  // ==================== EXAMS SERVICE ====================
  async getExams(params?: any) {
    return this.get('/api/exams', { params })
  }

  async getExam(examId: number) {
    return this.get(`/api/exams/${examId}`)
  }

  async createExam(examData: any) {
    return this.post('/api/exams', examData)
  }

  async updateExam(examId: number, examData: any) {
    return this.put(`/api/exams/${examId}`, examData)
  }

  async deleteExam(examId: number) {
    return this.delete(`/api/exams/${examId}`)
  }

  async getExamAnalytics(examId: number) {
    return this.get(`/api/exams/${examId}/analytics`)
  }

  // ==================== QUESTIONS SERVICE ====================
  async getQuestions(params?: any) {
    return this.get('/api/questions', { params })
  }

  async getQuestion(questionId: number) {
    return this.get(`/api/questions/${questionId}`)
  }

  async createQuestion(questionData: any) {
    return this.post('/api/questions', questionData)
  }

  async updateQuestion(questionId: number, questionData: any) {
    return this.put(`/api/questions/${questionId}`, questionData)
  }

  async deleteQuestion(questionId: number) {
    return this.delete(`/api/questions/${questionId}`)
  }

  async createQuestionsBulk(questionsData: any) {
    return this.post('/api/questions/bulk', questionsData)
  }

  // ==================== MARKS SERVICE ====================
  async getMarks(params?: any) {
    return this.get('/api/marks', { params })
  }

  async getStudentMarks(studentId: number, params?: any) {
    return this.get('/api/marks', { params: { student_id: studentId, ...params } })
  }

  async getExamMarks(examId: number, params?: any) {
    return this.get('/api/marks', { params: { exam_id: examId, ...params } })
  }

  async bulkMarksEntry(marksData: any) {
    return this.post('/api/marks/bulk', marksData)
  }

  async getExamMarksSummary(examId: number) {
    return this.get(`/api/marks/exam/${examId}/summary`)
  }

  async getStudentPerformance(studentId: number, params?: any) {
    return this.get(`/api/marks/student/${studentId}/performance`, { params })
  }

  async getMarksAnalytics(params?: any) {
    return this.get('/api/marks/analytics', { params })
  }

  // ==================== ANALYTICS SERVICE ====================
  async getDashboardStats() {
    return this.get('/api/analytics/dashboard')
  }

  async getDepartmentAnalytics() {
    return this.get('/api/analytics/departments')
  }

  async getClassesAnalytics(params?: any) {
    return this.get('/api/analytics/classes', { params })
  }

  async getStudentsAnalytics(params?: any) {
    return this.get('/api/analytics/students', { params })
  }

  async getExamsAnalytics(params?: any) {
    return this.get('/api/analytics/exams', { params })
  }

  async getCOPOPerformance(params?: any) {
    return this.get('/api/analytics/co-po', { params })
  }

  // ==================== CO/PO SERVICE ====================
  async getCOs(params?: any) {
    return this.get('/api/cos', { params })
  }

  async getCO(coId: number) {
    return this.get(`/api/cos/${coId}`)
  }

  async createCO(coData: any) {
    return this.post('/api/cos', coData)
  }

  async updateCO(coId: number, coData: any) {
    return this.put(`/api/cos/${coId}`, coData)
  }

  async deleteCO(coId: number) {
    return this.delete(`/api/cos/${coId}`)
  }

  async getPOs(params?: any) {
    return this.get('/api/pos', { params })
  }

  async getPO(poId: number) {
    return this.get(`/api/pos/${poId}`)
  }

  async createPO(poData: any) {
    return this.post('/api/pos', poData)
  }

  async updatePO(poId: number, poData: any) {
    return this.put(`/api/pos/${poId}`, poData)
  }

  async deletePO(poId: number) {
    return this.delete(`/api/pos/${poId}`)
  }

  async getCOPOMappings(params?: any) {
    return this.get('/api/copo-mappings', { params })
  }

  async createCOPOMapping(mappingData: any) {
    return this.post('/api/copo-mappings', mappingData)
  }

  async updateCOPOMapping(mappingId: number, mappingData: any) {
    return this.put(`/api/copo-mappings/${mappingId}`, mappingData)
  }

  async deleteCOPOMapping(mappingId: number) {
    return this.delete(`/api/copo-mappings/${mappingId}`)
  }


  async getCOPOAnalytics(params?: any) {
    return this.get('/api/copo/analytics', { params })
  }

  async getCOPORecommendations(departmentId: number) {
    return this.get(`/api/copo/recommendations?department_id=${departmentId}`)
  }

  async createSmartCO(coData: any) {
    return this.post('/api/cos/smart', coData)
  }

  async createSmartPO(poData: any) {
    return this.post('/api/pos/smart', poData)
  }

  // ==================== NOTIFICATIONS SERVICE ====================
  async getNotifications(params?: any) {
    return this.get('/api/notifications', { params })
  }

  async createNotification(notificationData: any) {
    return this.post('/api/notifications', notificationData)
  }

  async markNotificationRead(notificationId: number) {
    return this.put(`/api/notifications/${notificationId}/read`)
  }

  async getNotificationStats() {
    return this.get('/api/notifications/stats')
  }

  constructor() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
          console.log('API Request with token:', config.url, token.substring(0, 20) + '...')
        } else {
          console.log('API Request without token:', config.url)
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => {
        // Don't extract data from auth endpoints to preserve full response structure
        if (response.config?.url?.includes('/api/auth/')) {
          return response
        }
        // Return the full response object to preserve structure and status codes
        return response
      },
      (error) => {
        console.error('API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.response?.data?.detail || error.message
        })

        if (error.response?.status === 401) {
          // Only redirect to login if we're not already on the login page
          // and if the request was not for getting current user (to avoid redirect loops)
          const isLoginPage = window.location.pathname === '/login'
          const isGetCurrentUser = error.config?.url?.includes('/api/auth/me')
          
          if (!isLoginPage && !isGetCurrentUser) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
          }
        }
        
        // Return a structured error object for consistent handling
        return Promise.reject({
          status: error.response?.status || 500,
          message: error.response?.data?.detail || error.message || 'An unexpected error occurred',
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method
        })
      }
    )
  }
}

export const apiClient = new ApiClient()
