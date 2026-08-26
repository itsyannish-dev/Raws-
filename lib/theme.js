'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'

function current() {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem('rm_theme') || 'dark'
}

export function useTheme() {
  const [theme, setThemeState] = useState('dark')
  useEffect(() => {
    setThemeState(current())
    const h = () => setThemeState(current())
    window.addEventListener('rm-theme', h)
    return () => window.removeEventListener('rm-theme', h)
  }, [])
  const setTheme = useCallback((t) => {
    try { localStorage.setItem('rm_theme', t) } catch (e) {}
    window.dispatchEvent(new Event('rm-theme'))
  }, [])
  return { theme, setTheme, light: theme === 'light' }
}

export function ThemeToggle({ className = '' }) {
  const { setTheme, light } = useTheme()
  return (
    <button
      data-testid="theme-toggle"
      onClick={() => setTheme(light ? 'dark' : 'light')}
      title={light ? 'Dark mode' : 'Light mode'}
      className={`flex items-center justify-center h-8 w-8 rounded-full border transition shrink-0 ${light ? 'border-black/15 text-gray-500 hover:text-gray-900 hover:border-black/30' : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'} ${className}`}
    >
      {light ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </button>
  )
}
