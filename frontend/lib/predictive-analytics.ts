'use client'

import { apiClient } from './api'

export interface StudentPerformanceData {
  student_id: number
  student_name: string
  marks: number[]
  attendance: number[]
  assignments: number[]
  exams: number[]
  co_attainments: Record<string, number>
  semester_data: Array<{
    semester: string
    performance: number
    attendance: number
  }>
}

export interface PredictiveModel {
  model_type: 'linear_regression' | 'neural_network' | 'random_forest'
  accuracy: number
  confidence_threshold: number
  features_used: string[]
  last_trained: string
}

export interface PerformancePrediction {
  student_id: number
  student_name: string
  current_performance: number
  predicted_performance: number
  confidence_score: number
  risk_factors: string[]
  recommendations: string[]
  next_exam_prediction: number
  trend_direction: 'up' | 'down' | 'stable'
  risk_level: 'low' | 'medium' | 'high'
}

export interface TrendAnalysis {
  metric: string
  trend: 'increasing' | 'decreasing' | 'stable'
  change_rate: number
  confidence: number
  seasonal_patterns: boolean
  outliers: Array<{
    value: number
    date: string
    reason: string
  }>
}

export interface RiskAssessment {
  student_id: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_factors: Array<{
    factor: string
    weight: number
    description: string
    recommendation: string
  }>
  intervention_needed: boolean
  priority_score: number
}

export class PredictiveAnalyticsService {
  private models: Map<string, PredictiveModel> = new Map()

  async trainModels(): Promise<void> {
    try {
      const response = await apiClient.post('/api/analytics/train-models')
      this.models = new Map(Object.entries(response.data?.models || {}))
    } catch (error) {
      console.error('Error training models:', error)
      throw error
    }
  }

  async getPerformancePredictions(
    filters: {
      department_id?: number
      semester_id?: number
      class_id?: number
      student_id?: number
    } = {}
  ): Promise<PerformancePrediction[]> {
    try {
      const response = await apiClient.get('/api/analytics/performance-predictions', {
        params: filters
      })
      return response.data
    } catch (error) {
      console.error('Error getting performance predictions:', error)
      throw error
    }
  }

  async getTrendAnalysis(
    metric: string,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<TrendAnalysis> {
    try {
      const response = await apiClient.get('/api/analytics/trend-analysis', {
        params: { metric, time_range: timeRange }
      })
      return response.data
    } catch (error) {
      console.error('Error getting trend analysis:', error)
      throw error
    }
  }

  async getRiskAssessment(
    studentId?: number,
    filters: {
      department_id?: number
      class_id?: number
      risk_level?: string
    } = {}
  ): Promise<RiskAssessment[]> {
    try {
      const response = await apiClient.get('/api/analytics/risk-assessment', {
        params: { student_id: studentId, ...filters }
      })
      return response.data
    } catch (error) {
      console.error('Error getting risk assessment:', error)
      throw error
    }
  }

  async getPredictiveInsights(): Promise<Array<{
    id: string
    type: 'performance' | 'risk' | 'opportunity' | 'trend'
    title: string
    description: string
    confidence: number
    impact: 'low' | 'medium' | 'high'
    recommendation: string
    data_points: number[]
    trend: 'up' | 'down' | 'stable'
  }>> {
    try {
      const response = await apiClient.get('/api/analytics/predictive-insights')
      return response.data
    } catch (error) {
      console.error('Error getting predictive insights:', error)
      throw error
    }
  }

  async generateRecommendations(
    studentId: number,
    context: 'academic' | 'attendance' | 'overall' = 'academic'
  ): Promise<Array<{
    category: string
    recommendation: string
    priority: 'low' | 'medium' | 'high'
    expected_impact: number
    timeline: string
  }>> {
    try {
      const response = await apiClient.post('/api/analytics/generate-recommendations', {
        student_id: studentId,
        context
      })
      return response.data
    } catch (error) {
      console.error('Error generating recommendations:', error)
      throw error
    }
  }

  async analyzeCOPOAttainment(
    filters: {
      department_id?: number
      semester_id?: number
      co_id?: number
      po_id?: number
    } = {}
  ): Promise<Array<{
    co_id: number
    co_name: string
    po_id: number
    po_name: string
    current_attainment: number
    predicted_attainment: number
    trend: 'improving' | 'declining' | 'stable'
    confidence: number
    recommendations: string[]
  }>> {
    try {
      const response = await apiClient.get('/api/analytics/copo-attainment-analysis', {
        params: filters
      })
      return response.data
    } catch (error) {
      console.error('Error analyzing CO/PO attainment:', error)
      throw error
    }
  }

  async getEarlyWarningSignals(): Promise<Array<{
    student_id: number
    student_name: string
    signal_type: 'academic' | 'attendance' | 'behavioral'
    severity: 'low' | 'medium' | 'high'
    description: string
    detected_at: string
    recommended_action: string
  }>> {
    try {
      const response = await apiClient.get('/api/analytics/early-warning-signals')
      return response.data
    } catch (error) {
      console.error('Error getting early warning signals:', error)
      throw error
    }
  }

  async predictExamOutcomes(
    examId: number,
    studentIds?: number[]
  ): Promise<Array<{
    student_id: number
    student_name: string
    predicted_score: number
    confidence: number
    preparation_level: 'low' | 'medium' | 'high'
    recommended_study_areas: string[]
  }>> {
    try {
      const response = await apiClient.post('/api/analytics/predict-exam-outcomes', {
        exam_id: examId,
        student_ids: studentIds
      })
      return response.data
    } catch (error) {
      console.error('Error predicting exam outcomes:', error)
      throw error
    }
  }

  async getModelPerformance(): Promise<Record<string, {
    model_type: string
    accuracy: number
    precision: number
    recall: number
    f1_score: number
    last_updated: string
  }>> {
    try {
      const response = await apiClient.get('/api/analytics/model-performance')
      return response.data
    } catch (error) {
      console.error('Error getting model performance:', error)
      throw error
    }
  }

  // Utility methods for client-side analysis
  calculatePerformanceTrend(performanceData: number[]): 'up' | 'down' | 'stable' {
    if (performanceData.length < 2) return 'stable'
    
    const recent = performanceData.slice(-3)
    const older = performanceData.slice(-6, -3)
    
    if (recent.length === 0 || older.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    
    const change = recentAvg - olderAvg
    const threshold = 2 // 2% threshold
    
    if (change > threshold) return 'up'
    if (change < -threshold) return 'down'
    return 'stable'
  }

  identifyRiskFactors(studentData: StudentPerformanceData): string[] {
    const riskFactors: string[] = []
    
    // Check attendance
    const avgAttendance = studentData.attendance.reduce((a, b) => a + b, 0) / studentData.attendance.length
    if (avgAttendance < 75) {
      riskFactors.push('Low attendance')
    }
    
    // Check declining performance
    const trend = this.calculatePerformanceTrend(studentData.marks)
    if (trend === 'down') {
      riskFactors.push('Declining performance')
    }
    
    // Check CO attainment gaps
    const lowCOAttainments = Object.entries(studentData.co_attainments)
      .filter(([_, value]) => value < 60)
      .map(([co, _]) => `Low ${co} attainment`)
    
    riskFactors.push(...lowCOAttainments)
    
    // Check assignment completion
    const incompleteAssignments = studentData.assignments.filter(score => score === 0).length
    if (incompleteAssignments > studentData.assignments.length * 0.3) {
      riskFactors.push('Incomplete assignments')
    }
    
    return riskFactors
  }

  generateSmartRecommendations(studentData: StudentPerformanceData): string[] {
    const recommendations: string[] = []
    
    // Attendance recommendations
    const avgAttendance = studentData.attendance.reduce((a, b) => a + b, 0) / studentData.attendance.length
    if (avgAttendance < 80) {
      recommendations.push('Improve attendance by attending all classes regularly')
    }
    
    // Performance recommendations
    const trend = this.calculatePerformanceTrend(studentData.marks)
    if (trend === 'down') {
      recommendations.push('Schedule additional study sessions with subject teachers')
    }
    
    // CO-specific recommendations
    const weakCOs = Object.entries(studentData.co_attainments)
      .filter(([_, value]) => value < 70)
      .map(([co, _]) => co)
    
    if (weakCOs.length > 0) {
      recommendations.push(`Focus on improving: ${weakCOs.join(', ')}`)
    }
    
    // Assignment recommendations
    const avgAssignmentScore = studentData.assignments.reduce((a, b) => a + b, 0) / studentData.assignments.length
    if (avgAssignmentScore < 60) {
      recommendations.push('Complete all pending assignments and seek help if needed')
    }
    
    return recommendations
  }

  calculateConfidenceScore(dataPoints: number): number {
    // Confidence based on amount of data available
    if (dataPoints >= 10) return 95
    if (dataPoints >= 7) return 85
    if (dataPoints >= 5) return 75
    if (dataPoints >= 3) return 65
    return 50
  }

  formatPredictionOutput(prediction: number): string {
    if (prediction >= 90) return 'Excellent'
    if (prediction >= 80) return 'Good'
    if (prediction >= 70) return 'Average'
    if (prediction >= 60) return 'Below Average'
    return 'Needs Improvement'
  }
}

// Singleton instance
export const predictiveAnalytics = new PredictiveAnalyticsService()
