import axios from 'axios'
import { getAccessToken } from './cookies'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased timeout to 30 seconds
  })

  constructor() {
    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )
  }

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
      return {
        data: null,
        status: error.response?.status || 500,
        success: false,
        error: error.response?.data?.detail || error.message || 'Request failed'
      }
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
      return {
        data: null,
        status: error.response?.status || 500,
        success: false,
        error: error.response?.data?.detail || error.message || 'Request failed'
      }
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
      return {
        data: null,
        status: error.response?.status || 500,
        success: false,
        error: error.response?.data?.detail || error.message || 'Request failed'
      }
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
      return {
        data: null,
        status: error.response?.status || 500,
        success: false,
        error: error.response?.data?.detail || error.message || 'Request failed'
      }
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

  async resetPassword(userId: number) {
    return this.post(`/api/auth/reset-password/${userId}`)
  }

  async forgotPassword(email: string) {
    return this.post('/api/auth/forgot-password', { email })
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

  async getAvailableRoles() {
    return this.get('/api/users/available-roles')
  }

  async getFieldConfig(role: string) {
    return this.get(`/api/users/field-config/${role}`)
  }

  async getAvailableHODs() {
    return this.get('/api/departments/available-hods')
  }

  async assignSubjects(userId: number, subjects: number[]) {
    return this.post(`/api/users/${userId}/subjects`, { subjects })
  }

  async bulkUpdateUsers(bulkData: any) {
    return this.post('/api/users/bulk-update', bulkData)
  }

  async bulkDeleteUsers(bulkData: any) {
    return this.post('/api/users/bulk-delete', bulkData)
  }

  // Profile Management
  async getUserProfile() {
    return this.get('/api/users/profile')
  }

  async updateUserProfile(profileData: any) {
    return this.put('/api/users/profile', profileData)
  }

  async changeUserPassword(passwordData: { current_password: string; new_password: string }) {
    return this.post('/api/users/profile/change-password', passwordData)
  }

  async uploadProfilePicture(fileData: any) {
    return this.post('/api/users/profile/upload-picture', fileData)
  }

  // Student Promotion
  async promoteStudents(promotionData: any) {
    return this.post('/api/users/promote-students', promotionData)
  }

  async getPromotionCandidates(params?: any) {
    return this.get('/api/users/promotion-candidates', { params })
  }

  // User Analytics
  async getUserAnalytics(userId: number) {
    return this.get(`/api/users/${userId}/analytics`)
  }

  async getUserPerformance(userId: number, params?: any) {
    return this.get(`/api/users/${userId}/performance`, { params })
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

  // Bulk Operations for Classes
  async bulkCreateClasses(bulkData: any) {
    return this.post('/api/classes/bulk-create', bulkData)
  }

  async bulkUpdateClasses(bulkData: any) {
    return this.post('/api/classes/bulk-update', bulkData)
  }

  async bulkEnrollStudents(enrollmentData: any) {
    return this.post('/api/classes/bulk-enroll-students', enrollmentData)
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

  // Bulk Operations for Subjects
  async bulkCreateSubjects(bulkData: any) {
    return this.post('/api/subjects/bulk-create', bulkData)
  }

  async bulkAssignTeachers(assignmentData: any) {
    return this.post('/api/subjects/bulk-assign-teachers', assignmentData)
  }

  async bulkUpdateSubjects(bulkData: any) {
    return this.post('/api/subjects/bulk-update', bulkData)
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

  // Bulk Operations for Semesters
  async bulkCreateSemesters(bulkData: any) {
    return this.post('/api/semesters/bulk-create', bulkData)
  }

  async bulkEnrollStudents(enrollmentData: any) {
    return this.post('/api/semesters/bulk-enroll-students', enrollmentData)
  }

  async promoteStudents(promotionData: any) {
    return this.post('/api/semesters/promote-students', promotionData)
  }

  async getSemesterPerformanceSummary(semesterId: number) {
    return this.get(`/api/semesters/performance-summary?semester_id=${semesterId}`)
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

  // Bulk Operations for Exams
  async bulkCreateQuestions(bulkData: any) {
    return this.post('/api/exams/bulk-create-questions', bulkData)
  }

  async bulkCreateExams(bulkData: any) {
    return this.post('/api/exams/bulk-create-exams', bulkData)
  }

  async bulkUploadMarks(bulkData: any) {
    return this.post('/api/exams/bulk-upload-marks', bulkData)
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

  // Enhanced Marks Analytics
  async getGradeDistribution(params?: any) {
    return this.get('/api/marks/grade-distribution', { params })
  }

  async getPerformanceTrends(params?: any) {
    return this.get('/api/marks/performance-trends', { params })
  }

  async getClassRankings(classId: number, params?: any) {
    return this.get(`/api/marks/class-rankings?class_id=${classId}`, { params })
  }

  async getSubjectAnalytics(subjectId: number, params?: any) {
    return this.get(`/api/marks/subject-analytics?subject_id=${subjectId}`, { params })
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
    return this.get('/api/copo-mappings', { params })
  }

  // Enhanced Analytics Endpoints
  async getPerformanceAnalytics(params?: any) {
    return this.get('/api/analytics/performance', { params })
  }

  async getStudentAnalytics(studentId: number) {
    return this.get(`/api/analytics/students/${studentId}`)
  }

  async getTeacherAnalytics(teacherId: number) {
    return this.get(`/api/analytics/teachers/${teacherId}`)
  }

  async getDepartmentAnalytics(departmentId: number) {
    return this.get(`/api/analytics/departments/${departmentId}`)
  }

  // Export Functionality
  async exportUsers(format: string = 'csv', params?: any) {
    return this.get(`/api/analytics/export/users?format=${format}`, { params })
  }

  async exportStudents(format: string = 'csv', params?: any) {
    return this.get(`/api/analytics/export/students?format=${format}`, { params })
  }

  async exportExams(format: string = 'csv', params?: any) {
    return this.get(`/api/analytics/export/exams?format=${format}`, { params })
  }

  async exportMarks(format: string = 'csv', params?: any) {
    return this.get(`/api/analytics/export/marks?format=${format}`, { params })
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

  async getUnreadNotificationCount() {
    return this.get('/api/notifications/unread-count')
  }

  async getSystemMetrics() {
    return this.get('/api/system/metrics')
  }

  async getSystemAlerts() {
    return this.get('/api/system/alerts')
  }

  async getSystemHealth() {
    return this.get('/api/system/health')
  }

  async getCOAttainment(params?: any) {
    return this.get('/api/analytics/co-attainment', { params })
  }

  async getPOAttainment(params?: any) {
    return this.get('/api/analytics/po-attainment', { params })
  }

  async getQuestionBanks(params?: any) {
    return this.get('/api/question-banks', { params })
  }

  async getQuestionBankQuestions(bankId: number) {
    return this.get(`/api/question-banks/${bankId}/questions`)
  }

  async getAttendanceRecords(params?: any) {
    return this.get('/api/attendance', { params })
  }

  // Question Bank Management
  async createQuestionBank(bankData: any) {
    return this.post('/api/question-banks', bankData)
  }

  async deleteQuestionBank(bankId: number) {
    return this.delete(`/api/question-banks/${bankId}`)
  }

  async removeQuestionFromBank(bankId: number, questionId: number) {
    return this.delete(`/api/question-banks/${bankId}/questions/${questionId}`)
  }

  async addQuestionToBank(bankId: number, questionId: number) {
    return this.post(`/api/question-banks/${bankId}/questions`, { question_id: questionId })
  }

  // Notification Management
  async markNotificationAsRead(notificationId: number) {
    return this.put(`/api/notifications/${notificationId}/read`)
  }

  async markAllNotificationsAsRead() {
    return this.put('/api/notifications/read-all')
  }

  async deleteNotification(notificationId: number) {
    return this.delete(`/api/notifications/${notificationId}`)
  }

  // Attendance Management
  async createAttendanceRecord(attendanceData: any) {
    return this.post('/api/attendance', attendanceData)
  }

  async updateAttendanceRecord(attendanceId: number, attendanceData: any) {
    return this.put(`/api/attendance/${attendanceId}`, attendanceData)
  }

  async deleteAttendanceRecord(attendanceId: number) {
    return this.delete(`/api/attendance/${attendanceId}`)
  }

  // Predictive Analytics
  async trainModels() {
    return this.post('/api/analytics/train-models')
  }

  async getPerformancePredictions(filters?: any) {
    return this.get('/api/analytics/performance-predictions', { params: filters })
  }

  async getTrendAnalysis(metric: string, timeRange: string) {
    return this.get('/api/analytics/trend-analysis', { 
      params: { metric, time_range: timeRange } 
    })
  }

  async getRiskAssessment(studentId: number, filters?: any) {
    return this.get('/api/analytics/risk-assessment', { 
      params: { student_id: studentId, ...filters } 
    })
  }

  async getPredictiveInsights() {
    return this.get('/api/analytics/predictive-insights')
  }

  async generateRecommendations(studentId: number, context: any) {
    return this.post('/api/analytics/generate-recommendations', {
      student_id: studentId,
      context
    })
  }

  async getCOPOPerformanceAnalysis(filters?: any) {
    return this.get('/api/analytics/copo-attainment-analysis', { params: filters })
  }

  async getEarlyWarningSignals() {
    return this.get('/api/analytics/early-warning-signals')
  }

  async predictExamOutcomes(examId: number, studentIds: number[]) {
    return this.post('/api/analytics/predict-exam-outcomes', {
      exam_id: examId,
      student_ids: studentIds
    })
  }

  async getModelPerformance() {
    return this.get('/api/analytics/model-performance')
  }

  // Promotion Management
  async getPromotionStudents(params?: any) {
    return this.get('/api/students/promotion', { params })
  }

  async getPromotionBatches(params?: any) {
    return this.get('/api/promotion/batches', { params })
  }

  async downloadMarksTemplate(examId: number) {
    return this.get(`/api/marks/template/${examId}`, { responseType: 'blob' })
  }

  async calculateCOAttainment(examId: number) {
    return this.post(`/api/copo/calculate-attainment`, { exam_id: examId })
  }

  async deleteMark(markId: number) {
    return this.delete(`/api/marks/${markId}`)
  }
}

export const apiClient = new ApiClient()
