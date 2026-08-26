'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { useLang, LangToggle } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { Menu, LogOut, CandlestickChart, ShieldCheck, Clock, XCircle, FileCheck, IdCard, HomeIcon, Upload, FileText } from 'lucide-react'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
  const [docs, setDocs] = useState([])
  const [verification, setVerification] = useState('unverified')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [uploading, setUploading] = useState('')
  const idInputRef = useRef(null)
  const addrInputRef = useRef(null)

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const T = {
    page: light ? 'bg-[#f5f6f5] text-gray-900' : 'bg-black text-white',
    header: light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/80',
    icon: light ? 'text-gray-600 hover:text-gray-900' : 'text-white/70 hover:text-white',
    iconFaint: light ? 'text-gray-400 hover:text-gray-900' : 'text-white/50 hover:text-white',
    sub: light ? 'text-gray-500' : 'text-white/40',
    faint: light ? 'text-gray-400' : 'text-white/35',
    fainter: light ? 'text-gray-400' : 'text-white/30',
    faintest: light ? 'text-gray-300' : 'text-white/25',
    card: light ? 'border-black/10 bg-white shadow-sm' : 'border-white/10 bg-white/[0.02]',
    fileBox: light ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.03] border-white/5',
  }

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/documents')
      setDocs(r.data.documents)
      setVerification(r.data.verificationStatus)
    } catch (e) {
      localStorage.removeItem('rm_token')
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    if (!localStorage.getItem('rm_token')) { router.replace('/'); return }
    refresh()
  }, [refresh, router])

  const handleFile = async (type, file) => {
    if (!file) return
    if (file.size > MAX_SIZE) { toast.error(t('Max 5MB — PNG, JPG, WEBP or PDF')); return }
    if (!ALLOWED.includes(file.type)) { toast.error(t('Max 5MB — PNG, JPG, WEBP or PDF')); return }
    setUploading(type)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = reject
        fr.readAsDataURL(file)
      })
      const base64 = String(dataUrl).split(',')[1]
      await api.post('/documents', { type, fileName: file.name, mimeType: file.type, data: base64 })
      toast.success(t('Document submitted for review'))
      refresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed')
    } finally {
      setUploading('')
    }
  }

  const statusBadge = (s) => ({
    approved: 'bg-[#00FF66]/15 text-[#00b34a]',
    pending: 'bg-yellow-400/15 text-yellow-500',
    rejected: 'bg-[#ff3b5c]/15 text-[#e11d48]',
  }[s] || (light ? 'bg-black/5 text-gray-500' : 'bg-white/10 text-white/50'))

  const banner = {
    verified: { icon: ShieldCheck, cls: 'border-[#00FF66]/25 bg-[#00FF66]/[0.06] text-[#00b34a]', label: t('Verified'), note: t('Your account is fully verified.') },
    pending: { icon: Clock, cls: 'border-yellow-400/25 bg-yellow-400/[0.06] text-yellow-500', label: t('Pending review'), note: t('Your documents are being reviewed by our team.') },
    rejected: { icon: XCircle, cls: 'border-[#ff3b5c]/25 bg-[#ff3b5c]/[0.06] text-[#e11d48]', label: t('Rejected'), note: t('A document was rejected. Please upload a new one.') },
    unverified: { icon: FileCheck, cls: light ? 'border-black/10 bg-black/[0.02] text-gray-600' : 'border-white/10 bg-white/[0.02] text-white/60', label: t('Unverified'), note: t('Submit both documents below to verify your account.') },
  }[verification] || { icon: FileCheck, cls: light ? 'border-black/10 bg-black/[0.02] text-gray-600' : 'border-white/10 bg-white/[0.02] text-white/60', label: verification, note: '' }

  const docOf = (type) => docs.find((doc) => doc.type === type)

  const CARDS = [
    { type: 'identity', icon: IdCard, title: t('Identity document'), desc: t('Passport, national ID card or driving licence (photo or PDF).'), inputRef: idInputRef },
    { type: 'address', icon: HomeIcon, title: t('Proof of address'), desc: t('Utility bill or bank statement issued in the last 3 months.'), inputRef: addrInputRef },
  ]

  return (
    <div className={`min-h-screen ${T.page}`}>
      <Toaster position="top-right" theme={light ? 'light' : 'dark'} richColors />

      <header className={`h-14 border-b flex items-center justify-between px-4 sticky top-0 backdrop-blur-xl z-30 ${T.header}`}>
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className={`p-1.5 -ml-1.5 transition ${T.icon}`}>
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => router.push('/home')} className="flex items-center gap-2">
            <span className="font-bold text-sm">RAW<span className={GREEN}>MARKETS</span></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangToggle className="hidden sm:flex" />
          <button data-testid="terminal-nav-btn" onClick={() => router.push('/terminal')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <CandlestickChart className="h-3.5 w-3.5" /> Terminal
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className={`p-2 transition ${T.iconFaint}`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        <h1 className="text-2xl font-bold">{t('Documents')}</h1>
        <p className={`text-sm mt-1 ${T.sub}`}>{t('Account verification')}</p>

        {/* STATUS BANNER */}
        <div data-testid="verification-banner" className={`mt-6 rounded-2xl border p-5 flex items-center gap-4 ${banner.cls}`}>
          <banner.icon className="h-7 w-7 shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('Account verification')}: <span data-testid="verification-status">{banner.label}</span></div>
            <div className="text-xs opacity-80 mt-0.5">{banner.note}</div>
          </div>
        </div>
        <p className={`text-[11px] mt-3 px-1 ${T.faint}`}>{t('You can deposit and trade before completing verification.')}</p>

        {/* UPLOAD CARDS */}
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          {CARDS.map((c) => {
            const doc = docOf(c.type)
            return (
              <div key={c.type} data-testid={`doc-card-${c.type}`} className={`rounded-3xl border p-6 flex flex-col ${T.card}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${light ? 'bg-[#00b34a]/10' : 'bg-[#00FF66]/10'}`}>
                    <c.icon className={`h-5 w-5 ${GREEN}`} />
                  </div>
                  <h2 className="font-semibold text-sm">{c.title}</h2>
                </div>
                <p className={`text-[11px] mt-3 leading-relaxed flex-1 ${T.faint}`}>{c.desc}</p>

                {doc && (
                  <div className={`mt-4 rounded-xl border px-3.5 py-3 flex items-center gap-2.5 ${T.fileBox}`}>
                    <FileText className={`h-4 w-4 shrink-0 ${T.sub}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate">{doc.fileName}</div>
                      <div className={`text-[10px] ${T.fainter}`}>{new Date(doc.createdAt).toLocaleString()}</div>
                    </div>
                    <span data-testid={`doc-status-${c.type}`} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${statusBadge(doc.status)}`}>
                      {t(doc.status === 'pending' ? 'pending' : doc.status)}
                    </span>
                  </div>
                )}

                {doc?.status !== 'approved' && (
                  <>
                    <input
                      ref={c.inputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.pdf"
                      className="hidden"
                      data-testid={`doc-input-${c.type}`}
                      onChange={(e) => { handleFile(c.type, e.target.files?.[0]); e.target.value = '' }}
                    />
                    <button
                      data-testid={`doc-upload-${c.type}`}
                      disabled={uploading === c.type}
                      onClick={() => c.inputRef.current?.click()}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-[#00FF66] text-black font-semibold py-3 rounded-xl hover:bg-[#00e65c] transition disabled:opacity-50 text-sm"
                    >
                      <Upload className="h-4 w-4" /> {uploading === c.type ? '…' : doc ? t('Replace') : t('Upload')}
                    </button>
                    <p className={`text-[10px] mt-2 text-center ${T.faintest}`}>{t('Max 5MB — PNG, JPG, WEBP or PDF')}</p>
                  </>
                )}
                {doc?.status === 'approved' && (
                  <div className={`mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold py-3 ${GREEN}`}>
                    <ShieldCheck className="h-4 w-4" /> {t('approved')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      <BottomNav active="" />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
