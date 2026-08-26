'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createChart, CandlestickSeries, ColorType, createSeriesMarkers } from 'lightweight-charts'
import { api, positionPnl, notionalUsd, fmtMoney, fmtSignedMoney, fmtPrice, bidOf, askOf, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { AppDrawer } from '@/components/app-nav'
import { SymbolIcon } from '@/components/symbol-icon'
import { useLang } from '@/lib/i18n'
import { Wallet, LogOut, LayoutDashboard, X, Menu, CandlestickChart, ArrowLeftRight, ListOrdered, LineChart, Home as HomeIcon } from 'lucide-react'

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d']
const INTERVAL_SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
const LEVERAGES = [1, 2, 5, 10, 20, 50, 100]

const App = () => {
  const router = useRouter()
  const { t } = useLang()
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
  const [histFilter, setHistFilter] = useState('all')
  const [marketCat, setMarketCat] = useState('all')
  const [pickedAsset, setPickedAsset] = useState(null)
  const [closingId, setClosingId] = useState(null)
  const [chartError, setChartError] = useState('')
  const [mobileTab, setMobileTab] = useState('chart')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const chartContainerRef = useRef(null)
  const chartApiRef = useRef(null)
  const seriesRef = useRef(null)
  const markersRef = useRef(null)
  const priceLinesRef = useRef([])
  const bidLineRef = useRef(null)
  const askLineRef = useRef(null)
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
      const tabParam = params.get('tab')
      if (['trade', 'positions', 'markets'].includes(tabParam)) setMobileTab(tabParam)
      const symParam = params.get('symbol')
      if (symParam && /^[A-Z0-9]{2,10}$/.test(symParam)) setSelected(symParam)
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
    const markers = createSeriesMarkers(series, [])
    chartApiRef.current = chart
    seriesRef.current = series
    markersRef.current = markers
    return () => {
      chart.remove()
      chartApiRef.current = null
      seriesRef.current = null
      markersRef.current = null
      priceLinesRef.current = []
      bidLineRef.current = null
      askLineRef.current = null
    }
  }, [])

  // ---------- trade markers + entry price lines on chart (no text legends) ----------
  useEffect(() => {
    if (!seriesRef.current) return
    const sec = INTERVAL_SEC[chartInterval] || 3600
    const bucket = (iso) => Math.floor(new Date(iso).getTime() / 1000 / sec) * sec
    const markers = []
    closedPositions.filter((p) => p.symbol === selected).forEach((p) => {
      markers.push({
        time: bucket(p.openedAt),
        position: p.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: p.side === 'buy' ? '#00FF66' : '#ff3b5c',
        shape: p.side === 'buy' ? 'arrowUp' : 'arrowDown',
      })
      if (p.closedAt) {
        markers.push({
          time: bucket(p.closedAt),
          position: p.side === 'buy' ? 'aboveBar' : 'belowBar',
          color: '#7d8590',
          shape: 'circle',
        })
      }
    })
    positions.filter((p) => p.symbol === selected).forEach((p) => {
      markers.push({
        time: bucket(p.openedAt),
        position: p.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: p.side === 'buy' ? '#00FF66' : '#ff3b5c',
        shape: p.side === 'buy' ? 'arrowUp' : 'arrowDown',
      })
    })
    markers.sort((a, b) => a.time - b.time)
    try { markersRef.current?.setMarkers(markers) } catch (e) {}

    // entry price lines for open positions (deduped so same-price entries overlap into one line)
    priceLinesRef.current.forEach((pl) => { try { seriesRef.current.removePriceLine(pl) } catch (e) {} })
    const seen = new Set()
    priceLinesRef.current = positions
      .filter((p) => p.symbol === selected)
      .filter((p) => {
        const key = `${p.side}-${p.entryPrice}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((p) => {
        try {
          return seriesRef.current.createPriceLine({
            price: p.entryPrice,
            color: p.side === 'buy' ? '#00FF66' : '#ff3b5c',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: '',
          })
        } catch (e) { return null }
      })
      .filter(Boolean)
  }, [positions, closedPositions, selected, chartInterval])

  // ---------- live bid/ask lines on chart ----------
  useEffect(() => {
    const series = seriesRef.current
    const q = quotes[selected]
    if (!series || !q?.price) return
    const meta = symbols.find((s) => s.symbol === selected)
    const half = q.bid != null && q.ask != null
      ? (q.ask - q.bid) / 2
      : ((q.spreadPips || 1.5) * (meta?.pipSize || 0.0001)) / 2
    const bid = q.price - half
    const ask = q.price + half
    try {
      if (!askLineRef.current) {
        askLineRef.current = series.createPriceLine({ price: ask, color: '#00FF66', lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' })
      } else {
        askLineRef.current.applyOptions({ price: ask })
      }
      if (!bidLineRef.current) {
        bidLineRef.current = series.createPriceLine({ price: bid, color: '#ff3b5c', lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' })
      } else {
        bidLineRef.current.applyOptions({ price: bid })
      }
    } catch (e) {}
  }, [quotes, selected, symbols])

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
    return sum + (q?.price ? positionPnl(p, q, quotes) : 0)
  }, 0), [positions, quotes])
  const usedMargin = useMemo(() => positions.reduce((s, p) => s + p.margin, 0), [positions])
  const equity = balance + floatingPnl
  const freeMargin = equity - usedMargin
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : null

  const selMeta = symbols.find((s) => s.symbol === selected) || { decimals: 2, name: selected, contractSize: 1, quote: 'USD', maxLeverage: 100 }
  const selQuote = quotes[selected]
  const lotsNum = Number(lots) || 0
  const midPrice = selQuote?.price || 0
  const contractUnits = lotsNum * (selMeta.contractSize || 1)
  const orderNotional = notionalUsd(selMeta, midPrice, lotsNum, quotes)
  const requiredMargin = orderNotional / leverage
  const maxLev = selMeta.maxLeverage || 100
  const availableLeverages = LEVERAGES.filter((l) => l <= maxLev)

  // clamp leverage to the selected symbol's category limit
  useEffect(() => {
    if (leverage > maxLev) setLeverage(maxLev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, maxLev])

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
  const forexSymbols = symbols.filter((s) => s.type === 'forex')
  const metalSymbols = symbols.filter((s) => s.type === 'metal')
  const indexSymbols = symbols.filter((s) => s.type === 'index')
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
        <div className="flex items-center gap-2.5 min-w-0">
          <SymbolIcon symbol={s.symbol} type={s.type} size={26} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{s.symbol}</div>
            <div className="text-[11px] text-white/35 truncate">{s.name}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
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
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-2 pb-1">{t('Crypto')}</div>
      {cryptoSymbols.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-4 pb-1">{t('Forex')}</div>
      {forexSymbols.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-4 pb-1">{t('Metals')}</div>
      {metalSymbols.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-4 pb-1">{t('Indices')}</div>
      {indexSymbols.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
      <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 pt-4 pb-1">{t('Stocks')}</div>
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
            <div className="font-mono text-sm text-[#ff3b5c]" data-testid="sell-price">{midPrice ? fmtPrice(bidOf(selQuote), selMeta.decimals) : '—'}</div>
          </div>
          <div className="rounded-lg bg-[#00FF66]/5 border border-[#00FF66]/15 p-2.5 text-center">
            <div className="text-[10px] text-white/35">BUY (Ask)</div>
            <div className="font-mono text-sm text-[#00FF66]" data-testid="buy-price">{midPrice ? fmtPrice(askOf(selQuote), selMeta.decimals) : '—'}</div>
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
        <label className="text-[11px] text-white/40 block mb-1.5">Leverage <span className="text-white/25">(max 1:{maxLev})</span></label>
        <div className="grid grid-cols-4 gap-1.5">
          {availableLeverages.map((l) => (
            <button key={l} data-testid={`leverage-${l}`} onClick={() => setLeverage(l)} className={`text-[11px] py-1.5 rounded-md border font-mono transition ${leverage === l ? 'border-[#00FF66]/60 bg-[#00FF66]/10 text-[#00FF66]' : 'border-white/10 text-white/40 hover:text-white'}`}>
              {l}x
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 space-y-1.5 text-[11px]">
        {(selMeta.contractSize || 1) > 1 && (
          <div className="flex justify-between"><span className="text-white/35">Units ({selMeta.contractSize.toLocaleString()}/lot)</span><span className="font-mono" data-testid="order-units">{contractUnits.toLocaleString()}</span></div>
        )}
        <div className="flex justify-between"><span className="text-white/35">Notional value</span><span className="font-mono" data-testid="order-notional">{fmtMoney(orderNotional)}</span></div>
        <div className="flex justify-between"><span className="text-white/35">Required margin</span><span className="font-mono" data-testid="order-margin">{fmtMoney(requiredMargin)}</span></div>
        <div className="flex justify-between"><span className="text-white/35">Free margin</span><span className="font-mono">{fmtMoney(freeMargin)}</span></div>
        <div className="flex justify-between"><span className="text-white/35">Spread</span><span className="font-mono">{selQuote?.spreadPips != null ? `${selQuote.spreadPips.toFixed(1)} pips` : '—'}</span></div>
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

  const HIST_FILTERS = [
    { k: 'today', l: t('Today') },
    { k: 'yesterday', l: t('Yesterday') },
    { k: 'week', l: t('This week') },
    { k: 'month', l: t('This month') },
    { k: 'all', l: t('All') },
  ]
  const filterHistory = (list, f) => {
    if (f === 'all') return list
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return list.filter((p) => {
      if (!p.closedAt) return false
      const c = new Date(p.closedAt)
      if (f === 'today') return c >= today
      if (f === 'yesterday') {
        const y = new Date(today); y.setDate(y.getDate() - 1)
        return c >= y && c < today
      }
      if (f === 'week') {
        const w = new Date(today); w.setDate(w.getDate() - ((w.getDay() + 6) % 7))
        return c >= w
      }
      if (f === 'month') return c >= new Date(now.getFullYear(), now.getMonth(), 1)
      return true
    })
  }
  const histList = filterHistory(closedPositions, histFilter)
  const histTotal = histList.reduce((s, p) => s + (p.pnl || 0), 0)
  const histWins = histList.filter((p) => (p.pnl || 0) > 0).length

  const positionsPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-3 pt-2 shrink-0">
        <button data-testid="tab-open-positions" onClick={() => setTab('open')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${tab === 'open' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
          {t('Positions')} ({positions.length})
        </button>
        <button data-testid="tab-history" onClick={() => setTab('history')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${tab === 'history' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
          History ({closedPositions.length})
        </button>
      </div>

      {tab === 'history' && (
        <div className="px-3 pt-2 shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-1" data-testid="history-filters">
            {HIST_FILTERS.map((f) => (
              <button key={f.k} data-testid={`hist-filter-${f.k}`} onClick={() => setHistFilter(f.k)} className={`px-3 py-1 text-[11px] rounded-full font-medium whitespace-nowrap transition ${histFilter === f.k ? 'bg-[#00FF66] text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}>
                {f.l}
              </button>
            ))}
          </div>
          <div data-testid="history-summary" className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3.5 py-2 mt-1.5 text-[11px]">
            <span className="text-white/40">{t('Trades')}: <span className="text-white font-mono">{histList.length}</span>{histList.length > 0 && <span className="text-white/25 ml-2">({histWins}W / {histList.length - histWins}L)</span>}</span>
            <span className="text-white/40">{t('Total PnL')}: <span data-testid="history-total-pnl" className={`font-mono font-semibold ${histTotal >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>{fmtSignedMoney(histTotal)}</span></span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {tab === 'open' && positions.map((p) => {
          const q = quotes[p.symbol]
          const pnl = q?.price ? positionPnl(p, q, quotes) : 0
          const meta = symbols.find((s) => s.symbol === p.symbol) || { decimals: 2 }
          const cur = q?.price ? (p.side === 'buy' ? bidOf(q) : askOf(q)) : null
          return (
            <div key={p.id} data-testid={`position-row-${p.id}`} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <SymbolIcon symbol={p.symbol} type={meta.type} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{p.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${p.side === 'buy' ? 'bg-[#00FF66]/15 text-[#00FF66]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]'}`}>{p.side} {p.lots}</span>
                  </div>
                  <div className="text-[11px] text-white/30 font-mono mt-0.5">{fmtPrice(p.entryPrice, meta.decimals)} → {cur ? fmtPrice(cur, meta.decimals) : '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`font-mono text-sm font-semibold ${pnl >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>{fmtSignedMoney(pnl)}</span>
                <button data-testid={`close-position-${p.id}`} disabled={closingId === p.id} onClick={() => closePosition(p.id)} title="Close position" className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:bg-[#ff3b5c]/15 hover:text-[#ff3b5c] transition disabled:opacity-40">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
        {tab === 'open' && positions.length === 0 && (
          <div className="py-10 text-center text-white/25 text-xs">No open positions. Place your first trade →</div>
        )}

        {tab === 'history' && histList.map((p) => {
          const meta = symbols.find((s) => s.symbol === p.symbol) || { decimals: 2 }
          return (
            <div key={p.id} data-testid={`history-row-${p.id}`} className="flex items-center justify-between rounded-2xl bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <SymbolIcon symbol={p.symbol} type={meta.type} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{p.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${p.side === 'buy' ? 'bg-[#00FF66]/15 text-[#00FF66]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]'}`}>{p.side} {p.lots}</span>
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5">{p.closedAt ? new Date(p.closedAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>
              </div>
              <span className={`font-mono text-sm font-semibold shrink-0 ${(p.pnl || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>{fmtSignedMoney(p.pnl)}</span>
            </div>
          )
        })}
        {tab === 'history' && histList.length === 0 && (
          <div className="py-10 text-center text-white/25 text-xs">{t('No trades in this period.')}</div>
        )}
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

          {/* chart (hidden on mobile when another tab is active) */}
          <div className={`flex-1 relative min-h-0 ${mobileTab !== 'chart' ? 'hidden md:block' : ''}`}>
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

          {/* mobile POSITIONS view */}
          <div data-testid="mobile-positions-view" className={`md:hidden flex-1 min-h-0 overflow-hidden ${mobileTab === 'positions' ? 'flex flex-col' : 'hidden'}`}>
            {positionsPanel}
          </div>

          {/* mobile MARKETS view */}
          <div data-testid="mobile-markets-view" className={`md:hidden flex-1 min-h-0 flex-col ${mobileTab === 'markets' ? 'flex' : 'hidden'}`}>
            <div className="p-3 shrink-0">
              <select
                data-testid="markets-category-select"
                value={marketCat}
                onChange={(e) => setMarketCat(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[#00FF66]/50"
              >
                <option value="all" className="bg-black">{t('Category')}: {t('All')}</option>
                <option value="crypto" className="bg-black">{t('Crypto')}</option>
                <option value="forex" className="bg-black">{t('Forex')}</option>
                <option value="metal" className="bg-black">{t('Metals')}</option>
                <option value="index" className="bg-black">{t('Indices')}</option>
                <option value="stock" className="bg-black">{t('Stocks')}</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {symbols.filter((s) => marketCat === 'all' || s.type === marketCat).map((s) => {
                const q = quotes[s.symbol]
                const up = (q?.changePercent || 0) >= 0
                return (
                  <button
                    key={s.symbol}
                    data-testid={`mobile-markets-${s.symbol}`}
                    onClick={() => setPickedAsset(s)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SymbolIcon symbol={s.symbol} type={s.type} size={28} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{s.symbol}</div>
                        <div className="text-[11px] text-white/35 truncate">{s.name}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
                      <div className={`text-[11px] font-mono ${up ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
                        {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* positions (desktop / mobile chart tab) */}
          <div className={`h-56 shrink-0 border-t border-white/5 ${mobileTab === 'chart' ? 'flex' : 'hidden md:flex'} flex-col`}>
            {positionsPanel}
          </div>
        </main>

        {/* ORDER PANEL (desktop) */}
        <aside className="w-72 shrink-0 border-l border-white/5 p-4 overflow-y-auto hidden md:block">
          {orderPanel}
        </aside>
      </div>

      {/* ASSET ACTION MODAL (markets tab) */}
      {pickedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPickedAsset(null)} />
          <div data-testid="terminal-asset-modal" className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
            <button data-testid="terminal-asset-modal-close" onClick={() => setPickedAsset(null)} className="absolute top-4 right-4 text-white/40 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <SymbolIcon symbol={pickedAsset.symbol} type={pickedAsset.type} size={40} />
              <div>
                <div className="font-bold">{pickedAsset.symbol}</div>
                <div className="text-xs text-white/40">{pickedAsset.name}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-mono text-sm">{quotes[pickedAsset.symbol]?.price ? fmtPrice(quotes[pickedAsset.symbol].price, pickedAsset.decimals) : '—'}</div>
              </div>
            </div>
            <p className="text-xs text-white/35 mt-4">{t('What would you like to do?')}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                data-testid="terminal-asset-chart-btn"
                onClick={() => { setSelected(pickedAsset.symbol); setMobileTab('chart'); setPickedAsset(null) }}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 py-4 hover:border-[#00FF66]/40 hover:bg-white/[0.03] transition"
              >
                <CandlestickChart className="h-5 w-5 text-[#00FF66]" />
                <span className="text-xs font-semibold">{t('Open chart')}</span>
              </button>
              <button
                data-testid="terminal-asset-trade-btn"
                onClick={() => { setSelected(pickedAsset.symbol); setMobileTab('trade'); setPickedAsset(null) }}
                className="flex flex-col items-center gap-2 rounded-xl bg-[#00FF66] text-black py-4 hover:bg-[#00e65c] transition"
              >
                <ArrowLeftRight className="h-5 w-5" />
                <span className="text-xs font-bold">{t('Trade')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav data-testid="mobile-bottom-nav" className="md:hidden h-16 shrink-0 border-t border-white/10 bg-black flex items-stretch z-30">
        <button data-testid="bottomnav-home" onClick={() => router.push('/home')} className="flex-1 flex flex-col items-center justify-center gap-1 text-white/40 hover:text-white transition">
          <HomeIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('Home')}</span>
        </button>
        <button data-testid="bottomnav-chart" onClick={() => setMobileTab('chart')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'chart' ? 'text-[#00FF66]' : 'text-white/40 hover:text-white'}`}>
          <CandlestickChart className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('Chart')}</span>
        </button>
        <button data-testid="bottomnav-trade" onClick={() => setMobileTab('trade')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'trade' ? 'text-[#00FF66]' : 'text-white/40 hover:text-white'}`}>
          <ArrowLeftRight className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('Trade')}</span>
        </button>
        <button data-testid="bottomnav-positions" onClick={() => setMobileTab('positions')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'positions' ? 'text-[#00FF66]' : 'text-white/40 hover:text-white'}`}>
          <ListOrdered className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('Positions')}</span>
        </button>
      </nav>

      {/* NAVIGATION DRAWER */}
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
