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
    const token = request.cookies.get('access_token')?.value
    
    if (!token) {
      // Redirect to login if no token
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // Allow login page for unauthenticated users
  if (pathname === '/login') {
    const token = request.cookies.get('access_token')?.value
    if (token) {
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

