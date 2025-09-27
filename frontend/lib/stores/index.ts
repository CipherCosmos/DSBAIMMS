// Import stores first
import { useAuthStore } from './auth.store'
import { useUIStore } from './ui.store'
import { useUsersStore } from './users.store'
import { useDepartmentsStore } from './departments.store'
import { useNotificationsStore } from './notifications.store'

// Export all stores for easy importing
export { useAuthStore } from './auth.store'
export { useUIStore } from './ui.store'
export { useUsersStore } from './users.store'
export { useDepartmentsStore } from './departments.store'
export { useNotificationsStore } from './notifications.store'

// Store types for better TypeScript support
export type { AuthState } from './auth.store'
export type { UIState } from './ui.store'
export type { UsersState } from './users.store'
export type { DepartmentsState } from './departments.store'
export type { NotificationsState } from './notifications.store'

// Store utilities
export const storeUtils = {
  // Reset all stores (useful for logout)
  resetAllStores: () => {
    useAuthStore.getState().logout()
    useUIStore.getState().clearAllNotifications()
    useUsersStore.getState().reset()
    useDepartmentsStore.getState().reset()
    useNotificationsStore.getState().reset()
  },

  // Get store states for debugging
  getStoreStates: () => ({
    auth: useAuthStore.getState(),
    ui: useUIStore.getState(),
    users: useUsersStore.getState(),
    departments: useDepartmentsStore.getState(),
    notifications: useNotificationsStore.getState(),
  }),

  // Subscribe to store changes for debugging
  subscribeToAllStores: (callback: (state: any) => void) => {
    const unsubscribes = [
      useAuthStore.subscribe(callback),
      useUIStore.subscribe(callback),
      useUsersStore.subscribe(callback),
      useDepartmentsStore.subscribe(callback),
      useNotificationsStore.subscribe(callback),
    ]

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
    }
  },
}
