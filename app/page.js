'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtPrice } from '@/lib/rm'
import { ArrowRight, Zap, LineChart, Wallet, ShieldCheck, X, ChevronDown, UserPlus, Banknote, CandlestickChart } from 'lucide-react'

const FAQS = [
  { q: 'How do I start trading on RAWMarkets?', a: 'Create a free account in under a minute, fund it instantly with a demo deposit, and start trading crypto and stocks with live market data.' },
  { q: 'What markets can I trade?', a: 'You can trade 8 major cryptocurrencies (BTC, ETH, SOL, XRP and more) 24/7, plus 6 leading US stocks including Apple, Tesla and NVIDIA during market hours.' },
  { q: 'What are the fees?', a: 'Zero commission. We charge a transparent 0.05% spread on every trade — that is it. No hidden costs, no monthly fees.' },
  { q: 'How does leverage work?', a: 'You can trade with leverage from 1x up to 100x. Your required margin is the notional value divided by your leverage. Free margin is monitored in real time to protect your account.' },
  { q: 'How do withdrawals work?', a: 'Withdrawal requests are reviewed by our team and typically processed within 24 hours. Your funds are always visible in your wallet with full transaction history.' },
]

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
  const [openFaq, setOpenFaq] = useState(null)

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
      router.push('/home')
    } catch (e2) {
      setError(e2.response?.data?.error || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const openAuth = (m) => {
    if (loggedIn) {
      router.push('/home')
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
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2 select-none">
              <div className="h-7 w-7 rounded-md bg-[#00FF66] flex items-center justify-center">
                <span className="text-black font-extrabold text-sm">R</span>
              </div>
              <span className="font-bold tracking-tight text-lg">RAW<span className="text-[#00FF66]">MARKETS</span></span>
            </div>
            <div className="hidden lg:flex items-center gap-7 text-sm text-white/50">
              <a href="#markets" className="hover:text-white transition">Markets</a>
              <a href="#features" className="hover:text-white transition">Features</a>
              <a href="#how" className="hover:text-white transition">How it works</a>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button data-testid="nav-signin-btn" onClick={() => openAuth('login')} className="text-sm text-white/70 hover:text-white transition px-4 py-2">
              {loggedIn ? 'Open app' : 'Sign in'}
            </button>
            <button data-testid="nav-getstarted-btn" onClick={() => openAuth('register')} className="text-sm font-semibold bg-[#00FF66] text-black px-4 py-2 rounded-full hover:bg-[#00e65c] transition">
              {loggedIn ? 'Launch app' : 'Get started'}
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

      {/* LIVE MARKETS TABLE */}
      <section id="markets" className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Live markets.</h2>
          <p className="text-white/40 text-center mt-3">Real prices, streaming right now.</p>
          <div className="mt-10 rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5" data-testid="landing-markets-table">
            {(symbols.slice(0, 8)).map((s) => {
              const q = quotes[s.symbol]
              const up = (q?.changePercent || 0) >= 0
              return (
                <div key={s.symbol} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold ${s.type === 'crypto' ? 'bg-[#00FF66]/10 text-[#00FF66]' : 'bg-white/5 text-white/60'}`}>
                      {s.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{s.symbol}</div>
                      <div className="text-[11px] text-white/35">{s.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
                      <div className={`text-[11px] font-mono ${up ? 'text-[#00FF66]' : 'text-[#ff3b5c]'}`}>
                        {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
                      </div>
                    </div>
                    <button onClick={() => openAuth('register')} className="hidden sm:block text-xs font-semibold border border-[#00FF66]/30 text-[#00FF66] px-4 py-1.5 rounded-full hover:bg-[#00FF66]/10 transition">
                      Trade
                    </button>
                  </div>
                </div>
              )
            })}
            {symbols.length === 0 && <div className="px-5 py-12 text-center text-white/25">Loading markets…</div>}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Engineered for serious traders.</h2>
          <p className="text-white/40 text-center mt-3 max-w-xl mx-auto">Everything you need. Nothing you don't.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-14">
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

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Up and running in a minute.</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-14">
            {[
              { icon: UserPlus, step: '01', title: 'Create your account', desc: 'Sign up with just your name, email and a password. No paperwork, no waiting.' },
              { icon: Banknote, step: '02', title: 'Fund your wallet', desc: 'Demo deposits are credited instantly so you can start trading right away.' },
              { icon: CandlestickChart, step: '03', title: 'Trade live markets', desc: 'Open positions with up to 100x leverage and watch your PnL update in real time.' },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-7">
                <div className="text-[#00FF66]/20 font-extrabold text-4xl absolute top-5 right-6">{s.step}</div>
                <s.icon className="h-6 w-6 text-[#00FF66] mb-4" />
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Simple, transparent pricing.</h2>
          <p className="text-white/40 text-center mt-3">No commission. No monthly fees. No surprises.</p>
          <div className="grid md:grid-cols-3 gap-4 mt-14">
            {[
              { v: '0.05%', l: 'Spread per trade', d: 'The only cost you pay. Applied transparently to bid and ask.' },
              { v: '$0', l: 'Commission', d: 'Zero commission on all markets, deposits and account maintenance.' },
              { v: '100x', l: 'Max leverage', d: 'Choose from 1x to 100x with real-time margin monitoring.' },
            ].map((p) => (
              <div key={p.l} className="rounded-2xl border border-[#00FF66]/15 bg-gradient-to-b from-[#00FF66]/[0.05] to-transparent p-8 text-center">
                <div className="text-4xl font-extrabold text-[#00FF66]">{p.v}</div>
                <div className="font-semibold mt-2">{p.l}</div>
                <p className="text-sm text-white/40 mt-3 leading-relaxed">{p.d}</p>
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

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Frequently asked questions.</h2>
          <div className="mt-12 space-y-3" data-testid="faq-list">
            {FAQS.map((f, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <button
                  data-testid={`faq-q-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left font-medium hover:bg-white/[0.02] transition"
                >
                  <span>{f.q}</span>
                  <ChevronDown className={`h-4 w-4 text-white/40 shrink-0 ml-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-white/50 leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
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
      <footer className="border-t border-white/5 py-14 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
                <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
              </div>
              <p className="text-white/30 text-xs mt-4 leading-relaxed">Premium online broker for crypto and stocks. Live data, instant execution, real-time PnL.</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/30 mb-4">Product</div>
              <div className="space-y-2.5 text-sm text-white/50">
                <a href="#markets" className="block hover:text-white transition">Markets</a>
                <a href="#features" className="block hover:text-white transition">Features</a>
                <a href="#pricing" className="block hover:text-white transition">Pricing</a>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/30 mb-4">Company</div>
              <div className="space-y-2.5 text-sm text-white/50">
                <a href="#how" className="block hover:text-white transition">How it works</a>
                <a href="#faq" className="block hover:text-white transition">FAQ</a>
                <button onClick={() => openAuth('register')} className="block hover:text-white transition">Open account</button>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/30 mb-4">Legal</div>
              <div className="space-y-2.5 text-sm text-white/50">
                <span className="block">Terms of service</span>
                <span className="block">Privacy policy</span>
                <span className="block">Risk disclosure</span>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
            <span>© 2025 RAWMarkets. All rights reserved.</span>
            <span>Trading involves risk. Demo environment — not financial advice.</span>
          </div>
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
