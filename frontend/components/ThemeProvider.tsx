'use client'

import { ReactNode, useEffect, useState } from 'react'

interface ThemeProviderProps {
  children: ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  storageKey?: string
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'light',
  enableSystem = false,
  disableTransitionOnChange = false,
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>
  }

  // Dynamic import for theme provider
  let NextThemeProvider: any = null
  try {
    NextThemeProvider = require('next-themes').ThemeProvider
  } catch (error) {
    console.warn('next-themes not available:', error)
    // Fallback ThemeProvider
    NextThemeProvider = ({ children }: { children: ReactNode }) => <>{children}</>
  }

  return (
    <NextThemeProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      storageKey={storageKey}
    >
      {children}
    </NextThemeProvider>
  )
}



