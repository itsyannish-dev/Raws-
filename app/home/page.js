'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtSignedMoney, fmtPrice, logout } from '@/lib/rm'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { SymbolIcon } from '@/components/symbol-icon'
import { useLang, LangToggle } from '@/lib/i18n'
import { Menu, Wallet, LogOut, ArrowDownToLine, ArrowUpFromLine, CandlestickChart, ArrowLeftRight } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [symbols, setSymbols] = useState([])
  const [quotes, setQuotes] = useState({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filter, setFilter] = useState('all')

  const refresh = useCallback(async () => {
    try {
      const [meRes, acctRes] = await Promise.all([api.get('/auth/me'), api.get('/account/summary')])
      setUser(meRes.data.user)
      setAccount(acctRes.data.account)
    } catch (e) {
      localStorage.removeItem('rm_token')
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    if (!localStorage.getItem('rm_token')) { router.replace('/'); return }
    refresh()
    const loadMarket = async () => {
      try {
        const [s, q] = await Promise.all([api.get('/market/symbols'), api.get('/market/quotes')])
        setSymbols(s.data.symbols)
        setQuotes(q.data.quotes)
      } catch (e) {}
    }
    loadMarket()
    const timer = setInterval(async () => {
      try {
        const q = await api.get('/market/quotes')
        setQuotes(q.data.quotes)
      } catch (e) {}
    }, 10000)
    const acctT = setInterval(refresh, 20000)
    try {
      const view = new URLSearchParams(window.location.search).get('view')
      if (view === 'markets') {
        setTimeout(() => document.getElementById('market-watch')?.scrollIntoView({ behavior: 'smooth' }), 400)
      }
    } catch (e) {}
    return () => { clearInterval(timer); clearInterval(acctT) }
  }, [refresh, router])

  const quickActions = [
    { label: t('Deposit'), icon: ArrowDownToLine, path: '/dashboard?action=deposit', accent: true, testid: 'qa-deposit' },
    { label: t('Withdraw'), icon: ArrowUpFromLine, path: '/dashboard?action=withdraw', testid: 'qa-withdraw' },
    { label: t('Trade'), icon: ArrowLeftRight, path: '/terminal?tab=trade', testid: 'qa-trade' },
    { label: t('Charts'), icon: CandlestickChart, path: '/terminal', testid: 'qa-charts' },
  ]

  const list = symbols.filter((s) => filter === 'all' || s.type === filter)

  const FILTERS = [
    { k: 'all', l: t('All') },
    { k: 'crypto', l: t('Crypto') },
    { k: 'forex', l: t('Forex') },
    { k: 'metal', l: t('Metals') },
    { k: 'index', l: t('Indices') },
    { k: 'stock', l: t('Stocks') },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sticky top-0 bg-black/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className="p-1.5 -ml-1.5 text-white/70 hover:text-white transition">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle className="hidden sm:flex" />
          <button data-testid="deposit-nav-btn" onClick={() => router.push('/dashboard?action=deposit')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <Wallet className="h-3.5 w-3.5" /> {t('Deposit')}
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className="p-2 text-white/50 hover:text-white transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        {/* GREETING */}
        <h1 className="text-2xl font-bold" data-testid="home-greeting">
          {user ? `${t('Welcome back')}, ${user.name.split(' ')[0]}` : t('Welcome back')}
        </h1>
        <p className="text-white/40 text-sm mt-1">{t("Here's your account at a glance.")}</p>

        {/* ACCOUNT SUMMARY */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { label: t('Balance'), value: account ? fmtMoney(account.balance) : '—', testid: 'home-balance' },
            { label: t('Equity'), value: account ? fmtMoney(account.equity) : '—', testid: 'home-equity' },
            { label: t('Floating PnL'), value: account ? fmtSignedMoney(account.floatingPnl) : '—', color: (account?.floatingPnl || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]', testid: 'home-pnl' },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30">{c.label}</div>
              <div data-testid={c.testid} className={`text-base sm:text-xl font-mono font-semibold mt-1.5 ${c.color || ''}`}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-widest text-white/30 mb-3">{t('Quick actions')}</div>
          <div className="grid grid-cols-4 gap-3" data-testid="quick-actions">
            {quickActions.map((a) => (
              <button
                key={a.label}
                data-testid={a.testid}
                onClick={() => router.push(a.path)}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 sm:p-5 transition ${a.accent ? 'border-[#00FF66]/25 bg-[#00FF66]/[0.06] hover:bg-[#00FF66]/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}`}
              >
                <a.icon className={`h-5 w-5 ${a.accent ? 'text-[#00FF66]' : 'text-white/70'}`} />
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MARKET WATCH */}
        <div className="mt-8" id="market-watch">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-[11px] uppercase tracking-widest text-white/30">{t('Market watch')}</div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <button key={f.k} data-testid={`filter-${f.k}`} onClick={() => setFilter(f.k)} className={`px-3 py-1 text-xs rounded-full font-medium transition ${filter === f.k ? 'bg-[#00FF66] text-black' : 'text-white/40 hover:text-white bg-white/5'}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5" data-testid="home-market-watch">
            {list.map((s) => {
              const q = quotes[s.symbol]
              const up = (q?.changePercent || 0) >= 0
              return (
                <button
                  key={s.symbol}
                  data-testid={`market-row-${s.symbol}`}
                  onClick={() => router.push(`/terminal?symbol=${s.symbol}`)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <SymbolIcon symbol={s.symbol} type={s.type} size={32} />
                    <div>
                      <div className="text-sm font-semibold">{s.symbol}</div>
                      <div className="text-[11px] text-white/35">{s.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
                    <div className={`text-[11px] font-mono ${up ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
                      {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
                    </div>
                  </div>
                </button>
              )
            })}
            {list.length === 0 && <div className="px-4 py-10 text-center text-white/25 text-sm">{t('Loading markets…')}</div>}
          </div>
        </div>
      </main>

      <BottomNav active="home" />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
