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

export const SPREAD = 0.0005
export const askPrice = (mid, spread = SPREAD) => mid * (1 + spread / 2)
export const bidPrice = (mid, spread = SPREAD) => mid * (1 - spread / 2)

export function positionPnl(p, mid, spread = SPREAD) {
  if (!mid || !isFinite(mid)) return 0
  const units = p.lots * (p.contractSize || 1)
  const closeAt = p.side === 'buy' ? bidPrice(mid, spread) : askPrice(mid, spread)
  const dir = p.side === 'buy' ? 1 : -1
  const diff = (closeAt - p.entryPrice) * dir * units
  // USD-base forex pairs (USDJPY etc): diff is in quote currency -> convert to USD
  if (p.quoteCurrency && p.quoteCurrency !== 'USD') return diff / mid
  return diff
}

export function notionalUsd(meta, price, lots) {
  const units = lots * (meta?.contractSize || 1)
  return meta?.quote && meta.quote !== 'USD' ? units : units * price
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
