'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createChart, CandlestickSeries, ColorType, createSeriesMarkers } from 'lightweight-charts'
import { api, positionPnl, notionalUsd, fmtMoney, fmtSignedMoney, fmtPrice, bidOf, askOf, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { AppDrawer } from '@/components/app-nav'
import { SymbolIcon } from '@/components/symbol-icon'
import { useLang } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { Wallet, LogOut, LayoutDashboard, X, Menu, CandlestickChart, ArrowLeftRight, ListOrdered, Home as HomeIcon, ChevronDown, Pencil, Target, ShieldAlert, Layers, History as HistoryIcon, PieChart, Hourglass, Clock } from 'lucide-react'

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d']
const INTERVAL_SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
const LEVERAGES = [1, 2, 5, 10, 20, 50, 100]

const chartColors = (light) => light
  ? { bg: '#ffffff', text: '#6b7280', grid: '#eceef0', border: '#e2e4e6', up: '#00b34a', down: '#e11d48' }
  : { bg: '#050505', text: '#555555', grid: '#0f0f0f', border: '#1a1a1a', up: '#00FF66', down: '#ff3b5c' }

const haptic = (ms = 12) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms) } catch (e) {} }

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
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
  const [showOrderStops, setShowOrderStops] = useState(false)
  const [orderSL, setOrderSL] = useState('')
  const [orderTP, setOrderTP] = useState('')
  const [tab, setTab] = useState('positions')
  const [histFilter, setHistFilter] = useState('all')
  const [marketCat, setMarketCat] = useState('all')
  const [pickedAsset, setPickedAsset] = useState(null)
  const [closingId, setClosingId] = useState(null)
  const [chartError, setChartError] = useState('')
  const [mobileTab, setMobileTab] = useState('chart')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [groupSheet, setGroupSheet] = useState(null) // {symbol, side, positions}
  const [editPos, setEditPos] = useState(null)       // position object being edited
  const [editSL, setEditSL] = useState('')
  const [editTP, setEditTP] = useState('')
  const [dragTarget, setDragTarget] = useState(null) // 'sl' | 'tp' | null
  const [quickMenu, setQuickMenu] = useState(null)    // position for long-press quick actions

  const chartContainerRef = useRef(null)
  const chartApiRef = useRef(null)
  const seriesRef = useRef(null)
  const markersRef = useRef(null)
  const priceLinesRef = useRef([])
  const editLinesRef = useRef([])
  const bidLineRef = useRef(null)
  const askLineRef = useRef(null)
  const lastBarRef = useRef(null)
  const selectedRef = useRef(selected)
  const intervalStateRef = useRef(chartInterval)
  const bufferRef = useRef({})
  const wsMapRef = useRef({})
  const draggingRef = useRef(false)

  selectedRef.current = selected
  intervalStateRef.current = chartInterval

  // ---------- theme tokens ----------
  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const RED = light ? 'text-[#e11d48]' : 'text-[#ff3b5c]'
  const greenHex = light ? '#00b34a' : '#00FF66'
  const redHex = light ? '#e11d48' : '#ff3b5c'
  const T = {
    page: light ? 'bg-[#f5f6f5] text-gray-900' : 'bg-black text-white',
    header: light ? 'bg-white border-black/5' : 'bg-black border-white/5',
    bar: light ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.02] border-white/5',
    border: light ? 'border-black/5' : 'border-white/5',
    border10: light ? 'border-black/10' : 'border-white/10',
    aside: light ? 'bg-white border-black/5' : 'border-white/5',
    icon: light ? 'text-gray-500 hover:text-gray-900' : 'text-white/70 hover:text-white',
    iconFaint: light ? 'text-gray-400 hover:text-gray-900' : 'text-white/50 hover:text-white',
    sub: light ? 'text-gray-500' : 'text-white/40',
    faint: light ? 'text-gray-400' : 'text-white/35',
    fainter: light ? 'text-gray-400' : 'text-white/30',
    faintest: light ? 'text-gray-300' : 'text-white/25',
    label: light ? 'text-gray-400' : 'text-white/30',
    panel: light ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.03] border-white/5',
    glass: light ? 'bg-white/80 border-black/10 backdrop-blur-xl' : 'bg-white/[0.05] border-white/10 backdrop-blur-xl',
    sheet: light ? 'bg-white border-black/10' : 'bg-[#0b0b0b]/95 border-white/10 backdrop-blur-2xl',
    input: light ? 'bg-black/[0.03] border-black/10 focus:border-[#00b34a]/60 placeholder:text-gray-400' : 'bg-white/5 border-white/10 focus:border-[#00FF66]/50',
    rowHover: light ? 'hover:bg-black/[0.04]' : 'hover:bg-white/5',
    tabActive: light ? 'bg-black/[0.06] text-gray-900' : 'bg-white/10 text-white',
    tabIdle: light ? 'text-gray-400 hover:text-gray-900' : 'text-white/40 hover:text-white',
    modal: light ? 'border-black/10 bg-white' : 'border-white/10 bg-[#0a0a0a]',
    card: light ? 'bg-white border-black/[0.06] shadow-sm' : 'bg-white/[0.03] border-white/[0.06]',
    chip: light ? 'bg-black/5 text-gray-400 hover:text-gray-900' : 'bg-white/5 text-white/40 hover:text-white',
  }

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
    let pollTimer, flushTimer, acctTimer, posTimer

    const flushBuffer = () => {
      const buf = bufferRef.current
      const keys = Object.keys(buf)
      if (keys.length === 0) return
      bufferRef.current = {}
      setQuotes((prev) => {
        const next = { ...prev }
        for (const [s, p] of Object.entries(buf)) next[s] = { ...(next[s] || {}), price: p }
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
              for (const tk of m.data) {
                const sym = wsMapRef.current[tk.s]
                if (sym) bufferRef.current[sym] = tk.p
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
      acctTimer = setInterval(refreshAccount, 15000)
      posTimer = setInterval(refreshPositions, 8000) // catches server-side SL/TP triggers
    }
    init()
    return () => {
      if (ws) try { ws.close() } catch (e) {}
      clearInterval(pollTimer)
      clearInterval(flushTimer)
      clearInterval(acctTimer)
      clearInterval(posTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- chart setup ----------
  useEffect(() => {
    if (!chartContainerRef.current) return
    const c = chartColors(typeof window !== 'undefined' && localStorage.getItem('rm_theme') === 'light')
    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text, fontFamily: "'Inter', sans-serif" },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: c.border },
      rightPriceScale: { borderColor: c.border },
      crosshair: { mode: 0 },
      localization: { locale: 'en-US' },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: c.up, downColor: c.down, borderVisible: false, wickUpColor: c.up, wickDownColor: c.down,
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
      editLinesRef.current = []
      bidLineRef.current = null
      askLineRef.current = null
    }
  }, [])

  // ---------- theme -> chart colors ----------
  useEffect(() => {
    const chart = chartApiRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    const c = chartColors(light)
    try {
      chart.applyOptions({
        layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        timeScale: { borderColor: c.border },
        rightPriceScale: { borderColor: c.border },
      })
      series.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down })
    } catch (e) {}
  }, [light])

  // ---------- entry / TP / SL horizontal markers (TradingView-style, no giant arrows) ----------
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    priceLinesRef.current.forEach((pl) => { try { series.removePriceLine(pl) } catch (e) {} })
    const lines = []
    const seenEntry = new Set()
    positions.filter((p) => p.symbol === selected).forEach((p) => {
      const ek = `${p.side}-${p.entryPrice}`
      if (!seenEntry.has(ek)) {
        seenEntry.add(ek)
        try {
          lines.push(series.createPriceLine({ price: p.entryPrice, color: p.side === 'buy' ? greenHex : redHex, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: p.side === 'buy' ? 'BUY' : 'SELL' }))
        } catch (e) {}
      }
      if (p.takeProfit != null) {
        try { lines.push(series.createPriceLine({ price: p.takeProfit, color: greenHex, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'TP' })) } catch (e) {}
      }
      if (p.stopLoss != null) {
        try { lines.push(series.createPriceLine({ price: p.stopLoss, color: redHex, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'SL' })) } catch (e) {}
      }
    })
    priceLinesRef.current = lines
  }, [positions, selected, greenHex, redHex])

  // ---------- editing preview lines (draggable) ----------
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    editLinesRef.current.forEach((pl) => { try { series.removePriceLine(pl) } catch (e) {} })
    const lines = []
    if (editPos && editPos.symbol === selected) {
      const sl = Number(editSL)
      const tp = Number(editTP)
      if (isFinite(tp) && tp > 0) {
        try { lines.push(series.createPriceLine({ price: tp, color: greenHex, lineWidth: 3, lineStyle: 0, axisLabelVisible: true, title: '◆ TP' })) } catch (e) {}
      }
      if (isFinite(sl) && sl > 0) {
        try { lines.push(series.createPriceLine({ price: sl, color: redHex, lineWidth: 3, lineStyle: 0, axisLabelVisible: true, title: '◆ SL' })) } catch (e) {}
      }
    }
    editLinesRef.current = lines
  }, [editPos, editSL, editTP, selected, greenHex, redHex])

  // ---------- drag SL/TP on chart ----------
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el || !editPos) return
    const meta = symbols.find((s) => s.symbol === editPos.symbol) || { decimals: 2 }
    const setFromEvent = (e) => {
      const rect = el.getBoundingClientRect()
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const y = clientY - rect.top
      let price
      try { price = seriesRef.current?.coordinateToPrice(y) } catch (er) { price = null }
      if (price == null || !isFinite(price) || price <= 0) return
      const val = Number(price).toFixed(meta.decimals)
      if (dragTarget === 'sl') setEditSL(val)
      else if (dragTarget === 'tp') setEditTP(val)
    }
    const onDown = (e) => { if (!dragTarget) return; draggingRef.current = true; setFromEvent(e); haptic(8) }
    const onMove = (e) => { if (!draggingRef.current) return; e.preventDefault(); setFromEvent(e) }
    const onUp = () => { if (draggingRef.current) { draggingRef.current = false; haptic(15) } }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [editPos, dragTarget, symbols])

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
      if (!askLineRef.current) askLineRef.current = series.createPriceLine({ price: ask, color: greenHex, lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' })
      else askLineRef.current.applyOptions({ price: ask, color: greenHex })
      if (!bidLineRef.current) bidLineRef.current = series.createPriceLine({ price: bid, color: redHex, lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' })
      else bidLineRef.current.applyOptions({ price: bid, color: redHex })
    } catch (e) {}
  }, [quotes, selected, symbols, greenHex, redHex])

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

  useEffect(() => {
    if (leverage > maxLev) setLeverage(maxLev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, maxLev])

  // dollar-per-price-unit for a position (derived from live PnL so it handles currency conversion)
  const dollarPerPrice = (p) => {
    const meta = symbols.find((s) => s.symbol === p.symbol) || { contractSize: 1 }
    const q = quotes[p.symbol]
    if (q?.price) {
      const cur = p.side === 'buy' ? bidOf(q) : askOf(q)
      const denom = cur - p.entryPrice
      const livePnl = positionPnl(p, q, quotes)
      if (Math.abs(denom) > 1e-9) return livePnl / denom
    }
    return (p.lots * (meta.contractSize || 1)) * (p.side === 'buy' ? 1 : -1)
  }
  const estAt = (p, price) => {
    if (price == null || !isFinite(price) || price <= 0) return null
    return dollarPerPrice(p) * (price - p.entryPrice)
  }

  const currentClose = (p) => {
    const q = quotes[p.symbol]
    if (!q?.price) return p.entryPrice
    return p.side === 'buy' ? bidOf(q) : askOf(q)
  }
  const posPnl = (p) => {
    const q = quotes[p.symbol]
    return q?.price ? positionPnl(p, q, quotes) : 0
  }
  const metaOf = (sym) => symbols.find((s) => s.symbol === sym) || { decimals: 2 }

  // ---------- actions ----------
  const placeOrder = async (side) => {
    if (placing) return
    if (!lotsNum || lotsNum <= 0) { toast.error('Enter a valid lot size'); return }
    setPlacing(true)
    haptic(15)
    try {
      const payload = { symbol: selected, side, lots: lotsNum, leverage }
      if (showOrderStops && orderSL) payload.stopLoss = Number(orderSL)
      if (showOrderStops && orderTP) payload.takeProfit = Number(orderTP)
      await api.post('/orders', payload)
      toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} ${lotsNum} ${selected} executed`)
      setOrderSL(''); setOrderTP('')
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
    haptic(20)
    try {
      const r = await api.post(`/positions/${id}/close`)
      const pnl = r.data.position.pnl
      toast[pnl >= 0 ? 'success' : 'error'](`Position closed. PnL: ${fmtSignedMoney(pnl)}`)
      setBalance(r.data.balance)
      refreshPositions()
      setGroupSheet((g) => (g ? { ...g, positions: g.positions.filter((p) => p.id !== id) } : g))
    } catch (e) {
      toast.error(e.response?.data?.error || 'Close failed')
    } finally {
      setClosingId(null)
    }
  }

  const openEdit = (p) => {
    haptic(12)
    setSelected(p.symbol)
    setEditPos(p)
    setEditSL(p.stopLoss != null ? String(p.stopLoss) : '')
    setEditTP(p.takeProfit != null ? String(p.takeProfit) : '')
    setDragTarget(null)
    setQuickMenu(null)
  }
  const saveEdit = async () => {
    if (!editPos) return
    try {
      const payload = { stopLoss: editSL === '' ? null : Number(editSL), takeProfit: editTP === '' ? null : Number(editTP) }
      const r = await api.post(`/positions/${editPos.id}/modify`, payload)
      toast.success('Stop Loss / Take Profit updated')
      haptic(20)
      setEditPos(null); setDragTarget(null)
      refreshPositions()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Update failed')
    }
  }

  const pickSymbol = (symbol) => { setSelected(symbol); setDrawerOpen(false) }

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
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${active ? (light ? 'bg-[#00b34a]/10 border border-[#00b34a]/25' : 'bg-[#00FF66]/10 border border-[#00FF66]/20') : `${T.rowHover} border border-transparent`}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <SymbolIcon symbol={s.symbol} type={s.type} size={26} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{s.symbol}</div>
            <div className={`text-[11px] truncate ${T.faint}`}>{s.name}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
          <div className={`text-[11px] font-mono ${up ? GREEN : RED}`}>
            {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
          </div>
        </div>
      </button>
    )
  }

  const marketWatchList = (testPrefix) => (
    <>
      {[['Crypto', cryptoSymbols], ['Forex', forexSymbols], ['Metals', metalSymbols], ['Indices', indexSymbols], ['Stocks', stockSymbols]].map(([label, list]) => (
        <div key={label}>
          <div className={`text-[10px] uppercase tracking-widest px-3 pt-3 pb-1 ${T.label}`}>{t(label)}</div>
          {list.map((s) => <WatchRow key={s.symbol} s={s} testPrefix={testPrefix} />)}
        </div>
      ))}
    </>
  )

  // ---------- grouped open positions (by symbol + side + ~0.1% price band) ----------
  const groups = useMemo(() => {
    const map = {}
    positions.forEach((p) => {
      const band = p.entryPrice ? Math.round(p.entryPrice / Math.max(p.entryPrice * 0.001, 1e-9)) : 0
      const key = `${p.symbol}|${p.side}|${band}`
      if (!map[key]) map[key] = { key, symbol: p.symbol, side: p.side, positions: [] }
      map[key].positions.push(p)
    })
    return Object.values(map).sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [positions])

  // keep open group sheet fresh with latest position data
  useEffect(() => {
    if (!groupSheet) return
    const g = groups.find((x) => x.key === groupSheet.key)
    if (!g) setGroupSheet(null)
    else if (g.positions.length !== groupSheet.positions.length) setGroupSheet(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  // ---------- reusable order panel ----------
  const orderPanel = (
    <div className="flex flex-col gap-4">
      <div>
        <div className={`text-[10px] uppercase tracking-widest mb-2 ${T.label}`}>New order — {selected}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[#ff3b5c]/5 border border-[#ff3b5c]/15 p-2.5 text-center">
            <div className={`text-[10px] ${T.faint}`}>SELL (Bid)</div>
            <div className={`font-mono text-sm ${RED}`} data-testid="sell-price">{midPrice ? fmtPrice(bidOf(selQuote), selMeta.decimals) : '—'}</div>
          </div>
          <div className="rounded-2xl bg-[#00FF66]/5 border border-[#00FF66]/15 p-2.5 text-center">
            <div className={`text-[10px] ${T.faint}`}>BUY (Ask)</div>
            <div className={`font-mono text-sm ${GREEN}`} data-testid="buy-price">{midPrice ? fmtPrice(askOf(selQuote), selMeta.decimals) : '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Lot size (units)</label>
        <input data-testid="lots-input" type="number" min="0.0001" step="0.01" value={lots} onChange={(e) => setLots(e.target.value)}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm font-mono focus:outline-none ${T.input}`} />
        <div className="flex gap-1.5 mt-2">
          {['0.01', '0.1', '0.5', '1'].map((v) => (
            <button key={v} onClick={() => setLots(v)} className={`flex-1 text-[11px] py-1 rounded-lg border transition ${lots === v ? (light ? 'border-[#00b34a]/50 text-[#00b34a]' : 'border-[#00FF66]/50 text-[#00FF66]') : `${T.border10} ${T.tabIdle}`}`}>{v}</button>
          ))}
        </div>
      </div>

      <div>
        <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Leverage <span className={T.faintest}>(max 1:{maxLev})</span></label>
        <div className="grid grid-cols-4 gap-1.5">
          {availableLeverages.map((l) => (
            <button key={l} data-testid={`leverage-${l}`} onClick={() => setLeverage(l)} className={`text-[11px] py-1.5 rounded-lg border font-mono transition ${leverage === l ? (light ? 'border-[#00b34a]/60 bg-[#00b34a]/10 text-[#00b34a]' : 'border-[#00FF66]/60 bg-[#00FF66]/10 text-[#00FF66]') : `${T.border10} ${T.tabIdle}`}`}>
              {l}x
            </button>
          ))}
        </div>
      </div>

      {/* optional SL/TP on new order */}
      <div>
        <button data-testid="toggle-order-stops" onClick={() => setShowOrderStops((v) => !v)} className={`w-full flex items-center justify-between text-[11px] rounded-xl border px-3 py-2 transition ${T.border10} ${T.tabIdle}`}>
          <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> {t('Add Stop Loss / Take Profit')}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showOrderStops ? 'rotate-180' : ''}`} />
        </button>
        {showOrderStops && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className={`text-[10px] block mb-1 ${RED}`}>Stop Loss</label>
              <input data-testid="order-sl-input" type="number" step="any" placeholder="price" value={orderSL} onChange={(e) => setOrderSL(e.target.value)} className={`w-full rounded-xl border px-2.5 py-2 text-sm font-mono focus:outline-none ${T.input}`} />
            </div>
            <div>
              <label className={`text-[10px] block mb-1 ${GREEN}`}>Take Profit</label>
              <input data-testid="order-tp-input" type="number" step="any" placeholder="price" value={orderTP} onChange={(e) => setOrderTP(e.target.value)} className={`w-full rounded-xl border px-2.5 py-2 text-sm font-mono focus:outline-none ${T.input}`} />
            </div>
          </div>
        )}
      </div>

      <div className={`rounded-2xl border p-3 space-y-1.5 text-[11px] ${T.panel}`}>
        {(selMeta.contractSize || 1) > 1 && (
          <div className="flex justify-between"><span className={T.faint}>Units ({selMeta.contractSize.toLocaleString()}/lot)</span><span className="font-mono" data-testid="order-units">{contractUnits.toLocaleString()}</span></div>
        )}
        <div className="flex justify-between"><span className={T.faint}>Notional value</span><span className="font-mono" data-testid="order-notional">{fmtMoney(orderNotional)}</span></div>
        <div className="flex justify-between"><span className={T.faint}>Required margin</span><span className="font-mono" data-testid="order-margin">{fmtMoney(requiredMargin)}</span></div>
        <div className="flex justify-between"><span className={T.faint}>Free margin</span><span className="font-mono">{fmtMoney(freeMargin)}</span></div>
        <div className="flex justify-between"><span className={T.faint}>Spread</span><span className="font-mono">{selQuote?.spreadPips != null ? `${selQuote.spreadPips.toFixed(1)} pips` : '—'}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button data-testid="sell-btn" disabled={placing || !midPrice} onClick={() => placeOrder('sell')} className="bg-[#ff3b5c] hover:bg-[#e63552] text-white font-bold py-3.5 rounded-2xl transition disabled:opacity-40 text-sm active:scale-[0.98]">SELL</button>
        <button data-testid="buy-btn" disabled={placing || !midPrice} onClick={() => placeOrder('buy')} className="bg-[#00FF66] hover:bg-[#00e65c] text-black font-bold py-3.5 rounded-2xl transition disabled:opacity-40 text-sm active:scale-[0.98]">BUY</button>
      </div>

      {balance <= 0 && (
        <div className={`rounded-2xl border p-3 text-[11px] ${light ? 'border-[#00b34a]/20 bg-[#00b34a]/5 text-gray-600' : 'border-[#00FF66]/20 bg-[#00FF66]/5 text-white/60'}`}>
          Your balance is $0. <button onClick={() => router.push('/dashboard')} className={`font-semibold hover:underline ${GREEN}`}>Make a deposit</button> to start trading.
        </div>
      )}
    </div>
  )

  // ---------- history helpers ----------
  const HIST_FILTERS = [
    { k: 'today', l: t('Today') }, { k: 'yesterday', l: t('Yesterday') }, { k: 'week', l: t('This week') }, { k: 'month', l: t('This month') }, { k: 'all', l: t('All') },
  ]
  const filterHistory = (list, f) => {
    if (f === 'all') return list
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return list.filter((p) => {
      if (!p.closedAt) return false
      const c = new Date(p.closedAt)
      if (f === 'today') return c >= today
      if (f === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); return c >= y && c < today }
      if (f === 'week') { const w = new Date(today); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return c >= w }
      if (f === 'month') return c >= new Date(now.getFullYear(), now.getMonth(), 1)
      return true
    })
  }
  const histList = filterHistory(closedPositions, histFilter)
  const histTotal = histList.reduce((s, p) => s + (p.pnl || 0), 0)
  const histWins = histList.filter((p) => (p.pnl || 0) > 0).length

  // closed PnL analytics (all closed)
  const realizedTotal = closedPositions.reduce((s, p) => s + (p.pnl || 0), 0)
  const wins = closedPositions.filter((p) => (p.pnl || 0) > 0)
  const losses = closedPositions.filter((p) => (p.pnl || 0) < 0)
  const winRate = closedPositions.length ? (wins.length / closedPositions.length) * 100 : 0
  const best = closedPositions.reduce((m, p) => Math.max(m, p.pnl || 0), 0)
  const worst = closedPositions.reduce((m, p) => Math.min(m, p.pnl || 0), 0)

  const sideBadge = (side, count) => (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide ${side === 'buy' ? 'bg-[#00FF66]/15 text-[#00b34a]' : 'bg-[#ff3b5c]/15 text-[#e11d48]'}`}>
      {side}{count > 1 ? ` ×${count}` : ''}
    </span>
  )

  // ---------- positions panel (4 tabs) ----------
  const POS_TABS = [
    { k: 'positions', l: t('Positions'), icon: Layers, n: positions.length },
    { k: 'pending', l: t('Pending'), icon: Hourglass, n: 0 },
    { k: 'history', l: t('History'), icon: HistoryIcon, n: closedPositions.length },
    { k: 'closed', l: t('Closed PnL'), icon: PieChart },
  ]

  const positionsPanel = (
    <div className="flex flex-col h-full min-h-0">
      {/* total floating pnl header */}
      <div className={`shrink-0 px-4 pt-3 pb-2 flex items-center justify-between`}>
        <div>
          <div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{t('Floating PnL')}</div>
          <div data-testid="panel-floating-pnl" className={`text-2xl font-mono font-bold leading-tight ${floatingPnl >= 0 ? GREEN : RED}`}>{fmtSignedMoney(floatingPnl)}</div>
        </div>
        <div className="text-right">
          <div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{t('Equity')}</div>
          <div className="text-sm font-mono font-semibold">{fmtMoney(equity)}</div>
        </div>
      </div>

      {/* tabs */}
      <div className="shrink-0 px-3 flex gap-1 overflow-x-auto">
        {POS_TABS.map((tb) => (
          <button key={tb.k} data-testid={`tab-${tb.k}`} onClick={() => { setTab(tb.k); haptic(6) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium whitespace-nowrap transition ${tab === tb.k ? T.tabActive : T.tabIdle}`}>
            <tb.icon className="h-3.5 w-3.5" /> {tb.l}{tb.n != null && tb.n > 0 ? ` (${tb.n})` : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* POSITIONS (grouped) */}
        {tab === 'positions' && groups.map((g) => {
          const totalLots = g.positions.reduce((s, p) => s + p.lots, 0)
          const totalPnl = g.positions.reduce((s, p) => s + posPnl(p), 0)
          const meta = metaOf(g.symbol)
          const avgEntry = g.positions.reduce((s, p) => s + p.entryPrice * p.lots, 0) / (totalLots || 1)
          return (
            <button key={g.key} data-testid={`group-${g.symbol}-${g.side}`} onClick={() => { haptic(8); setGroupSheet(g) }}
              className={`w-full text-left rounded-[20px] border p-4 transition active:scale-[0.99] ${T.card} ${T.rowHover}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <SymbolIcon symbol={g.symbol} type={meta.type} size={34} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{g.symbol}</span>
                      {sideBadge(g.side, g.positions.length)}
                    </div>
                    <div className={`text-[11px] font-mono mt-0.5 ${T.fainter}`}>{totalLots.toFixed(2)} {t('lots')} @ {fmtPrice(avgEntry, meta.decimals)}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono text-base font-bold ${totalPnl >= 0 ? GREEN : RED}`}>{fmtSignedMoney(totalPnl)}</div>
                  <div className={`text-[10px] ${T.faintest}`}>{t('tap for details')}</div>
                </div>
              </div>
            </button>
          )
        })}
        {tab === 'positions' && groups.length === 0 && (
          <div className={`py-12 text-center text-xs ${T.faintest}`}>{t('No open positions. Place your first trade →')}</div>
        )}

        {/* PENDING ORDERS (Phase 3) */}
        {tab === 'pending' && (
          <div className={`py-12 text-center ${T.faintest}`} data-testid="pending-empty">
            <Hourglass className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <div className="text-xs">{t('No pending orders yet.')}</div>
            <div className="text-[11px] mt-1">{t('Limit, Stop, Stop-Limit and Trailing orders are coming soon.')}</div>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1" data-testid="history-filters">
              {HIST_FILTERS.map((f) => (
                <button key={f.k} data-testid={`hist-filter-${f.k}`} onClick={() => setHistFilter(f.k)} className={`px-3 py-1 text-[11px] rounded-full font-medium whitespace-nowrap transition ${histFilter === f.k ? 'bg-[#00FF66] text-black' : T.chip}`}>{f.l}</button>
              ))}
            </div>
            <div data-testid="history-summary" className={`flex items-center justify-between rounded-2xl border px-3.5 py-2 text-[11px] ${T.panel}`}>
              <span className={T.faint}>{t('Trades')}: <span className={`font-mono ${light ? 'text-gray-900' : 'text-white'}`}>{histList.length}</span>{histList.length > 0 && <span className={`ml-2 ${T.faintest}`}>({histWins}W / {histList.length - histWins}L)</span>}</span>
              <span className={T.faint}>{t('Total PnL')}: <span data-testid="history-total-pnl" className={`font-mono font-semibold ${histTotal >= 0 ? GREEN : RED}`}>{fmtSignedMoney(histTotal)}</span></span>
            </div>
            {histList.map((p) => {
              const meta = metaOf(p.symbol)
              return (
                <div key={p.id} data-testid={`history-row-${p.id}`} className={`flex items-center justify-between rounded-[20px] border px-4 py-3 ${T.card}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <SymbolIcon symbol={p.symbol} type={meta.type} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{p.symbol}</span>
                        {sideBadge(p.side, 1)}
                        {p.closeReason && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${p.closeReason === 'tp' ? 'bg-[#00FF66]/15 text-[#00b34a]' : 'bg-[#ff3b5c]/15 text-[#e11d48]'}`}>{p.closeReason}</span>}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${T.fainter}`}>{p.closedAt ? new Date(p.closedAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-semibold shrink-0 ${(p.pnl || 0) >= 0 ? GREEN : RED}`}>{fmtSignedMoney(p.pnl)}</span>
                </div>
              )
            })}
            {histList.length === 0 && <div className={`py-10 text-center text-xs ${T.faintest}`}>{t('No trades in this period.')}</div>}
          </>
        )}

        {/* CLOSED PnL analytics */}
        {tab === 'closed' && (
          <div className="space-y-3" data-testid="closed-pnl">
            <div className={`rounded-[20px] border p-5 ${T.card}`}>
              <div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{t('Total realized PnL')}</div>
              <div className={`text-3xl font-mono font-bold mt-1 ${realizedTotal >= 0 ? GREEN : RED}`}>{fmtSignedMoney(realizedTotal)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: t('Win rate'), v: `${winRate.toFixed(0)}%` },
                { l: t('Total trades'), v: closedPositions.length },
                { l: t('Best trade'), v: fmtSignedMoney(best), c: GREEN },
                { l: t('Worst trade'), v: fmtSignedMoney(worst), c: RED },
                { l: t('Winners'), v: wins.length, c: GREEN },
                { l: t('Losers'), v: losses.length, c: RED },
              ].map((s) => (
                <div key={s.l} className={`rounded-2xl border p-4 ${T.card}`}>
                  <div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{s.l}</div>
                  <div className={`text-lg font-mono font-semibold mt-1 ${s.c || ''}`}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${T.page}`}>
      <Toaster position="top-right" theme={light ? 'light' : 'dark'} richColors />

      {/* MENU BAR */}
      <header className={`h-14 shrink-0 border-b flex items-center justify-between px-4 z-30 ${T.header}`}>
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className={`p-1.5 -ml-1.5 transition ${T.icon}`}><Menu className="h-5 w-5" /></button>
          <button onClick={() => router.push('/home')} className="flex items-center gap-2">
            <span className="font-bold text-sm">RAW<span className={GREEN}>MARKETS</span></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button data-testid="deposit-nav-btn" onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition"><Wallet className="h-3.5 w-3.5" /> Deposit</button>
          <button data-testid="dashboard-nav-btn" onClick={() => router.push('/dashboard')} className={`hidden md:block p-2 transition ${T.iconFaint}`} title="Dashboard"><LayoutDashboard className="h-4 w-4" /></button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className={`p-2 transition ${T.iconFaint}`} title="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {/* ACCOUNT HEADER */}
      <div data-testid="account-header" className={`h-11 shrink-0 border-b flex items-center gap-6 px-4 overflow-x-auto whitespace-nowrap text-xs ${T.bar}`}>
        <div className="shrink-0"><span className={T.faint}>Balance </span><span data-testid="acct-balance" className="font-mono font-semibold">{fmtMoney(balance)}</span></div>
        <div className="shrink-0"><span className={T.faint}>Equity </span><span data-testid="acct-equity" className="font-mono font-semibold">{fmtMoney(equity)}</span></div>
        <div className="shrink-0"><span className={T.faint}>Floating PnL </span><span data-testid="acct-floating-pnl" className={`font-mono font-semibold ${floatingPnl >= 0 ? GREEN : RED}`}>{fmtSignedMoney(floatingPnl)}</span></div>
        <div className="shrink-0"><span className={T.faint}>Margin </span><span data-testid="acct-margin" className="font-mono">{fmtMoney(usedMargin)}</span></div>
        <div className="shrink-0"><span className={T.faint}>Free margin </span><span data-testid="acct-free-margin" className="font-mono">{fmtMoney(freeMargin)}</span></div>
        {marginLevel != null && <div className="shrink-0"><span className={T.faint}>Margin level </span><span className="font-mono">{marginLevel.toFixed(0)}%</span></div>}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* WATCHLIST (desktop) */}
        <aside className={`w-60 shrink-0 border-r overflow-y-auto p-2 hidden md:block ${T.aside}`}>{marketWatchList('watchlist')}</aside>

        {/* CENTER */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* symbol header */}
          <div className={`h-14 shrink-0 border-b flex items-center justify-between gap-2 px-4 overflow-x-auto ${T.border}`}>
            <div className="flex items-center gap-3 shrink-0">
              <select data-testid="mobile-symbol-select" value={selected} onChange={(e) => setSelected(e.target.value)} className={`md:hidden border rounded-xl text-sm font-bold px-2 py-1.5 focus:outline-none ${T.input}`}>
                {(symbols.length ? symbols : [{ symbol: selected }]).map((s) => (<option key={s.symbol} value={s.symbol} className={light ? 'bg-white' : 'bg-black'}>{s.symbol}</option>))}
              </select>
              <div className="hidden md:block"><div className="font-bold" data-testid="selected-symbol">{selected}</div><div className={`text-[11px] ${T.faint}`}>{selMeta.name}</div></div>
              <div data-testid="selected-price" className={`text-lg sm:text-2xl font-mono font-bold ${(selQuote?.changePercent || 0) >= 0 ? GREEN : RED}`}>{selQuote?.price ? fmtPrice(selQuote.price, selMeta.decimals) : '—'}</div>
              {selQuote?.changePercent != null && (<div className={`text-xs font-mono ${selQuote.changePercent >= 0 ? GREEN : RED}`}>{selQuote.changePercent >= 0 ? '+' : ''}{selQuote.changePercent.toFixed(2)}%</div>)}
              <div className={`hidden lg:flex gap-4 text-[11px] font-mono ${T.faint}`}><span>H {selQuote?.high ? fmtPrice(selQuote.high, selMeta.decimals) : '—'}</span><span>L {selQuote?.low ? fmtPrice(selQuote.low, selMeta.decimals) : '—'}</span></div>
            </div>
            <div className="flex gap-1 shrink-0">
              {INTERVALS.map((iv) => (<button key={iv} data-testid={`interval-${iv}`} onClick={() => setChartInterval(iv)} className={`px-2 sm:px-2.5 py-1 text-xs rounded-lg font-medium transition ${chartInterval === iv ? 'bg-[#00FF66] text-black' : `${T.tabIdle} ${T.rowHover}`}`}>{iv}</button>))}
            </div>
          </div>

          {/* chart */}
          <div className={`flex-1 relative min-h-0 ${mobileTab !== 'chart' ? 'hidden md:block' : ''}`}>
            <div ref={chartContainerRef} className="absolute inset-0" data-testid="chart-container" style={{ touchAction: dragTarget ? 'none' : 'auto' }} />
            {dragTarget && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-black/70 text-white backdrop-blur border border-white/10">
                {t('Drag on chart to set')} {dragTarget === 'sl' ? 'Stop Loss' : 'Take Profit'}
              </div>
            )}
            {chartError && (<div className={`absolute inset-0 flex items-center justify-center text-sm ${light ? 'text-gray-400 bg-white/60' : 'text-white/30 bg-black/60'}`}>{chartError}</div>)}
          </div>

          {/* mobile TRADE view */}
          <div data-testid="mobile-trade-view" className={`md:hidden flex-1 min-h-0 overflow-y-auto p-4 ${mobileTab === 'trade' ? 'block' : 'hidden'}`}>
            {orderPanel}
            <div className={`mt-6 h-80 rounded-[20px] border ${T.border}`}>{positionsPanel}</div>
          </div>

          {/* mobile POSITIONS view */}
          <div data-testid="mobile-positions-view" className={`md:hidden flex-1 min-h-0 overflow-hidden ${mobileTab === 'positions' ? 'flex flex-col' : 'hidden'}`}>{positionsPanel}</div>

          {/* mobile MARKETS view */}
          <div data-testid="mobile-markets-view" className={`md:hidden flex-1 min-h-0 flex-col ${mobileTab === 'markets' ? 'flex' : 'hidden'}`}>
            <div className="p-3 shrink-0">
              <select data-testid="markets-category-select" value={marketCat} onChange={(e) => setMarketCat(e.target.value)} className={`w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none ${T.input}`}>
                <option value="all" className={light ? 'bg-white' : 'bg-black'}>{t('Category')}: {t('All')}</option>
                <option value="crypto" className={light ? 'bg-white' : 'bg-black'}>{t('Crypto')}</option>
                <option value="forex" className={light ? 'bg-white' : 'bg-black'}>{t('Forex')}</option>
                <option value="metal" className={light ? 'bg-white' : 'bg-black'}>{t('Metals')}</option>
                <option value="index" className={light ? 'bg-white' : 'bg-black'}>{t('Indices')}</option>
                <option value="stock" className={light ? 'bg-white' : 'bg-black'}>{t('Stocks')}</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {symbols.filter((s) => marketCat === 'all' || s.type === marketCat).map((s) => {
                const q = quotes[s.symbol]; const up = (q?.changePercent || 0) >= 0
                return (
                  <button key={s.symbol} data-testid={`mobile-markets-${s.symbol}`} onClick={() => setPickedAsset(s)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${T.rowHover}`}>
                    <div className="flex items-center gap-2.5 min-w-0"><SymbolIcon symbol={s.symbol} type={s.type} size={28} /><div className="min-w-0"><div className="text-sm font-semibold">{s.symbol}</div><div className={`text-[11px] truncate ${T.faint}`}>{s.name}</div></div></div>
                    <div className="text-right shrink-0"><div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div><div className={`text-[11px] font-mono ${up ? GREEN : RED}`}>{q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}</div></div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* positions (desktop / mobile chart tab) */}
          <div className={`h-64 shrink-0 border-t ${T.border} ${mobileTab === 'chart' ? 'flex' : 'hidden md:flex'} flex-col`}>{positionsPanel}</div>
        </main>

        {/* ORDER PANEL (desktop) */}
        <aside className={`w-72 shrink-0 border-l p-4 overflow-y-auto hidden md:block ${T.border}`}>{orderPanel}</aside>
      </div>

      {/* ASSET ACTION MODAL (markets tab) */}
      {pickedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPickedAsset(null)} />
          <div data-testid="terminal-asset-modal" className={`relative w-full max-w-sm rounded-[20px] border p-6 shadow-2xl ${T.modal}`}>
            <button data-testid="terminal-asset-modal-close" onClick={() => setPickedAsset(null)} className={`absolute top-4 right-4 ${T.iconFaint}`}><X className="h-5 w-5" /></button>
            <div className="flex items-center gap-3"><SymbolIcon symbol={pickedAsset.symbol} type={pickedAsset.type} size={40} /><div><div className="font-bold">{pickedAsset.symbol}</div><div className={`text-xs ${T.sub}`}>{pickedAsset.name}</div></div><div className="ml-auto text-right"><div className="font-mono text-sm">{quotes[pickedAsset.symbol]?.price ? fmtPrice(quotes[pickedAsset.symbol].price, pickedAsset.decimals) : '—'}</div></div></div>
            <p className={`text-xs mt-4 ${T.faint}`}>{t('What would you like to do?')}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button data-testid="terminal-asset-chart-btn" onClick={() => { setSelected(pickedAsset.symbol); setMobileTab('chart'); setPickedAsset(null) }} className={`flex flex-col items-center gap-2 rounded-2xl border py-4 transition ${light ? 'border-black/10 hover:border-[#00b34a]/40 hover:bg-black/[0.03]' : 'border-white/10 hover:border-[#00FF66]/40 hover:bg-white/[0.03]'}`}><CandlestickChart className={`h-5 w-5 ${GREEN}`} /><span className="text-xs font-semibold">{t('Open chart')}</span></button>
              <button data-testid="terminal-asset-trade-btn" onClick={() => { setSelected(pickedAsset.symbol); setMobileTab('trade'); setPickedAsset(null) }} className="flex flex-col items-center gap-2 rounded-2xl bg-[#00FF66] text-black py-4 hover:bg-[#00e65c] transition"><ArrowLeftRight className="h-5 w-5" /><span className="text-xs font-bold">{t('Trade')}</span></button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP DETAILS BOTTOM SHEET */}
      {groupSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGroupSheet(null)} />
          <div data-testid="group-sheet" className={`relative w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] border p-4 pb-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-[slideUp_.25s_ease] ${T.sheet}`}>
            <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20 mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5"><SymbolIcon symbol={groupSheet.symbol} type={metaOf(groupSheet.symbol).type} size={30} /><span className="font-bold">{groupSheet.symbol}</span>{sideBadge(groupSheet.side, groupSheet.positions.length)}</div>
              <button data-testid="group-sheet-close" onClick={() => setGroupSheet(null)} className={T.iconFaint}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2.5">
              {groupSheet.positions.map((p) => {
                const meta = metaOf(p.symbol); const pnl = posPnl(p); const cur = currentClose(p)
                return (
                  <SwipeRow key={p.id} onClose={() => closePosition(p.id)} onEdit={() => openEdit(p)} onLong={() => { haptic(20); setQuickMenu(p) }} light={light}>
                    <div data-testid={`position-detail-${p.id}`} className={`rounded-[20px] border p-4 ${T.card}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">{sideBadge(p.side, 1)}<span className="text-[11px] font-mono">{p.lots} {t('lots')}</span><span className={`text-[10px] ${T.faintest}`}>· {p.leverage}x</span></div>
                        <div className={`font-mono text-lg font-bold ${pnl >= 0 ? GREEN : RED}`}>{fmtSignedMoney(pnl)}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-y-2 gap-x-3 text-[11px]">
                        <div><div className={T.label}>{t('Entry')}</div><div className="font-mono">{fmtPrice(p.entryPrice, meta.decimals)}</div></div>
                        <div><div className={T.label}>{t('Current')}</div><div className="font-mono">{fmtPrice(cur, meta.decimals)}</div></div>
                        <div><div className={T.label}>{t('Margin')}</div><div className="font-mono">{fmtMoney(p.margin)}</div></div>
                        <div><div className={T.label}>SL</div><div className={`font-mono ${RED}`}>{p.stopLoss != null ? fmtPrice(p.stopLoss, meta.decimals) : '—'}</div></div>
                        <div><div className={T.label}>TP</div><div className={`font-mono ${GREEN}`}>{p.takeProfit != null ? fmtPrice(p.takeProfit, meta.decimals) : '—'}</div></div>
                        <div><div className={T.label}>{t('Swap/Fees')}</div><div className="font-mono">$0.00</div></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button data-testid={`detail-edit-${p.id}`} onClick={() => openEdit(p)} className={`flex items-center justify-center gap-1.5 text-xs font-semibold border py-2.5 rounded-xl transition ${light ? 'border-black/10 hover:bg-black/5' : 'border-white/10 hover:bg-white/5'}`}><Pencil className="h-3.5 w-3.5" /> {t('Edit SL/TP')}</button>
                        <button data-testid={`detail-close-${p.id}`} disabled={closingId === p.id} onClick={() => closePosition(p.id)} className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#ff3b5c]/15 text-[#e11d48] py-2.5 rounded-xl hover:bg-[#ff3b5c]/25 transition disabled:opacity-40"><X className="h-3.5 w-3.5" /> {t('Close')}</button>
                      </div>
                    </div>
                  </SwipeRow>
                )
              })}
              {groupSheet.positions.length === 0 && <div className={`py-8 text-center text-xs ${T.faintest}`}>{t('All positions in this group are closed.')}</div>}
            </div>
            <p className={`text-[10px] text-center mt-4 ${T.faintest}`}>{t('Swipe left to close · swipe right to edit · long-press for actions')}</p>
          </div>
        </div>
      )}

      {/* EDIT POSITION BOTTOM SHEET */}
      {editPos && (() => {
        const meta = metaOf(editPos.symbol)
        const slN = editSL === '' ? null : Number(editSL)
        const tpN = editTP === '' ? null : Number(editTP)
        const estProfit = estAt(editPos, tpN)
        const estLoss = estAt(editPos, slN)
        const rr = (estProfit != null && estLoss != null && Math.abs(estLoss) > 1e-9) ? Math.abs(estProfit / estLoss) : null
        const step = (meta.pipSize || (editPos.entryPrice * 0.0001)) * 10
        const nudge = (which, dir) => {
          const cur = which === 'sl' ? (slN ?? editPos.entryPrice) : (tpN ?? editPos.entryPrice)
          const v = (cur + dir * step).toFixed(meta.decimals)
          which === 'sl' ? setEditSL(v) : setEditTP(v)
        }
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setEditPos(null); setDragTarget(null) }} />
            <div data-testid="edit-sheet" className={`relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border p-5 pb-6 shadow-2xl max-h-[88vh] overflow-y-auto animate-[slideUp_.25s_ease] ${T.sheet}`}>
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20 mb-4 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5"><SymbolIcon symbol={editPos.symbol} type={meta.type} size={30} /><div><div className="font-bold text-sm flex items-center gap-2">{editPos.symbol} {sideBadge(editPos.side, 1)}</div><div className={`text-[11px] font-mono ${T.fainter}`}>{t('Entry')} {fmtPrice(editPos.entryPrice, meta.decimals)} · {editPos.lots} {t('lots')}</div></div></div>
                <button data-testid="edit-sheet-close" onClick={() => { setEditPos(null); setDragTarget(null) }} className={T.iconFaint}><X className="h-5 w-5" /></button>
              </div>

              {/* SL */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-semibold flex items-center gap-1.5 ${RED}`}><ShieldAlert className="h-3.5 w-3.5" /> {t('Stop Loss')}</label>
                  <button data-testid="drag-sl-btn" onClick={() => { setDragTarget(dragTarget === 'sl' ? null : 'sl'); setMobileTab('chart'); haptic(10) }} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${dragTarget === 'sl' ? 'bg-[#ff3b5c] text-white border-transparent' : `${T.border10} ${T.tabIdle}`}`}>{dragTarget === 'sl' ? t('Tap chart to set') : t('Drag on chart')}</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => nudge('sl', -1)} className={`h-10 w-10 rounded-xl border shrink-0 ${T.border10}`}>−</button>
                  <input data-testid="edit-sl-input" type="number" step="any" placeholder={t('No stop loss')} value={editSL} onChange={(e) => setEditSL(e.target.value)} className={`flex-1 rounded-xl border px-3 py-2.5 text-base font-mono focus:outline-none ${T.input}`} />
                  <button onClick={() => nudge('sl', 1)} className={`h-10 w-10 rounded-xl border shrink-0 ${T.border10}`}>+</button>
                </div>
                {estLoss != null && <div className={`text-[11px] mt-1 ${T.faint}`}>{t('Estimated loss')}: <span className={`font-mono font-semibold ${RED}`}>{fmtSignedMoney(estLoss)}</span></div>}
              </div>

              {/* TP */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-semibold flex items-center gap-1.5 ${GREEN}`}><Target className="h-3.5 w-3.5" /> {t('Take Profit')}</label>
                  <button data-testid="drag-tp-btn" onClick={() => { setDragTarget(dragTarget === 'tp' ? null : 'tp'); setMobileTab('chart'); haptic(10) }} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${dragTarget === 'tp' ? 'bg-[#00FF66] text-black border-transparent' : `${T.border10} ${T.tabIdle}`}`}>{dragTarget === 'tp' ? t('Tap chart to set') : t('Drag on chart')}</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => nudge('tp', -1)} className={`h-10 w-10 rounded-xl border shrink-0 ${T.border10}`}>−</button>
                  <input data-testid="edit-tp-input" type="number" step="any" placeholder={t('No take profit')} value={editTP} onChange={(e) => setEditTP(e.target.value)} className={`flex-1 rounded-xl border px-3 py-2.5 text-base font-mono focus:outline-none ${T.input}`} />
                  <button onClick={() => nudge('tp', 1)} className={`h-10 w-10 rounded-xl border shrink-0 ${T.border10}`}>+</button>
                </div>
                {estProfit != null && <div className={`text-[11px] mt-1 ${T.faint}`}>{t('Estimated profit')}: <span className={`font-mono font-semibold ${GREEN}`}>{fmtSignedMoney(estProfit)}</span></div>}
              </div>

              {/* R/R */}
              <div className={`rounded-2xl border p-3 flex items-center justify-around text-center ${T.panel}`}>
                <div><div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{t('Risk')}</div><div className={`font-mono text-sm ${RED}`}>{estLoss != null ? fmtMoney(Math.abs(estLoss)) : '—'}</div></div>
                <div><div className={`text-[10px] uppercase tracking-widest ${T.label}`}>{t('Reward')}</div><div className={`font-mono text-sm ${GREEN}`}>{estProfit != null ? fmtMoney(Math.abs(estProfit)) : '—'}</div></div>
                <div><div className={`text-[10px] uppercase tracking-widest ${T.label}`}>R:R</div><div data-testid="edit-rr" className="font-mono text-sm font-bold">{rr != null ? `1:${rr.toFixed(2)}` : '—'}</div></div>
              </div>

              <button data-testid="edit-update-btn" onClick={saveEdit} className="w-full mt-4 bg-[#00FF66] text-black font-bold py-3.5 rounded-2xl hover:bg-[#00e65c] transition active:scale-[0.98]">{t('Update')}</button>
            </div>
          </div>
        )
      })()}

      {/* QUICK ACTIONS (long-press) */}
      {quickMenu && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setQuickMenu(null)} />
          <div data-testid="quick-menu" className={`relative w-full max-w-xs rounded-[24px] border p-4 shadow-2xl ${T.sheet}`}>
            <div className="flex items-center gap-2 mb-3 px-1"><SymbolIcon symbol={quickMenu.symbol} type={metaOf(quickMenu.symbol).type} size={26} /><span className="font-bold text-sm">{quickMenu.symbol}</span>{sideBadge(quickMenu.side, 1)}</div>
            <button onClick={() => openEdit(quickMenu)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm ${T.rowHover}`}><Pencil className={`h-4 w-4 ${GREEN}`} /> {t('Edit SL/TP')}</button>
            <button onClick={() => { const id = quickMenu.id; setQuickMenu(null); closePosition(id) }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm ${T.rowHover}`}><X className="h-4 w-4 text-[#e11d48]" /> {t('Close position')}</button>
            <button onClick={() => setQuickMenu(null)} className={`w-full text-center px-3 py-2.5 rounded-xl text-xs mt-1 ${T.tabIdle}`}>{t('Cancel')}</button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav data-testid="mobile-bottom-nav" className={`md:hidden h-16 shrink-0 border-t flex items-stretch z-30 ${light ? 'border-black/10 bg-white' : 'border-white/10 bg-black'}`}>
        <button data-testid="bottomnav-home" onClick={() => router.push('/home')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${T.tabIdle}`}><HomeIcon className="h-5 w-5" /><span className="text-[10px] font-medium">{t('Home')}</span></button>
        <button data-testid="bottomnav-chart" onClick={() => setMobileTab('chart')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'chart' ? GREEN : T.tabIdle}`}><CandlestickChart className="h-5 w-5" /><span className="text-[10px] font-medium">{t('Chart')}</span></button>
        <button data-testid="bottomnav-trade" onClick={() => setMobileTab('trade')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'trade' ? GREEN : T.tabIdle}`}><ArrowLeftRight className="h-5 w-5" /><span className="text-[10px] font-medium">{t('Trade')}</span></button>
        <button data-testid="bottomnav-positions" onClick={() => setMobileTab('positions')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'positions' ? GREEN : T.tabIdle}`}><ListOrdered className="h-5 w-5" /><span className="text-[10px] font-medium">{t('Positions')}</span></button>
      </nav>

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

// ---------- swipe + long-press wrapper ----------
function SwipeRow({ children, onClose, onEdit, onLong, light }) {
  const [dx, setDx] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const active = useRef(false)
  const longTimer = useRef(null)
  const moved = useRef(false)

  const begin = (x, y) => {
    startX.current = x; startY.current = y; active.current = true; moved.current = false
    longTimer.current = setTimeout(() => { if (!moved.current) { active.current = false; setDx(0); onLong && onLong() } }, 550)
  }
  const move = (x, y) => {
    if (!active.current) return
    const d = x - startX.current
    if (Math.abs(d) > 6 || Math.abs(y - startY.current) > 6) { moved.current = true; clearTimeout(longTimer.current) }
    setDx(Math.max(-120, Math.min(120, d)))
  }
  const end = () => {
    clearTimeout(longTimer.current)
    if (!active.current) return
    active.current = false
    if (dx <= -70) { onClose && onClose() }
    else if (dx >= 70) { onEdit && onEdit() }
    setDx(0)
  }
  return (
    <div className="relative overflow-hidden rounded-[20px]" data-testid="swipe-row">
      <div className="absolute inset-0 flex items-center justify-between px-5 rounded-[20px]">
        <span className="text-[11px] font-bold text-[#00b34a] flex items-center gap-1" style={{ opacity: dx > 20 ? 1 : 0 }}>EDIT →</span>
        <span className="text-[11px] font-bold text-[#e11d48] flex items-center gap-1 ml-auto" style={{ opacity: dx < -20 ? 1 : 0 }}>← CLOSE</span>
      </div>
      <div
        style={{ transform: `translateX(${dx}px)`, transition: active.current ? 'none' : 'transform .2s ease', touchAction: 'pan-y' }}
        onPointerDown={(e) => begin(e.clientX, e.clientY)}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={() => { if (active.current) end() }}
      >
        {children}
      </div>
    </div>
  )
}

export default App
