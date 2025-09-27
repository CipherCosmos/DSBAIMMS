import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { usersService } from '@/lib/services'
import type { User, CreateUserRequest, UpdateUserRequest, PaginatedResponse } from '@/lib/services'

export interface UsersState {
  // State
  users: User[]
  selectedUser: User | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    role?: string
    department_id?: number
    is_active?: boolean
    search?: string
  }
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchUsers: (params?: {
    page?: number
    limit?: number
    role?: string
    department_id?: number
    is_active?: boolean
    search?: string
  }) => Promise<void>
  
  fetchUser: (id: number) => Promise<void>
  createUser: (userData: CreateUserRequest) => Promise<User>
  updateUser: (id: number, userData: UpdateUserRequest) => Promise<User>
  deleteUser: (id: number) => Promise<void>
  
  // Bulk operations
  bulkUpdateUsers: (userIds: number[], updateData: UpdateUserRequest) => Promise<void>
  bulkDeleteUsers: (userIds: number[]) => Promise<void>
  
  // Utility actions
  setSelectedUser: (user: User | null) => void
  setFilters: (filters: Partial<UsersState['filters']>) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  users: [],
  selectedUser: null,
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

export const useUsersStore = create<UsersState>()(
  immer((set, get) => ({
    ...initialState,

    fetchUsers: async (params = {}) => {
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

        const response: PaginatedResponse<User> = await usersService.getUsers(queryParams)
        
        set((state) => {
          state.users = response.data
          state.pagination = response.pagination
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to fetch users'
        })
        throw error
      }
    },

    fetchUser: async (id: number) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await usersService.getUser(id)
        
        set((state) => {
          state.selectedUser = response.data
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to fetch user'
        })
        throw error
      }
    },

    createUser: async (userData: CreateUserRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await usersService.createUser(userData)
        
        set((state) => {
          state.users.unshift(response.data)
          state.pagination.total += 1
          state.isLoading = false
          state.error = null
        })

        return response.data
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to create user'
        })
        throw error
      }
    },

    updateUser: async (id: number, userData: UpdateUserRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const response = await usersService.updateUser(id, userData)
        
        set((state) => {
          const index = state.users.findIndex(user => user.id === id)
          if (index !== -1) {
            state.users[index] = response.data
          }
          if (state.selectedUser?.id === id) {
            state.selectedUser = response.data
          }
          state.isLoading = false
          state.error = null
        })

        return response.data
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to update user'
        })
        throw error
      }
    },

    deleteUser: async (id: number) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        await usersService.deleteUser(id)
        
        set((state) => {
          state.users = state.users.filter(user => user.id !== id)
          state.pagination.total -= 1
          if (state.selectedUser?.id === id) {
            state.selectedUser = null
          }
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to delete user'
        })
        throw error
      }
    },

    bulkUpdateUsers: async (userIds: number[], updateData: UpdateUserRequest) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        await usersService.bulkUpdateUsers({ user_ids: userIds, update_data: updateData })
        
        set((state) => {
          state.users = state.users.map(user => 
            userIds.includes(user.id) ? { ...user, ...updateData } : user
          )
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk update users'
        })
        throw error
      }
    },

    bulkDeleteUsers: async (userIds: number[]) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        await usersService.bulkDeleteUsers(userIds)
        
        set((state) => {
          state.users = state.users.filter(user => !userIds.includes(user.id))
          state.pagination.total -= userIds.length
          if (state.selectedUser && userIds.includes(state.selectedUser.id)) {
            state.selectedUser = null
          }
          state.isLoading = false
          state.error = null
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message || 'Failed to bulk delete users'
        })
        throw error
      }
    },

    setSelectedUser: (user: User | null) => {
      set((state) => {
        state.selectedUser = user
      })
    },

    setFilters: (filters: Partial<UsersState['filters']>) => {
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
