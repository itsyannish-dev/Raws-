'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtSignedMoney, fmtPrice, logout } from '@/lib/rm'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { SymbolIcon } from '@/components/symbol-icon'
import { useLang, LangToggle } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { Menu, Wallet, LogOut, ArrowDownToLine, ArrowUpFromLine, CandlestickChart, ArrowLeftRight, X } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [symbols, setSymbols] = useState([])
  const [quotes, setQuotes] = useState({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [picked, setPicked] = useState(null)

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const RED = light ? 'text-[#e11d48]' : 'text-[#ff3b5c]'
  const T = {
    page: light ? 'bg-[#f5f6f5] text-gray-900' : 'bg-black text-white',
    header: light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/80',
    icon: light ? 'text-gray-600 hover:text-gray-900' : 'text-white/70 hover:text-white',
    iconFaint: light ? 'text-gray-400 hover:text-gray-900' : 'text-white/50 hover:text-white',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/5 bg-white/[0.02]',
    label: light ? 'text-gray-400' : 'text-white/30',
    sub: light ? 'text-gray-500' : 'text-white/40',
    faint: light ? 'text-gray-400' : 'text-white/35',
    divide: light ? 'divide-black/5 border-black/5' : 'divide-white/5 border-white/5',
    rowHover: light ? 'hover:bg-black/[0.02]' : 'hover:bg-white/[0.03]',
    chip: light ? 'text-gray-500 bg-black/5 hover:text-gray-900' : 'text-white/40 bg-white/5 hover:text-white',
    qa: light ? 'border-black/5 bg-white shadow-sm hover:bg-black/[0.02]' : 'border-white/5 bg-white/[0.02] hover:bg-white/5',
    qaAccent: light ? 'border-[#00b34a]/25 bg-[#00b34a]/[0.06] hover:bg-[#00b34a]/10' : 'border-[#00FF66]/25 bg-[#00FF66]/[0.06] hover:bg-[#00FF66]/10',
    modal: light ? 'border-black/10 bg-white' : 'border-white/10 bg-[#0a0a0a]',
  }

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
    return () => { clearInterval(timer); clearInterval(acctT) }
  }, [refresh, router])

  const quickActions = [
    { label: t('Deposit'), icon: ArrowDownToLine, path: '/dashboard?action=deposit', accent: true, testid: 'qa-deposit' },
    { label: t('Withdraw'), icon: ArrowUpFromLine, path: '/dashboard?action=withdraw', testid: 'qa-withdraw' },
    { label: t('Trade'), icon: ArrowLeftRight, path: '/terminal?tab=trade', testid: 'qa-trade' },
    { label: t('Charts'), icon: CandlestickChart, path: '/terminal', testid: 'qa-charts' },
  ]

  const list = symbols.filter((s) => filter === 'all' || s.type === filter)
  const visibleList = showAll ? list : list.slice(0, 8)

  const FILTERS = [
    { k: 'all', l: t('All') },
    { k: 'crypto', l: t('Crypto') },
    { k: 'forex', l: t('Forex') },
    { k: 'metal', l: t('Metals') },
    { k: 'index', l: t('Indices') },
    { k: 'stock', l: t('Stocks') },
  ]

  return (
    <div className={`min-h-screen ${T.page}`}>
      {/* HEADER */}
      <header className={`h-14 border-b flex items-center justify-between px-4 sticky top-0 backdrop-blur-xl z-30 ${T.header}`}>
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className={`p-1.5 -ml-1.5 transition ${T.icon}`}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className={GREEN}>MARKETS</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />
          <LangToggle className="hidden sm:flex" />
          <button data-testid="deposit-nav-btn" onClick={() => router.push('/dashboard?action=deposit')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <Wallet className="h-3.5 w-3.5" /> {t('Deposit')}
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className={`p-2 transition ${T.iconFaint}`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" data-testid="home-greeting">
              {user ? `${t('Welcome back')}, ${user.name.split(' ')[0]}` : t('Welcome back')}
            </h1>
            <p className={`text-sm mt-1 ${T.sub}`}>{t("Here's your account at a glance.")}</p>
          </div>
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>

        {/* ACCOUNT SUMMARY */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { label: t('Balance'), value: account ? fmtMoney(account.balance) : '—', testid: 'home-balance' },
            { label: t('Equity'), value: account ? fmtMoney(account.equity) : '—', testid: 'home-equity' },
            { label: t('Floating PnL'), value: account ? fmtSignedMoney(account.floatingPnl) : '—', color: (account?.floatingPnl || 0) >= 0 ? GREEN : RED, testid: 'home-pnl' },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border p-4 ${T.card}`}>
              <div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{c.label}</div>
              <div data-testid={c.testid} className={`text-base sm:text-xl font-mono font-semibold mt-1.5 ${c.color || ''}`}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-6">
          <div className={`text-[11px] uppercase tracking-widest mb-3 ${T.label}`}>{t('Quick actions')}</div>
          <div className="grid grid-cols-4 gap-3" data-testid="quick-actions">
            {quickActions.map((a) => (
              <button
                key={a.label}
                data-testid={a.testid}
                onClick={() => router.push(a.path)}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 sm:p-5 transition ${a.accent ? T.qaAccent : T.qa}`}
              >
                <a.icon className={`h-5 w-5 ${a.accent ? GREEN : (light ? 'text-gray-600' : 'text-white/70')}`} />
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MARKET WATCH */}
        <div className="mt-8" id="market-watch">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className={`text-[11px] uppercase tracking-widest ${T.label}`}>{t('Market watch')}</div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <button key={f.k} data-testid={`filter-${f.k}`} onClick={() => { setFilter(f.k); setShowAll(false) }} className={`px-3 py-1 text-xs rounded-full font-medium transition ${filter === f.k ? 'bg-[#00FF66] text-black' : T.chip}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
          <div className={`rounded-2xl border overflow-hidden divide-y ${T.card} ${T.divide}`} data-testid="home-market-watch">
            {visibleList.map((s) => {
              const q = quotes[s.symbol]
              const up = (q?.changePercent || 0) >= 0
              return (
                <button
                  key={s.symbol}
                  data-testid={`market-row-${s.symbol}`}
                  onClick={() => setPicked(s)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 transition text-left ${T.rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <SymbolIcon symbol={s.symbol} type={s.type} size={32} />
                    <div>
                      <div className="text-sm font-semibold">{s.symbol}</div>
                      <div className={`text-[11px] ${T.faint}`}>{s.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
                    <div className={`text-[11px] font-mono ${up ? GREEN : RED}`}>
                      {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
                    </div>
                  </div>
                </button>
              )
            })}
            {list.length === 0 && <div className={`px-4 py-10 text-center text-sm ${T.faint}`}>{t('Loading markets…')}</div>}
          </div>
          {list.length > 8 && (
            <button
              data-testid="market-view-more-btn"
              onClick={() => setShowAll(!showAll)}
              className={`w-full mt-3 py-3 rounded-2xl border text-sm font-medium transition ${light ? 'border-black/10 text-gray-500 hover:text-[#00b34a] hover:border-[#00b34a]/40' : 'border-white/10 text-white/60 hover:text-[#00FF66] hover:border-[#00FF66]/30'}`}
            >
              {showAll ? t('View less') : `${t('View more')} (${list.length - 8})`}
            </button>
          )}
        </div>
      </main>

      {/* ASSET ACTION MODAL */}
      {picked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPicked(null)} />
          <div data-testid="asset-action-modal" className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${T.modal}`}>
            <button data-testid="asset-modal-close" onClick={() => setPicked(null)} className={`absolute top-4 right-4 ${T.iconFaint}`}>
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <SymbolIcon symbol={picked.symbol} type={picked.type} size={40} />
              <div>
                <div className="font-bold">{picked.symbol}</div>
                <div className={`text-xs ${T.sub}`}>{picked.name}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-mono text-sm">{quotes[picked.symbol]?.price ? fmtPrice(quotes[picked.symbol].price, picked.decimals) : '—'}</div>
                <div className={`text-[11px] font-mono ${(quotes[picked.symbol]?.changePercent || 0) >= 0 ? GREEN : RED}`}>
                  {quotes[picked.symbol]?.changePercent != null ? `${quotes[picked.symbol].changePercent >= 0 ? '+' : ''}${quotes[picked.symbol].changePercent.toFixed(2)}%` : ''}
                </div>
              </div>
            </div>
            <p className={`text-xs mt-4 ${T.faint}`}>{t('What would you like to do?')}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                data-testid="asset-modal-chart-btn"
                onClick={() => router.push(`/terminal?symbol=${picked.symbol}`)}
                className={`flex flex-col items-center gap-2 rounded-xl border py-4 transition ${light ? 'border-black/10 hover:border-[#00b34a]/40 hover:bg-black/[0.02]' : 'border-white/10 hover:border-[#00FF66]/40 hover:bg-white/[0.03]'}`}
              >
                <CandlestickChart className={`h-5 w-5 ${GREEN}`} />
                <span className="text-xs font-semibold">{t('Open chart')}</span>
              </button>
              <button
                data-testid="asset-modal-trade-btn"
                onClick={() => router.push(`/terminal?symbol=${picked.symbol}&tab=trade`)}
                className="flex flex-col items-center gap-2 rounded-xl bg-[#00FF66] text-black py-4 hover:bg-[#00e65c] transition"
              >
                <ArrowLeftRight className="h-5 w-5" />
                <span className="text-xs font-bold">{t('Trade')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="home" />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
