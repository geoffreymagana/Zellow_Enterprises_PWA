import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // For authenticated routes, add headers to prevent static generation
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/supplier') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/deliveries') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/profile')
  ) {
    const response = NextResponse.next()
    response.headers.set('x-middleware-cache', 'no-cache')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)',
  ],
} 