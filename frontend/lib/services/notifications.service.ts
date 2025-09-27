import { BaseService, ApiResponse, PaginatedResponse } from './base.service'

export interface CreateNotificationRequest {
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  target_roles?: string[]
  target_users?: number[]
  target_departments?: number[]
  target_classes?: number[]
  priority: 'low' | 'medium' | 'high'
  expires_at?: string
  send_email?: boolean
  send_sms?: boolean
}

export interface UpdateNotificationRequest {
  title?: string
  message?: string
  type?: 'info' | 'warning' | 'error' | 'success'
  priority?: 'low' | 'medium' | 'high'
  expires_at?: string
  is_read?: boolean
}

export interface Notification {
  id: number
  title: string
  message: string
  type: string
  priority: string
  is_read: boolean
  created_by: number
  creator_name: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface NotificationStats {
  total_notifications: number
  unread_notifications: number
  notifications_by_type: Record<string, number>
  notifications_by_priority: Record<string, number>
}

export interface SystemStats {
  active_users: number
  system_uptime: number
  database_connections: number
  memory_usage: number
  cpu_usage: number
  disk_usage: number
}

export class NotificationsService extends BaseService {
  constructor() {
    super({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000
    })
  }

  async getNotifications(params?: {
    page?: number
    limit?: number
    type?: string
    priority?: string
    is_read?: boolean
    created_by?: number
  }): Promise<PaginatedResponse<Notification>> {
    return this.getPaginated('/api/notifications', { params })
  }

  async getNotification(id: number): Promise<ApiResponse<Notification>> {
    return this.get(`/api/notifications/${id}`)
  }

  async createNotification(notificationData: CreateNotificationRequest): Promise<ApiResponse<Notification>> {
    return this.post('/api/notifications', notificationData)
  }

  async updateNotification(id: number, notificationData: UpdateNotificationRequest): Promise<ApiResponse<Notification>> {
    return this.put(`/api/notifications/${id}`, notificationData)
  }

  async deleteNotification(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/notifications/${id}`)
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return this.get('/api/notifications/unread-count')
  }

  async markNotificationAsRead(id: number): Promise<ApiResponse<void>> {
    return this.put(`/api/notifications/${id}`, { is_read: true })
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/notifications/mark-all-read')
  }

  async getNotificationStats(): Promise<ApiResponse<NotificationStats>> {
    return this.get('/api/notifications/stats')
  }

  async getSystemStats(): Promise<ApiResponse<SystemStats>> {
    return this.get('/api/notifications/system-stats')
  }

  async bulkDeleteNotifications(notificationIds: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.post('/api/notifications/bulk-delete', { notification_ids: notificationIds })
  }

  async bulkUpdateNotifications(updates: Array<{
    id: number
    data: UpdateNotificationRequest
  }>): Promise<ApiResponse<{ updated_count: number }>> {
    return this.post('/api/notifications/bulk-update', updates)
  }

  async getNotificationTemplates(): Promise<ApiResponse<Array<{
    id: number
    name: string
    title_template: string
    message_template: string
    type: string
    variables: string[]
  }>>> {
    return this.get('/api/notifications/templates')
  }

  async createNotificationTemplate(templateData: {
    name: string
    title_template: string
    message_template: string
    type: string
    variables: string[]
  }): Promise<ApiResponse<any>> {
    return this.post('/api/notifications/templates', templateData)
  }

  async updateNotificationTemplate(id: number, templateData: {
    name?: string
    title_template?: string
    message_template?: string
    type?: string
    variables?: string[]
  }): Promise<ApiResponse<any>> {
    return this.put(`/api/notifications/templates/${id}`, templateData)
  }

  async deleteNotificationTemplate(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/notifications/templates/${id}`)
  }

  async sendBulkNotification(notificationData: CreateNotificationRequest & {
    user_ids?: number[]
    department_ids?: number[]
    class_ids?: number[]
  }): Promise<ApiResponse<{ sent_count: number }>> {
    return this.post('/api/notifications/bulk-send', notificationData)
  }

  async scheduleNotification(notificationData: CreateNotificationRequest & {
    scheduled_at: string
  }): Promise<ApiResponse<Notification>> {
    return this.post('/api/notifications/schedule', notificationData)
  }

  async getScheduledNotifications(params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<Notification>> {
    return this.getPaginated('/api/notifications/scheduled', { params })
  }

  async cancelScheduledNotification(id: number): Promise<ApiResponse<void>> {
    return this.delete(`/api/notifications/scheduled/${id}`)
  }

  async updateScheduledNotification(id: number, notificationData: {
    scheduled_at?: string
    title?: string
    message?: string
  }): Promise<ApiResponse<Notification>> {
    return this.put(`/api/notifications/scheduled/${id}`, notificationData)
  }

  async getNotificationHistory(params?: {
    page?: number
    limit?: number
    start_date?: string
    end_date?: string
    type?: string
  }): Promise<PaginatedResponse<Notification>> {
    return this.getPaginated('/api/notifications/history', { params })
  }

  async exportNotifications(format: 'csv' | 'excel' = 'csv', params?: {
    type?: string
    start_date?: string
    end_date?: string
  }): Promise<void> {
    return this.download(`/api/notifications/export/${format}`, `notifications.${format}`)
  }

  // WebSocket connection helper
  connectWebSocket(userId: number): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/notifications/ws/${userId}`
    return new WebSocket(wsUrl)
  }
}
