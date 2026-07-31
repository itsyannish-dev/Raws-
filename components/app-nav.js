'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Home, CandlestickChart, LineChart, Wallet, ArrowDownToLine, ArrowUpFromLine, Settings, LogOut, X, ArrowLeftRight, ShieldCheck, ListOrdered } from 'lucide-react'
import { logout } from '@/lib/rm'
import { useLang, LangToggle } from '@/lib/i18n'

const MENU_ITEMS = [
  { label: 'Home', icon: Home, path: '/home', testid: 'menu-home' },
  { label: 'Charts', icon: CandlestickChart, path: '/terminal', testid: 'menu-charts' },
  { label: 'Markets', icon: LineChart, path: '/terminal?tab=markets', testid: 'menu-markets' },
  { label: 'Positions', icon: ListOrdered, path: '/terminal?tab=positions', testid: 'menu-positions' },
  { label: 'Wallet', icon: Wallet, path: '/dashboard', testid: 'menu-wallet' },
  { label: 'Deposit', icon: ArrowDownToLine, path: '/dashboard?action=deposit', testid: 'menu-deposit' },
  { label: 'Withdraw', icon: ArrowUpFromLine, path: '/dashboard?action=withdraw', testid: 'menu-withdraw' },
  { label: 'Settings', icon: Settings, path: '/settings', testid: 'menu-settings' },
]

export function AppDrawer({ open, onClose }) {
  const router = useRouter()
  const { t } = useLang()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('rm_user') || '{}')
      setIsAdmin(u.role === 'admin')
    } catch (e) {}
  }, [open])
  if (!open) return null
  const go = (path) => {
    onClose()
    router.push(path)
  }
  const items = isAdmin
    ? [...MENU_ITEMS, { label: 'Admin panel', icon: ShieldCheck, path: '/admin', testid: 'menu-admin' }]
    : MENU_ITEMS
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div data-testid="app-drawer" className="absolute inset-y-0 left-0 w-72 bg-[#0a0a0a] border-r border-white/10 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </div>
          <button data-testid="drawer-close-btn" onClick={onClose} className="p-1.5 text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => (
            <button
              key={item.label}
              data-testid={item.testid}
              onClick={() => go(item.path)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
            >
              <item.icon className="h-[18px] w-[18px] text-[#00FF66]" />
              <span className="font-medium">{t(item.label)}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-1">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-white/40 font-medium">{t('Language')}</span>
            <LangToggle />
          </div>
          <button
            data-testid="menu-logout"
            onClick={() => { onClose(); logout(router) }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-white/50 hover:bg-white/5 hover:text-[#ff3b5c] transition"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className="font-medium">{t('Sign out')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function BottomNav({ active }) {
  const router = useRouter()
  const { t } = useLang()
  const items = [
    { key: 'home', label: 'Home', icon: Home, path: '/home' },
    { key: 'markets', label: 'Markets', icon: LineChart, path: '/terminal?tab=markets' },
    { key: 'trade', label: 'Trade', icon: ArrowLeftRight, path: '/terminal?tab=trade' },
    { key: 'positions', label: 'Positions', icon: ListOrdered, path: '/terminal?tab=positions' },
    { key: 'wallet', label: 'Wallet', icon: Wallet, path: '/dashboard' },
  ]
  return (
    <nav data-testid="mobile-bottom-nav" className="md:hidden fixed bottom-0 inset-x-0 h-16 border-t border-white/10 bg-black flex items-stretch z-40">
      {items.map((it) => (
        <button
          key={it.key}
          data-testid={`bottomnav-${it.key}`}
          onClick={() => router.push(it.path)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${active === it.key ? 'text-[#00FF66]' : 'text-white/40 hover:text-white'}`}
        >
          <it.icon className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t(it.label)}</span>
        </button>
      ))}
    </nav>
  )
}
