'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUsersStore } from '@/lib/stores'
import { usersService } from '@/lib/services'
import type { CreateUserRequest, UpdateUserRequest, User } from '@/lib/services'

// Query keys for consistent caching
export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...usersKeys.lists(), { filters }] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: number) => [...usersKeys.details(), id] as const,
  stats: () => [...usersKeys.all, 'stats'] as const,
}

// Hook for fetching users list
export function useUsers(params?: {
  page?: number
  limit?: number
  role?: string
  department_id?: number
  is_active?: boolean
  search?: string
}) {
  const { users, pagination, filters, fetchUsers } = useUsersStore()

  return useQuery({
    queryKey: usersKeys.list({ ...filters, ...params }),
    queryFn: () => fetchUsers(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => previousData,
  })
}

// Hook for fetching a single user
export function useUser(id: number) {
  const { selectedUser, fetchUser } = useUsersStore()

  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData,
  })
}

// Hook for user stats
export function useUserStats() {
  return useQuery({
    queryKey: usersKeys.stats(),
    queryFn: () => usersService.getUserStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for creating a user
export function useCreateUser() {
  const queryClient = useQueryClient()
  const { createUser } = useUsersStore()

  return useMutation({
    mutationFn: createUser,
    onSuccess: (newUser) => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.stats() })
      
      // Add to cache
      queryClient.setQueryData(usersKeys.detail(newUser.id), newUser)
    },
    onError: (error: any) => {
      console.error('Create user failed:', error)
    },
  })
}

// Hook for updating a user
export function useUpdateUser() {
  const queryClient = useQueryClient()
  const { updateUser } = useUsersStore()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
      updateUser(id, data),
    onSuccess: (updatedUser) => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.stats() })
      
      // Update cache
      queryClient.setQueryData(usersKeys.detail(updatedUser.id), updatedUser)
    },
    onError: (error: any) => {
      console.error('Update user failed:', error)
    },
  })
}

// Hook for deleting a user
export function useDeleteUser() {
  const queryClient = useQueryClient()
  const { deleteUser } = useUsersStore()

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: (_, deletedId) => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.stats() })
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: usersKeys.detail(deletedId) })
    },
    onError: (error: any) => {
      console.error('Delete user failed:', error)
    },
  })
}

// Hook for bulk updating users
export function useBulkUpdateUsers() {
  const queryClient = useQueryClient()
  const { bulkUpdateUsers } = useUsersStore()

  return useMutation({
    mutationFn: ({ userIds, updateData }: { userIds: number[]; updateData: UpdateUserRequest }) =>
      bulkUpdateUsers(userIds, updateData),
    onSuccess: () => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.stats() })
    },
    onError: (error: any) => {
      console.error('Bulk update users failed:', error)
    },
  })
}

// Hook for bulk deleting users
export function useBulkDeleteUsers() {
  const queryClient = useQueryClient()
  const { bulkDeleteUsers } = useUsersStore()

  return useMutation({
    mutationFn: bulkDeleteUsers,
    onSuccess: (_, deletedIds) => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.stats() })
      
      // Remove from cache
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: usersKeys.detail(id) })
      })
    },
    onError: (error: any) => {
      console.error('Bulk delete users failed:', error)
    },
  })
}

// Hook for resetting user password
export function useResetUserPassword() {
  return useMutation({
    mutationFn: (userId: number) => usersService.resetUserPassword(userId),
    onSuccess: () => {
      // Optionally show success message
    },
    onError: (error: any) => {
      console.error('Reset user password failed:', error)
    },
  })
}

// Hook for exporting users
export function useExportUsers() {
  return useMutation({
    mutationFn: ({ format, params }: { format: 'csv' | 'excel'; params?: any }) =>
      usersService.exportUsers(format, params),
    onSuccess: () => {
      // Optionally show success message
    },
    onError: (error: any) => {
      console.error('Export users failed:', error)
    },
  })
}

// Combined users hook for easy access
export function useUsersManagement() {
  const usersState = useUsersStore()
  const usersQuery = useUsers()
  const createUserMutation = useCreateUser()
  const updateUserMutation = useUpdateUser()
  const deleteUserMutation = useDeleteUser()
  const bulkUpdateMutation = useBulkUpdateUsers()
  const bulkDeleteMutation = useBulkDeleteUsers()

  return {
    // State
    users: usersState.users,
    selectedUser: usersState.selectedUser,
    pagination: usersState.pagination,
    filters: usersState.filters,
    isLoading: usersState.isLoading || usersQuery.isLoading,
    error: usersState.error || usersQuery.error,

    // Actions
    setSelectedUser: usersState.setSelectedUser,
    setFilters: usersState.setFilters,
    clearError: usersState.clearError,
    reset: usersState.reset,

    // Mutations
    createUser: createUserMutation.mutate,
    updateUser: updateUserMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    bulkUpdateUsers: bulkUpdateMutation.mutate,
    bulkDeleteUsers: bulkDeleteMutation.mutate,

    // Mutation states
    isCreating: createUserMutation.isPending,
    isUpdating: updateUserMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,

    // Query states
    isFetching: usersQuery.isFetching,
    refetch: usersQuery.refetch,
  }
}

