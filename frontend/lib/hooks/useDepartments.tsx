'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDepartmentsStore } from '@/lib/stores'
import { departmentsService } from '@/lib/services'
import type { CreateDepartmentRequest, UpdateDepartmentRequest, Department } from '@/lib/services'

// Query keys for consistent caching
export const departmentsKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...departmentsKeys.lists(), { filters }] as const,
  details: () => [...departmentsKeys.all, 'detail'] as const,
  detail: (id: number) => [...departmentsKeys.details(), id] as const,
  availableHODs: () => [...departmentsKeys.all, 'availableHODs'] as const,
  stats: (id: number) => [...departmentsKeys.all, 'stats', id] as const,
}

// Hook for fetching departments list
export function useDepartments(params?: {
  page?: number
  limit?: number
  is_active?: boolean
  search?: string
}) {
  const { departments, pagination, filters, fetchDepartments } = useDepartmentsStore()

  return useQuery({
    queryKey: departmentsKeys.list({ ...filters, ...params }),
    queryFn: () => fetchDepartments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => previousData,
  })
}

// Hook for fetching a single department
export function useDepartment(id: number) {
  const { selectedDepartment, fetchDepartment } = useDepartmentsStore()

  return useQuery({
    queryKey: departmentsKeys.detail(id),
    queryFn: () => fetchDepartment(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData,
  })
}

// Hook for available HODs
export function useAvailableHODs() {
  return useQuery({
    queryKey: departmentsKeys.availableHODs(),
    queryFn: () => departmentsService.getAvailableHODs(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for department stats
export function useDepartmentStats(id: number) {
  return useQuery({
    queryKey: departmentsKeys.stats(id),
    queryFn: () => departmentsService.getDepartmentStats(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook for creating a department
export function useCreateDepartment() {
  const queryClient = useQueryClient()
  const { createDepartment } = useDepartmentsStore()

  return useMutation({
    mutationFn: createDepartment,
    onSuccess: (newDepartment) => {
      // Invalidate departments list
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.availableHODs() })
      
      // Add to cache
      queryClient.setQueryData(departmentsKeys.detail(newDepartment.id), newDepartment)
    },
    onError: (error: any) => {
      console.error('Create department failed:', error)
    },
  })
}

// Hook for updating a department
export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  const { updateDepartment } = useDepartmentsStore()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDepartmentRequest }) =>
      updateDepartment(id, data),
    onSuccess: (updatedDepartment) => {
      // Invalidate departments list
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.availableHODs() })
      
      // Update cache
      queryClient.setQueryData(departmentsKeys.detail(updatedDepartment.id), updatedDepartment)
    },
    onError: (error: any) => {
      console.error('Update department failed:', error)
    },
  })
}

// Hook for deleting a department
export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  const { deleteDepartment } = useDepartmentsStore()

  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: (_, deletedId) => {
      // Invalidate departments list
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.availableHODs() })
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: departmentsKeys.detail(deletedId) })
      queryClient.removeQueries({ queryKey: departmentsKeys.stats(deletedId) })
    },
    onError: (error: any) => {
      console.error('Delete department failed:', error)
    },
  })
}

// Hook for bulk creating departments
export function useBulkCreateDepartments() {
  const queryClient = useQueryClient()
  const { bulkCreateDepartments } = useDepartmentsStore()

  return useMutation({
    mutationFn: bulkCreateDepartments,
    onSuccess: () => {
      // Invalidate departments list
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.availableHODs() })
    },
    onError: (error: any) => {
      console.error('Bulk create departments failed:', error)
    },
  })
}

// Hook for bulk updating departments
export function useBulkUpdateDepartments() {
  const queryClient = useQueryClient()
  const { bulkUpdateDepartments } = useDepartmentsStore()

  return useMutation({
    mutationFn: bulkUpdateDepartments,
    onSuccess: () => {
      // Invalidate departments list
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.availableHODs() })
    },
    onError: (error: any) => {
      console.error('Bulk update departments failed:', error)
    },
  })
}

// Hook for bulk deleting departments
export function useBulkDeleteDepartments() {
  const queryClient = useQueryClient()
  const { bulkDeleteDepartments } = useDepartmentsStore()

  return useMutation({
    mutationFn: bulkDeleteDepartments,
    onSuccess: (_, deletedIds) => {
      // Invalidate departments list
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: departmentsKeys.availableHODs() })
      
      // Remove from cache
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: departmentsKeys.detail(id) })
        queryClient.removeQueries({ queryKey: departmentsKeys.stats(id) })
      })
    },
    onError: (error: any) => {
      console.error('Bulk delete departments failed:', error)
    },
  })
}

// Hook for exporting departments
export function useExportDepartments() {
  return useMutation({
    mutationFn: (format: 'csv' | 'excel' = 'csv') => departmentsService.exportDepartments(format),
    onSuccess: () => {
      // Optionally show success message
    },
    onError: (error: any) => {
      console.error('Export departments failed:', error)
    },
  })
}

// Combined departments hook for easy access
export function useDepartmentsManagement() {
  const departmentsState = useDepartmentsStore()
  const departmentsQuery = useDepartments()
  const createDepartmentMutation = useCreateDepartment()
  const updateDepartmentMutation = useUpdateDepartment()
  const deleteDepartmentMutation = useDeleteDepartment()
  const bulkCreateMutation = useBulkCreateDepartments()
  const bulkUpdateMutation = useBulkUpdateDepartments()
  const bulkDeleteMutation = useBulkDeleteDepartments()

  return {
    // State
    departments: departmentsState.departments,
    selectedDepartment: departmentsState.selectedDepartment,
    pagination: departmentsState.pagination,
    filters: departmentsState.filters,
    isLoading: departmentsState.isLoading || departmentsQuery.isLoading,
    error: departmentsState.error || departmentsQuery.error,

    // Actions
    setSelectedDepartment: departmentsState.setSelectedDepartment,
    setFilters: departmentsState.setFilters,
    clearError: departmentsState.clearError,
    reset: departmentsState.reset,

    // Mutations
    createDepartment: createDepartmentMutation.mutate,
    updateDepartment: updateDepartmentMutation.mutate,
    deleteDepartment: deleteDepartmentMutation.mutate,
    bulkCreateDepartments: bulkCreateMutation.mutate,
    bulkUpdateDepartments: bulkUpdateMutation.mutate,
    bulkDeleteDepartments: bulkDeleteMutation.mutate,

    // Mutation states
    isCreating: createDepartmentMutation.isPending,
    isUpdating: updateDepartmentMutation.isPending,
    isDeleting: deleteDepartmentMutation.isPending,
    isBulkCreating: bulkCreateMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,

    // Query states
    isFetching: departmentsQuery.isFetching,
    refetch: departmentsQuery.refetch,
  }
}
