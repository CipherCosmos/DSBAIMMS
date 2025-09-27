import { BaseService, ApiResponse } from './base.service'

export interface DashboardStats {
  total_users: number
  total_departments: number
  total_classes: number
  total_subjects: number
  total_exams: number
  active_semesters: number
  recent_activities: Array<{
    id: number
    type: string
    description: string
    timestamp: string
    user_name: string
  }>
}

export interface COAttainmentData {
  co_id: number
  co_name: string
  subject_name: string
  target_percentage: number
  achieved_percentage: number
  gap: number
  exam_count: number
}

export interface POAttainmentData {
  po_id: number
  po_name: string
  target_percentage: number
  achieved_percentage: number
  gap: number
  contributing_cos: number
}

export interface StudentPerformanceData {
  student_id: number
  student_name: string
  class_name: string
  overall_percentage: number
  attendance_percentage: number
  subject_performances: Array<{
    subject_name: string
    marks_obtained: number
    total_marks: number
    percentage: number
  }>
}

export interface QuestionAnalytics {
  question_id: number
  question_text: string
  difficulty_level: string
  bloom_taxonomy_level: string
  average_marks: number
  total_marks: number
  success_rate: number
  co_mapping: string
}

export interface ExamAnalyticsData {
  exam_id: number
  exam_title: string
  subject_name: string
  total_students: number
  completed_students: number
  average_marks: number
  pass_rate: number
  difficulty_distribution: {
    easy: number
    medium: number
    hard: number
  }
}

export interface TrendData {
  date: string
  value: number
  label?: string
}

export interface MLRecommendation {
  type: 'student' | 'teacher' | 'subject' | 'exam'
  id: number
  name: string
  recommendation: string
  confidence_score: number
  priority: 'high' | 'medium' | 'low'
}

export class AnalyticsService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getDashboardStats(params?: {
    department_id?: number
    semester_id?: number
  }): Promise<ApiResponse<DashboardStats>> {
    return this.get('/api/analytics/dashboard-stats', { params })
  }

  async getCOAttainment(params?: {
    department_id?: number
    subject_id?: number
    semester_id?: number
    threshold?: number
  }): Promise<ApiResponse<COAttainmentData[]>> {
    return this.get('/api/analytics/co-attainment', { params })
  }

  async getPOAttainment(params?: {
    department_id?: number
    semester_id?: number
    threshold?: number
  }): Promise<ApiResponse<POAttainmentData[]>> {
    return this.get('/api/analytics/po-attainment', { params })
  }

  async getStudentPerformance(params?: {
    class_id?: number
    subject_id?: number
    semester_id?: number
    min_percentage?: number
    max_percentage?: number
  }): Promise<ApiResponse<StudentPerformanceData[]>> {
    return this.get('/api/analytics/student-performance', { params })
  }

  async getQuestionAnalytics(params?: {
    exam_id?: number
    subject_id?: number
    difficulty_level?: string
    bloom_taxonomy_level?: string
  }): Promise<ApiResponse<QuestionAnalytics[]>> {
    return this.get('/api/analytics/question-analytics', { params })
  }

  async getExamAnalytics(params?: {
    subject_id?: number
    exam_type?: string
    semester_id?: number
    start_date?: string
    end_date?: string
  }): Promise<ApiResponse<ExamAnalyticsData[]>> {
    return this.get('/api/analytics/exam-analytics', { params })
  }

  async getMLRecommendations(params?: {
    type?: string
    department_id?: number
    limit?: number
  }): Promise<ApiResponse<MLRecommendation[]>> {
    return this.get('/api/analytics/ml-recommendations', { params })
  }

  async getTrends(metric: string, params?: {
    department_id?: number
    semester_id?: number
    start_date?: string
    end_date?: string
    interval?: 'daily' | 'weekly' | 'monthly'
  }): Promise<ApiResponse<TrendData[]>> {
    return this.get(`/api/analytics/trends/${metric}`, { params })
  }

  async getAttendancePerformanceCorrelation(params?: {
    department_id?: number
    semester_id?: number
    min_attendance?: number
  }): Promise<ApiResponse<{
    correlation_coefficient: number
    data_points: Array<{
      student_id: number
      student_name: string
      attendance_percentage: number
      performance_percentage: number
    }>
  }>> {
    return this.get('/api/analytics/attendance-performance-correlation', { params })
  }

  async getExamWeightageAnalysis(params?: {
    subject_id?: number
    semester_id?: number
  }): Promise<ApiResponse<{
    subject_name: string
    total_marks: number
    weightage_distribution: Array<{
      exam_type: string
      marks: number
      percentage: number
    }>
  }>> {
    return this.get('/api/analytics/exam-weightage-analysis', { params })
  }

  async getBloomTaxonomyAttainment(params?: {
    department_id?: number
    subject_id?: number
    semester_id?: number
  }): Promise<ApiResponse<{
    taxonomy_level: string
    total_questions: number
    average_attainment: number
    improvement_needed: boolean
  }[]>> {
    return this.get('/api/analytics/bloom-taxonomy-attainment', { params })
  }

  async getCrossSemesterAnalytics(params?: {
    department_id?: number
    start_semester_id?: number
    end_semester_id?: number
  }): Promise<ApiResponse<{
    semester_comparison: Array<{
      semester_name: string
      average_performance: number
      pass_rate: number
      improvement: number
    }>
    trend_analysis: TrendData[]
  }>> {
    return this.get('/api/analytics/cross-semester', { params })
  }

  async exportAnalyticsReport(format: 'csv' | 'excel' | 'pdf', params?: {
    report_type: string
    department_id?: number
    semester_id?: number
  }): Promise<void> {
    return this.download(`/api/analytics/export/${format}`, `analytics_report.${format}`)
  }
}

