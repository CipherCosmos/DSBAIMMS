// Export all hooks for easy importing
export * from './useAuth'
export * from './useUsers'
export * from './useDepartments'
export * from './useNotifications'

// Re-export the old useAuth hook for backward compatibility
export { useAuth as useAuthLegacy } from './useAuth'

// Hook utilities
export const hookUtils = {
  // Get all query keys for debugging
  getAllQueryKeys: () => ({
    auth: {
      all: ['auth'],
      currentUser: ['auth', 'currentUser'],
    },
    users: {
      all: ['users'],
      lists: ['users', 'list'],
      details: ['users', 'detail'],
      stats: ['users', 'stats'],
    },
    departments: {
      all: ['departments'],
      lists: ['departments', 'list'],
      details: ['departments', 'detail'],
      availableHODs: ['departments', 'availableHODs'],
      stats: ['departments', 'stats'],
    },
    notifications: {
      all: ['notifications'],
      lists: ['notifications', 'list'],
      details: ['notifications', 'detail'],
      unreadCount: ['notifications', 'unreadCount'],
      stats: ['notifications', 'stats'],
    },
  }),

  // Invalidate all queries (useful for logout)
  invalidateAllQueries: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: ['auth'] })
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['departments'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  },

  // Clear all queries (useful for logout)
  clearAllQueries: (queryClient: any) => {
    queryClient.clear()
  },
}

