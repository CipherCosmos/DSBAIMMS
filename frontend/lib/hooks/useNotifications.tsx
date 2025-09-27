'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotificationsStore } from '@/lib/stores'
import { notificationsService } from '@/lib/services'
import type { CreateNotificationRequest, UpdateNotificationRequest, Notification } from '@/lib/services'

// Query keys for consistent caching
export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...notificationsKeys.lists(), { filters }] as const,
  details: () => [...notificationsKeys.all, 'detail'] as const,
  detail: (id: number) => [...notificationsKeys.details(), id] as const,
  unreadCount: () => [...notificationsKeys.all, 'unreadCount'] as const,
  stats: () => [...notificationsKeys.all, 'stats'] as const,
}

// Hook for fetching notifications list
export function useNotifications(params?: {
  page?: number
  limit?: number
  type?: string
  priority?: string
  is_read?: boolean
}) {
  const { notifications, pagination, filters, fetchNotifications } = useNotificationsStore()

  return useQuery({
    queryKey: notificationsKeys.list({ ...filters, ...params }),
    queryFn: () => fetchNotifications(params),
    staleTime: 1 * 60 * 1000, // 1 minute (notifications are time-sensitive)
    placeholderData: (previousData) => previousData,
  })
}

// Hook for fetching a single notification
export function useNotification(id: number) {
  const { fetchNotification } = useNotificationsStore()

  return useQuery({
    queryKey: notificationsKeys.detail(id),
    queryFn: () => fetchNotification(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => previousData,
  })
}

// Hook for unread count
export function useUnreadCount() {
  const { unreadCount, fetchUnreadCount } = useNotificationsStore()

  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    placeholderData: (previousData) => previousData,
  })
}

// Hook for notification stats
export function useNotificationStats() {
  return useQuery({
    queryKey: notificationsKeys.stats(),
    queryFn: () => notificationsService.getNotificationStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook for creating a notification
export function useCreateNotification() {
  const queryClient = useQueryClient()
  const { createNotification } = useNotificationsStore()

  return useMutation({
    mutationFn: createNotification,
    onSuccess: (newNotification) => {
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.stats() })
      
      // Add to cache
      queryClient.setQueryData(notificationsKeys.detail(newNotification.id), newNotification)
    },
    onError: (error: any) => {
      console.error('Create notification failed:', error)
    },
  })
}

// Hook for updating a notification
export function useUpdateNotification() {
  const queryClient = useQueryClient()
  const { updateNotification } = useNotificationsStore()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateNotificationRequest }) =>
      updateNotification(id, data),
    onSuccess: (updatedNotification) => {
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
      
      // Update cache
      queryClient.setQueryData(notificationsKeys.detail(updatedNotification.id), updatedNotification)
    },
    onError: (error: any) => {
      console.error('Update notification failed:', error)
    },
  })
}

// Hook for deleting a notification
export function useDeleteNotification() {
  const queryClient = useQueryClient()
  const { deleteNotification } = useNotificationsStore()

  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: (_, deletedId) => {
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.stats() })
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: notificationsKeys.detail(deletedId) })
    },
    onError: (error: any) => {
      console.error('Delete notification failed:', error)
    },
  })
}

// Hook for marking notification as read
export function useMarkAsRead() {
  const queryClient = useQueryClient()
  const { markAsRead } = useNotificationsStore()

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      // Invalidate notifications list and unread count
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
    },
    onError: (error: any) => {
      console.error('Mark as read failed:', error)
    },
  })
}

// Hook for marking all notifications as read
export function useMarkAllAsRead() {
  const queryClient = useQueryClient()
  const { markAllAsRead } = useNotificationsStore()

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      // Invalidate notifications list and unread count
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
    },
    onError: (error: any) => {
      console.error('Mark all as read failed:', error)
    },
  })
}

// Hook for bulk deleting notifications
export function useBulkDeleteNotifications() {
  const queryClient = useQueryClient()
  const { bulkDeleteNotifications } = useNotificationsStore()

  return useMutation({
    mutationFn: bulkDeleteNotifications,
    onSuccess: (_, deletedIds) => {
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.stats() })
      
      // Remove from cache
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: notificationsKeys.detail(id) })
      })
    },
    onError: (error: any) => {
      console.error('Bulk delete notifications failed:', error)
    },
  })
}

// Hook for bulk updating notifications
export function useBulkUpdateNotifications() {
  const queryClient = useQueryClient()
  const { bulkUpdateNotifications } = useNotificationsStore()

  return useMutation({
    mutationFn: bulkUpdateNotifications,
    onSuccess: () => {
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() })
    },
    onError: (error: any) => {
      console.error('Bulk update notifications failed:', error)
    },
  })
}

// Hook for exporting notifications
export function useExportNotifications() {
  return useMutation({
    mutationFn: ({ format, params }: { format: 'csv' | 'excel'; params?: any }) =>
      notificationsService.exportNotifications(format, params),
    onSuccess: () => {
      // Optionally show success message
    },
    onError: (error: any) => {
      console.error('Export notifications failed:', error)
    },
  })
}

// Combined notifications hook for easy access
export function useNotificationsManagement() {
  const notificationsState = useNotificationsStore()
  const notificationsQuery = useNotifications()
  const unreadCountQuery = useUnreadCount()
  const createNotificationMutation = useCreateNotification()
  const updateNotificationMutation = useUpdateNotification()
  const deleteNotificationMutation = useDeleteNotification()
  const markAsReadMutation = useMarkAsRead()
  const markAllAsReadMutation = useMarkAllAsRead()
  const bulkDeleteMutation = useBulkDeleteNotifications()
  const bulkUpdateMutation = useBulkUpdateNotifications()

  return {
    // State
    notifications: notificationsState.notifications,
    unreadCount: notificationsState.unreadCount,
    pagination: notificationsState.pagination,
    filters: notificationsState.filters,
    isLoading: notificationsState.isLoading || notificationsQuery.isLoading,
    error: notificationsState.error || notificationsQuery.error,

    // Actions
    setFilters: notificationsState.setFilters,
    clearError: notificationsState.clearError,
    reset: notificationsState.reset,

    // Mutations
    createNotification: createNotificationMutation.mutate,
    updateNotification: updateNotificationMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    bulkDeleteNotifications: bulkDeleteMutation.mutate,
    bulkUpdateNotifications: bulkUpdateMutation.mutate,

    // Mutation states
    isCreating: createNotificationMutation.isPending,
    isUpdating: updateNotificationMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,

    // Query states
    isFetching: notificationsQuery.isFetching,
    isFetchingUnreadCount: unreadCountQuery.isFetching,
    refetch: notificationsQuery.refetch,
    refetchUnreadCount: unreadCountQuery.refetch,
  }
}

