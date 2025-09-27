import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/dashboard/users',
  '/dashboard/departments',
  '/dashboard/semesters',
  '/dashboard/classes',
  '/dashboard/subjects',
  '/dashboard/exams',
  '/dashboard/attendance',
  '/dashboard/promotion',
  '/dashboard/questionbanks',
  '/dashboard/files',
  '/dashboard/notifications',
  '/dashboard/co-po',
  '/dashboard/analytics',
  '/dashboard/bulk',
  '/dashboard/reports',
  '/dashboard/monitoring',
  '/dashboard/marks',
  '/dashboard/courses',
  '/dashboard/profile'
]

// Define role-based routes
const roleBasedRoutes = {
  admin: [
    '/dashboard/users',
    '/dashboard/departments',
    '/dashboard/semesters',
    '/dashboard/classes',
    '/dashboard/subjects',
    '/dashboard/attendance',
    '/dashboard/promotion',
    '/dashboard/questionbanks',
    '/dashboard/files',
    '/dashboard/notifications',
    '/dashboard/co-po',
    '/dashboard/analytics',
    '/dashboard/bulk',
    '/dashboard/reports',
    '/dashboard/monitoring'
  ],
  hod: [
    '/dashboard/users',
    '/dashboard/semesters',
    '/dashboard/classes',
    '/dashboard/subjects',
    '/dashboard/attendance',
    '/dashboard/promotion',
    '/dashboard/questionbanks',
    '/dashboard/files',
    '/dashboard/notifications',
    '/dashboard/co-po',
    '/dashboard/analytics',
    '/dashboard/reports'
  ],
  teacher: [
    '/dashboard/subjects',
    '/dashboard/attendance',
    '/dashboard/questionbanks',
    '/dashboard/files',
    '/dashboard/notifications',
    '/dashboard/marks',
    '/dashboard/analytics',
    '/dashboard/reports'
  ],
  student: [
    '/dashboard/courses',
    '/dashboard/exams',
    '/dashboard/files',
    '/dashboard/notifications',
    '/dashboard/marks',
    '/dashboard/analytics',
    '/dashboard/profile'
  ]
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  if (isProtectedRoute) {
    // Check for authentication token
    const accessToken = request.cookies.get('access_token')?.value
    const refreshToken = request.cookies.get('refresh_token')?.value
    console.log('Middleware - Protected route:', pathname, 'Access token exists:', !!accessToken, 'Refresh token exists:', !!refreshToken)
    console.log('Middleware - All cookies:', request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 20)}...`))
    
    if (!accessToken && !refreshToken) {
      // Redirect to login if no tokens at all
      console.log('Middleware - No tokens, redirecting to login')
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    if (!accessToken && refreshToken) {
      // Access token expired but refresh token exists
      // Let the frontend handle token refresh
      console.log('Middleware - Access token expired, refresh token exists - allowing request')
    }
  }
  
  // Allow login page for unauthenticated users
  if (pathname === '/login') {
    const accessToken = request.cookies.get('access_token')?.value
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (accessToken || refreshToken) {
      // Redirect to dashboard if already authenticated
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}

