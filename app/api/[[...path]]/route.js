import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// ---------- CONFIG ----------
const JWT_SECRET = process.env.JWT_SECRET || 'rawmarkets-dev-secret'
const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const SPREAD = 0.0005 // 0.05% total spread
const LEVERAGES = [1, 2, 5, 10, 20, 50, 100]

const SYMBOLS = [
  { symbol: 'BTCUSD', name: 'Bitcoin', type: 'crypto', binance: 'BTCUSDT', ws: 'BINANCE:BTCUSDT', decimals: 2 },
  { symbol: 'ETHUSD', name: 'Ethereum', type: 'crypto', binance: 'ETHUSDT', ws: 'BINANCE:ETHUSDT', decimals: 2 },
  { symbol: 'SOLUSD', name: 'Solana', type: 'crypto', binance: 'SOLUSDT', ws: 'BINANCE:SOLUSDT', decimals: 3 },
  { symbol: 'XRPUSD', name: 'Ripple', type: 'crypto', binance: 'XRPUSDT', ws: 'BINANCE:XRPUSDT', decimals: 4 },
  { symbol: 'BNBUSD', name: 'BNB', type: 'crypto', binance: 'BNBUSDT', ws: 'BINANCE:BNBUSDT', decimals: 2 },
  { symbol: 'DOGEUSD', name: 'Dogecoin', type: 'crypto', binance: 'DOGEUSDT', ws: 'BINANCE:DOGEUSDT', decimals: 5 },
  { symbol: 'ADAUSD', name: 'Cardano', type: 'crypto', binance: 'ADAUSDT', ws: 'BINANCE:ADAUSDT', decimals: 4 },
  { symbol: 'LINKUSD', name: 'Chainlink', type: 'crypto', binance: 'LINKUSDT', ws: 'BINANCE:LINKUSDT', decimals: 3 },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', finnhub: 'AAPL', yahoo: 'AAPL', decimals: 2 },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', finnhub: 'TSLA', yahoo: 'TSLA', decimals: 2 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', finnhub: 'NVDA', yahoo: 'NVDA', decimals: 2 },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock', finnhub: 'MSFT', yahoo: 'MSFT', decimals: 2 },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock', finnhub: 'AMZN', yahoo: 'AMZN', decimals: 2 },
  { symbol: 'GOOGL', name: 'Alphabet', type: 'stock', finnhub: 'GOOGL', yahoo: 'GOOGL', decimals: 2 },
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

// ---------- TRADING ENGINE ----------
const askPrice = (mid) => mid * (1 + SPREAD / 2)
const bidPrice = (mid) => mid * (1 - SPREAD / 2)

function positionFloatingPnl(p, mid) {
  const closeAt = p.side === 'buy' ? bidPrice(mid) : askPrice(mid)
  const dir = p.side === 'buy' ? 1 : -1
  return (closeAt - p.entryPrice) * p.lots * dir
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
    if (q) floating += positionFloatingPnl(p, q.price)
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

    // ===== MARKET (public) =====
    if (route === 'market/symbols' && method === 'GET') {
      return json({ symbols: SYMBOLS.map(({ symbol, name, type, decimals }) => ({ symbol, name, type, decimals })) })
    }

    if (route === 'market/quotes' && method === 'GET') {
      const url = new URL(request.url)
      const qs = url.searchParams.get('symbols')
      const list = qs ? qs.split(',').map((s) => s.trim()).filter(Boolean) : SYMBOLS.map((s) => s.symbol)
      const quotes = await fetchQuotes(list)
      return json({ quotes, spread: SPREAD })
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

      let quote
      try {
        quote = await fetchQuote(meta)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const entryPrice = side === 'buy' ? askPrice(quote.price) : bidPrice(quote.price)
      const notional = lotsNum * entryPrice
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
      let quote
      try {
        quote = await fetchQuote(meta)
      } catch (e) {
        return err('Market price unavailable, try again', 502)
      }
      const closePrice = position.side === 'buy' ? bidPrice(quote.price) : askPrice(quote.price)
      const dir = position.side === 'buy' ? 1 : -1
      const pnl = (closePrice - position.entryPrice) * position.lots * dir
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
      const account = await computeAccount(database, user)
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
