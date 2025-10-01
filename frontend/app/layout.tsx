import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
// ChunkErrorBoundary component removed during cleanup
import ErrorBoundary from '@/components/error/GlobalErrorBoundary'
// AuthDebug component removed during cleanup

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LMS System - CO/PO Learning Management',
  description: 'Complete Learning Management System for CO/PO attainment analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}