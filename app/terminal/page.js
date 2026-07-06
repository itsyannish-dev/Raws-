'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts'
import { api, positionPnl, fmtMoney, fmtSignedMoney, fmtPrice, askPrice, bidPrice, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { AppDrawer } from '@/components/app-nav'
import { Wallet, LogOut, LayoutDashboard, X, Menu, Home, CandlestickChart, ArrowLeftRight } from 'lucide-react'

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d']
const INTERVAL_SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
const LEVERAGES = [1, 2, 5, 10, 20, 50, 100]

const App = () => {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [symbols, setSymbols] = useState([])
  const [quotes, setQuotes] = useState({})
  const [selected, setSelected] = useState('BTCUSD')
  const [chartInterval, setChartInterval] = useState('1h')
  const [positions, setPositions] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [balance, setBalance] = useState(0)
  const [lots, setLots] = useState('0.01')
  const [leverage, setLeverage] = useState(10)
  const [placing, setPlacing] = useState(false)
  const [tab, setTab] = useState('open')
  const [closingId, setClosingId] = useState(null)
  const [chartError, setChartError] = useState('')
  const [mobileTab, setMobileTab] = useState('chart')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const chartContainerRef = useRef(null)
  const chartApiRef = useRef(null)
  const seriesRef = useRef(null)
  const lastBarRef = useRef(null)
  const selectedRef = useRef(selected)
  const intervalStateRef = useRef(chartInterval)
  const bufferRef = useRef({})
  const wsMapRef = useRef({})
  const quotesRef = useRef({})

  selectedRef.current = selected
  intervalStateRef.current = chartInterval

  // ---------- data refresh ----------
  const refreshPositions = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([api.get('/positions?status=open'), api.get('/positions?status=closed')])
      setPositions(o.data.positions)
      setClosedPositions(c.data.positions)
    } catch (e) {}
  }, [])

  const refreshAccount = useCallback(async () => {
    try {
      const r = await api.get('/account/summary')
      setBalance(r.data.account.balance)
    } catch (e) {}
  }, [])

  // ---------- chart tick update ----------
  const updateChartTick = useCallback((price) => {
    const sec = INTERVAL_SEC[intervalStateRef.current] || 3600
    const bucket = Math.floor(Date.now() / 1000 / sec) * sec
    let bar = lastBarRef.current
    if (bar && bar.time === bucket) {
      bar = { ...bar, close: price, high: Math.max(bar.high, price), low: Math.min(bar.low, price) }
    } else if (bar && bucket > bar.time) {
      bar = { time: bucket, open: bar.close, high: price, low: price, close: price }
    } else if (!bar) {
      bar = { time: bucket, open: price, high: price, low: price, close: price }
    } else {
      return
    }
    lastBarRef.current = bar
    try { seriesRef.current?.update(bar) } catch (e) {}
  }, [])

  const applyQuotes = useCallback((incoming) => {
    setQuotes((prev) => {
      const next = { ...prev }
      for (const [s, q] of Object.entries(incoming)) next[s] = { ...(next[s] || {}), ...q }
      quotesRef.current = next
      return next
    })
    const sel = selectedRef.current
    if (incoming[sel]?.price) updateChartTick(incoming[sel].price)
  }, [updateChartTick])

  // ---------- init ----------
  useEffect(() => {
    const token = localStorage.getItem('rm_token')
    if (!token) { router.replace('/'); return }
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tab') === 'trade') setMobileTab('trade')
      const symParam = params.get('symbol')
      if (symParam && /^[A-Z]{2,10}$/.test(symParam)) setSelected(symParam)
    } catch (e) {}
    let ws = null
    let pollTimer, flushTimer, acctTimer

    const flushBuffer = () => {
      const buf = bufferRef.current
      const keys = Object.keys(buf)
      if (keys.length === 0) return
      bufferRef.current = {}
      setQuotes((prev) => {
        const next = { ...prev }
        for (const [s, p] of Object.entries(buf)) next[s] = { ...(next[s] || {}), price: p }
        quotesRef.current = next
        return next
      })
      const sel = selectedRef.current
      if (buf[sel] != null) updateChartTick(buf[sel])
    }

    const init = async () => {
      try {
        const [meRes, symRes] = await Promise.all([api.get('/auth/me'), api.get('/market/symbols')])
        setUser(meRes.data.user)
        setBalance(meRes.data.user.balance)
        setSymbols(symRes.data.symbols)
      } catch (e) {
        localStorage.removeItem('rm_token')
        router.replace('/')
        return
      }
      try {
        const qRes = await api.get('/market/quotes')
        applyQuotes(qRes.data.quotes)
      } catch (e) {}
      refreshPositions()

      // Finnhub websocket for live crypto ticks
      try {
        const cfg = await api.get('/market/ws-config')
        const map = {}
        cfg.data.subscriptions.forEach((s) => { map[s.ws] = s.symbol })
        wsMapRef.current = map
        ws = new WebSocket(`${cfg.data.url}?token=${cfg.data.token}`)
        ws.onopen = () => {
          cfg.data.subscriptions.forEach((s) => ws.send(JSON.stringify({ type: 'subscribe', symbol: s.ws })))
        }
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data)
            if (m.type === 'trade' && Array.isArray(m.data)) {
              for (const t of m.data) {
                const sym = wsMapRef.current[t.s]
                if (sym) bufferRef.current[sym] = t.p
              }
            }
          } catch (e) {}
        }
      } catch (e) {}

      flushTimer = setInterval(flushBuffer, 600)
      pollTimer = setInterval(async () => {
        try {
          const r = await api.get('/market/quotes')
          applyQuotes(r.data.quotes)
        } catch (e) {}
      }, 12000)
      acctTimer = setInterval(refreshAccount, 20000)
    }
    init()
    return () => {
      if (ws) try { ws.close() } catch (e) {}
      clearInterval(pollTimer)
      clearInterval(flushTimer)
      clearInterval(acctTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- chart setup ----------
  useEffect(() => {
    if (!chartContainerRef.current) return
    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#050505' }, textColor: '#555', fontFamily: "'Inter', sans-serif" },
      grid: { vertLines: { color: '#0f0f0f' }, horzLines: { color: '#0f0f0f' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#1a1a1a' },
      rightPriceScale: { borderColor: '#1a1a1a' },
      crosshair: { mode: 0 },
      localization: { locale: 'en-US' },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00FF66', downColor: '#ff3b5c', borderVisible: false, wickUpColor: '#00FF66', wickDownColor: '#ff3b5c',
    })
    chartApiRef.current = chart
    seriesRef.current = series
    return () => {
      chart.remove()
      chartApiRef.current = null
      seriesRef.current = null
    }
  }, [])

  // ---------- load candles ----------
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setChartError('')
      try {
        const r = await api.get(`/market/candles?symbol=${selected}&interval=${chartInterval}`)
        if (cancelled) return
        const bars = r.data.candles || []
        lastBarRef.current = bars.length ? bars[bars.length - 1] : null
        seriesRef.current?.setData(bars)
        chartApiRef.current?.timeScale().fitContent()
      } catch (e) {
        if (!cancelled) setChartError('Chart data unavailable for this market right now.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [selected, chartInterval])

  // ---------- derived live account ----------
  const floatingPnl = useMemo(() => positions.reduce((sum, p) => {
    const q = quotes[p.symbol]
    return sum + (q?.price ? positionPnl(p, q.price) : 0)
  }, 0), [positions, quotes])
  const usedMargin = useMemo(() => positions.reduce((s, p) => s + p.margin, 0), [positions])
  const equity = balance + floatingPnl
  const freeMargin = equity - usedMargin
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : null

  const selMeta = symbols.find((s) => s.symbol === selected) || { decimals: 2, name: selected }
  const selQuote = quotes[selected]
  const lotsNum = Number(lots) || 0
  const midPrice = selQuote?.price || 0
  const requiredMargin = (lotsNum * midPrice) / leverage

  // ---------- actions ----------
  const placeOrder = async (side) => {
    if (placing) return
    if (!lotsNum || lotsNum <= 0) { toast.error('Enter a valid lot size'); return }
    setPlacing(true)
    try {
      await api.post('/orders', { symbol: selected, side, lots: lotsNum, leverage })
      toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} ${lotsNum} ${selected} executed`)
      refreshPositions()
      refreshAccount()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Order failed')
    } finally {
      setPlacing(false)
    }
  }

  const closePosition = async (id) => {
    setClosingId(id)
    try {
      const r = await api.post(`/positions/${id}/close`)
      const pnl = r.data.position.pnl
      toast[pnl >= 0 ? 'success' : 'error'](`Position closed. PnL: ${fmtSignedMoney(pnl)}`)
      setBalance(r.data.balance)
      refreshPositions()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Close failed')
    } finally {
      setClosingId(null)
    }
  }

  const pickSymbol = (symbol) => {
    setSelected(symbol)
    setDrawerOpen(false)
  }

  const cryptoSymbols = symbols.filter((s) => s.type === 'crypto')
  const stockSymbols = symbols.filter((s) => s.type === 'stock')

  const WatchRow = ({ s, testPrefix = 'watchlist' }) => {
    const q = quotes[s.symbol]
    const up = (q?.changePercent || 0) >= 0
    const active = selected === s.symbol
    return (
      <button
        data-testid={`${testPrefix}-${s.symbol}`}
        onClick={() => pickSymbol(s.symbol)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition ${active ? 'bg-[#00FF66]/10 border border-[#00FF66]/20' : 'hover:bg-white/5 border border-transparent'}`}
      >
        <div>
          <div className="text-sm font-semibold">{s.symbol}</div>
          <div className="text-[11px] text-white/35">{s.name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
          <div className={`text-[11px] font-mono ${up ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
            {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
          </div>
        </div>
      </button>
    )
  }

  const marketWatchList = (testPrefix) => (
    <>
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-2 pb-1">Crypto</div>
      {cryptoSymbols.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-4 pb-1">Stocks</div>
      {stockSymbols.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
    </>
  )

  // ---------- reusable panels ----------
  const orderPanel = (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">New order — {selected}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#ff3b5c]/5 border border-[#ff3b5c]/15 p-2.5 text-center">
            <div className="text-[10px] text-white/35">SELL (Bid)</div>
            <div className="font-mono text-sm text-[#ff3b5c]" data-testid="sell-price">{midPrice ? fmtPrice(bidPrice(midPrice), selMeta.decimals) : '—'}</div>
          </div>
          <div className="rounded-lg bg-[#00FF66]/5 border border-[#00FF66]/15 p-2.5 text-center">
            <div className="text-[10px] text-white/35">BUY (Ask)</div>
            <div className="font-mono text-sm text-[#00FF66]" data-testid="buy-price">{midPrice ? fmtPrice(askPrice(midPrice), selMeta.decimals) : '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-white/40 block mb-1.5">Lot size (units)</label>
        <input
          data-testid="lots-input"
          type="number"
          min="0.0001"
          step="0.01"
          value={lots}
          onChange={(e) => setLots(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00FF66]/50"
        />
        <div className="flex gap-1.5 mt-2">
          {['0.01', '0.1', '0.5', '1'].map((v) => (
            <button key={v} onClick={() => setLots(v)} className={`flex-1 text-[11px] py-1 rounded-md border transition ${lots === v ? 'border-[#00FF66]/50 text-[#00FF66]' : 'border-white/10 text-white/40 hover:text-white'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-white/40 block mb-1.5">Leverage</label>
        <div className="grid grid-cols-4 gap-1.5">
          {LEVERAGES.map((l) => (
            <button key={l} data-testid={`leverage-${l}`} onClick={() => setLeverage(l)} className={`text-[11px] py-1.5 rounded-md border font-mono transition ${leverage === l ? 'border-[#00FF66]/60 bg-[#00FF66]/10 text-[#00FF66]' : 'border-white/10 text-white/40 hover:text-white'}`}>
              {l}x
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 space-y-1.5 text-[11px]">
        <div className="flex justify-between"><span className="text-white/35">Notional value</span><span className="font-mono" data-testid="order-notional">{fmtMoney(lotsNum * midPrice)}</span></div>
        <div className="flex justify-between"><span className="text-white/35">Required margin</span><span className="font-mono" data-testid="order-margin">{fmtMoney(requiredMargin)}</span></div>
        <div className="flex justify-between"><span className="text-white/35">Free margin</span><span className="font-mono">{fmtMoney(freeMargin)}</span></div>
        <div className="flex justify-between"><span className="text-white/35">Spread</span><span className="font-mono">0.05%</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button data-testid="sell-btn" disabled={placing || !midPrice} onClick={() => placeOrder('sell')} className="bg-[#ff3b5c] hover:bg-[#e63552] text-white font-bold py-3 rounded-lg transition disabled:opacity-40 text-sm">
          SELL
        </button>
        <button data-testid="buy-btn" disabled={placing || !midPrice} onClick={() => placeOrder('buy')} className="bg-[#00FF66] hover:bg-[#00e65c] text-black font-bold py-3 rounded-lg transition disabled:opacity-40 text-sm">
          BUY
        </button>
      </div>

      {balance <= 0 && (
        <div className="rounded-lg border border-[#00FF66]/20 bg-[#00FF66]/5 p-3 text-[11px] text-white/60">
          Your balance is $0. <button onClick={() => router.push('/dashboard')} className="text-[#00FF66] font-semibold hover:underline">Make a deposit</button> to start trading.
        </div>
      )}
    </div>
  )

  const positionsPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-3 pt-2 shrink-0">
        <button data-testid="tab-open-positions" onClick={() => setTab('open')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${tab === 'open' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
          Open positions ({positions.length})
        </button>
        <button data-testid="tab-history" onClick={() => setTab('history')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${tab === 'history' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
          History ({closedPositions.length})
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 pb-2">
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="text-white/30 text-left">
              <th className="py-2 font-medium">Symbol</th>
              <th className="font-medium">Side</th>
              <th className="font-medium text-right">Lots</th>
              <th className="font-medium text-right">Entry</th>
              <th className="font-medium text-right">{tab === 'open' ? 'Current' : 'Close'}</th>
              <th className="font-medium text-right">Margin</th>
              <th className="font-medium text-right">PnL</th>
              <th className="font-medium text-right">{tab === 'open' ? '' : 'Closed at'}</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {tab === 'open' && positions.map((p) => {
              const q = quotes[p.symbol]
              const pnl = q?.price ? positionPnl(p, q.price) : 0
              const meta = symbols.find((s) => s.symbol === p.symbol) || { decimals: 2 }
              const cur = q?.price ? (p.side === 'buy' ? bidPrice(q.price) : askPrice(q.price)) : null
              return (
                <tr key={p.id} data-testid={`position-row-${p.id}`} className="border-t border-white/5">
                  <td className="py-2 font-semibold font-sans">{p.symbol}</td>
                  <td><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${p.side === 'buy' ? 'bg-[#00FF66]/15 text-[#00FF66]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]'}`}>{p.side}</span></td>
                  <td className="text-right">{p.lots}</td>
                  <td className="text-right">{fmtPrice(p.entryPrice, meta.decimals)}</td>
                  <td className="text-right">{cur ? fmtPrice(cur, meta.decimals) : '—'}</td>
                  <td className="text-right text-white/50">{fmtMoney(p.margin)}</td>
                  <td className={`text-right font-semibold ${pnl >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>{fmtSignedMoney(pnl)}</td>
                  <td className="text-right">
                    <button data-testid={`close-position-${p.id}`} disabled={closingId === p.id} onClick={() => closePosition(p.id)} className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold border border-white/15 hover:border-[#ff3b5c]/60 hover:text-[#ff3b5c] rounded-md px-2 py-1 transition disabled:opacity-40">
                      <X className="h-3 w-3" /> {closingId === p.id ? 'Closing…' : 'Close'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {tab === 'open' && positions.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-white/25 font-sans">No open positions. Place your first trade →</td></tr>
            )}
            {tab === 'history' && closedPositions.map((p) => {
              const meta = symbols.find((s) => s.symbol === p.symbol) || { decimals: 2 }
              return (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="py-2 font-semibold font-sans">{p.symbol}</td>
                  <td><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${p.side === 'buy' ? 'bg-[#00FF66]/15 text-[#00FF66]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]'}`}>{p.side}</span></td>
                  <td className="text-right">{p.lots}</td>
                  <td className="text-right">{fmtPrice(p.entryPrice, meta.decimals)}</td>
                  <td className="text-right">{fmtPrice(p.closePrice, meta.decimals)}</td>
                  <td className="text-right text-white/50">{fmtMoney(p.margin)}</td>
                  <td className={`text-right font-semibold ${(p.pnl || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>{fmtSignedMoney(p.pnl)}</td>
                  <td className="text-right text-white/40">{p.closedAt ? new Date(p.closedAt).toLocaleString() : ''}</td>
                </tr>
              )
            })}
            {tab === 'history' && closedPositions.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-white/25 font-sans">No trade history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      <Toaster position="top-right" theme="dark" richColors />

      {/* MENU BAR */}
      <header className="h-14 shrink-0 border-b border-white/5 flex items-center justify-between px-4 bg-black z-30">
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className="p-1.5 -ml-1.5 text-white/70 hover:text-white transition">
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => router.push('/home')} className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="deposit-nav-btn" onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <Wallet className="h-3.5 w-3.5" /> Deposit
          </button>
          <button data-testid="dashboard-nav-btn" onClick={() => router.push('/dashboard')} className="hidden md:block p-2 text-white/50 hover:text-white transition" title="Dashboard">
            <LayoutDashboard className="h-4 w-4" />
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className="p-2 text-white/50 hover:text-white transition" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ACCOUNT HEADER */}
      <div data-testid="account-header" className="h-11 shrink-0 border-b border-white/5 bg-white/[0.02] flex items-center gap-6 px-4 overflow-x-auto whitespace-nowrap text-xs">
        <div className="shrink-0"><span className="text-white/35">Balance </span><span data-testid="acct-balance" className="font-mono font-semibold">{fmtMoney(balance)}</span></div>
        <div className="shrink-0"><span className="text-white/35">Equity </span><span data-testid="acct-equity" className="font-mono font-semibold">{fmtMoney(equity)}</span></div>
        <div className="shrink-0"><span className="text-white/35">Floating PnL </span><span data-testid="acct-floating-pnl" className={`font-mono font-semibold ${floatingPnl >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>{fmtSignedMoney(floatingPnl)}</span></div>
        <div className="shrink-0"><span className="text-white/35">Margin </span><span data-testid="acct-margin" className="font-mono">{fmtMoney(usedMargin)}</span></div>
        <div className="shrink-0"><span className="text-white/35">Free margin </span><span data-testid="acct-free-margin" className="font-mono">{fmtMoney(freeMargin)}</span></div>
        {marginLevel != null && <div className="shrink-0"><span className="text-white/35">Margin level </span><span className="font-mono">{marginLevel.toFixed(0)}%</span></div>}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* WATCHLIST (desktop) */}
        <aside className="w-60 shrink-0 border-r border-white/5 overflow-y-auto p-2 hidden md:block">
          {marketWatchList('watchlist')}
        </aside>

        {/* CENTER */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* symbol header */}
          <div className="h-14 shrink-0 border-b border-white/5 flex items-center justify-between gap-2 px-4 overflow-x-auto">
            <div className="flex items-center gap-3 shrink-0">
              <select
                data-testid="mobile-symbol-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="md:hidden bg-white/5 border border-white/10 rounded-md text-sm font-bold px-2 py-1.5 focus:outline-none focus:border-[#00FF66]/50"
              >
                {(symbols.length ? symbols : [{ symbol: selected }]).map((s) => (
                  <option key={s.symbol} value={s.symbol} className="bg-black">{s.symbol}</option>
                ))}
              </select>
              <div className="hidden md:block">
                <div className="font-bold" data-testid="selected-symbol">{selected}</div>
                <div className="text-[11px] text-white/35">{selMeta.name}</div>
              </div>
              <div data-testid="selected-price" className={`text-lg sm:text-xl font-mono font-semibold ${(selQuote?.changePercent || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
                {selQuote?.price ? fmtPrice(selQuote.price, selMeta.decimals) : '—'}
              </div>
              {selQuote?.changePercent != null && (
                <div className={`text-xs font-mono ${selQuote.changePercent >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
                  {selQuote.changePercent >= 0 ? '+' : ''}{selQuote.changePercent.toFixed(2)}%
                </div>
              )}
              <div className="hidden lg:flex gap-4 text-[11px] text-white/35 font-mono">
                <span>H {selQuote?.high ? fmtPrice(selQuote.high, selMeta.decimals) : '—'}</span>
                <span>L {selQuote?.low ? fmtPrice(selQuote.low, selMeta.decimals) : '—'}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {INTERVALS.map((iv) => (
                <button key={iv} data-testid={`interval-${iv}`} onClick={() => setChartInterval(iv)} className={`px-2 sm:px-2.5 py-1 text-xs rounded-md font-medium transition ${chartInterval === iv ? 'bg-[#00FF66] text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                  {iv}
                </button>
              ))}
            </div>
          </div>

          {/* chart (hidden on mobile when Trade tab active) */}
          <div className={`flex-1 relative min-h-0 ${mobileTab === 'trade' ? 'hidden md:block' : ''}`}>
            <div ref={chartContainerRef} className="absolute inset-0" data-testid="chart-container" />
            {chartError && (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm bg-black/60">{chartError}</div>
            )}
          </div>

          {/* mobile TRADE view */}
          <div data-testid="mobile-trade-view" className={`md:hidden flex-1 min-h-0 overflow-y-auto p-4 ${mobileTab === 'trade' ? 'block' : 'hidden'}`}>
            {orderPanel}
            <div className="mt-6 h-72 rounded-xl border border-white/5">
              {positionsPanel}
            </div>
          </div>

          {/* positions (desktop / mobile chart tab) */}
          <div className={`h-56 shrink-0 border-t border-white/5 ${mobileTab === 'trade' ? 'hidden md:flex' : 'flex'} flex-col`}>
            {positionsPanel}
          </div>
        </main>

        {/* ORDER PANEL (desktop) */}
        <aside className="w-72 shrink-0 border-l border-white/5 p-4 overflow-y-auto hidden md:block">
          {orderPanel}
        </aside>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav data-testid="mobile-bottom-nav" className="md:hidden h-16 shrink-0 border-t border-white/10 bg-black flex items-stretch z-30">
        <button data-testid="bottomnav-home" onClick={() => router.push('/home')} className="flex-1 flex flex-col items-center justify-center gap-1 text-white/40 hover:text-white transition">
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button data-testid="bottomnav-chart" onClick={() => setMobileTab('chart')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'chart' ? 'text-[#00FF66]' : 'text-white/40 hover:text-white'}`}>
          <CandlestickChart className="h-5 w-5" />
          <span className="text-[10px] font-medium">Chart</span>
        </button>
        <button data-testid="bottomnav-trade" onClick={() => setMobileTab('trade')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'trade' ? 'text-[#00FF66]' : 'text-white/40 hover:text-white'}`}>
          <ArrowLeftRight className="h-5 w-5" />
          <span className="text-[10px] font-medium">Trade</span>
        </button>
        <button data-testid="bottomnav-wallet" onClick={() => router.push('/dashboard')} className="flex-1 flex flex-col items-center justify-center gap-1 text-white/40 hover:text-white transition">
          <Wallet className="h-5 w-5" />
          <span className="text-[10px] font-medium">Wallet</span>
        </button>
      </nav>

      {/* NAVIGATION DRAWER */}
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
