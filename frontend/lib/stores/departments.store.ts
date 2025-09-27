import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { departmentsService } from '@/lib/services'
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest, PaginatedResponse } from '@/lib/services'

export interface DepartmentsState {
  // State
  departments: Department[]
  selectedDepartment: Department | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    is_active?: boolean
    search?: string
  }
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchDepartments: (params?: {
    page?: number
    limit?: number
    is_active?: boolean
    search?: string
  }) => Promise<void>
  
  fetchDepartment: (id: number) => Promise<void>
  createDepartment: (departmentData: CreateDepartmentRequest) => Promise<Department>
  updateDepartment: (id: number, departmentData: UpdateDepartmentRequest) => Promise<Department>
  deleteDepartment: (id: number) => Promise<void>
  
  // Bulk operations
  bulkCreateDepartments: (departments: CreateDepartmentRequest[]) => Promise<void>
  bulkUpdateDepartments: (updates: Array<{ id: number; data: UpdateDepartmentRequest }>) => Promise<void>
  bulkDeleteDepartments: (ids: number[]) => Promise<void>
  
  // Utility actions
  setSelectedDepartment: (department: Department | null) => void
  setFilters: (filters: Partial<DepartmentsState['filters']>) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  departments: [],
  selectedDepartment: null,
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

export const useDepartmentsStore = create<DepartmentsState>()(
  immer((set, get) => ({
    ...initialState,

    fetchDepartments: async (params = {}) => {
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

        const response: PaginatedResponse<Department> = await departmentsService.getDepartments(queryParams)
        
        set((state) => {
          state.departments = response.data
          state.pagination = response.pagination
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to fetch departments'
        })
        throw error
      }
    },

    fetchDepartment: async (id: number) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await departmentsService.getDepartment(id)
        
        set((state) => {
          state.selectedDepartment = response.data
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to fetch department'
        })
        throw error
      }
    },

    createDepartment: async (departmentData: CreateDepartmentRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await departmentsService.createDepartment(departmentData)
        
        set((state) => {
          state.departments.unshift(response.data)
          state.pagination.total += 1
          state.isLoading = false
          state.error = null
        })

        return response.data
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to create department'
        })
        throw error
      }
    },

    updateDepartment: async (id: number, departmentData: UpdateDepartmentRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await departmentsService.updateDepartment(id, departmentData)
        
        set((state) => {
          const index = state.departments.findIndex(dept => dept.id === id)
          if (index !== -1) {
            state.departments[index] = response.data
          }
          if (state.selectedDepartment?.id === id) {
            state.selectedDepartment = response.data
          }
          state.isLoading = false
          state.error = null
        })

        return response.data
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to update department'
        })
        throw error
      }
    },

    deleteDepartment: async (id: number) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        await departmentsService.deleteDepartment(id)
        
        set((state) => {
          state.departments = state.departments.filter(dept => dept.id !== id)
          state.pagination.total -= 1
          if (state.selectedDepartment?.id === id) {
            state.selectedDepartment = null
          }
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to delete department'
        })
        throw error
      }
    },

    bulkCreateDepartments: async (departments: CreateDepartmentRequest[]) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await departmentsService.bulkCreateDepartments(departments)
        
        set((state) => {
          state.pagination.total += response.data.created_count
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk create departments'
        })
        throw error
      }
    },

    bulkUpdateDepartments: async (updates: Array<{ id: number; data: UpdateDepartmentRequest }>) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await departmentsService.bulkUpdateDepartments(updates)
        
        set((state) => {
          updates.forEach(({ id, data }) => {
            const index = state.departments.findIndex(dept => dept.id === id)
            if (index !== -1) {
              state.departments[index] = { ...state.departments[index], ...data }
            }
            if (state.selectedDepartment?.id === id) {
              state.selectedDepartment = { ...state.selectedDepartment, ...data }
            }
          })
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk update departments'
        })
        throw error
      }
    },

    bulkDeleteDepartments: async (ids: number[]) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await departmentsService.bulkDeleteDepartments(ids)
        
        set((state) => {
          state.departments = state.departments.filter(dept => !ids.includes(dept.id))
          state.pagination.total -= response.data.deleted_count
          if (state.selectedDepartment && ids.includes(state.selectedDepartment.id)) {
            state.selectedDepartment = null
          }
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk delete departments'
        })
        throw error
      }
    },

    setSelectedDepartment: (department: Department | null) => {
      set((state) => {
        state.selectedDepartment = department
      })
    },

    setFilters: (filters: Partial<DepartmentsState['filters']>) => {
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
