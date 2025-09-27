'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/stores'
import { authService } from '@/lib/services'
import type { LoginCredentials, ChangePasswordRequest } from '@/lib/services'

// Query keys for consistent caching
export const authKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authKeys.all, 'currentUser'] as const,
}

// Hook for getting current user
export function useCurrentUser() {
  const { user, isAuthenticated, getCurrentUser } = useAuthStore()

  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: getCurrentUser,
    enabled: isAuthenticated && !user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.status === 401) return false
      return failureCount < 3
    },
  })
}

// Hook for login mutation
export function useLogin() {
  const queryClient = useQueryClient()
  const { login } = useAuthStore()

  return useMutation({
    mutationFn: login,
    onSuccess: () => {
      // Invalidate and refetch current user
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() })
    },
    onError: (error: any) => {
      console.error('Login failed:', error)
    },
  })
}

// Hook for logout mutation
export function useLogout() {
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all queries and reset stores
      queryClient.clear()
      useAuthStore.getState().setUser(null)
    },
    onError: (error: any) => {
      console.error('Logout failed:', error)
    },
  })
}

// Hook for change password mutation
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authService.changePassword(data),
    onSuccess: () => {
      // Optionally show success message
    },
    onError: (error: any) => {
      console.error('Change password failed:', error)
    },
  })
}

// Hook for password reset
export function usePasswordReset() {
  return useMutation({
    mutationFn: (email: string) => authService.resetPassword(email),
    onSuccess: () => {
      // Optionally show success message
    },
    onError: (error: any) => {
      console.error('Password reset failed:', error)
    },
  })
}

// Hook for verifying reset token
export function useVerifyResetToken() {
  return useMutation({
    mutationFn: (token: string) => authService.verifyResetToken(token),
    onError: (error: any) => {
      console.error('Token verification failed:', error)
    },
  })
}

// Hook for confirming password reset
export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authService.confirmResetPassword(token, newPassword),
    onSuccess: () => {
      // Optionally show success message and redirect to login
    },
    onError: (error: any) => {
      console.error('Password reset confirmation failed:', error)
    },
  })
}

// Hook for refreshing token
export function useRefreshToken() {
  return useMutation({
    mutationFn: () => authService.refreshToken(),
    onSuccess: (response) => {
      // Update stored token if needed
      console.log('Token refreshed successfully')
    },
    onError: (error: any) => {
      console.error('Token refresh failed:', error)
      // Redirect to login on refresh failure
      if (error?.status === 401) {
        useAuthStore.getState().logout()
      }
    },
  })
}

// Combined auth hook for easy access
export function useAuth() {
  const authState = useAuthStore()
  const currentUserQuery = useCurrentUser()
  const loginMutation = useLogin()
  const logoutMutation = useLogout()
  const changePasswordMutation = useChangePassword()

  return {
    // State
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading || currentUserQuery.isLoading,
    error: authState.error || currentUserQuery.error,

    // Actions
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    clearError: authState.clearError,

    // Mutation states
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,

    // Query states
    isFetchingUser: currentUserQuery.isFetching,
    userError: currentUserQuery.error,
  }
}
