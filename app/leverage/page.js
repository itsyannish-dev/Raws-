'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader, SiteFooter } from '@/components/site-header'
import { useLang } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { ArrowRight, Scale } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const T = {
    page: light ? 'bg-[#f7f8f7] text-gray-900' : 'bg-black text-white',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/5 bg-white/[0.02]',
    faint: light ? 'text-gray-500' : 'text-white/40',
    fainter: light ? 'text-gray-400' : 'text-white/35',
    note: light ? 'border-[#00b34a]/20 bg-[#00b34a]/[0.05]' : 'border-[#00FF66]/15 bg-[#00FF66]/[0.04]',
  }

  const CATEGORIES = [
    { label: t('Forex'), sub: t('Major pairs and crosses'), lev: '1:100', pct: 100 },
    { label: t('Indices'), sub: t('S&P 500, Nasdaq, Dow'), lev: '1:50', pct: 50 },
    { label: t('Metals'), sub: t('Gold and silver'), lev: '1:20', pct: 20 },
    { label: t('Crypto'), sub: t('BTC, ETH and more, 24/7'), lev: '1:10', pct: 10 },
    { label: t('Stocks'), sub: t('Top US companies'), lev: '1:10', pct: 10 },
  ]

  return (
    <div className={`min-h-screen ${T.page}`}>
      <SiteHeader />
      <main className="pt-28 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <Scale className={`h-4 w-4 ${GREEN}`} />
            <span className={GREEN}>{t('Leverage')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-3">{t('Maximum leverage per category')}</h1>
          <p className={`mt-3 text-lg ${T.faint}`}>{t('Trade more. Power your potential.')}</p>

          <div className="grid md:grid-cols-2 gap-10 items-center mt-12">
            <div>
              <img src="/images/leverage.png" alt="Maximum leverage per category" className="rounded-3xl w-full shadow-2xl border border-black/10" loading="lazy" />
            </div>
            <div className="space-y-3" data-testid="leverage-categories">
              {CATEGORIES.map((c) => (
                <div key={c.label} className={`rounded-2xl border px-5 py-4 ${T.card}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{c.label}</div>
                      <div className={`text-xs ${T.fainter}`}>{c.sub}</div>
                    </div>
                    <div className={`text-2xl font-extrabold font-mono ${GREEN}`}>{c.lev}</div>
                  </div>
                  <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${light ? 'bg-black/5' : 'bg-white/5'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-[#00FF66] to-[#00c94f]" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-12 rounded-2xl border p-6 sm:p-8 ${T.note}`}>
            <h2 className="font-bold text-lg">{t('Leverage that adapts to risk')}</h2>
            <p className={`text-sm mt-2 leading-relaxed ${T.faint}`}>{t('Every asset class has its own maximum leverage, engineered to match its volatility.')}</p>
            <p className={`text-sm mt-2 leading-relaxed ${T.faint}`}>{t('Margin required = notional value ÷ leverage. Higher leverage means less margin locked per trade — and higher risk.')}</p>
            <button onClick={() => router.push('/?join=1')} className="mt-6 inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-7 py-3 rounded-full hover:bg-[#00e65c] transition text-sm">
              {t('Start trading')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
