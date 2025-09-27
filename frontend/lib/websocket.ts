'use client'

import { useState, useEffect } from 'react'

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 3000
  private listeners: Map<string, Function[]> = new Map()

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          this.emit('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.emit(data.type, data.payload)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
          this.emit('disconnected')
          this.handleReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.emit('error', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      
      setTimeout(() => {
        this.connect().catch(console.error)
      }, this.reconnectInterval)
    } else {
      console.error('Max reconnection attempts reached')
      this.emit('max_reconnect_attempts_reached')
    }
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

// Analytics WebSocket Service
export class AnalyticsWebSocketService extends WebSocketService {
  constructor() {
    super('ws://localhost:8001/ws/analytics')
  }

  subscribeToRealtimeStats(callback: (data: any) => void) {
    this.on('realtime_stats', callback)
  }

  subscribeToPredictiveUpdates(callback: (data: any) => void) {
    this.on('predictive_update', callback)
  }

  subscribeToExamUpdates(callback: (data: any) => void) {
    this.on('exam_update', callback)
  }

  subscribeToMarksUpdates(callback: (data: any) => void) {
    this.on('marks_update', callback)
  }

  subscribeToUserActivity(callback: (data: any) => void) {
    this.on('user_activity', callback)
  }

  requestRealtimeStats() {
    this.send('request_realtime_stats', {})
  }

  requestPredictiveAnalysis(filters: any) {
    this.send('request_predictive_analysis', filters)
  }

  subscribeToNotifications(callback: (data: any) => void) {
    this.on('notification', callback)
  }
}

// Notification WebSocket Service
export class NotificationWebSocketService extends WebSocketService {
  constructor(userId: string) {
    super(`ws://localhost:8001/ws/notifications/${userId}`)
  }

  subscribeToNotifications(callback: (notification: any) => void) {
    this.on('notification', callback)
  }

  markAsRead(notificationId: string) {
    this.send('mark_as_read', { notification_id: notificationId })
  }

  subscribeToSystemAlerts(callback: (alert: any) => void) {
    this.on('system_alert', callback)
  }
}

// Real-time Dashboard Hook
export function useRealtimeAnalytics() {
  const [wsService] = useState(() => new AnalyticsWebSocketService())
  const [connected, setConnected] = useState(false)
  const [realtimeStats, setRealtimeStats] = useState<any>(null)
  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([])
  const [userActivity, setUserActivity] = useState<any[]>([])

  useEffect(() => {
    wsService.on('connected', () => setConnected(true))
    wsService.on('disconnected', () => setConnected(false))
    wsService.on('realtime_stats', setRealtimeStats)
    wsService.on('predictive_update', (data: any) => {
      setPredictiveInsights(prev => [...prev, data])
    })
    wsService.on('user_activity', (data: any) => {
      setUserActivity(prev => [data, ...prev.slice(0, 99)]) // Keep last 100 activities
    })

    wsService.connect().catch(console.error)

    return () => {
      wsService.disconnect()
    }
  }, [wsService])

  const requestStats = () => {
    wsService.requestRealtimeStats()
  }

  const requestPredictiveAnalysis = (filters: any) => {
    wsService.requestPredictiveAnalysis(filters)
  }

  return {
    connected,
    realtimeStats,
    predictiveInsights,
    userActivity,
    requestStats,
    requestPredictiveAnalysis
  }
}

// Notification Hook
export function useRealtimeNotifications(userId: string) {
  const [wsService] = useState(() => new NotificationWebSocketService(userId))
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [systemAlerts, setSystemAlerts] = useState<any[]>([])

  useEffect(() => {
    wsService.on('connected', () => setConnected(true))
    wsService.on('disconnected', () => setConnected(false))
    wsService.on('notification', (notification: any) => {
      setNotifications(prev => [notification, ...prev])
    })
    wsService.on('system_alert', (alert: any) => {
      setSystemAlerts(prev => [alert, ...prev])
    })

    wsService.connect().catch(console.error)

    return () => {
      wsService.disconnect()
    }
  }, [wsService, userId])

  const markAsRead = (notificationId: string) => {
    wsService.markAsRead(notificationId)
  }

  return {
    connected,
    notifications,
    systemAlerts,
    markAsRead
  }
}
