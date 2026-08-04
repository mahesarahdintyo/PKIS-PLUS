'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun, Laptop } from 'lucide-react'

const THEME_STORAGE_KEY = 'futaba.theme'

type Theme = 'light' | 'dark' | 'system'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'system'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
    }
  } else if (theme === 'dark') {
    html.classList.add('dark')
    html.classList.remove('light')
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

interface ThemeToggleProps {
  /** 'icon' renders only the icon button (for sidebar), 'full' adds a label */
  variant?: 'icon' | 'sidebar'
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const initial = getInitialTheme()
    setTheme(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
      if (storedTheme === 'system' || !storedTheme) {
        const html = document.documentElement
        if (e.matches) {
          html.classList.add('dark')
          html.classList.remove('light')
        } else {
          html.classList.add('light')
          html.classList.remove('dark')
        }
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange)
    } else if ((mediaQuery as any).addListener) {
      ;(mediaQuery as any).addListener(handleSystemThemeChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange)
      } else if ((mediaQuery as any).removeListener) {
        ;(mediaQuery as any).removeListener(handleSystemThemeChange)
      }
    }
  }, [])

  const toggle = () => {
    let next: Theme
    if (theme === 'system') {
      next = 'light'
    } else if (theme === 'light') {
      next = 'dark'
    } else {
      next = 'system'
    }
    setTheme(next)
    applyTheme(next)
  }

  // Avoid hydration mismatch — render nothing on server
  if (!mounted) {
    if (variant === 'sidebar') {
      return (
        <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground opacity-0 select-none">
          <div className="h-5 w-5" />
          Tema
        </div>
      )
    }
    return <div className="h-8 w-8" />
  }

  const details = getThemeDetails(theme)

  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggle}
        aria-label={details.nextLabel}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {details.icon}
        {details.label}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      aria-label={details.nextLabel}
      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
    >
      {details.icon}
    </button>
  )
}

function getThemeDetails(currentTheme: Theme) {
  switch (currentTheme) {
    case 'light':
      return {
        icon: <Sun className="h-5 w-5" />,
        label: 'Mode Terang',
        nextLabel: 'Ganti ke Mode Gelap',
      }
    case 'dark':
      return {
        icon: <Moon className="h-5 w-5" />,
        label: 'Mode Gelap',
        nextLabel: 'Ganti ke Mode Sistem',
      }
    case 'system':
    default:
      return {
        icon: <Laptop className="h-5 w-5" />,
        label: 'Mode Sistem',
        nextLabel: 'Ganti ke Mode Terang',
      }
  }
}
