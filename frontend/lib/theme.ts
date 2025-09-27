/**
 * Theme configuration for the LMS application
 * Supports light/dark mode with system preference detection
 */

export const themeConfig = {
  // Theme colors that match the design system
  colors: {
    primary: {
      50: 'hsl(var(--primary-50))',
      100: 'hsl(var(--primary-100))',
      200: 'hsl(var(--primary-200))',
      300: 'hsl(var(--primary-300))',
      400: 'hsl(var(--primary-400))',
      500: 'hsl(var(--primary-500))',
      600: 'hsl(var(--primary-600))',
      700: 'hsl(var(--primary-700))',
      800: 'hsl(var(--primary-800))',
      900: 'hsl(var(--primary-900))',
    },
    gray: {
      50: 'hsl(var(--gray-50))',
      100: 'hsl(var(--gray-100))',
      200: 'hsl(var(--gray-200))',
      300: 'hsl(var(--gray-300))',
      400: 'hsl(var(--gray-400))',
      500: 'hsl(var(--gray-500))',
      600: 'hsl(var(--gray-600))',
      700: 'hsl(var(--gray-700))',
      800: 'hsl(var(--gray-800))',
      900: 'hsl(var(--gray-900))',
    },
  },
  
  // Animation durations
  animation: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  
  // Spacing scale
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  
  // Border radius scale
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
  },
  
  // Shadow scale
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
}

// Theme utility functions
export const getThemeColor = (color: string, shade: number = 500) => {
  return `hsl(var(--${color}-${shade}))`
}

export const getAnimationDuration = (speed: keyof typeof themeConfig.animation) => {
  return themeConfig.animation[speed]
}

export const getSpacing = (size: keyof typeof themeConfig.spacing) => {
  return themeConfig.spacing[size]
}

export const getBorderRadius = (size: keyof typeof themeConfig.borderRadius) => {
  return themeConfig.borderRadius[size]
}

export const getShadow = (size: keyof typeof themeConfig.shadows) => {
  return themeConfig.shadows[size]
}

// CSS variable definitions for light/dark themes
export const lightThemeVars = {
  '--background': '0 0% 100%',
  '--foreground': '222.2 84% 4.9%',
  '--card': '0 0% 100%',
  '--card-foreground': '222.2 84% 4.9%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '222.2 84% 4.9%',
  '--primary': '222.2 47.4% 11.2%',
  '--primary-foreground': '210 40% 98%',
  '--secondary': '210 40% 96%',
  '--secondary-foreground': '222.2 84% 4.9%',
  '--muted': '210 40% 96%',
  '--muted-foreground': '215.4 16.3% 46.9%',
  '--accent': '210 40% 96%',
  '--accent-foreground': '222.2 84% 4.9%',
  '--destructive': '0 84.2% 60.2%',
  '--destructive-foreground': '210 40% 98%',
  '--border': '214.3 31.8% 91.4%',
  '--input': '214.3 31.8% 91.4%',
  '--ring': '222.2 84% 4.9%',
  '--radius': '0.5rem',
}

export const darkThemeVars = {
  '--background': '222.2 84% 4.9%',
  '--foreground': '210 40% 98%',
  '--card': '222.2 84% 4.9%',
  '--card-foreground': '210 40% 98%',
  '--popover': '222.2 84% 4.9%',
  '--popover-foreground': '210 40% 98%',
  '--primary': '210 40% 98%',
  '--primary-foreground': '222.2 47.4% 11.2%',
  '--secondary': '217.2 32.6% 17.5%',
  '--secondary-foreground': '210 40% 98%',
  '--muted': '217.2 32.6% 17.5%',
  '--muted-foreground': '215 20.2% 65.1%',
  '--accent': '217.2 32.6% 17.5%',
  '--accent-foreground': '210 40% 98%',
  '--destructive': '0 62.8% 30.6%',
  '--destructive-foreground': '210 40% 98%',
  '--border': '217.2 32.6% 17.5%',
  '--input': '217.2 32.6% 17.5%',
  '--ring': '212.7 26.8% 83.9%',
  '--radius': '0.5rem',
}

