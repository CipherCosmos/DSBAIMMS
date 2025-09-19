import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  })

  // Helper method for direct service calls
  private async directServiceCall(serviceUrl: string, method: string, endpoint: string, data?: any, params?: any) {
    const directClient = axios.create({
      baseURL: serviceUrl,
      timeout: 10000,
    })
    
    // Add auth token
    const token = localStorage.getItem('access_token')
    if (token) {
      directClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    
    const response = await directClient[method](endpoint, data, { params })
    return response.data
  }

  constructor() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
        // Return the full error object to preserve structure
        return Promise.reject(error)
      }
    )
  }

  // ==================== AUTH SERVICE ====================
  async login(username: string, password: string) {
    return this.client.post('/api/auth/login', { username, password })
  }

  async getCurrentUser() {
    return this.client.get('/api/auth/me')
  }

  async logout() {
    return this.client.post('/api/auth/logout')
  }

  async changePassword(passwordData: { current_password: string; new_password: string }) {
    return this.client.post('/api/auth/change-password', passwordData)
  }

  // ==================== USER SERVICE ====================
  async getUsers(params?: any) {
    return this.client.get('/api/users', { params })
  }

  async getUser(id: number) {
    return this.client.get(`/api/users/${id}`)
  }

  async createUser(userData: any) {
    return this.client.post('/api/users', userData)
  }

  async updateUser(id: number, userData: any) {
    return this.client.put(`/api/users/${id}`, userData)
  }

  async deleteUser(id: number) {
    return this.client.delete(`/api/users/${id}`)
  }

  async bulkUpdateUsers(userIds: number[], updateData: any) {
    return this.client.post('/api/users/bulk-update', { user_ids: userIds, update_data: updateData })
  }

  async bulkDeleteUsers(userIds: number[]) {
    return this.client.post('/api/users/bulk-delete', { user_ids: userIds })
  }

  async resetUserPassword(userId: number) {
    return this.client.post(`/api/users/${userId}/reset-password`)
  }

  async getUserStats() {
    return this.client.get('/api/users/stats')
  }

  async getFieldConfig(role: string) {
    return this.client.get(`/api/users/field-config/${role}`)
  }

  async getAvailableRoles() {
    return this.client.get('/api/users/available-roles')
  }

  async getSubjects(departmentId?: number) {
    return this.client.get('/api/users/subjects', { params: { department_id: departmentId } })
  }

  async assignSubjects(userId: number, subjectIds: number[]) {
    return this.client.post(`/api/users/${userId}/subjects`, { subject_ids: subjectIds })
  }

  async exportUsers(format: string = 'csv', role?: string, departmentId?: number) {
    return this.client.get('/api/exports/users/csv', { 
      params: { format, role, department_id: departmentId } 
    })
  }

  // ==================== DEPARTMENT SERVICE ====================
  async getDepartments(params?: any) {
    return this.client.get('/api/departments', { params })
  }

  async getDepartment(id: number) {
    return this.client.get(`/api/departments/${id}`)
  }

  async createDepartment(departmentData: any) {
    return this.client.post('/api/departments', departmentData)
  }

  async updateDepartment(id: number, departmentData: any) {
    return this.client.put(`/api/departments/${id}`, departmentData)
  }

  async deleteDepartment(id: number) {
    return this.client.delete(`/api/departments/${id}`)
  }

  // Bulk operations for departments
  async bulkCreateDepartments(departments: any[]) {
    return this.client.post('/api/departments/bulk-create', departments)
  }

  async bulkUpdateDepartments(updates: any[]) {
    return this.client.post('/api/departments/bulk-update', updates)
  }

  async bulkDeleteDepartments(ids: number[]) {
    return this.client.post('/api/departments/bulk-delete', ids)
  }

  async getAvailableHODs() {
    return this.client.get('/api/departments/available-hods')
  }

  // ==================== CLASS SERVICE ====================
  async getClasses(params?: any) {
    return this.directServiceCall('http://localhost:8012', 'get', '/classes', undefined, params)
  }

  async getClass(id: number) {
    return this.directServiceCall('http://localhost:8012', 'get', `/classes/${id}`)
  }

  async createClass(classData: any) {
    return this.directServiceCall('http://localhost:8012', 'post', '/classes', classData)
  }

  async updateClass(id: number, classData: any) {
    return this.directServiceCall('http://localhost:8012', 'put', `/classes/${id}`, classData)
  }

  async deleteClass(id: number) {
    return this.directServiceCall('http://localhost:8012', 'delete', `/classes/${id}`)
  }

  // ==================== SUBJECT SERVICE ====================
  async getSubjects(params?: any) {
    return this.directServiceCall('http://localhost:8012', 'get', '/subjects', undefined, params)
  }

  async getSubject(id: number) {
    return this.directServiceCall('http://localhost:8012', 'get', `/subjects/${id}`)
  }

  async createSubject(subjectData: any) {
    return this.directServiceCall('http://localhost:8012', 'post', '/subjects', subjectData)
  }

  async updateSubject(id: number, subjectData: any) {
    return this.directServiceCall('http://localhost:8012', 'put', `/subjects/${id}`, subjectData)
  }

  async deleteSubject(id: number) {
    return this.directServiceCall('http://localhost:8012', 'delete', `/subjects/${id}`)
  }

  // ==================== PO SERVICE ====================
  async getPOs(params?: any) {
    return this.client.get('/api/pos', { params })
  }

  async getPO(id: number) {
    return this.client.get(`/api/pos/${id}`)
  }

  async createPO(poData: any) {
    return this.client.post('/api/pos', poData)
  }

  async updatePO(id: number, poData: any) {
    return this.client.put(`/api/pos/${id}`, poData)
  }

  async deletePO(id: number) {
    return this.client.delete(`/api/pos/${id}`)
  }

  // ==================== CO SERVICE ====================
  async getCOs(params?: any) {
    return this.client.get('/api/cos', { params })
  }

  async getCO(id: number) {
    return this.client.get(`/api/cos/${id}`)
  }

  async createCO(coData: any) {
    return this.client.post('/api/cos', coData)
  }

  async updateCO(id: number, coData: any) {
    return this.client.put(`/api/cos/${id}`, coData)
  }

  async deleteCO(id: number) {
    return this.client.delete(`/api/cos/${id}`)
  }

  // ==================== CO-PO MAPPING SERVICE ====================
  async getCOPOMappings(params?: any) {
    return this.client.get('/api/co-po-mappings', { params })
  }

  async getCOPOMapping(id: number) {
    return this.client.get(`/api/co-po-mappings/${id}`)
  }

  async createCOPOMapping(mappingData: any) {
    return this.client.post('/api/co-po-mappings', mappingData)
  }

  async updateCOPOMapping(id: number, mappingData: any) {
    return this.client.put(`/api/co-po-mappings/${id}`, mappingData)
  }

  async deleteCOPOMapping(id: number) {
    return this.client.delete(`/api/co-po-mappings/${id}`)
  }

  // ==================== EXAM SERVICE ====================
  async getExams(params?: any) {
    return this.client.get('/api/exams', { params })
  }

  async getExam(id: number) {
    return this.client.get(`/api/exams/${id}`)
  }

  async createExam(examData: any) {
    return this.client.post('/api/exams', examData)
  }

  async updateExam(id: number, examData: any) {
    return this.client.put(`/api/exams/${id}`, examData)
  }

  async deleteExam(id: number) {
    return this.client.delete(`/api/exams/${id}`)
  }

  async publishExam(id: number) {
    return this.client.put(`/api/exams/${id}/publish`)
  }

  // ==================== EXAM SECTION SERVICE ====================
  async getExamSections(examId: number) {
    return this.client.get(`/api/exam-sections?exam_id=${examId}`)
  }

  async createExamSection(sectionData: any) {
    return this.client.post('/api/exam-sections', sectionData)
  }

  async updateExamSection(sectionId: number, sectionData: any) {
    return this.client.put(`/api/exam-sections/${sectionId}`, sectionData)
  }

  async deleteExamSection(sectionId: number) {
    return this.client.delete(`/api/exam-sections/${sectionId}`)
  }

  // ==================== QUESTION SERVICE ====================
  async getQuestions(params?: any) {
    return this.client.get('/api/questions', { params })
  }

  async getQuestion(id: number) {
    return this.client.get(`/api/questions/${id}`)
  }

  async createQuestion(questionData: any) {
    return this.client.post('/api/questions', questionData)
  }

  async createEnhancedQuestion(questionData: any) {
    return this.client.post('/api/questions/enhanced', questionData)
  }

  async updateQuestion(id: number, questionData: any) {
    return this.client.put(`/api/questions/${id}`, questionData)
  }

  async deleteQuestion(id: number) {
    return this.client.delete(`/api/questions/${id}`)
  }

  // ==================== MARKS SERVICE ====================
  async getMarks(params?: any) {
    return this.client.get('/api/marks', { params })
  }

  async getMark(id: number) {
    return this.client.get(`/api/marks/${id}`)
  }

  async createMark(markData: any) {
    return this.client.post('/api/marks', markData)
  }

  async updateMark(id: number, markData: any) {
    return this.client.put(`/api/marks/${id}`, markData)
  }

  async deleteMark(id: number) {
    return this.client.delete(`/api/marks/${id}`)
  }

  async createMarksBulk(marksData: any) {
    return this.client.post('/api/marks/bulk', marksData)
  }

  async uploadMarksExcel(examId: number, formData: FormData) {
    return this.client.post(`/api/marks/upload-excel?exam_id=${examId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async getStudentScores(examId: number, useSmartScoring?: boolean) {
    return this.client.get(`/api/marks/${examId}/student-scores`, {
      params: { use_smart_scoring: useSmartScoring }
    })
  }

  async downloadMarksTemplate(examId: number) {
    return this.client.get(`/api/marks/${examId}/template`, {
      responseType: 'blob'
    })
  }

  async calculateCOAttainment(examId: number, threshold?: number) {
    return this.client.get(`/api/marks/${examId}/co-attainment`, {
      params: { threshold }
    })
  }

  // ==================== ANALYTICS SERVICE ====================
  async getDashboardStats(params?: any) {
    return this.client.get('/api/analytics/dashboard-stats', { params })
  }

  async getCOAttainment(params?: any) {
    return this.client.get('/api/analytics/co-attainment', { params })
  }

  async getPOAttainment(params?: any) {
    return this.client.get('/api/analytics/po-attainment', { params })
  }

  async getStudentPerformance(params?: any) {
    return this.client.get('/api/analytics/student-performance', { params })
  }

  async getQuestionAnalytics(params?: any) {
    return this.client.get('/api/analytics/question-analytics', { params })
  }

  async getExamAnalytics(params?: any) {
    return this.client.get('/api/analytics/exam-analytics', { params })
  }

  async getMLRecommendations(params?: any) {
    return this.client.get('/api/analytics/ml-recommendations', { params })
  }

  async getTrends(metric: string, params?: any) {
    return this.client.get(`/api/analytics/trends/${metric}`, { params })
  }

  // ==================== NOTIFICATION SERVICE ====================
  async getNotifications(params?: any) {
    return this.client.get('/api/notifications', { params })
  }

  async getNotification(id: number) {
    return this.client.get(`/api/notifications/${id}`)
  }

  async createNotification(notificationData: any) {
    return this.client.post('/api/notifications', notificationData)
  }

  async updateNotification(id: number, notificationData: any) {
    return this.client.put(`/api/notifications/${id}`, notificationData)
  }

  async deleteNotification(id: number) {
    return this.client.delete(`/api/notifications/${id}`)
  }

  async getUnreadCount() {
    const response = await this.client.get('/api/notifications/unread-count')
    console.log('getUnreadCount response:', response)
    return response
  }

  async markAllRead() {
    return this.client.post('/api/notifications/mark-all-read')
  }

  async markAsRead(id: number) {
    return this.client.put(`/api/notifications/${id}/read`)
  }

  async getSystemStats() {
    return this.client.get('/api/notifications/system-stats')
  }

  // ==================== FILE SERVICE ====================
  async uploadFile(formData: FormData) {
    return this.client.post('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async getFiles(params?: any) {
    return this.client.get('/api/files', { params })
  }

  async getFile(id: number) {
    return this.client.get(`/api/files/${id}`)
  }

  async downloadFile(id: number) {
    return this.client.get(`/api/files/${id}/download`, {
      responseType: 'blob'
    })
  }

  async previewFile(id: number) {
    return this.client.get(`/api/files/${id}/preview`)
  }

  async deleteFile(id: number) {
    return this.client.delete(`/api/files/${id}`)
  }

  async getFileCategories() {
    return this.client.get('/api/files/categories')
  }

  async getStorageStats() {
    return this.client.get('/api/files/storage-stats')
  }

  // ==================== QUESTION BANK SERVICE ====================
  async getQuestionBanks(params?: any) {
    return this.client.get('/api/questionbank', { params })
  }

  async getQuestionBank(id: number) {
    return this.client.get(`/api/questionbank/${id}`)
  }

  async createQuestionBank(bankData: any) {
    return this.client.post('/api/questionbank', bankData)
  }

  async updateQuestionBank(id: number, bankData: any) {
    return this.client.put(`/api/questionbank/${id}`, bankData)
  }

  async deleteQuestionBank(id: number) {
    return this.client.delete(`/api/questionbank/${id}`)
  }

  async getBankQuestions(bankId: number, params?: any) {
    return this.client.get(`/api/questionbank/${bankId}/questions`, { params })
  }

  async addQuestionToBank(bankId: number, questionId: number) {
    return this.client.post(`/api/questionbank/${bankId}/questions`, { question_id: questionId })
  }

  async removeQuestionFromBank(bankId: number, questionId: number) {
    return this.client.delete(`/api/questionbank/${bankId}/questions/${questionId}`)
  }

  async getBankStats(bankId: number) {
    return this.client.get(`/api/questionbank/${bankId}/stats`)
  }

  // ==================== BULK OPERATIONS SERVICE ====================
  async bulkCreateUsers(formData: FormData) {
    return this.client.post('/api/bulk/upload/users', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async validateUsersUpload(formData: FormData) {
    return this.client.post('/api/bulk/upload/users/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async bulkCreateQuestions(formData: FormData) {
    return this.client.post('/api/bulk/upload/questions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async validateQuestionsUpload(formData: FormData) {
    return this.client.post('/api/bulk/upload/questions/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async bulkCreateClasses(formData: FormData) {
    return this.client.post('/api/bulk/upload/classes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async validateClassesUpload(formData: FormData) {
    return this.client.post('/api/bulk/upload/classes/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async bulkCreateSubjects(formData: FormData) {
    return this.client.post('/api/bulk/upload/subjects', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async validateSubjectsUpload(formData: FormData) {
    return this.client.post('/api/bulk/upload/subjects/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async bulkCreateCOPOMappings(formData: FormData) {
    return this.client.post('/api/bulk/upload/co-po-mappings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async validateCOPOMappingsUpload(formData: FormData) {
    return this.client.post('/api/bulk/upload/co-po-mappings/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async bulkCreateMarks(formData: FormData) {
    return this.client.post('/api/bulk/upload/marks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  async validateMarksUpload(formData: FormData) {
    return this.client.post('/api/bulk/upload/marks/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  // Template downloads
  async downloadUsersTemplate() {
    return this.client.get('/api/bulk/template/users', {
      responseType: 'blob'
    })
  }

  async downloadQuestionsTemplate() {
    return this.client.get('/api/bulk/template/questions', {
      responseType: 'blob'
    })
  }

  async downloadClassesTemplate() {
    return this.client.get('/api/bulk/template/classes', {
      responseType: 'blob'
    })
  }

  async downloadSubjectsTemplate() {
    return this.client.get('/api/bulk/template/subjects', {
      responseType: 'blob'
    })
  }

  async downloadCOPOMappingsTemplate() {
    return this.client.get('/api/bulk/template/co-po-mappings', {
      responseType: 'blob'
    })
  }

  async downloadMarksTemplate(examId: number) {
    return this.client.get(`/api/bulk/template/marks?exam_id=${examId}`, {
      responseType: 'blob'
    })
  }

  // ==================== EXPORT SERVICE ====================
  async exportUsers(format: string = 'csv', params?: any) {
    return this.client.get(`/api/exports/users/csv`, {
      params: { format, ...params }
    })
  }

  async exportMarks(examId: number, format: string = 'csv') {
    return this.client.get(`/api/exports/marks/${examId}/${format}`, {
      responseType: 'blob'
    })
  }

  async exportCOAttainment(format: string = 'csv', params?: any) {
    return this.client.get(`/api/exports/co-attainment/${format}`, {
      responseType: 'blob',
      params
    })
  }

  async exportComprehensiveReport(format: string = 'pdf', params?: any) {
    return this.client.get(`/api/exports/comprehensive-report/${format}`, {
      responseType: 'blob',
      params
    })
  }

  async generateReport(reportType: string, params?: any) {
    return this.client.post('/api/exports/reports/generate', { report_type: reportType, ...params })
  }

  async downloadReport(reportId: string) {
    return this.client.get(`/api/exports/reports/download/${reportId}`, {
      responseType: 'blob'
    })
  }

  async scheduleExport(exportRequest: any) {
    return this.client.post('/api/exports/schedule-export', exportRequest)
  }

  // ==================== MONITORING SERVICE ====================
  async getSystemHealth() {
    return this.client.get('/api/monitoring/health')
  }

  async getSystemMetrics() {
    return this.client.get('/api/monitoring/metrics')
  }

  async getSystemAlerts() {
    return this.client.get('/api/monitoring/alerts')
  }

  async getSystemLogs(params?: any) {
    return this.client.get('/api/monitoring/logs', { params })
  }

  async getPerformanceMetrics(params?: any) {
    return this.client.get('/api/monitoring/performance', { params })
  }

  async createBackup() {
    return this.client.post('/api/monitoring/backup')
  }

  async listBackups() {
    return this.client.get('/api/monitoring/backups')
  }

  async getAuditLogs(params?: any) {
    return this.client.get('/api/monitoring/audit-logs', { params })
  }

  // ==================== WEBSOCKET CONNECTIONS ====================
  connectWebSocket(userId: number) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/notifications/ws/${userId}`
    return new WebSocket(wsUrl)
  }
}

export const apiClient = new ApiClient()