// Cookie utility functions
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const value = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1]
  
  return value || null
}

export function setCookie(name: string, value: string, days: number = 7): void {
  if (typeof document === 'undefined') return
  
  const expires = new Date()
  expires.setDate(expires.getDate() + days)
  
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/;`
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}

export function getAccessToken(): string | null {
  return getCookie('access_token')
}

export function setAccessToken(token: string, days: number = 7): void {
  setCookie('access_token', token, days)
}

export function getRefreshToken(): string | null {
  return getCookie('refresh_token')
}

export function setRefreshToken(token: string, days: number = 7): void {
  setCookie('refresh_token', token, days)
}

export function clearAuthTokens(): void {
  deleteCookie('access_token')
  deleteCookie('refresh_token')
}

