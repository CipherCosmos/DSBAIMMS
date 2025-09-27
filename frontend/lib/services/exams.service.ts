import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateExamRequest {
  title: string
  subject_id: number
  exam_type: 'midterm' | 'final' | 'quiz' | 'assignment'
  total_marks: number
  duration_minutes: number
  instructions?: string
  start_date: string
  end_date: string
  is_published?: boolean
}

export interface UpdateExamRequest {
  title?: string
  exam_type?: 'midterm' | 'final' | 'quiz' | 'assignment'
  total_marks?: number
  duration_minutes?: number
  instructions?: string
  start_date?: string
  end_date?: string
  is_published?: boolean
}

export interface Exam {
  id: number
  title: string
  subject_id: number
  subject_name: string
  exam_type: string
  total_marks: number
  duration_minutes: number
  instructions?: string
  start_date: string
  end_date: string
  is_published: boolean
  created_by: number
  created_at: string
  updated_at: string
}

export interface ExamSection {
  id: number
  exam_id: number
  name: string
  description?: string
  total_questions: number
  total_marks: number
  is_optional: boolean
  questions_to_answer?: number
}

export interface ExamQuestion {
  id: number
  exam_id: number
  section_id: number
  question_text: string
  marks: number
  difficulty_level: 'easy' | 'medium' | 'hard'
  bloom_taxonomy_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
  co_id?: number
  co_name?: string
  options?: string[]
  correct_answer?: string
  explanation?: string
}

export interface ExamAnalytics {
  total_students: number
  completed_students: number
  average_marks: number
  pass_rate: number
  difficulty_analysis: {
    easy: number
    medium: number
    hard: number
  }
  co_attainment: Array<{
    co_id: number
    co_name: string
    attainment_percentage: number
  }>
}

export class ExamsService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getExams(params?: {
    page?: number
    limit?: number
    subject_id?: number
    exam_type?: string
    is_published?: boolean
    search?: string
  }): Promise<PaginatedResponse<Exam>> {
    return this.getPaginated('/api/exams', { params })
  }

  async getExam(id: number): Promise<ApiResponse<Exam>> {
    return this.get(`/api/exams/${id}`)
  }

  async createExam(examData: CreateExamRequest): Promise<ApiResponse<Exam>> {
    return this.post('/api/exams', examData)
  }

  async updateExam(id: number, examData: UpdateExamRequest): Promise<ApiResponse<Exam>> {
    return this.put(`/api/exams/${id}`, examData)
  }

  async deleteExam(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/exams/${id}`)
  }

  async publishExam(id: number): Promise<ApiResponse<void>> {
    return this.put(`/api/exams/${id}/publish`)
  }

  async unpublishExam(id: number): Promise<ApiResponse<void>> {
    return this.put(`/api/exams/${id}/unpublish`)
  }

  // Exam Sections
  async getExamSections(examId: number): Promise<ApiResponse<ExamSection[]>> {
    return this.get(`/api/exam-sections?exam_id=${examId}`)
  }

  async createExamSection(sectionData: {
    exam_id: number
    name: string
    description?: string
    total_questions: number
    total_marks: number
    is_optional?: boolean
    questions_to_answer?: number
  }): Promise<ApiResponse<ExamSection>> {
    return this.post('/api/exam-sections', sectionData)
  }

  async updateExamSection(sectionId: number, sectionData: Partial<ExamSection>): Promise<ApiResponse<ExamSection>> {
    return this.put(`/api/exam-sections/${sectionId}`, sectionData)
  }

  async deleteExamSection(sectionId: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/exam-sections/${sectionId}`)
  }

  // Exam Questions
  async getExamQuestions(examId: number, params?: {
    section_id?: number
  }): Promise<ApiResponse<ExamQuestion[]>> {
    return this.get(`/api/questions?exam_id=${examId}`, { params })
  }

  async createQuestion(questionData: {
    exam_id: number
    section_id: number
    question_text: string
    marks: number
    difficulty_level: string
    bloom_taxonomy_level: string
    co_id?: number
    options?: string[]
    correct_answer?: string
    explanation?: string
  }): Promise<ApiResponse<ExamQuestion>> {
    return this.post('/api/questions', questionData)
  }

  async updateQuestion(id: number, questionData: Partial<ExamQuestion>): Promise<ApiResponse<ExamQuestion>> {
    return this.put(`/api/questions/${id}`, questionData)
  }

  async deleteQuestion(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/questions/${id}`)
  }

  async bulkCreateQuestions(examId: number, sectionId: number, questions: Partial<ExamQuestion>[]): Promise<ApiResponse<{ created_count: number }>> {
    return this.post(`/api/exams/${examId}/bulk-questions`, {
      exam_id: examId,
      section_id: sectionId,
      questions: questions
    })
  }

  async getExamAnalytics(id: number): Promise<ApiResponse<ExamAnalytics>> {
    return this.get(`/api/exams/${id}/analytics`)
  }

  async getExamStats(params?: {
    subject_id?: number
    exam_type?: string
  }): Promise<ApiResponse<{
    total_exams: number
    published_exams: number
    average_duration: number
    total_questions: number
  }>> {
    return this.get('/api/exams/stats', { params })
  }

  async exportExamAnalytics(id: number, format: 'csv' | 'excel' = 'csv'): Promise<void> {
    return this.download(`/api/exams/${id}/export/analytics?format=${format}`, `exam_${id}_analytics.${format}`)
  }

  async getExamTemplates(examType?: string): Promise<ApiResponse<any[]>> {
    return this.get('/api/exams/templates', { params: examType ? { exam_type: examType } : {} })
  }

  async createSmartExam(examData: CreateExamRequest & {
    auto_generate_questions?: boolean
    question_distribution?: Record<string, number>
  }): Promise<ApiResponse<Exam>> {
    return this.post('/api/exams/smart-create', examData)
  }

  async bulkCreateExams(examsData: CreateExamRequest[]): Promise<ApiResponse<{ created_count: number }>> {
    return this.post('/api/exams/bulk-create', examsData)
  }
}
