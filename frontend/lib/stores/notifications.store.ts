import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { notificationsService } from '@/lib/services'
import type { Notification, CreateNotificationRequest, UpdateNotificationRequest, PaginatedResponse } from '@/lib/services'

export interface NotificationsState {
  // State
  notifications: Notification[]
  unreadCount: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    type?: string
    priority?: string
    is_read?: boolean
  }
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchNotifications: (params?: {
    page?: number
    limit?: number
    type?: string
    priority?: string
    is_read?: boolean
  }) => Promise<void>
  
  fetchNotification: (id: number) => Promise<void>
  createNotification: (notificationData: CreateNotificationRequest) => Promise<Notification>
  updateNotification: (id: number, notificationData: UpdateNotificationRequest) => Promise<Notification>
  deleteNotification: (id: number) => Promise<void>
  
  // Notification actions
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  
  // Bulk operations
  bulkDeleteNotifications: (notificationIds: number[]) => Promise<void>
  bulkUpdateNotifications: (updates: Array<{ id: number; data: UpdateNotificationRequest }>) => Promise<void>
  
  // Utility actions
  setFilters: (filters: Partial<NotificationsState['filters']>) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  notifications: [],
  unreadCount: 0,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {},
  isLoading: false,
  error: null,
}

export const useNotificationsStore = create<NotificationsState>()(
  immer((set, get) => ({
    ...initialState,

    fetchNotifications: async (params = {}) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const currentState = get()
        const queryParams = {
          page: params.page || currentState.pagination.page,
          limit: params.limit || currentState.pagination.limit,
          ...currentState.filters,
          ...params,
        }

        const response: PaginatedResponse<Notification> = await notificationsService.getNotifications(queryParams)
        
        set((state) => {
          state.notifications = response.data
          state.pagination = response.pagination
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to fetch notifications'
        })
        throw error
      }
    },

    fetchNotification: async (id: number) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await notificationsService.getNotification(id)
        
        set((state) => {
          const index = state.notifications.findIndex(notif => notif.id === id)
          if (index !== -1) {
            state.notifications[index] = response.data
          }
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to fetch notification'
        })
        throw error
      }
    },

    createNotification: async (notificationData: CreateNotificationRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await notificationsService.createNotification(notificationData)
        
        set((state) => {
          state.notifications.unshift(response.data)
          state.pagination.total += 1
          state.isLoading = false
          state.error = null
        })

        return response.data
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to create notification'
        })
        throw error
      }
    },

    updateNotification: async (id: number, notificationData: UpdateNotificationRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await notificationsService.updateNotification(id, notificationData)
        
        set((state) => {
          const index = state.notifications.findIndex(notif => notif.id === id)
          if (index !== -1) {
            state.notifications[index] = response.data
          }
          state.isLoading = false
          state.error = null
        })

        return response.data
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to update notification'
        })
        throw error
      }
    },

    deleteNotification: async (id: number) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        await notificationsService.deleteNotification(id)
        
        set((state) => {
          state.notifications = state.notifications.filter(notif => notif.id !== id)
          state.pagination.total -= 1
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to delete notification'
        })
        throw error
      }
    },

    markAsRead: async (id: number) => {
      try {
        await notificationsService.markNotificationAsRead(id)
        
        set((state) => {
          const notification = state.notifications.find(notif => notif.id === id)
          if (notification && !notification.is_read) {
            notification.is_read = true
            state.unreadCount = Math.max(0, state.unreadCount - 1)
          }
        })
      } catch (error: any) {
        set((state) => {
          state.error = error.message || 'Failed to mark notification as read'
        })
        throw error
      }
    },

    markAllAsRead: async () => {
      try {
        await notificationsService.markAllNotificationsAsRead()
        
        set((state) => {
          state.notifications.forEach(notification => {
            notification.is_read = true
          })
          state.unreadCount = 0
        })
      } catch (error: any) {
        set((state) => {
          state.error = error.message || 'Failed to mark all notifications as read'
        })
        throw error
      }
    },

    fetchUnreadCount: async () => {
      try {
        const response = await notificationsService.getUnreadCount()
        
        set((state) => {
          state.unreadCount = response.data.count
        })
      } catch (error: any) {
        set((state) => {
          state.error = error.message || 'Failed to fetch unread count'
        })
        throw error
      }
    },

    bulkDeleteNotifications: async (notificationIds: number[]) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await notificationsService.bulkDeleteNotifications(notificationIds)
        
        set((state) => {
          state.notifications = state.notifications.filter(notif => !notificationIds.includes(notif.id))
          state.pagination.total -= response.data.deleted_count
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk delete notifications'
        })
        throw error
      }
    },

    bulkUpdateNotifications: async (updates: Array<{ id: number; data: UpdateNotificationRequest }>) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await notificationsService.bulkUpdateNotifications(updates)
        
        set((state) => {
          updates.forEach(({ id, data }) => {
            const index = state.notifications.findIndex(notif => notif.id === id)
            if (index !== -1) {
              state.notifications[index] = { ...state.notifications[index], ...data }
            }
          })
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk update notifications'
        })
        throw error
      }
    },

    setFilters: (filters: Partial<NotificationsState['filters']>) => {
      set((state) => {
        state.filters = { ...state.filters, ...filters }
        state.pagination.page = 1 // Reset to first page when filters change
      })
    },

    clearError: () => {
      set((state) => {
        state.error = null
      })
    },

    reset: () => {
      set(() => ({ ...initialState }))
    },
  }))
)
