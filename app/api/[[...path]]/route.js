import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'

// ---------- CONFIG ----------
const JWT_SECRET = process.env.JWT_SECRET || 'rawmarkets-dev-secret'
const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const LEVERAGES = [1, 2, 5, 10, 20, 50, 100]
const CATEGORY_LEVERAGE = { crypto: 10, forex: 100, metal: 20, index: 50, stock: 10 }

const SYMBOLS = [
  // Crypto (max leverage 1:10)
  { symbol: 'BTCUSD', name: 'Bitcoin', type: 'crypto', binance: 'BTCUSDT', ws: 'BINANCE:BTCUSDT', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 1 },
  { symbol: 'ETHUSD', name: 'Ethereum', type: 'crypto', binance: 'ETHUSDT', ws: 'BINANCE:ETHUSDT', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.1 },
  { symbol: 'SOLUSD', name: 'Solana', type: 'crypto', binance: 'SOLUSDT', ws: 'BINANCE:SOLUSDT', decimals: 3, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  { symbol: 'XRPUSD', name: 'Ripple', type: 'crypto', binance: 'XRPUSDT', ws: 'BINANCE:XRPUSDT', decimals: 4, contractSize: 1, quote: 'USD', pipSize: 0.0001 },
  { symbol: 'BNBUSD', name: 'BNB', type: 'crypto', binance: 'BNBUSDT', ws: 'BINANCE:BNBUSDT', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.1 },
  { symbol: 'DOGEUSD', name: 'Dogecoin', type: 'crypto', binance: 'DOGEUSDT', ws: 'BINANCE:DOGEUSDT', decimals: 5, contractSize: 1, quote: 'USD', pipSize: 0.00001 },
  { symbol: 'ADAUSD', name: 'Cardano', type: 'crypto', binance: 'ADAUSDT', ws: 'BINANCE:ADAUSDT', decimals: 4, contractSize: 1, quote: 'USD', pipSize: 0.0001 },
  { symbol: 'LINKUSD', name: 'Chainlink', type: 'crypto', binance: 'LINKUSDT', ws: 'BINANCE:LINKUSDT', decimals: 3, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  // Forex majors (max leverage 1:100) — 1 lot = 100,000 units, pip = 0.0001 (JPY pairs 0.01)
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex', ws: 'OANDA:EUR_USD', yahoo: 'EURUSD=X', decimals: 5, contractSize: 100000, quote: 'USD', pipSize: 0.0001 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex', ws: 'OANDA:GBP_USD', yahoo: 'GBPUSD=X', decimals: 5, contractSize: 100000, quote: 'USD', pipSize: 0.0001 },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'forex', ws: 'OANDA:AUD_USD', yahoo: 'AUDUSD=X', decimals: 5, contractSize: 100000, quote: 'USD', pipSize: 0.0001 },
  { symbol: 'NZDUSD', name: 'NZ Dollar / US Dollar', type: 'forex', ws: 'OANDA:NZD_USD', yahoo: 'NZDUSD=X', decimals: 5, contractSize: 100000, quote: 'USD', pipSize: 0.0001 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex', ws: 'OANDA:USD_JPY', yahoo: 'USDJPY=X', decimals: 3, contractSize: 100000, quote: 'JPY', pipSize: 0.01 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'forex', ws: 'OANDA:USD_CAD', yahoo: 'USDCAD=X', decimals: 5, contractSize: 100000, quote: 'CAD', pipSize: 0.0001 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'forex', ws: 'OANDA:USD_CHF', yahoo: 'USDCHF=X', decimals: 5, contractSize: 100000, quote: 'CHF', pipSize: 0.0001 },
  // Forex crosses
  { symbol: 'EURGBP', name: 'Euro / British Pound', type: 'forex', ws: 'OANDA:EUR_GBP', yahoo: 'EURGBP=X', decimals: 5, contractSize: 100000, quote: 'GBP', pipSize: 0.0001 },
  { symbol: 'EURJPY', name: 'Euro / Japanese Yen', type: 'forex', ws: 'OANDA:EUR_JPY', yahoo: 'EURJPY=X', decimals: 3, contractSize: 100000, quote: 'JPY', pipSize: 0.01 },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', type: 'forex', ws: 'OANDA:GBP_JPY', yahoo: 'GBPJPY=X', decimals: 3, contractSize: 100000, quote: 'JPY', pipSize: 0.01 },
  { symbol: 'EURCHF', name: 'Euro / Swiss Franc', type: 'forex', ws: 'OANDA:EUR_CHF', yahoo: 'EURCHF=X', decimals: 5, contractSize: 100000, quote: 'CHF', pipSize: 0.0001 },
  { symbol: 'AUDJPY', name: 'Australian Dollar / Yen', type: 'forex', ws: 'OANDA:AUD_JPY', yahoo: 'AUDJPY=X', decimals: 3, contractSize: 100000, quote: 'JPY', pipSize: 0.01 },
  { symbol: 'EURAUD', name: 'Euro / Australian Dollar', type: 'forex', ws: 'OANDA:EUR_AUD', yahoo: 'EURAUD=X', decimals: 5, contractSize: 100000, quote: 'AUD', pipSize: 0.0001 },
  // Metals (max leverage 1:20) — gold 100 oz/lot, silver 5000 oz/lot
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', type: 'metal', ws: 'OANDA:XAU_USD', yahoo: 'GC=F', decimals: 2, contractSize: 100, quote: 'USD', pipSize: 0.1 },
  { symbol: 'XAGUSD', name: 'Silver / US Dollar', type: 'metal', ws: 'OANDA:XAG_USD', yahoo: 'SI=F', decimals: 3, contractSize: 5000, quote: 'USD', pipSize: 0.01 },
  // Indices (max leverage 1:50) — 1 lot = 1 index unit, pip = 1 point
  { symbol: 'US500', name: 'S&P 500', type: 'index', ws: 'OANDA:SPX500_USD', yahoo: '^GSPC', decimals: 1, contractSize: 1, quote: 'USD', pipSize: 1 },
  { symbol: 'US100', name: 'Nasdaq 100', type: 'index', ws: 'OANDA:NAS100_USD', yahoo: '^NDX', decimals: 1, contractSize: 1, quote: 'USD', pipSize: 1 },
  { symbol: 'US30', name: 'Dow Jones 30', type: 'index', ws: 'OANDA:US30_USD', yahoo: '^DJI', decimals: 1, contractSize: 1, quote: 'USD', pipSize: 1 },
  // Stocks (max leverage 1:10) — pip = 1 cent
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', finnhub: 'AAPL', yahoo: 'AAPL', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', finnhub: 'TSLA', yahoo: 'TSLA', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', finnhub: 'NVDA', yahoo: 'NVDA', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock', finnhub: 'MSFT', yahoo: 'MSFT', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock', finnhub: 'AMZN', yahoo: 'AMZN', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.01 },
  { symbol: 'GOOGL', name: 'Alphabet', type: 'stock', finnhub: 'GOOGL', yahoo: 'GOOGL', decimals: 2, contractSize: 1, quote: 'USD', pipSize: 0.01 },
]

const symMeta = (symbol) => SYMBOLS.find((s) => s.symbol === symbol)
const maxLeverageOf = (meta) => CATEGORY_LEVERAGE[meta?.type] || 10

// ---------- DB ----------
let client = null
let db = null
async function getDb() {
  if (!db) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'rawmarkets')
  }
  return db
}

// ---------- HELPERS ----------
const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (message, status = 400) => NextResponse.json({ error: message }, { status })

const sanitizeUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, balance: u.balance, verificationStatus: u.verificationStatus || 'unverified', createdAt: u.createdAt })

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

async function getAuthUser(request, database) {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const user = await database.collection('users').findOne({ id: decoded.uid })
    return user || null
  } catch (e) {
    return null
  }
}

// ---------- SEED & SETTINGS ----------
let adminSeeded = false
async function ensureAdmin(database) {
  if (adminSeeded) return
  adminSeeded = true
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@rawmarkets.com').toLowerCase()
    const existing = await database.collection('users').findOne({ email })
    if (!existing) {
      await database.collection('users').insertOne({
        id: uuidv4(),
        name: 'RAW Admin',
        email,
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'RawAdmin!2025', 10),
        role: 'admin',
        balance: 0,
        createdAt: new Date().toISOString(),
      })
    } else if (existing.role !== 'admin') {
      await database.collection('users').updateOne({ email }, { $set: { role: 'admin' } })
    }
  } catch (e) {
    adminSeeded = false
  }
}

let settingsCache = { data: null, ts: 0 }
let basePipsGlobal = 1
async function getSettings(database) {
  if (settingsCache.data && Date.now() - settingsCache.ts < 15000) return settingsCache.data
  let s = await database.collection('settings').findOne({ id: 'platform' })
  if (!s) {
    s = { id: 'platform', spreadPips: 1, tradingEnabled: true }
    await database.collection('settings').insertOne({ ...s })
  }
  const clean = {
    spreadPips: s.spreadPips != null ? s.spreadPips : 1,
    tradingEnabled: s.tradingEnabled != null ? s.tradingEnabled : true,
  }
  basePipsGlobal = clean.spreadPips
  settingsCache = { data: clean, ts: Date.now() }
  return clean
}

// ---------- MARKET DATA ----------
const quoteCache = new Map() // symbol -> { data, ts }
const QUOTE_TTL = 5000

// Server-side Finnhub WebSocket feed for live forex/metal/index prices (singleton)
function getLiveFeed() {
  if (globalThis.__rmLiveFeed) return globalThis.__rmLiveFeed
  const feed = { prices: {}, ws: null }
  globalThis.__rmLiveFeed = feed
  const connect = () => {
    if (!FINNHUB_KEY) return
    try {
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`)
      feed.ws = ws
      ws.on('open', () => {
        SYMBOLS.filter((s) => ['forex', 'metal', 'index'].includes(s.type)).forEach((s) => {
          try { ws.send(JSON.stringify({ type: 'subscribe', symbol: s.ws })) } catch (e) {}
        })
      })
      ws.on('message', (raw) => {
        try {
          const m = JSON.parse(raw.toString())
          if (m.type === 'trade' && Array.isArray(m.data)) {
            for (const t of m.data) feed.prices[t.s] = { price: t.p, ts: Date.now() }
          }
        } catch (e) {}
      })
      ws.on('close', () => setTimeout(connect, 5000))
      ws.on('error', () => { try { ws.close() } catch (e) {} })
    } catch (e) {
      setTimeout(connect, 10000)
    }
  }
  connect()
  return feed
}

const yahooQuoteCache = new Map()
async function fetchYahooQuote(meta) {
  const c = yahooQuoteCache.get(meta.symbol)
  if (c && Date.now() - c.ts < 60000) return c.data
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahoo)}?interval=1d&range=5d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, cache: 'no-store',
    })
    if (!r.ok) return c?.data || null
    const j = await r.json()
    const m = j?.chart?.result?.[0]?.meta
    if (!m?.regularMarketPrice) return c?.data || null
    const data = {
      price: m.regularMarketPrice,
      prevClose: m.chartPreviousClose || m.previousClose || m.regularMarketPrice,
      high: m.regularMarketDayHigh,
      low: m.regularMarketDayLow,
    }
    yahooQuoteCache.set(meta.symbol, { data, ts: Date.now() })
    return data
  } catch (e) {
    return c?.data || null
  }
}

// Dynamic spread: between base and 2x base pips, per symbol, stable for the quote cache TTL
function dynamicSpreadPips() {
  return +(basePipsGlobal * (1 + Math.random())).toFixed(2)
}

function withSpread(data, meta) {
  const spreadPips = dynamicSpreadPips()
  const half = (spreadPips * (meta.pipSize || 0.0001)) / 2
  return { ...data, spreadPips, pipSize: meta.pipSize, bid: data.price - half, ask: data.price + half }
}

async function fetchQuote(meta) {
  const cached = quoteCache.get(meta.symbol)
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data
  let data
  if (meta.type === 'crypto') {
    const r = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${meta.binance}`, { cache: 'no-store' })
    if (!r.ok) throw new Error('quote fetch failed')
    const j = await r.json()
    data = {
      symbol: meta.symbol, price: +j.lastPrice, change: +j.priceChange, changePercent: +j.priceChangePercent,
      high: +j.highPrice, low: +j.lowPrice, prevClose: +j.openPrice, ts: Date.now(),
    }
  } else if (['forex', 'metal', 'index'].includes(meta.type)) {
    const feed = getLiveFeed()
    const live = feed.prices[meta.ws]
    const yq = await fetchYahooQuote(meta)
    const price = live && Date.now() - live.ts < 120000 ? live.price : yq?.price
    if (!price) throw new Error(`Quote unavailable for ${meta.symbol}`)
    const prevClose = yq?.prevClose || price
    data = {
      symbol: meta.symbol,
      price,
      change: price - prevClose,
      changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      high: yq?.high || null,
      low: yq?.low || null,
      prevClose,
      ts: Date.now(),
    }
  } else {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${meta.finnhub}&token=${FINNHUB_KEY}`, { cache: 'no-store' })
    if (!r.ok) throw new Error('quote fetch failed')
    const j = await r.json()
    data = {
      symbol: meta.symbol, price: j.c, change: j.d, changePercent: j.dp,
      high: j.h, low: j.l, prevClose: j.pc, ts: Date.now(),
    }
  }
  if (!data.price || !isFinite(data.price)) throw new Error(`Quote unavailable for ${meta.symbol}`)
  data = withSpread(data, meta)
  quoteCache.set(meta.symbol, { data, ts: Date.now() })
  return data
}

async function fetchQuotes(symbolList) {
  const results = {}
  await Promise.all(
    symbolList.map(async (s) => {
      const meta = symMeta(s)
      if (!meta) return
      try {
        results[s] = await fetchQuote(meta)
      } catch (e) {
        // skip unavailable quotes
      }
    })
  )
  return results
}

const BINANCE_INTERVALS = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' }
const YAHOO_INTERVALS = { '1m': ['1m', '1d'], '5m': ['5m', '5d'], '15m': ['15m', '5d'], '1h': ['60m', '1mo'], '4h': ['1d', '6mo'], '1d': ['1d', '1y'] }

async function fetchCandles(meta, interval, limit = 300) {
  if (meta.type === 'crypto') {
    const bi = BINANCE_INTERVALS[interval] || '1h'
    const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${meta.binance}&interval=${bi}&limit=${limit}`, { cache: 'no-store' })
    if (!r.ok) throw new Error('candle fetch failed')
    const j = await r.json()
    return j.map((k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }))
  } else {
    const [yi, range] = YAHOO_INTERVALS[interval] || ['60m', '1mo']
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahoo)}?interval=${yi}&range=${range}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, cache: 'no-store',
    })
    if (!r.ok) throw new Error('candle fetch failed')
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    if (!res) throw new Error('no chart data')
    const ts = res.timestamp || []
    const q = res.indicators?.quote?.[0] || {}
    const out = []
    for (let i = 0; i < ts.length; i++) {
      if (q.open?.[i] == null || q.close?.[i] == null) continue
      out.push({ time: ts[i], open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] })
    }
    return out.slice(-limit)
  }
}

// ---------- TRADING ENGINE (pip-based spread + multi-currency) ----------
const halfSpreadOf = (q, meta) => ((q.spreadPips || basePipsGlobal * 1.5) * (meta?.pipSize || 0.0001)) / 2

// USD value of 1 unit of a currency (uses live pairs)
async function usdRateOf(ccy) {
  if (!ccy || ccy === 'USD') return 1
  const direct = symMeta(`${ccy}USD`)
  if (direct) {
    const q = await fetchQuote(direct)
    return q.price
  }
  const inverse = symMeta(`USD${ccy}`)
  if (inverse) {
    const q = await fetchQuote(inverse)
    return 1 / q.price
  }
  return 1
}

async function pnlUsd(meta, entryPrice, closePrice, lots, dir) {
  const units = lots * (meta?.contractSize || 1)
  const diff = (closePrice - entryPrice) * dir * units
  const qc = meta?.quote || 'USD'
  if (qc === 'USD') return diff
  return diff * (await usdRateOf(qc))
}

async function notionalUsd(meta, price, lots) {
  const units = lots * (meta?.contractSize || 1)
  if (meta?.type === 'forex') {
    const base = meta.symbol.slice(0, 3)
    return units * (await usdRateOf(base))
  }
  return units * price
}

async function computeAccount(database, user) {
  const open = await database.collection('positions').find({ userId: user.id, status: 'open' }).toArray()
  let floating = 0
  let usedMargin = 0
  const symbols = [...new Set(open.map((p) => p.symbol))]
  const quotes = await fetchQuotes(symbols)
  for (const p of open) {
    usedMargin += p.margin
    const q = quotes[p.symbol]
    const meta = symMeta(p.symbol)
    if (q && meta) {
      const half = halfSpreadOf(q, meta)
      const closeAt = p.side === 'buy' ? q.price - half : q.price + half
      const dir = p.side === 'buy' ? 1 : -1
      try {
        floating += await pnlUsd(meta, p.entryPrice, closeAt, p.lots, dir)
      } catch (e) {}
    }
  }
  const balance = user.balance || 0
  const equity = balance + floating
  return {
    balance,
    equity,
    floatingPnl: floating,
    usedMargin,
    freeMargin: equity - usedMargin,
    marginLevel: usedMargin > 0 ? (equity / usedMargin) * 100 : null,
    openPositions: open.length,
  }
}

// ---------- KYC VERIFICATION ----------
// verified when user has an approved 'identity' AND an approved 'address' document
async function recomputeVerification(database, userId) {
  const docs = await database.collection('documents').find({ userId }, { projection: { _id: 0, type: 1, status: 1 } }).toArray()
  const hasApproved = (type) => docs.some((d) => d.type === type && d.status === 'approved')
  const hasPending = docs.some((d) => d.status === 'pending')
  const hasRejected = docs.some((d) => d.status === 'rejected')
  let status = 'unverified'
  if (hasApproved('identity') && hasApproved('address')) status = 'verified'
  else if (hasPending) status = 'pending'
  else if (hasRejected) status = 'rejected'
  await database.collection('users').updateOne({ id: userId }, { $set: { verificationStatus: status } })
  return status
}

// ---------- NOWPAYMENTS ----------
const NP_BASE = process.env.NOWPAYMENTS_BASE_URL || 'https://api.nowpayments.io/v1'
async function npRequest(path, options = {}) {
  const r = await fetch(`${NP_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NOWPAYMENTS_API_KEY || '',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  })
  const text = await r.text()
  let j = {}
  try { j = text ? JSON.parse(text) : {} } catch (e) {}
  if (!r.ok) {
    const e = new Error(j.message || j.error || `NOWPayments error ${r.status}`)
    e.status = r.status
    throw e
  }
  return j
}

const POPULAR_PAY_CURRENCIES = [
  { code: 'btc', label: 'Bitcoin (BTC)' },
  { code: 'eth', label: 'Ethereum (ETH)' },
  { code: 'usdttrc20', label: 'USDT (TRC-20)' },
  { code: 'usdterc20', label: 'USDT (ERC-20)' },
  { code: 'usdc', label: 'USDC' },
  { code: 'sol', label: 'Solana (SOL)' },
  { code: 'ltc', label: 'Litecoin (LTC)' },
  { code: 'xrp', label: 'Ripple (XRP)' },
  { code: 'trx', label: 'Tron (TRX)' },
  { code: 'doge', label: 'Dogecoin (DOGE)' },
]
let npCurrenciesCache = { data: null, ts: 0 }
async function getPayCurrencies() {
  if (npCurrenciesCache.data && Date.now() - npCurrenciesCache.ts < 600000) return npCurrenciesCache.data
  try {
    const j = await npRequest('/currencies', { method: 'GET' })
    const available = new Set((j.currencies || []).map((c) => String(c).toLowerCase()))
    const list = POPULAR_PAY_CURRENCIES.filter((c) => available.has(c.code))
    const data = list.length ? list : POPULAR_PAY_CURRENCIES
    npCurrenciesCache = { data, ts: Date.now() }
    return data
  } catch (e) {
    return npCurrenciesCache.data || POPULAR_PAY_CURRENCIES
  }
}

// waiting/confirming/sending/partially_paid -> waiting_payment; confirmed/finished -> pending (admin); failed/expired/refunded -> failed
function mapNpStatus(npStatus) {
  if (['finished', 'confirmed'].includes(npStatus)) return 'pending'
  if (['failed', 'expired', 'refunded'].includes(npStatus)) return 'failed'
  return 'waiting_payment'
}

// ---------- ROUTER ----------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = path.join('/')
  const method = request.method

  try {
    const database = await getDb()
    await ensureAdmin(database)

    // ===== ROOT =====
    if ((route === '' || route === 'root') && method === 'GET') {
      return json({ message: 'RAWMarkets API v1', status: 'operational' })
    }

    // ===== AUTH =====
    if (route === 'auth/register' && method === 'POST') {
      const body = await request.json()
      const { name, email, password } = body || {}
      if (!name || !email || !password) return err('Name, email and password are required')
      if (password.length < 6) return err('Password must be at least 6 characters')
      const emailNorm = String(email).toLowerCase().trim()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) return err('Invalid email address')
      const existing = await database.collection('users').findOne({ email: emailNorm })
      if (existing) return err('An account with this email already exists', 409)
      const user = {
        id: uuidv4(),
        name: String(name).trim(),
        email: emailNorm,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'user',
        balance: 0,
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
      }
      await database.collection('users').insertOne(user)
      return json({ token: signToken(user), user: sanitizeUser(user) }, 201)
    }

    if (route === 'auth/login' && method === 'POST') {
      const body = await request.json()
      const { email, password } = body || {}
      if (!email || !password) return err('Email and password are required')
      const user = await database.collection('users').findOne({ email: String(email).toLowerCase().trim() })
      if (!user) return err('Invalid email or password', 401)
      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) return err('Invalid email or password', 401)
      return json({ token: signToken(user), user: sanitizeUser(user) })
    }

    if (route === 'auth/me' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      return json({ user: sanitizeUser(user) })
    }

    if (route === 'auth/profile' && method === 'PATCH') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const name = String(body?.name || '').trim()
      if (!name) return err('Name is required')
      await database.collection('users').updateOne({ id: user.id }, { $set: { name } })
      return json({ user: { ...sanitizeUser(user), name } })
    }

    if (route === 'auth/change-password' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const { currentPassword, newPassword } = body || {}
      if (!currentPassword || !newPassword) return err('Current and new password are required')
      if (newPassword.length < 6) return err('New password must be at least 6 characters')
      const ok = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!ok) return err('Current password is incorrect', 401)
      await database.collection('users').updateOne(
        { id: user.id },
        { $set: { passwordHash: await bcrypt.hash(newPassword, 10) } }
      )
      return json({ success: true })
    }

    // ===== MARKET (public) =====
    if (route === 'market/symbols' && method === 'GET') {
      return json({
        symbols: SYMBOLS.map(({ symbol, name, type, decimals, contractSize, quote, pipSize }) => ({
          symbol, name, type, decimals, contractSize, quote, pipSize, maxLeverage: CATEGORY_LEVERAGE[type] || 10,
        })),
      })
    }

    if (route === 'market/quotes' && method === 'GET') {
      const url = new URL(request.url)
      const qs = url.searchParams.get('symbols')
      const list = qs ? qs.split(',').map((s) => s.trim()).filter(Boolean) : SYMBOLS.map((s) => s.symbol)
      const settings = await getSettings(database)
      const quotes = await fetchQuotes(list)
      return json({ quotes, baseSpreadPips: settings.spreadPips })
    }

    if (route === 'market/candles' && method === 'GET') {
      const url = new URL(request.url)
      const symbol = url.searchParams.get('symbol')
      const interval = url.searchParams.get('interval') || '1h'
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '300', 10), 500)
      const meta = symMeta(symbol)
      if (!meta) return err('Unknown symbol')
      try {
        const candles = await fetchCandles(meta, interval, limit)
        return json({ symbol, interval, candles })
      } catch (e) {
        return err('Chart data unavailable for this symbol', 502)
      }
    }

    if (route === 'market/ws-config' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      return json({
        token: FINNHUB_KEY,
        url: 'wss://ws.finnhub.io',
        subscriptions: SYMBOLS.filter((s) => s.ws).map((s) => ({ symbol: s.symbol, ws: s.ws })),
      })
    }

    // ===== ACCOUNT =====
    if (route === 'account/summary' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      await getSettings(database)
      const account = await computeAccount(database, user)
      return json({ account })
    }

    // ===== ORDERS / POSITIONS =====
    if (route === 'orders' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const { symbol, side, lots, leverage } = body || {}
      const meta = symMeta(symbol)
      if (!meta) return err('Unknown symbol')
      if (!['buy', 'sell'].includes(side)) return err('Side must be buy or sell')
      const lotsNum = Number(lots)
      if (!isFinite(lotsNum) || lotsNum <= 0 || lotsNum > 10000) return err('Invalid lot size')
      const lev = Number(leverage)
      if (!LEVERAGES.includes(lev)) return err('Invalid leverage')

      const settings = await getSettings(database)
      if (!settings.tradingEnabled) return err('Trading is temporarily disabled by the platform', 403)
      const catMax = maxLeverageOf(meta)
      if (lev > catMax) return err(`Maximum leverage for ${meta.type} is 1:${catMax}`)

      let quote
      try {
        quote = await fetchQuote(meta)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const half = halfSpreadOf(quote, meta)
      const entryPrice = side === 'buy' ? quote.price + half : quote.price - half
      let notional
      try {
        notional = await notionalUsd(meta, entryPrice, lotsNum)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const margin = notional / lev

      const account = await computeAccount(database, user)
      if (margin > account.freeMargin + 1e-9) {
        return err(`Insufficient free margin. Required: $${margin.toFixed(2)}, available: $${Math.max(0, account.freeMargin).toFixed(2)}`)
      }

      const position = {
        id: uuidv4(),
        userId: user.id,
        symbol,
        side,
        lots: lotsNum,
        entryPrice,
        leverage: lev,
        margin,
        notional,
        contractSize: meta.contractSize || 1,
        quoteCurrency: meta.quote || 'USD',
        pipSize: meta.pipSize,
        spreadPips: quote.spreadPips,
        status: 'open',
        openedAt: new Date().toISOString(),
        closedAt: null,
        closePrice: null,
        pnl: null,
      }
      await database.collection('positions').insertOne(position)
      const { _id, ...clean } = position
      return json({ position: clean }, 201)
    }

    if (route === 'positions' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const url = new URL(request.url)
      const status = url.searchParams.get('status') || 'open'
      const list = await database
        .collection('positions')
        .find({ userId: user.id, status }, { projection: { _id: 0 } })
        .sort({ openedAt: -1 })
        .limit(200)
        .toArray()
      return json({ positions: list })
    }

    // POST /api/positions/{id}/close
    if (path[0] === 'positions' && path[2] === 'close' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const posId = path[1]
      const position = await database.collection('positions').findOne({ id: posId, userId: user.id })
      if (!position) return err('Position not found', 404)
      if (position.status !== 'open') return err('Position already closed')
      const meta = symMeta(position.symbol)
      await getSettings(database)
      let quote
      try {
        quote = await fetchQuote(meta)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const half = halfSpreadOf(quote, meta)
      const closePrice = position.side === 'buy' ? quote.price - half : quote.price + half
      const dir = position.side === 'buy' ? 1 : -1
      let pnl
      try {
        pnl = await pnlUsd(meta, position.entryPrice, closePrice, position.lots, dir)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const closedAt = new Date().toISOString()
      await database.collection('positions').updateOne(
        { id: posId },
        { $set: { status: 'closed', closePrice, pnl, closedAt } }
      )
      await database.collection('users').updateOne({ id: user.id }, { $inc: { balance: pnl } })
      const updatedUser = await database.collection('users').findOne({ id: user.id })
      return json({
        position: { ...position, _id: undefined, status: 'closed', closePrice, pnl, closedAt },
        balance: updatedUser.balance,
      })
    }

    // ===== PAYMENTS (NOWPayments) =====
    if (route === 'payments/currencies' && method === 'GET') {
      const currencies = await getPayCurrencies()
      return json({ currencies })
    }

    // ===== TRANSACTIONS =====
    // Crypto deposit via NOWPayments -> waiting_payment -> pending (admin approval) -> approved (credited)
    if (route === 'transactions/deposit' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const amount = Number(body?.amount)
      const payCurrency = String(body?.payCurrency || '').toLowerCase().trim()
      if (!isFinite(amount) || amount <= 0) return err('Invalid amount')
      if (amount < 10) return err('Minimum deposit is $10')
      if (amount > 1000000) return err('Maximum deposit is $1,000,000')
      if (!payCurrency) return err('Select the cryptocurrency you will pay with')

      let payment
      try {
        payment = await npRequest('/payment', {
          method: 'POST',
          body: JSON.stringify({
            price_amount: amount,
            price_currency: 'usd',
            pay_currency: payCurrency,
            order_id: `dep-${user.id.slice(0, 8)}-${Date.now()}`,
            order_description: `RAWMarkets wallet deposit for ${user.email}`,
          }),
        })
      } catch (e) {
        return err(`Payment gateway error: ${e.message}`, 502)
      }

      const tx = {
        id: uuidv4(),
        userId: user.id,
        type: 'deposit',
        amount,
        method: 'crypto',
        payCurrency,
        payAmount: payment.pay_amount,
        payAddress: payment.pay_address,
        paymentId: payment.payment_id,
        paymentStatus: payment.payment_status || 'waiting',
        status: 'waiting_payment',
        createdAt: new Date().toISOString(),
      }
      await database.collection('transactions').insertOne(tx)
      const { _id, ...cleanTx } = tx
      return json({ transaction: cleanTx }, 201)
    }

    // Poll NOWPayments status for a deposit
    if (path[0] === 'transactions' && path[1] === 'deposit' && path[3] === 'status' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const tx = await database.collection('transactions').findOne({ id: path[2], userId: user.id, type: 'deposit' })
      if (!tx) return err('Deposit not found', 404)
      if (tx.paymentId && ['waiting_payment'].includes(tx.status)) {
        try {
          const p = await npRequest(`/payment/${tx.paymentId}`, { method: 'GET' })
          const npStatus = p.payment_status
          const newStatus = mapNpStatus(npStatus)
          if (npStatus !== tx.paymentStatus || newStatus !== tx.status) {
            await database.collection('transactions').updateOne(
              { id: tx.id },
              { $set: { paymentStatus: npStatus, status: newStatus } }
            )
            tx.paymentStatus = npStatus
            tx.status = newStatus
          }
        } catch (e) {
          // gateway temporarily unavailable — return stored state
        }
      }
      const { _id, ...cleanTx } = tx
      return json({ transaction: cleanTx })
    }

    // Withdrawal: crypto only, requires wallet address, admin approval
    if (route === 'transactions/withdraw' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const amount = Number(body?.amount)
      const walletAddress = String(body?.walletAddress || '').trim()
      const network = String(body?.network || '').trim()
      if (!isFinite(amount) || amount <= 0) return err('Invalid amount')
      if (!walletAddress || walletAddress.length < 15) return err('A valid crypto wallet address is required')
      await getSettings(database)
      const account = await computeAccount(database, user)
      if (amount > account.freeMargin || amount > account.balance) {
        return err(`Insufficient available funds. Available: $${Math.max(0, Math.min(account.freeMargin, account.balance)).toFixed(2)}`)
      }
      const tx = {
        id: uuidv4(),
        userId: user.id,
        type: 'withdrawal',
        amount,
        method: 'crypto',
        walletAddress,
        network: network || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      await database.collection('transactions').insertOne(tx)
      await database.collection('users').updateOne({ id: user.id }, { $inc: { balance: -amount } })
      const updatedUser = await database.collection('users').findOne({ id: user.id })
      const { _id, ...cleanTx } = tx
      return json({ transaction: cleanTx, balance: updatedUser.balance }, 201)
    }

    if (route === 'transactions' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const list = await database
        .collection('transactions')
        .find({ userId: user.id }, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
      return json({ transactions: list })
    }

    // ===== DOCUMENTS (KYC) =====
    if (route === 'documents' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const type = body?.type
      if (!['identity', 'address'].includes(type)) return err('Document type must be identity or address')
      const fileName = String(body?.fileName || 'document').slice(0, 150)
      const mimeType = String(body?.mimeType || '')
      const data = String(body?.data || '')
      if (!data || data.length < 100) return err('File data is required')
      if (data.length > 7000000) return err('File too large — maximum size is 5MB')
      if (!/^(image\/(png|jpeg|jpg|webp|heic|heif)|application\/pdf)$/.test(mimeType)) return err('Only images (PNG, JPG, WEBP) or PDF files are accepted')
      // replace any previous non-approved doc of the same type
      await database.collection('documents').deleteMany({ userId: user.id, type, status: { $in: ['pending', 'rejected'] } })
      const doc = {
        id: uuidv4(),
        userId: user.id,
        type,
        fileName,
        mimeType,
        data,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      }
      await database.collection('documents').insertOne(doc)
      const verificationStatus = await recomputeVerification(database, user.id)
      const { _id, data: _fileData, ...clean } = doc
      return json({ document: clean, verificationStatus }, 201)
    }

    if (route === 'documents' && method === 'GET') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const docs = await database
        .collection('documents')
        .find({ userId: user.id }, { projection: { _id: 0, data: 0 } })
        .sort({ createdAt: -1 })
        .toArray()
      return json({ documents: docs, verificationStatus: user.verificationStatus || 'unverified' })
    }

    // ===== ADMIN =====
    if (path[0] === 'admin') {
      const admin = await getAuthUser(request, database)
      if (!admin) return err('Unauthorized', 401)
      if (admin.role !== 'admin') return err('Forbidden: admin access required', 403)

      if (route === 'admin/stats' && method === 'GET') {
        const [userCount, balanceAgg, openPositions, pendingWd, pendingDep, depositAgg, withdrawAgg, pendingDocs] = await Promise.all([
          database.collection('users').countDocuments({}),
          database.collection('users').aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]).toArray(),
          database.collection('positions').countDocuments({ status: 'open' }),
          database.collection('transactions').find({ type: 'withdrawal', status: 'pending' }).toArray(),
          database.collection('transactions').find({ type: 'deposit', status: { $in: ['pending', 'waiting_payment'] } }).toArray(),
          database.collection('transactions').aggregate([{ $match: { type: 'deposit', status: { $in: ['approved', 'completed'] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
          database.collection('transactions').aggregate([{ $match: { type: 'withdrawal', status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
          database.collection('documents').countDocuments({ status: 'pending' }),
        ])
        return json({
          stats: {
            totalUsers: userCount,
            totalBalance: balanceAgg[0]?.total || 0,
            openPositions,
            pendingWithdrawals: pendingWd.length,
            pendingWithdrawalAmount: pendingWd.reduce((s, t) => s + t.amount, 0),
            pendingDeposits: pendingDep.filter((t) => t.status === 'pending').length,
            awaitingPaymentDeposits: pendingDep.filter((t) => t.status === 'waiting_payment').length,
            totalDeposited: depositAgg[0]?.total || 0,
            totalWithdrawn: withdrawAgg[0]?.total || 0,
            pendingDocuments: pendingDocs,
          },
        })
      }

      if (route === 'admin/users' && method === 'GET') {
        const url = new URL(request.url)
        const search = url.searchParams.get('search')
        const query = search
          ? { $or: [{ email: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }] }
          : {}
        const users = await database
          .collection('users')
          .find(query, { projection: { _id: 0, passwordHash: 0 } })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray()
        return json({ users })
      }

      if (path[1] === 'users' && path[3] === 'adjust-balance' && method === 'POST') {
        const target = await database.collection('users').findOne({ id: path[2] })
        if (!target) return err('User not found', 404)
        const body = await request.json()
        const amount = Number(body?.amount)
        if (!isFinite(amount) || amount === 0) return err('Invalid amount')
        if ((target.balance || 0) + amount < 0) return err(`Adjustment would make balance negative. Current balance: $${(target.balance || 0).toFixed(2)}`)
        await database.collection('users').updateOne({ id: target.id }, { $inc: { balance: amount } })
        const tx = {
          id: uuidv4(),
          userId: target.id,
          type: 'adjustment',
          amount: Math.abs(amount),
          direction: amount > 0 ? 'credit' : 'debit',
          note: String(body?.note || '').slice(0, 200),
          method: 'admin',
          status: 'completed',
          adminId: admin.id,
          createdAt: new Date().toISOString(),
        }
        await database.collection('transactions').insertOne(tx)
        const updated = await database.collection('users').findOne({ id: target.id }, { projection: { _id: 0, passwordHash: 0 } })
        const { _id, ...cleanTx } = tx
        return json({ user: updated, transaction: cleanTx })
      }

      if (route === 'admin/transactions' && method === 'GET') {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const type = url.searchParams.get('type')
        const query = {}
        if (status) query.status = status === 'pending' && type === 'deposit' ? { $in: ['pending', 'waiting_payment'] } : status
        if (type) query.type = type
        const txs = await database
          .collection('transactions')
          .find(query, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray()
        const userIds = [...new Set(txs.map((t) => t.userId))]
        const users = await database.collection('users').find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1, email: 1 } }).toArray()
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
        return json({ transactions: txs.map((t) => ({ ...t, user: userMap[t.userId] || null })) })
      }

      // Approve / reject deposits and withdrawals
      if (path[1] === 'transactions' && (path[3] === 'approve' || path[3] === 'reject') && method === 'POST') {
        const tx = await database.collection('transactions').findOne({ id: path[2] })
        if (!tx) return err('Transaction not found', 404)
        const action = path[3]
        if (tx.type === 'withdrawal') {
          if (tx.status !== 'pending') return err(`Transaction is already ${tx.status}`)
          const newStatus = action === 'approve' ? 'approved' : 'rejected'
          await database.collection('transactions').updateOne(
            { id: tx.id },
            { $set: { status: newStatus, processedAt: new Date().toISOString(), adminId: admin.id } }
          )
          if (newStatus === 'rejected') {
            await database.collection('users').updateOne({ id: tx.userId }, { $inc: { balance: tx.amount } })
          }
          return json({ transaction: { ...tx, _id: undefined, status: newStatus } })
        }
        if (tx.type === 'deposit') {
          if (!['pending', 'waiting_payment'].includes(tx.status)) return err(`Transaction is already ${tx.status}`)
          const newStatus = action === 'approve' ? 'approved' : 'rejected'
          await database.collection('transactions').updateOne(
            { id: tx.id },
            { $set: { status: newStatus, processedAt: new Date().toISOString(), adminId: admin.id } }
          )
          if (newStatus === 'approved') {
            await database.collection('users').updateOne({ id: tx.userId }, { $inc: { balance: tx.amount } })
          }
          return json({ transaction: { ...tx, _id: undefined, status: newStatus } })
        }
        return err('Only deposits and withdrawals can be approved or rejected')
      }

      // ---- KYC document review ----
      if (route === 'admin/documents' && method === 'GET') {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const query = status && status !== 'all' ? { status } : {}
        const docs = await database
          .collection('documents')
          .find(query, { projection: { _id: 0, data: 0 } })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray()
        const userIds = [...new Set(docs.map((d) => d.userId))]
        const docUsers = await database.collection('users').find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1, email: 1, verificationStatus: 1 } }).toArray()
        const userMap = Object.fromEntries(docUsers.map((u) => [u.id, u]))
        return json({ documents: docs.map((d) => ({ ...d, user: userMap[d.userId] || null })) })
      }

      // GET /api/admin/documents/{id}/file — returns the stored file for preview
      if (path[1] === 'documents' && path[3] === 'file' && method === 'GET') {
        const doc = await database.collection('documents').findOne({ id: path[2] }, { projection: { _id: 0 } })
        if (!doc) return err('Document not found', 404)
        return json({ document: doc })
      }

      // POST /api/admin/documents/{id}/approve|reject
      if (path[1] === 'documents' && (path[3] === 'approve' || path[3] === 'reject') && method === 'POST') {
        const doc = await database.collection('documents').findOne({ id: path[2] })
        if (!doc) return err('Document not found', 404)
        if (doc.status !== 'pending') return err(`Document is already ${doc.status}`)
        const newStatus = path[3] === 'approve' ? 'approved' : 'rejected'
        await database.collection('documents').updateOne(
          { id: doc.id },
          { $set: { status: newStatus, reviewedAt: new Date().toISOString(), adminId: admin.id } }
        )
        const verificationStatus = await recomputeVerification(database, doc.userId)
        return json({ document: { ...doc, _id: undefined, data: undefined, status: newStatus }, verificationStatus })
      }

      if (route === 'admin/positions' && method === 'GET') {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || 'open'
        const list = await database
          .collection('positions')
          .find({ status }, { projection: { _id: 0 } })
          .sort({ openedAt: -1 })
          .limit(200)
          .toArray()
        const userIds = [...new Set(list.map((p) => p.userId))]
        const users = await database.collection('users').find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1, email: 1 } }).toArray()
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
        return json({ positions: list.map((p) => ({ ...p, user: userMap[p.userId] || null })) })
      }

      if (route === 'admin/settings' && method === 'GET') {
        const settings = await getSettings(database)
        return json({ settings: { ...settings, categoryLeverage: CATEGORY_LEVERAGE } })
      }
      if (route === 'admin/settings' && method === 'PUT') {
        const body = await request.json()
        const updates = {}
        if (body.spreadPips != null) {
          const sp = Number(body.spreadPips)
          if (!isFinite(sp) || sp < 0.1 || sp > 10) return err('Base spread must be between 0.1 and 10 pips')
          updates.spreadPips = sp
        }
        if (body.tradingEnabled != null) {
          updates.tradingEnabled = !!body.tradingEnabled
        }
        if (Object.keys(updates).length === 0) return err('Nothing to update')
        await database.collection('settings').updateOne({ id: 'platform' }, { $set: updates }, { upsert: true })
        settingsCache = { data: null, ts: 0 }
        const settings = await getSettings(database)
        return json({ settings: { ...settings, categoryLeverage: CATEGORY_LEVERAGE } })
      }
    }

    return err(`Route not found: ${method} /api/${route}`, 404)
  } catch (e) {
    console.error('API error:', e)
    return err('Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const PATCH = handleRoute
export const DELETE = handleRoute
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
