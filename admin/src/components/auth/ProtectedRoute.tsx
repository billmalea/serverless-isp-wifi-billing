'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAuthenticated, isAdmin } from '@/lib/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Protected route wrapper that ensures user is authenticated and has admin role
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Skip check for login page
    if (pathname === '/login') {
      setIsChecking(false)
      return
    }

    // Check authentication
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    // Check admin role
    if (!isAdmin()) {
      router.push('/login')
      return
    }

    setIsChecking(false)
  }, [pathname, router])

  // Show nothing while checking auth (prevents flash of content)
  if (isChecking && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
