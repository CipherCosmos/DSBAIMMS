'use client'

import { AuthGuard } from '@/components/auth/AuthGuard'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <div className="flex h-screen bg-gray-50">
          <ErrorBoundary>
            <Sidebar />
          </ErrorBoundary>
          <ErrorBoundary>
            <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
          </ErrorBoundary>
          <div className="flex-1 flex flex-col overflow-hidden">
            <ErrorBoundary>
              <Header onMobileMenuToggle={toggleMobileMenu} />
            </ErrorBoundary>
            <main className="flex-1 overflow-auto p-6">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </AuthGuard>
  )
}