import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { authService } from '@/lib/services'
import { setAccessToken, setRefreshToken, clearAuthTokens, getAccessToken, getRefreshToken } from '@/lib/cookies'
import { isTokenValid } from '@/lib/utils/tokenValidation'
import type { User, LoginCredentials } from '@/lib/services'

export interface AuthState {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<void>
  refreshToken: () => Promise<void>
  clearError: () => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false, // Will be determined by token validity
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        set((state) => {
          state.isLoading = true
          state.error = null
        })

        try {
          const response = await authService.login(credentials)
          console.log('Auth store - Login response received:', response.data)
          
          // Store tokens in cookies for persistence
          if (response.data.access_token) {
            setAccessToken(response.data.access_token)
            console.log('Auth store - Access token stored in cookie')
          }
          if (response.data.refresh_token) {
            setRefreshToken(response.data.refresh_token)
            console.log('Auth store - Refresh token stored in cookie')
          }
          
          console.log('Auth store - Login successful, tokens stored locally')
          console.log('Auth store - Current cookies:', document.cookie)
          
          set((state) => {
            state.user = response.data.user
            state.isAuthenticated = true
            state.isLoading = false
            state.error = null
          })
        } catch (error: any) {
          set((state) => {
            state.isLoading = false
            state.error = error.message || 'Login failed'
            state.isAuthenticated = false
            state.user = null
          })
          throw error
        }
      },

      logout: async () => {
        set((state) => {
          state.isLoading = true
        })

        try {
          await authService.logout()
        } catch (error) {
          // Ignore logout errors
        } finally {
          // Backend will clear cookies automatically
          
          set((state) => {
            state.user = null
            state.isAuthenticated = false
            state.isLoading = false
            state.error = null
          })
        }
      },

      getCurrentUser: async () => {
        set((state) => {
          state.isLoading = true
        })

        try {
          // First check if we have a valid access token
          const accessToken = getAccessToken()
          if (!accessToken || !isTokenValid(accessToken)) {
            console.log('Auth store - No valid access token, attempting refresh...')
            
            const refreshToken = getRefreshToken()
            if (refreshToken && isTokenValid(refreshToken)) {
              try {
                await get().refreshToken()
                // Retry getting current user after refresh
                const retryResponse = await authService.getCurrentUser()
                set((state) => {
                  state.user = retryResponse.data
                  state.isAuthenticated = true
                  state.isLoading = false
                  state.error = null
                })
                return
              } catch (refreshError) {
                console.error('Auth store - Token refresh failed:', refreshError)
                // Clear tokens and redirect to login
                clearAuthTokens()
                set((state) => {
                  state.user = null
                  state.isAuthenticated = false
                  state.isLoading = false
                  state.error = 'Session expired. Please log in again.'
                })
                throw refreshError
              }
            } else {
              // No valid tokens
              clearAuthTokens()
              set((state) => {
                state.user = null
                state.isAuthenticated = false
                state.isLoading = false
                state.error = 'No valid session. Please log in.'
              })
              throw new Error('No valid session. Please log in.')
            }
          }

          const response = await authService.getCurrentUser()
          
          set((state) => {
            state.user = response.data
            state.isAuthenticated = true
            state.isLoading = false
            state.error = null
          })
        } catch (error: any) {
          console.error('Auth store - getCurrentUser failed:', error)
          
          set((state) => {
            state.isLoading = false
            state.error = error.message || 'Failed to get current user'
            state.isAuthenticated = false
            state.user = null
          })
          throw error
        }
      },

      refreshToken: async () => {
        const refreshToken = getRefreshToken()
        if (!refreshToken || !isTokenValid(refreshToken)) {
          throw new Error('No valid refresh token available')
        }

        try {
          const response = await authService.refreshToken()
          console.log('Auth store - Token refresh successful')
          
          // Store new tokens locally
          if (response.data.access_token) {
            setAccessToken(response.data.access_token)
          }
          if (response.data.refresh_token) {
            setRefreshToken(response.data.refresh_token)
          }
          
          set((state) => {
            state.isAuthenticated = true
          })
        } catch (error: any) {
          console.error('Auth store - Token refresh failed:', error)
          clearAuthTokens()
          set((state) => {
            state.user = null
            state.isAuthenticated = false
            state.error = 'Session expired. Please log in again.'
          })
          throw error
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null
        })
      },

      setUser: (user: User | null) => {
        set((state) => {
          state.user = user
          state.isAuthenticated = !!user
        })
      },
    })),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        // Don't persist isAuthenticated - it should be determined by token validity
      }),
    }
  )
)
