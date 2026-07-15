import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'

// ---------- CONFIG ----------
const JWT_SECRET = process.env.JWT_SECRET || 'rawmarkets-dev-secret'
const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const DEFAULT_SPREAD = 0.0005 // 0.05% total spread
const LEVERAGES = [1, 2, 5, 10, 20, 50, 100]

const SYMBOLS = [
  // Crypto (contractSize 1, quoted in USD)
  { symbol: 'BTCUSD', name: 'Bitcoin', type: 'crypto', binance: 'BTCUSDT', ws: 'BINANCE:BTCUSDT', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'ETHUSD', name: 'Ethereum', type: 'crypto', binance: 'ETHUSDT', ws: 'BINANCE:ETHUSDT', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'SOLUSD', name: 'Solana', type: 'crypto', binance: 'SOLUSDT', ws: 'BINANCE:SOLUSDT', decimals: 3, contractSize: 1, quote: 'USD' },
  { symbol: 'XRPUSD', name: 'Ripple', type: 'crypto', binance: 'XRPUSDT', ws: 'BINANCE:XRPUSDT', decimals: 4, contractSize: 1, quote: 'USD' },
  { symbol: 'BNBUSD', name: 'BNB', type: 'crypto', binance: 'BNBUSDT', ws: 'BINANCE:BNBUSDT', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'DOGEUSD', name: 'Dogecoin', type: 'crypto', binance: 'DOGEUSDT', ws: 'BINANCE:DOGEUSDT', decimals: 5, contractSize: 1, quote: 'USD' },
  { symbol: 'ADAUSD', name: 'Cardano', type: 'crypto', binance: 'ADAUSDT', ws: 'BINANCE:ADAUSDT', decimals: 4, contractSize: 1, quote: 'USD' },
  { symbol: 'LINKUSD', name: 'Chainlink', type: 'crypto', binance: 'LINKUSDT', ws: 'BINANCE:LINKUSDT', decimals: 3, contractSize: 1, quote: 'USD' },
  // Forex (contractSize 100,000 = 1 standard lot)
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex', ws: 'OANDA:EUR_USD', yahoo: 'EURUSD=X', decimals: 5, contractSize: 100000, quote: 'USD' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex', ws: 'OANDA:GBP_USD', yahoo: 'GBPUSD=X', decimals: 5, contractSize: 100000, quote: 'USD' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'forex', ws: 'OANDA:AUD_USD', yahoo: 'AUDUSD=X', decimals: 5, contractSize: 100000, quote: 'USD' },
  { symbol: 'NZDUSD', name: 'NZ Dollar / US Dollar', type: 'forex', ws: 'OANDA:NZD_USD', yahoo: 'NZDUSD=X', decimals: 5, contractSize: 100000, quote: 'USD' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex', ws: 'OANDA:USD_JPY', yahoo: 'USDJPY=X', decimals: 3, contractSize: 100000, quote: 'JPY' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'forex', ws: 'OANDA:USD_CAD', yahoo: 'USDCAD=X', decimals: 5, contractSize: 100000, quote: 'CAD' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'forex', ws: 'OANDA:USD_CHF', yahoo: 'USDCHF=X', decimals: 5, contractSize: 100000, quote: 'CHF' },
  // Stocks (contractSize 1)
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', finnhub: 'AAPL', yahoo: 'AAPL', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', finnhub: 'TSLA', yahoo: 'TSLA', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', finnhub: 'NVDA', yahoo: 'NVDA', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock', finnhub: 'MSFT', yahoo: 'MSFT', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock', finnhub: 'AMZN', yahoo: 'AMZN', decimals: 2, contractSize: 1, quote: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet', type: 'stock', finnhub: 'GOOGL', yahoo: 'GOOGL', decimals: 2, contractSize: 1, quote: 'USD' },
]

const symMeta = (symbol) => SYMBOLS.find((s) => s.symbol === symbol)

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

const sanitizeUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, balance: u.balance, createdAt: u.createdAt })

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

// ---------- MARKET DATA ----------
const quoteCache = new Map() // symbol -> { data, ts }
const QUOTE_TTL = 5000

// Server-side Finnhub WebSocket feed for live forex prices (singleton across hot reloads)
function getForexFeed() {
  if (globalThis.__rmForexFeed) return globalThis.__rmForexFeed
  const feed = { prices: {}, ws: null }
  globalThis.__rmForexFeed = feed
  const connect = () => {
    if (!FINNHUB_KEY) return
    try {
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`)
      feed.ws = ws
      ws.on('open', () => {
        SYMBOLS.filter((s) => s.type === 'forex').forEach((s) => {
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

// Yahoo snapshot (price + prev close) used for forex daily change and as price fallback
const yahooQuoteCache = new Map()
async function fetchYahooQuote(meta) {
  const c = yahooQuoteCache.get(meta.symbol)
  if (c && Date.now() - c.ts < 60000) return c.data
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${meta.yahoo}?interval=1d&range=5d`, {
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
  } else if (meta.type === 'forex') {
    // Live tick from server-side Finnhub WS, daily stats + fallback from Yahoo
    const feed = getForexFeed()
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
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${meta.yahoo}?interval=${yi}&range=${range}`, {
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
async function getSettings(database) {
  if (settingsCache.data && Date.now() - settingsCache.ts < 15000) return settingsCache.data
  let s = await database.collection('settings').findOne({ id: 'platform' })
  if (!s) {
    s = { id: 'platform', spread: DEFAULT_SPREAD, maxLeverage: 100, tradingEnabled: true }
    await database.collection('settings').insertOne({ ...s })
  }
  const clean = { spread: s.spread, maxLeverage: s.maxLeverage, tradingEnabled: s.tradingEnabled }
  settingsCache = { data: clean, ts: Date.now() }
  return clean
}

// ---------- TRADING ENGINE ----------
const askPrice = (mid, spread = DEFAULT_SPREAD) => mid * (1 + spread / 2)
const bidPrice = (mid, spread = DEFAULT_SPREAD) => mid * (1 - spread / 2)

const unitsOf = (meta, lots) => lots * (meta?.contractSize || 1)

// PnL in USD. For USD-quoted pairs (EURUSD, BTCUSD, stocks) the diff is already USD.
// For USD-base forex pairs (USDJPY, USDCAD, USDCHF) the diff is in quote currency -> convert by dividing by the pair's current price.
function pnlUsdOf(meta, entryPrice, closePrice, lots, dir, conversionPrice) {
  const diff = (closePrice - entryPrice) * dir * unitsOf(meta, lots)
  if (meta?.quote && meta.quote !== 'USD' && conversionPrice) return diff / conversionPrice
  return diff
}

// Notional in USD: XXXUSD -> units * price; USDXXX -> units (base is USD)
function notionalUsdOf(meta, price, lots) {
  const units = unitsOf(meta, lots)
  return meta?.quote && meta.quote !== 'USD' ? units : units * price
}

function positionFloatingPnl(p, mid, spread = DEFAULT_SPREAD) {
  const meta = symMeta(p.symbol) || { contractSize: p.contractSize || 1, quote: p.quoteCurrency || 'USD' }
  const closeAt = p.side === 'buy' ? bidPrice(mid, spread) : askPrice(mid, spread)
  const dir = p.side === 'buy' ? 1 : -1
  return pnlUsdOf(meta, p.entryPrice, closeAt, p.lots, dir, mid)
}

async function computeAccount(database, user, spread = DEFAULT_SPREAD) {
  const open = await database.collection('positions').find({ userId: user.id, status: 'open' }).toArray()
  let floating = 0
  let usedMargin = 0
  const symbols = [...new Set(open.map((p) => p.symbol))]
  const quotes = await fetchQuotes(symbols)
  for (const p of open) {
    usedMargin += p.margin
    const q = quotes[p.symbol]
    if (q) floating += positionFloatingPnl(p, q.price, spread)
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
      return json({ symbols: SYMBOLS.map(({ symbol, name, type, decimals, contractSize, quote }) => ({ symbol, name, type, decimals, contractSize, quote })) })
    }

    if (route === 'market/quotes' && method === 'GET') {
      const url = new URL(request.url)
      const qs = url.searchParams.get('symbols')
      const list = qs ? qs.split(',').map((s) => s.trim()).filter(Boolean) : SYMBOLS.map((s) => s.symbol)
      const quotes = await fetchQuotes(list)
      const settings = await getSettings(database)
      return json({ quotes, spread: settings.spread })
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
      const settings = await getSettings(database)
      const account = await computeAccount(database, user, settings.spread)
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
      if (lev > settings.maxLeverage) return err(`Maximum allowed leverage is ${settings.maxLeverage}x`)

      let quote
      try {
        quote = await fetchQuote(meta)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const entryPrice = side === 'buy' ? askPrice(quote.price, settings.spread) : bidPrice(quote.price, settings.spread)
      const notional = notionalUsdOf(meta, entryPrice, lotsNum)
      const margin = notional / lev

      const account = await computeAccount(database, user, settings.spread)
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
      const settings = await getSettings(database)
      let quote
      try {
        quote = await fetchQuote(meta)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const closePrice = position.side === 'buy' ? bidPrice(quote.price, settings.spread) : askPrice(quote.price, settings.spread)
      const dir = position.side === 'buy' ? 1 : -1
      const pnl = pnlUsdOf(meta, position.entryPrice, closePrice, position.lots, dir, quote.price)
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

    // ===== TRANSACTIONS =====
    if (route === 'transactions/deposit' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const amount = Number(body?.amount)
      if (!isFinite(amount) || amount <= 0) return err('Invalid amount')
      if (amount > 1000000) return err('Maximum deposit is $1,000,000')
      const tx = {
        id: uuidv4(),
        userId: user.id,
        type: 'deposit',
        amount,
        method: 'demo',
        status: 'completed',
        createdAt: new Date().toISOString(),
      }
      await database.collection('transactions').insertOne(tx)
      await database.collection('users').updateOne({ id: user.id }, { $inc: { balance: amount } })
      const updatedUser = await database.collection('users').findOne({ id: user.id })
      const { _id, ...cleanTx } = tx
      return json({ transaction: cleanTx, balance: updatedUser.balance }, 201)
    }

    if (route === 'transactions/withdraw' && method === 'POST') {
      const user = await getAuthUser(request, database)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const amount = Number(body?.amount)
      if (!isFinite(amount) || amount <= 0) return err('Invalid amount')
      const wdSettings = await getSettings(database)
      const account = await computeAccount(database, user, wdSettings.spread)
      if (amount > account.freeMargin || amount > account.balance) {
        return err(`Insufficient available funds. Available: $${Math.max(0, Math.min(account.freeMargin, account.balance)).toFixed(2)}`)
      }
      const tx = {
        id: uuidv4(),
        userId: user.id,
        type: 'withdrawal',
        amount,
        method: 'bank',
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

    // ===== ADMIN =====
    if (path[0] === 'admin') {
      const admin = await getAuthUser(request, database)
      if (!admin) return err('Unauthorized', 401)
      if (admin.role !== 'admin') return err('Forbidden: admin access required', 403)

      // GET /api/admin/stats
      if (route === 'admin/stats' && method === 'GET') {
        const [userCount, balanceAgg, openPositions, pendingWd, depositAgg, withdrawAgg] = await Promise.all([
          database.collection('users').countDocuments({}),
          database.collection('users').aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]).toArray(),
          database.collection('positions').countDocuments({ status: 'open' }),
          database.collection('transactions').find({ type: 'withdrawal', status: 'pending' }).toArray(),
          database.collection('transactions').aggregate([{ $match: { type: 'deposit', status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]).toArray(),
          database.collection('transactions').aggregate([{ $match: { type: 'withdrawal', status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]).toArray(),
        ])
        return json({
          stats: {
            totalUsers: userCount,
            totalBalance: balanceAgg[0]?.total || 0,
            openPositions,
            pendingWithdrawals: pendingWd.length,
            pendingWithdrawalAmount: pendingWd.reduce((s, t) => s + t.amount, 0),
            totalDeposited: depositAgg[0]?.total || 0,
            totalWithdrawn: withdrawAgg[0]?.total || 0,
          },
        })
      }

      // GET /api/admin/users?search=
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

      // POST /api/admin/users/{id}/adjust-balance
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

      // GET /api/admin/transactions?status=&type=
      if (route === 'admin/transactions' && method === 'GET') {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const type = url.searchParams.get('type')
        const query = {}
        if (status) query.status = status
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

      // POST /api/admin/transactions/{id}/approve | reject
      if (path[1] === 'transactions' && (path[3] === 'approve' || path[3] === 'reject') && method === 'POST') {
        const tx = await database.collection('transactions').findOne({ id: path[2] })
        if (!tx) return err('Transaction not found', 404)
        if (tx.type !== 'withdrawal') return err('Only withdrawals can be approved or rejected')
        if (tx.status !== 'pending') return err(`Transaction is already ${tx.status}`)
        const newStatus = path[3] === 'approve' ? 'approved' : 'rejected'
        await database.collection('transactions').updateOne(
          { id: tx.id },
          { $set: { status: newStatus, processedAt: new Date().toISOString(), adminId: admin.id } }
        )
        if (newStatus === 'rejected') {
          // refund the held amount
          await database.collection('users').updateOne({ id: tx.userId }, { $inc: { balance: tx.amount } })
        }
        return json({ transaction: { ...tx, _id: undefined, status: newStatus } })
      }

      // GET /api/admin/positions?status=
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

      // GET / PUT /api/admin/settings
      if (route === 'admin/settings' && method === 'GET') {
        const settings = await getSettings(database)
        return json({ settings })
      }
      if (route === 'admin/settings' && method === 'PUT') {
        const body = await request.json()
        const updates = {}
        if (body.spread != null) {
          const sp = Number(body.spread)
          if (!isFinite(sp) || sp < 0 || sp > 0.02) return err('Spread must be between 0 and 0.02 (2%)')
          updates.spread = sp
        }
        if (body.maxLeverage != null) {
          const ml = Number(body.maxLeverage)
          if (!LEVERAGES.includes(ml)) return err(`Max leverage must be one of: ${LEVERAGES.join(', ')}`)
          updates.maxLeverage = ml
        }
        if (body.tradingEnabled != null) {
          updates.tradingEnabled = !!body.tradingEnabled
        }
        if (Object.keys(updates).length === 0) return err('Nothing to update')
        await database.collection('settings').updateOne({ id: 'platform' }, { $set: updates }, { upsert: true })
        settingsCache = { data: null, ts: 0 }
        const settings = await getSettings(database)
        return json({ settings })
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
