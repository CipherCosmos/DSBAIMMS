// Token validation utilities

export function isTokenValid(token: string): boolean {
  try {
    if (!token) return false
    
    // Decode JWT token (without verification for client-side validation)
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    const payload = JSON.parse(atob(parts[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    
    // Check if token is expired
    return payload.exp > currentTime
  } catch (error) {
    console.error('Token validation error:', error)
    return false
  }
}

export function getTokenExpiration(token: string): number | null {
  try {
    if (!token) return null
    
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = JSON.parse(atob(parts[1]))
    return payload.exp || null
  } catch (error) {
    console.error('Token expiration check error:', error)
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpiration(token)
  if (!expiration) return true
  
  const currentTime = Math.floor(Date.now() / 1000)
  return expiration <= currentTime
}

