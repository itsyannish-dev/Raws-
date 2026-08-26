'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, logout } from '@/lib/rm'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { Toaster, toast } from 'sonner'
import { useLang, LangToggle } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { Menu, LogOut, User, KeyRound, ShieldCheck } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
  const [user, setUser] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const T = {
    page: light ? 'bg-[#f5f6f5] text-gray-900' : 'bg-black text-white',
    header: light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/80',
    icon: light ? 'text-gray-600 hover:text-gray-900' : 'text-white/70 hover:text-white',
    iconFaint: light ? 'text-gray-400 hover:text-gray-900' : 'text-white/50 hover:text-white',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/5 bg-white/[0.02]',
    sub: light ? 'text-gray-500' : 'text-white/40',
    faint: light ? 'text-gray-400' : 'text-white/35',
    input: light ? 'bg-black/[0.03] border-black/10 focus:border-[#00b34a]/60' : 'bg-white/5 border-white/10 focus:border-[#00FF66]/50',
    inputDisabled: light ? 'bg-black/[0.02] border-black/5 text-gray-400' : 'bg-white/[0.02] border-white/5 text-white/40',
    outlineBtn: light ? 'border-black/15 text-gray-800 hover:bg-black/5' : 'border-white/15 text-white hover:bg-white/5',
  }

  useEffect(() => {
    if (!localStorage.getItem('rm_token')) { router.replace('/'); return }
    const load = async () => {
      try {
        const r = await api.get('/auth/me')
        setUser(r.data.user)
        setName(r.data.user.name)
      } catch (e) {
        localStorage.removeItem('rm_token')
        router.replace('/')
      }
    }
    load()
  }, [router])

  const saveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name cannot be empty'); return }
    setBusy(true)
    try {
      const r = await api.patch('/auth/profile', { name: name.trim() })
      setUser(r.data.user)
      toast.success('Profile updated')
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Password change failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`min-h-screen ${T.page}`}>
      <Toaster position="top-right" theme={light ? 'light' : 'dark'} richColors />

      <header className={`h-14 border-b flex items-center justify-between px-4 sticky top-0 backdrop-blur-xl z-30 ${T.header}`}>
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className={`p-1.5 -ml-1.5 transition ${T.icon}`}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">RAW<span className={GREEN}>MARKETS</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangToggle className="hidden sm:flex" />
          <button data-testid="logout-btn" onClick={() => logout(router)} className={`p-2 transition ${T.iconFaint}`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className={`text-sm mt-1 ${T.sub}`}>Manage your account and security.</p>

        {/* PROFILE */}
        <form onSubmit={saveProfile} className={`mt-8 rounded-2xl border p-6 ${T.card}`}>
          <div className="flex items-center gap-2 mb-4">
            <User className={`h-4 w-4 ${GREEN}`} />
            <h2 className="font-semibold">Profile</h2>
          </div>
          <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Full name</label>
          <input
            data-testid="settings-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none ${T.input}`}
          />
          <label className={`text-[11px] block mb-1.5 mt-4 ${T.sub}`}>Email</label>
          <input
            data-testid="settings-email-input"
            value={user?.email || ''}
            disabled
            className={`w-full rounded-lg border px-4 py-3 text-sm cursor-not-allowed ${T.inputDisabled}`}
          />
          <button data-testid="settings-save-profile-btn" disabled={busy} type="submit" className="mt-5 bg-[#00FF66] text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
            Save changes
          </button>
        </form>

        {/* PASSWORD */}
        <form onSubmit={changePassword} className={`mt-4 rounded-2xl border p-6 ${T.card}`}>
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className={`h-4 w-4 ${GREEN}`} />
            <h2 className="font-semibold">Change password</h2>
          </div>
          <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Current password</label>
          <input
            data-testid="settings-current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none ${T.input}`}
          />
          <label className={`text-[11px] block mb-1.5 mt-4 ${T.sub}`}>New password (min. 6 characters)</label>
          <input
            data-testid="settings-new-password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none ${T.input}`}
          />
          <button data-testid="settings-change-password-btn" disabled={busy} type="submit" className={`mt-5 border font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-50 text-sm ${T.outlineBtn}`}>
            Update password
          </button>
        </form>

        {/* ACCOUNT INFO */}
        <div className={`mt-4 rounded-2xl border p-6 ${T.card}`}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className={`h-4 w-4 ${GREEN}`} />
            <h2 className="font-semibold">Account</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className={T.faint}>Member since</span><span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span></div>
            <div className="flex justify-between"><span className={T.faint}>Account type</span><span className="capitalize">{user?.role || '—'}</span></div>
          </div>
          <button data-testid="settings-signout-btn" onClick={() => logout(router)} className="mt-5 w-full border border-[#ff3b5c]/30 text-[#ff3b5c] font-semibold py-2.5 rounded-lg hover:bg-[#ff3b5c]/10 transition text-sm">
            Sign out
          </button>
        </div>
      </main>

      <BottomNav active="" />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
