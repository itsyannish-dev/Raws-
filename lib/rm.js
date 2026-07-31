'use client'

import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((cfg) => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('rm_token')
    if (t) cfg.headers.Authorization = `Bearer ${t}`
  }
  return cfg
})

// ---- pricing helpers (pip-based spread; quotes carry bid/ask from server) ----
export const bidOf = (q) => (q?.bid != null ? q.bid : q?.price)
export const askOf = (q) => (q?.ask != null ? q.ask : q?.price)

export const halfSpreadOf = (q, pipSize = 0.0001) =>
  q?.bid != null && q?.ask != null
    ? (q.ask - q.bid) / 2
    : ((q?.spreadPips || 1.5) * pipSize) / 2

// legacy helpers (kept for compatibility)
export const SPREAD = 0.0005
export const askPrice = (mid, spread = SPREAD) => mid * (1 + spread / 2)
export const bidPrice = (mid, spread = SPREAD) => mid * (1 - spread / 2)

// USD value of 1 unit of a currency, using the live quotes map
export function usdRate(ccy, quotes) {
  if (!ccy || ccy === 'USD') return 1
  const direct = quotes?.[`${ccy}USD`]?.price
  if (direct) return direct
  const inverse = quotes?.[`USD${ccy}`]?.price
  if (inverse) return 1 / inverse
  return null
}

export function positionPnl(p, q, quotes) {
  const mid = q?.price
  if (!mid || !isFinite(mid)) return 0
  const half = halfSpreadOf(q, p.pipSize || 0.0001)
  const closeAt = p.side === 'buy' ? mid - half : mid + half
  const units = p.lots * (p.contractSize || 1)
  const diff = (closeAt - p.entryPrice) * (p.side === 'buy' ? 1 : -1) * units
  if (p.quoteCurrency && p.quoteCurrency !== 'USD') {
    const rate = usdRate(p.quoteCurrency, quotes)
    if (rate != null) return diff * rate
    if ((p.symbol || '').startsWith('USD')) return diff / mid
  }
  return diff
}

export function notionalUsd(meta, price, lots, quotes) {
  const units = lots * (meta?.contractSize || 1)
  if (meta?.type === 'forex') {
    const base = (meta.symbol || '').slice(0, 3)
    const rate = usdRate(base, quotes)
    if (rate != null) return units * rate
    return meta.quote === 'USD' ? units * price : units
  }
  return units * price
}

export const fmtMoney = (v, digits = 2) => {
  if (v == null || !isFinite(v)) return '—'
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export const fmtSignedMoney = (v, digits = 2) => {
  if (v == null || !isFinite(v)) return '—'
  const sign = v > 0 ? '+' : v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export const fmtPrice = (v, decimals = 2) => {
  if (v == null || !isFinite(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function logout(router) {
  localStorage.removeItem('rm_token')
  localStorage.removeItem('rm_user')
  router.push('/')
}
