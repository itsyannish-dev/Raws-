'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtPrice } from '@/lib/rm'
import { ArrowRight, Zap, LineChart, Wallet, ShieldCheck, X } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const [quotes, setQuotes] = useState({})
  const [symbols, setSymbols] = useState([])
  const [authOpen, setAuthOpen] = useState(false)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('rm_token'))
    const load = async () => {
      try {
        const [s, q] = await Promise.all([api.get('/market/symbols'), api.get('/market/quotes')])
        setSymbols(s.data.symbols)
        setQuotes(q.data.quotes)
      } catch (e) {}
    }
    load()
    const t = setInterval(async () => {
      try {
        const q = await api.get('/market/quotes')
        setQuotes(q.data.quotes)
      } catch (e) {}
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const payload = mode === 'login' ? { email: form.email, password: form.password } : form
      const res = await api.post(`/auth/${mode === 'login' ? 'login' : 'register'}`, payload)
      localStorage.setItem('rm_token', res.data.token)
      localStorage.setItem('rm_user', JSON.stringify(res.data.user))
      router.push('/terminal')
    } catch (e2) {
      setError(e2.response?.data?.error || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const openAuth = (m) => {
    if (loggedIn) {
      router.push('/terminal')
      return
    }
    setMode(m)
    setError('')
    setAuthOpen(true)
  }

  const tickerItems = symbols.filter((s) => quotes[s.symbol])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <div className="h-7 w-7 rounded-md bg-[#00FF66] flex items-center justify-center">
              <span className="text-black font-extrabold text-sm">R</span>
            </div>
            <span className="font-bold tracking-tight text-lg">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button data-testid="nav-signin-btn" onClick={() => openAuth('login')} className="text-sm text-white/70 hover:text-white transition px-4 py-2">
              {loggedIn ? 'Terminal' : 'Sign in'}
            </button>
            <button data-testid="nav-getstarted-btn" onClick={() => openAuth('register')} className="text-sm font-semibold bg-[#00FF66] text-black px-4 py-2 rounded-full hover:bg-[#00e65c] transition">
              {loggedIn ? 'Open Terminal' : 'Get started'}
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-gradient pt-40 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF66]/20 bg-[#00FF66]/5 px-4 py-1.5 text-xs text-[#00FF66] mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF66] animate-pulse" />
            Live markets. Real-time execution.
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
            Trade the world's markets.<br />
            <span className="text-[#00FF66] glow-green">Zero friction.</span>
          </h1>
          <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto">
            Crypto and stocks with live pricing, instant execution and real-time PnL.
            A trading terminal engineered to feel invisible.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button data-testid="hero-cta-btn" onClick={() => openAuth('register')} className="group inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-8 py-3.5 rounded-full hover:bg-[#00e65c] transition text-base">
              Start trading
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button onClick={() => openAuth('login')} className="text-white/70 hover:text-white transition font-medium px-6 py-3.5">
              Sign in
            </button>
          </div>
        </div>
      </section>

      {/* LIVE TICKER */}
      <section className="border-y border-white/5 bg-white/[0.02] overflow-hidden py-3">
        {tickerItems.length > 0 ? (
          <div className="ticker-track flex w-max gap-10 px-6" data-testid="live-ticker">
            {[...tickerItems, ...tickerItems].map((s, i) => {
              const q = quotes[s.symbol]
              const up = (q?.changePercent || 0) >= 0
              return (
                <div key={`${s.symbol}-${i}`} className="flex items-center gap-2.5 text-sm whitespace-nowrap">
                  <span className="font-semibold text-white/80">{s.symbol}</span>
                  <span className="font-mono text-white/60">{fmtPrice(q?.price, s.decimals)}</span>
                  <span className={`font-mono text-xs ${up ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
                    {up ? '+' : ''}{(q?.changePercent || 0).toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-white/30 text-sm">Loading live markets…</div>
        )}
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Engineered for serious traders.</h2>
          <p className="text-white/40 text-center mt-3 max-w-xl mx-auto">Everything you need. Nothing you don't.</p>
          <div className="grid md:grid-cols-4 gap-4 mt-14">
            {[
              { icon: LineChart, title: 'Live market data', desc: 'Streaming prices for crypto and US equities, tick by tick.' },
              { icon: Zap, title: 'Instant execution', desc: 'Market orders filled in milliseconds with transparent spreads.' },
              { icon: Wallet, title: 'Real-time PnL', desc: 'Floating PnL, equity and margin recalculated live on every tick.' },
              { icon: ShieldCheck, title: 'Secure wallet', desc: 'Deposits credited instantly. Withdrawals reviewed and protected.' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-[#00FF66]/20 transition group">
                <f.icon className="h-6 w-6 text-[#00FF66] mb-4" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="mx-auto max-w-4xl grid grid-cols-3 gap-8 text-center">
          {[
            { v: '14+', l: 'Markets' },
            { v: '<50ms', l: 'Execution' },
            { v: '24/7', l: 'Crypto trading' },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-3xl md:text-4xl font-extrabold text-[#00FF66]">{s.v}</div>
              <div className="text-white/40 text-sm mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl text-center rounded-3xl border border-[#00FF66]/15 bg-gradient-to-b from-[#00FF66]/[0.06] to-transparent p-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Your edge starts here.</h2>
          <p className="text-white/40 mt-3">Open an account in under a minute.</p>
          <button onClick={() => openAuth('register')} className="mt-8 inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-8 py-3.5 rounded-full hover:bg-[#00e65c] transition">
            Create free account <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <span>© 2025 RAWMarkets. All rights reserved.</span>
          <span>Trading involves risk. Demo environment — not financial advice.</span>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setAuthOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl" data-testid="auth-modal">
            <button onClick={() => setAuthOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white" data-testid="auth-close-btn">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
              <span className="font-bold">RAW<span className="text-[#00FF66]">MARKETS</span></span>
            </div>
            <div className="flex rounded-lg bg-white/5 p-1 mb-6">
              <button data-testid="auth-tab-login" onClick={() => { setMode('login'); setError('') }} className={`flex-1 py-2 text-sm rounded-md font-medium transition ${mode === 'login' ? 'bg-[#00FF66] text-black' : 'text-white/50 hover:text-white'}`}>Sign in</button>
              <button data-testid="auth-tab-register" onClick={() => { setMode('register'); setError('') }} className={`flex-1 py-2 text-sm rounded-md font-medium transition ${mode === 'register' ? 'bg-[#00FF66] text-black' : 'text-white/50 hover:text-white'}`}>Create account</button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <input data-testid="auth-name-input" required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#00FF66]/50" />
              )}
              <input data-testid="auth-email-input" required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#00FF66]/50" />
              <input data-testid="auth-password-input" required type="password" placeholder="Password (min. 6 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#00FF66]/50" />
              {error && <div data-testid="auth-error" className="text-[#ff3b5c] text-sm">{error}</div>}
              <button data-testid="auth-submit-btn" disabled={busy} type="submit" className="w-full bg-[#00FF66] text-black font-semibold py-3 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50">
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="text-xs text-white/25 mt-4 text-center">New accounts start at $0. Fund instantly with a demo deposit.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
