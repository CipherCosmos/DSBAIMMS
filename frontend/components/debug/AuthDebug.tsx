'use client'

import { useAuth } from '@/hooks/useAuth'
import { getAccessToken, getRefreshToken } from '@/lib/cookies'
import { isTokenValid } from '@/lib/utils/tokenValidation'

export function AuthDebug() {
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const accessToken = getAccessToken()
  const refreshToken = getRefreshToken()
  
  const isAccessTokenValid = accessToken ? isTokenValid(accessToken) : false
  const isRefreshTokenValid = refreshToken ? isTokenValid(refreshToken) : false

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>User: {user ? `${user.first_name} ${user.last_name}` : 'None'}</div>
        <div>Role: {user?.role || 'None'}</div>
        <div>Is Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
        <div>Is Loading: {isLoading ? 'Yes' : 'No'}</div>
        <div>Access Token: {accessToken ? 'Exists' : 'None'}</div>
        <div>Access Token Valid: {isAccessTokenValid ? 'Yes' : 'No'}</div>
        <div>Refresh Token: {refreshToken ? 'Exists' : 'None'}</div>
        <div>Refresh Token Valid: {isRefreshTokenValid ? 'Yes' : 'No'}</div>
      </div>
    </div>
  )
}
