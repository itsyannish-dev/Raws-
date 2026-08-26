'use client'

import React from 'react'
import { SiteHeader, SiteFooter } from '@/components/site-header'
import { useLang } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { MessageCircle, Instagram, ArrowUpRight } from 'lucide-react'

const App = () => {
  const { t } = useLang()
  const { light } = useTheme()

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const T = {
    page: light ? 'bg-[#f7f8f7] text-gray-900' : 'bg-black text-white',
    card: light ? 'border-black/5 bg-white shadow-sm hover:border-[#00b34a]/40' : 'border-white/5 bg-white/[0.02] hover:border-[#00FF66]/30',
    faint: light ? 'text-gray-500' : 'text-white/45',
    fainter: light ? 'text-gray-400' : 'text-white/35',
  }

  return (
    <div className={`min-h-screen ${T.page}`}>
      <SiteHeader />
      <main className="pt-28 pb-24 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{t('Contact us')}</h1>
          <p className={`mt-4 text-lg ${T.faint}`}>{t("We're here to help. Reach us on WhatsApp or Instagram — we usually reply within minutes.")}</p>

          <div className="grid sm:grid-cols-2 gap-5 mt-12 text-left">
            <a
              href="https://wa.me/410778059868"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="contact-whatsapp"
              className={`group rounded-3xl border p-7 transition ${T.card}`}
            >
              <div className="h-12 w-12 rounded-2xl bg-[#25D366]/15 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-[#25D366]" />
              </div>
              <h2 className="font-bold mt-5 flex items-center gap-1.5">WhatsApp <ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" /></h2>
              <p className={`text-sm mt-1.5 ${T.fainter}`}>{t('Chat with us on WhatsApp')}</p>
              <div className={`font-mono text-sm mt-4 ${GREEN}`}>+41 077 805 98 68</div>
              <div className={`mt-5 inline-flex text-xs font-semibold border rounded-full px-4 py-2 transition ${light ? 'border-black/15 group-hover:border-[#00b34a]/50' : 'border-white/15 group-hover:border-[#00FF66]/50'}`}>
                {t('Open WhatsApp')}
              </div>
            </a>

            <a
              href="https://www.instagram.com/rawmarkets.global?igsi=MW40dGt6Z3hwbDk4&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="contact-instagram"
              className={`group rounded-3xl border p-7 transition ${T.card}`}
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#f58529]/20 via-[#dd2a7b]/20 to-[#8134af]/20 flex items-center justify-center">
                <Instagram className="h-6 w-6 text-[#dd2a7b]" />
              </div>
              <h2 className="font-bold mt-5 flex items-center gap-1.5">Instagram <ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" /></h2>
              <p className={`text-sm mt-1.5 ${T.fainter}`}>{t('Follow us on Instagram')}</p>
              <div className={`font-mono text-sm mt-4 ${GREEN}`}>@rawmarkets.global</div>
              <div className={`mt-5 inline-flex text-xs font-semibold border rounded-full px-4 py-2 transition ${light ? 'border-black/15 group-hover:border-[#00b34a]/50' : 'border-white/15 group-hover:border-[#00FF66]/50'}`}>
                {t('Open Instagram')}
              </div>
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
