import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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
    <html lang="en">
      <body className={inter.className}>
        <ChunkErrorBoundary>
          <ErrorBoundary>
            <Providers>
              {children}
            </Providers>
          </ErrorBoundary>
        </ChunkErrorBoundary>
      </body>
    </html>
  )
}