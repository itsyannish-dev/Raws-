'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtPrice } from '@/lib/rm'
import { SymbolIcon } from '@/components/symbol-icon'
import { useLang, LangToggle } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { ArrowRight, Zap, LineChart, Wallet, Bitcoin, X, ChevronDown, UserPlus, Banknote, CandlestickChart, Menu, ShieldCheck, Lock, Activity, FileCheck } from 'lucide-react'

const FAQS = [
  { q: 'How do I start trading on RAWMarkets?', a: 'Create a free account in under a minute, deposit crypto (BTC, ETH, USDT and more) and start trading 30+ markets with live data.' },
  { q: 'What markets can I trade?', a: 'Crypto 24/7 (BTC, ETH, SOL and more), major and cross forex pairs, gold and silver, US indices (S&P 500, Nasdaq 100, Dow) and leading US stocks.' },
  { q: 'What are the fees?', a: 'Zero commission. We charge a transparent spread of 1\u20132 pips on every trade \u2014 that is it. No hidden costs, no monthly fees.' },
  { q: 'How does leverage work?', a: 'Maximum leverage depends on the asset class: 1:100 on forex, 1:50 on indices, 1:20 on metals and 1:10 on crypto and stocks. Your required margin is the notional value divided by your leverage.' },
  { q: 'How do deposits and withdrawals work?', a: 'Deposits are made in crypto via our payment gateway and credited after network confirmation. Withdrawals go to your crypto wallet and are reviewed by our team, typically within 24 hours.' },
]

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
  const [quotes, setQuotes] = useState({})
  const [symbols, setSymbols] = useState([])
  const [authOpen, setAuthOpen] = useState(false)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [navOpen, setNavOpen] = useState(false)

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const RED = light ? 'text-[#e11d48]' : 'text-[#ff3b5c]'
  const T = {
    page: light ? 'bg-[#f7f8f7] text-gray-900' : 'bg-black text-white',
    nav: light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/70',
    navLink: light ? 'text-gray-500 hover:text-gray-900' : 'text-white/50 hover:text-white',
    sub: light ? 'text-gray-500' : 'text-white/50',
    faint: light ? 'text-gray-400' : 'text-white/40',
    fainter: light ? 'text-gray-400' : 'text-white/35',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/5 bg-white/[0.02]',
    cardHover: light ? 'hover:border-[#00b34a]/30' : 'hover:border-[#00FF66]/20',
    borderT: light ? 'border-black/5' : 'border-white/5',
    divide: light ? 'divide-black/5' : 'divide-white/5',
    rowHover: light ? 'hover:bg-black/[0.02]' : 'hover:bg-white/[0.02]',
    greenCard: light ? 'border-[#00b34a]/20 bg-gradient-to-b from-[#00b34a]/[0.06] to-transparent' : 'border-[#00FF66]/15 bg-gradient-to-b from-[#00FF66]/[0.05] to-transparent',
    tickerBg: light ? 'bg-white' : 'bg-white/[0.02]',
  }

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('rm_token'))
    try {
      if (new URLSearchParams(window.location.search).get('join') === '1' && !localStorage.getItem('rm_token')) {
        setMode('register')
        setAuthOpen(true)
      }
    } catch (e) {}
    const load = async () => {
      try {
        const [s, q] = await Promise.all([api.get('/market/symbols'), api.get('/market/quotes')])
        setSymbols(s.data.symbols)
        setQuotes(q.data.quotes)
      } catch (e) {}
    }
    load()
    const timer = setInterval(async () => {
      try {
        const q = await api.get('/market/quotes')
        setQuotes(q.data.quotes)
      } catch (e) {}
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(), email: form.email, password: form.password }
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
    setNavOpen(false)
    if (loggedIn) {
      router.push('/home')
      return
    }
    setMode(m)
    setError('')
    setAuthOpen(true)
  }

  const NAV_LINKS = [
    { href: '#markets', label: t('Markets') },
    { href: '/leverage', label: t('Leverage') },
    { href: '#how', label: t('How it works') },
    { href: '#pricing', label: t('Pricing') },
    { href: '#faq', label: 'FAQ' },
    { href: '/about', label: t('About us') },
    { href: '/contact', label: t('Contact us') },
  ]

  const tickerItems = symbols.filter((s) => quotes[s.symbol]).slice(0, 20)

  const CATEGORIES = [
    { label: t('Crypto'), sub: t('BTC, ETH and more, 24/7'), lev: '1:10' },
    { label: t('Forex'), sub: t('Major pairs and crosses'), lev: '1:100' },
    { label: t('Metals'), sub: t('Gold and silver'), lev: '1:20' },
    { label: t('Indices'), sub: t('S&P 500, Nasdaq, Dow'), lev: '1:50' },
    { label: t('Stocks'), sub: t('Top US companies'), lev: '1:10' },
  ]

  const inputCls = light
    ? 'w-full rounded-lg bg-black/[0.03] border border-black/10 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#00b34a]/60'
    : 'w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#00FF66]/50'

  return (
    <div className={`min-h-screen ${T.page}`}>
      {/* NAV */}
      <nav className={`fixed top-0 inset-x-0 z-40 border-b backdrop-blur-xl ${T.nav}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-12">
            <button data-testid="site-hamburger-btn" onClick={() => setNavOpen(!navOpen)} className={`lg:hidden p-1.5 -ml-1.5 transition ${T.navLink}`}>
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <a href="/" className="select-none font-extrabold tracking-tight text-xl leading-none">
              RAW<span className={GREEN}>MARKETS</span>
            </a>
            <div className={`hidden lg:flex items-center gap-6 text-[13px] font-medium ${T.navLink}`}>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="hover:opacity-100 transition whitespace-nowrap">{l.label}</a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LangToggle />
            <button data-testid="nav-signin-btn" onClick={() => openAuth('login')} className={`hidden sm:block text-sm transition px-2 sm:px-3 py-2 ${T.navLink}`}>
              {loggedIn ? t('Open app') : t('Sign in')}
            </button>
            <button data-testid="nav-getstarted-btn" onClick={() => openAuth('register')} className="text-sm font-semibold bg-[#00FF66] text-black px-4 py-2 rounded-full hover:bg-[#00e65c] transition">
              {loggedIn ? t('Launch app') : t('Get started')}
            </button>
          </div>
        </div>

        {/* MOBILE TOP DROPDOWN MENU */}
        {navOpen && (
          <div data-testid="site-nav-dropdown" className={`lg:hidden border-t ${T.borderT} ${light ? 'bg-white' : 'bg-[#0a0a0a]'}`}>
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setNavOpen(false)} className={`block px-3 py-3 rounded-lg text-sm font-medium transition ${light ? 'text-gray-600 hover:bg-black/5' : 'text-white/70 hover:bg-white/5'}`}>
                  {l.label}
                </a>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
                <button onClick={() => openAuth('login')} className={`border font-medium py-3 rounded-xl transition text-sm ${light ? 'border-black/15 text-gray-700 hover:bg-black/5' : 'border-white/15 text-white/80 hover:bg-white/5'}`}>
                  {loggedIn ? t('Open app') : t('Sign in')}
                </button>
                <button onClick={() => openAuth('register')} className="bg-[#00FF66] text-black font-semibold py-3 rounded-xl hover:bg-[#00e65c] transition text-sm">
                  {loggedIn ? t('Launch app') : t('Get started')}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* HERO — lion artwork (always dark) */}
      <section className="relative bg-black text-white overflow-hidden">
        <img src="/images/hero-lion.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-40 pb-32">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02]">
              {t('Start Trading effortlessly')}<span className="text-[#00FF66] glow-green">.</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-xl">
              {t('Crypto, forex, metals, indices and stocks with live pricing, instant execution and real-time PnL. A trading terminal engineered to feel invisible.')}
            </p>
            <div className="mt-10 flex items-center gap-4 flex-wrap">
              <button data-testid="hero-cta-btn" onClick={() => openAuth('register')} className="group inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-8 py-3.5 rounded-full hover:bg-[#00e65c] transition text-base">
                {t('Start trading')}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={() => openAuth('login')} className="text-white/70 hover:text-white transition font-medium px-6 py-3.5">
                {t('Sign in')}
              </button>
            </div>
            <div className="mt-12 flex items-center gap-8 text-sm">
              {[{ v: '45+', l: t('Markets') }, { v: '<50ms', l: t('Execution') }, { v: '24/7', l: t('Crypto trading') }].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-extrabold text-[#00FF66]">{s.v}</div>
                  <div className="text-white/40 text-xs mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LIVE TICKER */}
      <section className={`border-y overflow-hidden py-3 ${T.borderT} ${T.tickerBg}`}>
        {tickerItems.length > 0 ? (
          <div className="ticker-track flex w-max gap-10 px-6" data-testid="live-ticker">
            {[...tickerItems, ...tickerItems].map((s, i) => {
              const q = quotes[s.symbol]
              const up = (q?.changePercent || 0) >= 0
              return (
                <div key={`${s.symbol}-${i}`} className="flex items-center gap-2.5 text-sm whitespace-nowrap">
                  <SymbolIcon symbol={s.symbol} type={s.type} size={18} />
                  <span className={`font-semibold ${light ? 'text-gray-700' : 'text-white/80'}`}>{s.symbol}</span>
                  <span className={`font-mono ${T.sub}`}>{fmtPrice(q?.price, s.decimals)}</span>
                  <span className={`font-mono text-xs ${up ? GREEN : RED}`}>
                    {up ? '+' : ''}{(q?.changePercent || 0).toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={`text-center text-sm ${T.fainter}`}>{t('Loading live markets…')}</div>
        )}
      </section>

      {/* LIVE MARKETS TABLE */}
      <section id="markets" className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">{t('Live markets.')}</h2>
          <p className={`text-center mt-3 ${T.faint}`}>{t('Real prices, streaming right now.')}</p>
          <div className={`mt-10 rounded-2xl border overflow-hidden divide-y ${T.card} ${T.divide}`} data-testid="landing-markets-table">
            {(symbols.slice(0, 10)).map((s) => {
              const q = quotes[s.symbol]
              const up = (q?.changePercent || 0) >= 0
              return (
                <div key={s.symbol} className={`flex items-center justify-between px-5 py-4 transition ${T.rowHover}`}>
                  <div className="flex items-center gap-3">
                    <SymbolIcon symbol={s.symbol} type={s.type} size={36} />
                    <div>
                      <div className="text-sm font-semibold">{s.symbol}</div>
                      <div className={`text-[11px] ${T.fainter}`}>{s.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-mono">{q?.price ? fmtPrice(q.price, s.decimals) : '—'}</div>
                      <div className={`text-[11px] font-mono ${up ? GREEN : RED}`}>
                        {q?.changePercent != null ? `${up ? '+' : ''}${q.changePercent.toFixed(2)}%` : ''}
                      </div>
                    </div>
                    <button onClick={() => openAuth('register')} className={`hidden sm:block text-xs font-semibold border px-4 py-1.5 rounded-full transition ${light ? 'border-[#00b34a]/40 text-[#00b34a] hover:bg-[#00b34a]/10' : 'border-[#00FF66]/30 text-[#00FF66] hover:bg-[#00FF66]/10'}`}>
                      {t('Trade')}
                    </button>
                  </div>
                </div>
              )
            })}
            {symbols.length === 0 && <div className={`px-5 py-12 text-center ${T.fainter}`}>{t('Loading markets…')}</div>}
          </div>
        </div>
      </section>

      {/* TRADE ANYTIME ANYWHERE — image section */}
      <section className={`py-24 px-4 sm:px-6 border-t ${T.borderT}`}>
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-10 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              TRADE <span className={GREEN}>ANYTIME.<br />ANYWHERE.</span>
            </h2>
            <p className={`mt-5 leading-relaxed max-w-md ${T.sub}`}>
              {t('The full power of global markets in a terminal designed to feel invisible. Live prices, one-tap execution and real-time PnL — on any device.')}
            </p>
            <button onClick={() => openAuth('register')} className="mt-8 inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-7 py-3 rounded-full hover:bg-[#00e65c] transition">
              {t('Get started')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="order-1 md:order-2">
            <img src="/images/trade-anywhere.png" alt="Trade anytime, anywhere" className="rounded-3xl w-full shadow-2xl border border-black/10" loading="lazy" />
          </div>
        </div>
      </section>

      {/* TERMINAL PREVIEW */}
      <section className={`py-24 px-4 sm:px-6 border-t ${T.borderT}`}>
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-10 items-center">
          <div className="flex justify-center">
            <img src="/images/phone-mockup.png" alt="RAWMarkets terminal" className="w-full max-w-sm drop-shadow-2xl" loading="lazy" />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('A terminal built for speed')}</h2>
            <p className={`mt-4 leading-relaxed max-w-md ${T.sub}`}>
              {t('Professional candlestick charts, live bid/ask lines, one-tap orders and a market watch covering 45+ instruments.')}
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: LineChart, title: t('Live market data'), desc: t('Streaming prices for crypto, forex, metals, indices and stocks, tick by tick.') },
                { icon: Zap, title: t('Instant execution'), desc: t('Market orders filled in milliseconds with transparent pip-based spreads.') },
                { icon: Wallet, title: t('Real-time PnL'), desc: t('Floating PnL, equity and margin recalculated live on every tick.') },
              ].map((f) => (
                <div key={f.title} className={`flex items-start gap-4 rounded-2xl border p-5 ${T.card}`}>
                  <f.icon className={`h-5 w-5 mt-0.5 shrink-0 ${GREEN}`} />
                  <div>
                    <h3 className="font-semibold text-sm">{f.title}</h3>
                    <p className={`text-xs mt-1 leading-relaxed ${T.fainter}`}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES / TRUST */}
      <section id="features" className={`py-24 px-4 sm:px-6 border-t ${T.borderT}`}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">{t('Built for trust.')}</h2>
          <p className={`text-center mt-3 max-w-xl mx-auto ${T.faint}`}>{t("Everything you need. Nothing you don't.")}</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-14">
            {[
              { icon: ShieldCheck, title: t('Verified accounts'), desc: t('KYC verification keeps the platform safe for every trader.') },
              { icon: Banknote, title: t('Reviewed withdrawals'), desc: t('Every withdrawal is manually reviewed before funds move.') },
              { icon: Lock, title: t('Encrypted sessions'), desc: t('Your data and credentials are protected end to end.') },
              { icon: Activity, title: t('Real-time monitoring'), desc: t('Margin levels are monitored live on every account.') },
            ].map((f) => (
              <div key={f.title} className={`rounded-2xl border p-6 transition group ${T.card} ${T.cardHover}`}>
                <f.icon className={`h-6 w-6 mb-4 ${GREEN}`} />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className={`text-sm leading-relaxed ${T.fainter}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — dynamic steps */}
      <section id="how" className={`py-24 px-4 sm:px-6 border-t ${T.borderT}`}>
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">{t('Up and running in a minute.')}</h2>
          {/* Full visual composition (transparent asset) — no cards/containers, keeps aspect ratio, never cropped */}
          <div className="mt-10 sm:mt-14 flex justify-center">
            <img
              src="/images/how-it-works.png"
              alt={t('Create your account, fund your wallet and trade live markets')}
              data-testid="how-it-works-composition"
              className="w-full max-w-2xl h-auto object-contain select-none"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className={`py-24 px-4 sm:px-6 border-t ${T.borderT}`}>
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">{t('Simple, transparent pricing.')}</h2>
          <p className={`text-center mt-3 ${T.faint}`}>{t('No commission. No monthly fees. No surprises.')}</p>
          <div className="grid md:grid-cols-3 gap-4 mt-14">
            {[
              { v: '1–2 pips', l: t('Spread per trade'), d: t('From 1 pip. The only cost you pay, applied transparently to bid and ask.') },
              { v: '$0', l: t('Commission'), d: t('Zero commission on all markets, deposits and account maintenance.') },
              { v: '1:100', l: t('Max leverage'), d: t('Up to 1:100 on forex, 1:50 indices, 1:20 metals, 1:10 crypto and stocks.') },
            ].map((p) => (
              <div key={p.l} className={`rounded-2xl border p-8 text-center ${T.greenCard}`}>
                <div className={`text-4xl font-extrabold ${GREEN}`}>{p.v}</div>
                <div className="font-semibold mt-2">{p.l}</div>
                <p className={`text-sm mt-3 leading-relaxed ${T.fainter}`}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={`py-24 px-4 sm:px-6 border-t ${T.borderT}`}>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">{t('Frequently asked questions.')}</h2>
          <div className="mt-12 space-y-3" data-testid="faq-list">
            {FAQS.map((f, i) => (
              <div key={i} className={`rounded-2xl border overflow-hidden ${T.card}`}>
                <button
                  data-testid={`faq-q-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className={`w-full flex items-center justify-between px-6 py-5 text-left font-medium transition ${T.rowHover}`}
                >
                  <span>{t(f.q)}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 ml-4 transition-transform ${T.faint} ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className={`px-6 pb-5 text-sm leading-relaxed ${T.sub}`}>{t(f.a)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6">
        <div className={`mx-auto max-w-3xl text-center rounded-3xl border p-14 ${T.greenCard}`}>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('Your edge starts here.')}</h2>
          <p className={`mt-3 ${T.faint}`}>{t('Open an account in under a minute.')}</p>
          <button onClick={() => openAuth('register')} className="mt-8 inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-8 py-3.5 rounded-full hover:bg-[#00e65c] transition">
            {t('Create free account')} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={`border-t py-14 px-4 sm:px-6 ${T.borderT}`}>
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div>
              <div className="font-extrabold tracking-tight text-lg">RAW<span className={GREEN}>MARKETS</span></div>
              <p className={`text-xs mt-4 leading-relaxed ${T.fainter}`}>{t('Premium online broker for crypto, forex, metals, indices and stocks. Live data, instant execution, real-time PnL.')}</p>
              <div className="flex items-center gap-3 mt-5">
                <a href="https://wa.me/410778059868" target="_blank" rel="noopener noreferrer" data-testid="footer-whatsapp" className={`text-xs font-semibold border rounded-full px-3.5 py-1.5 transition ${light ? 'border-[#00b34a]/40 text-[#00b34a] hover:bg-[#00b34a]/10' : 'border-[#00FF66]/30 text-[#00FF66] hover:bg-[#00FF66]/10'}`}>WhatsApp</a>
                <a href="https://www.instagram.com/rawmarkets.global?igsi=MW40dGt6Z3hwbDk4&utm_source=qr" target="_blank" rel="noopener noreferrer" data-testid="footer-instagram" className={`text-xs font-semibold border rounded-full px-3.5 py-1.5 transition ${light ? 'border-black/15 text-gray-600 hover:bg-black/5' : 'border-white/15 text-white/60 hover:bg-white/5'}`}>Instagram</a>
              </div>
            </div>
            <div>
              <div className={`text-xs uppercase tracking-widest mb-4 ${T.fainter}`}>{t('Product')}</div>
              <div className={`space-y-2.5 text-sm ${T.sub}`}>
                <a href="#markets" className="block hover:opacity-70 transition">{t('Markets')}</a>
                <a href="/leverage" className="block hover:opacity-70 transition">{t('Leverage')}</a>
                <a href="#pricing" className="block hover:opacity-70 transition">{t('Pricing')}</a>
              </div>
            </div>
            <div>
              <div className={`text-xs uppercase tracking-widest mb-4 ${T.fainter}`}>{t('Company')}</div>
              <div className={`space-y-2.5 text-sm ${T.sub}`}>
                <a href="/about" className="block hover:opacity-70 transition">{t('About us')}</a>
                <a href="/contact" className="block hover:opacity-70 transition">{t('Contact us')}</a>
                <a href="#faq" className="block hover:opacity-70 transition">FAQ</a>
                <button onClick={() => openAuth('register')} className="block hover:opacity-70 transition">{t('Open account')}</button>
              </div>
            </div>
            <div>
              <div className={`text-xs uppercase tracking-widest mb-4 ${T.fainter}`}>{t('Legal')}</div>
              <div className={`space-y-2.5 text-sm ${T.sub}`}>
                <span className="block">{t('Terms of service')}</span>
                <span className="block">{t('Privacy policy')}</span>
                <span className="block">{t('Risk disclosure')}</span>
              </div>
            </div>
          </div>
          <div className={`mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm ${T.borderT} ${T.fainter}`}>
            <span>© 2025 RAWMarkets. {t('All rights reserved.')}</span>
            <span>{t('Trading involves risk. Not financial advice.')}</span>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAuthOpen(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-8 shadow-2xl ${light ? 'border-black/10 bg-white' : 'border-white/10 bg-[#0a0a0a]'}`} data-testid="auth-modal">
            <button onClick={() => setAuthOpen(false)} className={`absolute top-4 right-4 ${T.faint}`} data-testid="auth-close-btn">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
              <span className="font-bold">RAW<span className={GREEN}>MARKETS</span></span>
            </div>
            <div className={`flex rounded-lg p-1 mb-6 ${light ? 'bg-black/5' : 'bg-white/5'}`}>
              <button data-testid="auth-tab-login" onClick={() => { setMode('login'); setError('') }} className={`flex-1 py-2 text-sm rounded-md font-medium transition ${mode === 'login' ? 'bg-[#00FF66] text-black' : T.faint}`}>{t('Sign in')}</button>
              <button data-testid="auth-tab-register" onClick={() => { setMode('register'); setError('') }} className={`flex-1 py-2 text-sm rounded-md font-medium transition ${mode === 'register' ? 'bg-[#00FF66] text-black' : T.faint}`}>{t('Create account')}</button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <input data-testid="auth-firstname-input" required placeholder={t('First name')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} />
                  <input data-testid="auth-lastname-input" required placeholder={t('Last name')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} />
                </div>
              )}
              <input data-testid="auth-email-input" required type="email" placeholder={t('Email address')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
              <input data-testid="auth-password-input" required type="password" placeholder={t('Password (min. 6 characters)')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
              {error && <div data-testid="auth-error" className={`text-sm ${RED}`}>{error}</div>}
              <button data-testid="auth-submit-btn" disabled={busy} type="submit" className="w-full bg-[#00FF66] text-black font-semibold py-3 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50">
                {busy ? t('Please wait…') : mode === 'login' ? t('Sign in') : t('Create account')}
              </button>
            </form>
            <p className={`text-xs mt-4 text-center ${T.fainter}`}>{t('New accounts start at $0. Fund your wallet with crypto to start trading.')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
