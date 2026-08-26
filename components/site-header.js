'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useLang, LangToggle } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'

export function SiteHeader() {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
  const [navOpen, setNavOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('rm_token'))
  }, [])

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const navCls = light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/70'
  const linkCls = light ? 'text-gray-500 hover:text-gray-900' : 'text-white/50 hover:text-white'

  const NAV_LINKS = [
    { href: '/#markets', label: t('Markets') },
    { href: '/leverage', label: t('Leverage') },
    { href: '/#how', label: t('How it works') },
    { href: '/#pricing', label: t('Pricing') },
    { href: '/#faq', label: 'FAQ' },
    { href: '/about', label: t('About us') },
    { href: '/contact', label: t('Contact us') },
  ]

  const go = (path) => {
    setNavOpen(false)
    router.push(path)
  }

  return (
    <nav className={`fixed top-0 inset-x-0 z-40 border-b backdrop-blur-xl ${navCls}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-12">
          <button data-testid="site-hamburger-btn" onClick={() => setNavOpen(!navOpen)} className={`lg:hidden p-1.5 -ml-1.5 transition ${linkCls}`}>
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <a href="/" className={`select-none font-extrabold tracking-tight text-xl leading-none ${light ? 'text-gray-900' : 'text-white'}`}>
            RAW<span className={GREEN}>MARKETS</span>
          </a>
          <div className={`hidden lg:flex items-center gap-6 text-[13px] font-medium ${linkCls}`}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:opacity-100 transition whitespace-nowrap">{l.label}</a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <LangToggle />
          <button data-testid="nav-signin-btn" onClick={() => go(loggedIn ? '/home' : '/')} className={`hidden sm:block text-sm transition px-2 sm:px-3 py-2 ${linkCls}`}>
            {loggedIn ? t('Open app') : t('Sign in')}
          </button>
          <button data-testid="nav-getstarted-btn" onClick={() => go(loggedIn ? '/home' : '/?join=1')} className="text-sm font-semibold bg-[#00FF66] text-black px-4 py-2 rounded-full hover:bg-[#00e65c] transition">
            {loggedIn ? t('Launch app') : t('Get started')}
          </button>
        </div>
      </div>

      {navOpen && (
        <div data-testid="site-nav-dropdown" className={`lg:hidden border-t ${light ? 'border-black/5 bg-white' : 'border-white/5 bg-[#0a0a0a]'}`}>
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setNavOpen(false)} className={`block px-3 py-3 rounded-lg text-sm font-medium transition ${light ? 'text-gray-600 hover:bg-black/5' : 'text-white/70 hover:bg-white/5'}`}>
                {l.label}
              </a>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
              <button onClick={() => go(loggedIn ? '/home' : '/')} className={`border font-medium py-3 rounded-xl transition text-sm ${light ? 'border-black/15 text-gray-700 hover:bg-black/5' : 'border-white/15 text-white/80 hover:bg-white/5'}`}>
                {loggedIn ? t('Open app') : t('Sign in')}
              </button>
              <button onClick={() => go(loggedIn ? '/home' : '/?join=1')} className="bg-[#00FF66] text-black font-semibold py-3 rounded-xl hover:bg-[#00e65c] transition text-sm">
                {loggedIn ? t('Launch app') : t('Get started')}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export function SiteFooter() {
  const { t } = useLang()
  const { light } = useTheme()
  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  return (
    <footer className={`border-t py-10 px-4 sm:px-6 ${light ? 'border-black/5' : 'border-white/5'}`}>
      <div className={`mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm ${light ? 'text-gray-400' : 'text-white/35'}`}>
        <a href="/" className={`font-extrabold tracking-tight ${light ? 'text-gray-900' : 'text-white'}`}>RAW<span className={GREEN}>MARKETS</span></a>
        <span>© 2025 RAWMarkets. {t('All rights reserved.')}</span>
        <span>{t('Trading involves risk. Not financial advice.')}</span>
      </div>
    </footer>
  )
}
