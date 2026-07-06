'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, logout } from '@/lib/rm'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { Toaster, toast } from 'sonner'
import { Menu, LogOut, User, KeyRound, ShieldCheck } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

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
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" theme="dark" richColors />

      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sticky top-0 bg-black/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className="p-1.5 -ml-1.5 text-white/70 hover:text-white transition">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </div>
        </div>
        <button data-testid="logout-btn" onClick={() => logout(router)} className="p-2 text-white/50 hover:text-white transition">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Manage your account and security.</p>

        {/* PROFILE */}
        <form onSubmit={saveProfile} className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-[#00FF66]" />
            <h2 className="font-semibold">Profile</h2>
          </div>
          <label className="text-[11px] text-white/40 block mb-1.5">Full name</label>
          <input
            data-testid="settings-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[#00FF66]/50"
          />
          <label className="text-[11px] text-white/40 block mb-1.5 mt-4">Email</label>
          <input
            data-testid="settings-email-input"
            value={user?.email || ''}
            disabled
            className="w-full rounded-lg bg-white/[0.02] border border-white/5 px-4 py-3 text-sm text-white/40 cursor-not-allowed"
          />
          <button data-testid="settings-save-profile-btn" disabled={busy} type="submit" className="mt-5 bg-[#00FF66] text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
            Save changes
          </button>
        </form>

        {/* PASSWORD */}
        <form onSubmit={changePassword} className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-[#00FF66]" />
            <h2 className="font-semibold">Change password</h2>
          </div>
          <label className="text-[11px] text-white/40 block mb-1.5">Current password</label>
          <input
            data-testid="settings-current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[#00FF66]/50"
          />
          <label className="text-[11px] text-white/40 block mb-1.5 mt-4">New password (min. 6 characters)</label>
          <input
            data-testid="settings-new-password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[#00FF66]/50"
          />
          <button data-testid="settings-change-password-btn" disabled={busy} type="submit" className="mt-5 border border-white/15 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-white/5 transition disabled:opacity-50 text-sm">
            Update password
          </button>
        </form>

        {/* ACCOUNT INFO */}
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-[#00FF66]" />
            <h2 className="font-semibold">Account</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/35">Member since</span><span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span></div>
            <div className="flex justify-between"><span className="text-white/35">Account type</span><span className="capitalize">{user?.role || '—'}</span></div>
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
