import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system'
  
  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  
  // Modals
  modals: Record<string, boolean>
  
  // Loading states
  globalLoading: boolean
  loadingStates: Record<string, boolean>
  
  // Notifications
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: number
    read: boolean
  }>
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  
  // Modal actions
  openModal: (modalId: string) => void
  closeModal: (modalId: string) => void
  closeAllModals: () => void
  
  // Loading actions
  setGlobalLoading: (loading: boolean) => void
  setLoading: (key: string, loading: boolean) => void
  isLoading: (key: string) => boolean
  
  // Notification actions
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp' | 'read'>) => void
  removeNotification: (id: string) => void
  markNotificationAsRead: (id: string) => void
  markAllNotificationsAsRead: () => void
  clearAllNotifications: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      theme: 'system',
      sidebarOpen: true,
      sidebarCollapsed: false,
      modals: {},
      globalLoading: false,
      loadingStates: {},
      notifications: [],

      // Theme actions
      setTheme: (theme) => {
        set((state) => {
          state.theme = theme
        })
      },

      // Sidebar actions
      toggleSidebar: () => {
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen
        })
      },

      setSidebarOpen: (open) => {
        set((state) => {
          state.sidebarOpen = open
        })
      },

      setSidebarCollapsed: (collapsed) => {
        set((state) => {
          state.sidebarCollapsed = collapsed
        })
      },

      // Modal actions
      openModal: (modalId) => {
        set((state) => {
          state.modals[modalId] = true
        })
      },

      closeModal: (modalId) => {
        set((state) => {
          state.modals[modalId] = false
        })
      },

      closeAllModals: () => {
        set((state) => {
          state.modals = {}
        })
      },

      // Loading actions
      setGlobalLoading: (loading) => {
        set((state) => {
          state.globalLoading = loading
        })
      },

      setLoading: (key, loading) => {
        set((state) => {
          if (loading) {
            state.loadingStates[key] = true
          } else {
            delete state.loadingStates[key]
          }
        })
      },

      isLoading: (key) => {
        return get().loadingStates[key] || false
      },

      // Notification actions
      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newNotification = {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false,
        }

        set((state) => {
          state.notifications.unshift(newNotification)
          // Keep only last 50 notifications
          if (state.notifications.length > 50) {
            state.notifications = state.notifications.slice(0, 50)
          }
        })
      },

      removeNotification: (id) => {
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id)
        })
      },

      markNotificationAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id)
          if (notification) {
            notification.read = true
          }
        })
      },

      markAllNotificationsAsRead: () => {
        set((state) => {
          state.notifications.forEach(notification => {
            notification.read = true
          })
        })
      },

      clearAllNotifications: () => {
        set((state) => {
          state.notifications = []
        })
      },
    })),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
