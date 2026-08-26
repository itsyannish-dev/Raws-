'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader, SiteFooter } from '@/components/site-header'
import { useLang } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { ArrowRight, Eye, Zap, ShieldCheck } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const T = {
    page: light ? 'bg-[#f7f8f7] text-gray-900' : 'bg-black text-white',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/5 bg-white/[0.02]',
    faint: light ? 'text-gray-500' : 'text-white/45',
    fainter: light ? 'text-gray-400' : 'text-white/35',
  }

  return (
    <div className={`min-h-screen ${T.page}`}>
      <SiteHeader />
      <main className="pt-28 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{t('About RAWMarkets')}</h1>
            <p className={`mt-5 text-lg leading-relaxed ${T.faint}`}>
              {t('We built RAWMarkets because trading should feel effortless. One clean terminal, live global markets, transparent pricing — and nothing in the way.')}
            </p>
            <div className="mt-8 flex items-center gap-10">
              {[{ v: '45+', l: t('Markets') }, { v: '1–2 pips', l: t('Spread per trade') }, { v: '24/7', l: t('Crypto trading') }].map((s) => (
                <div key={s.l}>
                  <div className={`text-2xl font-extrabold ${GREEN}`}>{s.v}</div>
                  <div className={`text-xs mt-0.5 ${T.fainter}`}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-20 text-center">{t('What we stand for')}</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              { icon: Eye, title: t('Transparency'), desc: t('One clear cost — a 1–2 pip spread. No commissions, no hidden fees.') },
              { icon: Zap, title: t('Speed'), desc: t('Live prices and instant execution, engineered into every screen.') },
              { icon: ShieldCheck, title: t('Security'), desc: t('KYC-verified accounts and manually reviewed withdrawals.') },
            ].map((v) => (
              <div key={v.title} className={`rounded-2xl border p-7 text-center ${T.card}`}>
                <v.icon className={`h-7 w-7 mx-auto mb-4 ${GREEN}`} />
                <h3 className="font-bold">{v.title}</h3>
                <p className={`text-sm mt-2 leading-relaxed ${T.fainter}`}>{v.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <button onClick={() => router.push('/?join=1')} className="inline-flex items-center gap-2 bg-[#00FF66] text-black font-semibold px-8 py-3.5 rounded-full hover:bg-[#00e65c] transition">
              {t('Create free account')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
