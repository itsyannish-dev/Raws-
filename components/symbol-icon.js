'use client'

import React, { useState } from 'react'

const CRYPTO_IDS = {
  BTCUSD: 'btc', ETHUSD: 'eth', SOLUSD: 'sol', XRPUSD: 'xrp',
  BNBUSD: 'bnb', DOGEUSD: 'doge', ADAUSD: 'ada', LINKUSD: 'link',
}
const STOCK_DOMAINS = {
  AAPL: 'apple.com', TSLA: 'tesla.com', NVDA: 'nvidia.com',
  MSFT: 'microsoft.com', AMZN: 'amazon.com', GOOGL: 'google.com',
}
const FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭',
}
const INDEX_LABELS = { US500: 'S&P', US100: 'NDX', US30: 'DJI' }

function FallbackBadge({ symbol, size }) {
  return (
    <div
      className="rounded-full bg-white/5 text-white/60 flex items-center justify-center font-bold shrink-0"
      style={{ height: size, width: size, fontSize: size * 0.32 }}
    >
      {symbol.slice(0, 2)}
    </div>
  )
}

export function SymbolIcon({ symbol, type, size = 32 }) {
  const [imgError, setImgError] = useState(false)

  if (type === 'forex' && symbol.length >= 6) {
    const base = FLAGS[symbol.slice(0, 3)]
    const quote = FLAGS[symbol.slice(3, 6)]
    if (base && quote) {
      return (
        <div className="relative shrink-0 flex items-center justify-center" style={{ height: size, width: size }}>
          <span className="absolute" style={{ fontSize: size * 0.55, left: 0, top: size * 0.05 }}>{base}</span>
          <span className="absolute" style={{ fontSize: size * 0.55, right: 0, bottom: size * 0.05 }}>{quote}</span>
        </div>
      )
    }
    return <FallbackBadge symbol={symbol} size={size} />
  }

  if (type === 'metal') {
    const gold = symbol.startsWith('XAU')
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold text-black shrink-0 ${gold ? 'bg-gradient-to-br from-yellow-300 to-yellow-600' : 'bg-gradient-to-br from-gray-200 to-gray-500'}`}
        style={{ height: size, width: size, fontSize: size * 0.34 }}
      >
        {gold ? 'Au' : 'Ag'}
      </div>
    )
  }

  if (type === 'index') {
    return (
      <div
        className="rounded-full bg-blue-500/15 text-blue-400 border border-blue-400/20 flex items-center justify-center font-bold shrink-0"
        style={{ height: size, width: size, fontSize: size * 0.28 }}
      >
        {INDEX_LABELS[symbol] || symbol.slice(0, 3)}
      </div>
    )
  }

  let src = null
  if (type === 'crypto' && CRYPTO_IDS[symbol]) src = `https://assets.coincap.io/assets/icons/${CRYPTO_IDS[symbol]}@2x.png`
  if (type === 'stock' && STOCK_DOMAINS[symbol]) src = `https://logo.clearbit.com/${STOCK_DOMAINS[symbol]}`

  if (!src || imgError) return <FallbackBadge symbol={symbol} size={size} />

  return (
    <img
      src={src}
      alt={symbol}
      loading="lazy"
      onError={() => setImgError(true)}
      className={`rounded-full shrink-0 object-contain ${type === 'stock' ? 'bg-white p-[2px]' : ''}`}
      style={{ height: size, width: size }}
    />
  )
}

export default SymbolIcon
