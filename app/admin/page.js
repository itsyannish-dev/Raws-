'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtPrice, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { ShieldCheck, LogOut, Users, ArrowUpFromLine, LineChart, Settings, LayoutDashboard, Search, Check, X, CandlestickChart } from 'lucide-react'

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { key: 'positions', label: 'Positions', icon: LineChart },
  { key: 'settings', label: 'Settings', icon: Settings },
]

const App = () => {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [transactions, setTransactions] = useState([])
  const [txFilter, setTxFilter] = useState('pending')
  const [positions, setPositions] = useState([])
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState(false)

  // ---------- auth guard ----------
  useEffect(() => {
    if (!localStorage.getItem('rm_token')) { router.replace('/'); return }
    const init = async () => {
      try {
        const r = await api.get('/auth/me')
        if (r.data.user.role !== 'admin') {
          toast.error('Admin access required')
          router.replace('/home')
          return
        }
        setMe(r.data.user)
      } catch (e) {
        localStorage.removeItem('rm_token')
        router.replace('/')
      }
    }
    init()
  }, [router])

  // ---------- data loaders ----------
  const loadStats = useCallback(async () => {
    try { const r = await api.get('/admin/stats'); setStats(r.data.stats) } catch (e) {}
  }, [])
  const loadUsers = useCallback(async (q = '') => {
    try { const r = await api.get(`/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`); setUsers(r.data.users) } catch (e) {}
  }, [])
  const loadTransactions = useCallback(async (filter) => {
    try {
      const qs = filter === 'pending' ? '?type=withdrawal&status=pending' : '?type=withdrawal'
      const r = await api.get(`/admin/transactions${qs}`)
      setTransactions(r.data.transactions)
    } catch (e) {}
  }, [])
  const loadPositions = useCallback(async () => {
    try { const r = await api.get('/admin/positions?status=open'); setPositions(r.data.positions) } catch (e) {}
  }, [])
  const loadSettings = useCallback(async () => {
    try { const r = await api.get('/admin/settings'); setSettings(r.data.settings) } catch (e) {}
  }, [])

  useEffect(() => {
    if (!me) return
    if (tab === 'overview') loadStats()
    if (tab === 'users') loadUsers(search)
    if (tab === 'withdrawals') loadTransactions(txFilter)
    if (tab === 'positions') loadPositions()
    if (tab === 'settings') loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, txFilter])

  // ---------- actions ----------
  const adjustBalance = async (e) => {
    e.preventDefault()
    const amt = Number(adjustAmount)
    if (!amt || !isFinite(amt)) { toast.error('Enter a valid amount (use negative to debit)'); return }
    setBusy(true)
    try {
      const r = await api.post(`/admin/users/${selectedUser.id}/adjust-balance`, { amount: amt, note: adjustNote })
      toast.success(`Balance ${amt > 0 ? 'credited' : 'debited'}: ${fmtMoney(Math.abs(amt))}`)
      setSelectedUser(r.data.user)
      setAdjustAmount('')
      setAdjustNote('')
      loadUsers(search)
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Adjustment failed')
    } finally {
      setBusy(false)
    }
  }

  const processTx = async (id, action) => {
    setBusy(true)
    try {
      await api.post(`/admin/transactions/${id}/${action}`)
      toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected (funds refunded)'}`)
      loadTransactions(txFilter)
      loadStats()
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.put('/admin/settings', settings)
      setSettings(r.data.settings)
      toast.success('Platform settings saved')
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const statusBadge = (s) => ({
    completed: 'bg-[#00FF66]/15 text-[#00FF66]',
    pending: 'bg-yellow-400/15 text-yellow-400',
    approved: 'bg-[#00FF66]/15 text-[#00FF66]',
    rejected: 'bg-[#ff3b5c]/15 text-[#ff3b5c]',
  }[s] || 'bg-white/10 text-white/50')

  if (!me) {
    return <div className="min-h-screen bg-black text-white/30 flex items-center justify-center text-sm">Verifying admin access…</div>
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" theme="dark" richColors />

      {/* HEADER */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sticky top-0 bg-black/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-[#00FF66]/10 text-[#00FF66] px-2.5 py-1 rounded-full">
            <ShieldCheck className="h-3 w-3" /> Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="admin-terminal-btn" onClick={() => router.push('/terminal')} className="flex items-center gap-1.5 text-xs font-semibold border border-white/15 px-3.5 py-2 rounded-full hover:bg-white/5 transition">
            <CandlestickChart className="h-3.5 w-3.5" /> Terminal
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className="p-2 text-white/50 hover:text-white transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="border-b border-white/5 px-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={`admin-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === t.key ? 'border-[#00FF66] text-white' : 'border-transparent text-white/40 hover:text-white'}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && (
          <div>
            <h1 className="text-xl font-bold mb-6">Platform overview</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="admin-stats">
              {[
                { label: 'Total users', value: stats ? stats.totalUsers : '—', testid: 'stat-users' },
                { label: 'Total balances', value: stats ? fmtMoney(stats.totalBalance) : '—', testid: 'stat-balance' },
                { label: 'Open positions', value: stats ? stats.openPositions : '—', testid: 'stat-positions' },
                { label: 'Pending withdrawals', value: stats ? stats.pendingWithdrawals : '—', accent: stats?.pendingWithdrawals > 0, testid: 'stat-pending' },
                { label: 'Pending amount', value: stats ? fmtMoney(stats.pendingWithdrawalAmount) : '—' },
                { label: 'Total deposited', value: stats ? fmtMoney(stats.totalDeposited) : '—' },
                { label: 'Total withdrawn', value: stats ? fmtMoney(stats.totalWithdrawn) : '—' },
              ].map((c) => (
                <div key={c.label} className={`rounded-2xl border p-5 ${c.accent ? 'border-yellow-400/30 bg-yellow-400/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}>
                  <div className="text-[10px] uppercase tracking-widest text-white/30">{c.label}</div>
                  <div data-testid={c.testid} className={`text-xl font-mono font-semibold mt-2 ${c.accent ? 'text-yellow-400' : ''}`}>{c.value}</div>
                </div>
              ))}
            </div>
            {stats?.pendingWithdrawals > 0 && (
              <button onClick={() => setTab('withdrawals')} className="mt-6 text-sm text-yellow-400 hover:underline">
                → {stats.pendingWithdrawals} withdrawal{stats.pendingWithdrawals > 1 ? 's' : ''} awaiting review
              </button>
            )}
          </div>
        )}

        {/* ===== USERS ===== */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h1 className="text-xl font-bold">Users</h1>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  data-testid="admin-user-search"
                  placeholder="Search name or email…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); loadUsers(e.target.value) }}
                  className="rounded-lg bg-white/5 border border-white/10 pl-9 pr-4 py-2.5 text-sm w-72 focus:outline-none focus:border-[#00FF66]/50"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-white/30 text-xs bg-white/[0.02]">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium text-right">Balance</th>
                    <th className="px-5 py-3 font-medium text-right">Joined</th>
                    <th className="px-5 py-3 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody data-testid="admin-users-table">
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-white/35">{u.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${u.role === 'admin' ? 'bg-[#00FF66]/15 text-[#00FF66]' : 'bg-white/10 text-white/50'}`}>{u.role}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{fmtMoney(u.balance || 0)}</td>
                      <td className="px-5 py-3 text-right text-white/40 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <button data-testid={`admin-manage-${u.email}`} onClick={() => { setSelectedUser(u); setAdjustAmount(''); setAdjustNote('') }} className="text-xs font-semibold border border-white/15 px-3 py-1.5 rounded-md hover:border-[#00FF66]/50 hover:text-[#00FF66] transition">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-white/25">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== WITHDRAWALS ===== */}
        {tab === 'withdrawals' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h1 className="text-xl font-bold">Withdrawal requests</h1>
              <div className="flex gap-1">
                {[{ k: 'pending', l: 'Pending' }, { k: 'all', l: 'All' }].map((f) => (
                  <button key={f.k} data-testid={`wd-filter-${f.k}`} onClick={() => setTxFilter(f.k)} className={`px-4 py-1.5 text-xs rounded-full font-medium transition ${txFilter === f.k ? 'bg-[#00FF66] text-black' : 'text-white/40 hover:text-white bg-white/5'}`}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-white/30 text-xs bg-white/[0.02]">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium text-right">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Requested</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody data-testid="admin-withdrawals-table">
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="px-5 py-3">
                        <div className="font-medium">{t.user?.name || '—'}</div>
                        <div className="text-xs text-white/35">{t.user?.email}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{fmtMoney(t.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusBadge(t.status)}`}>{t.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-white/40 text-xs">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right">
                        {t.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button data-testid={`approve-${t.id}`} disabled={busy} onClick={() => processTx(t.id, 'approve')} className="inline-flex items-center gap-1 text-xs font-semibold bg-[#00FF66] text-black px-3 py-1.5 rounded-md hover:bg-[#00e65c] transition disabled:opacity-40">
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button data-testid={`reject-${t.id}`} disabled={busy} onClick={() => processTx(t.id, 'reject')} className="inline-flex items-center gap-1 text-xs font-semibold border border-[#ff3b5c]/40 text-[#ff3b5c] px-3 py-1.5 rounded-md hover:bg-[#ff3b5c]/10 transition disabled:opacity-40">
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-white/25">{t.processedAt ? new Date(t.processedAt).toLocaleString() : ''}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-white/25">No {txFilter === 'pending' ? 'pending ' : ''}withdrawal requests.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== POSITIONS ===== */}
        {tab === 'positions' && (
          <div>
            <h1 className="text-xl font-bold mb-5">Open positions ({positions.length})</h1>
            <div className="rounded-2xl border border-white/5 overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-white/30 text-xs bg-white/[0.02]">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Symbol</th>
                    <th className="px-5 py-3 font-medium">Side</th>
                    <th className="px-5 py-3 font-medium text-right">Lots</th>
                    <th className="px-5 py-3 font-medium text-right">Entry</th>
                    <th className="px-5 py-3 font-medium text-right">Leverage</th>
                    <th className="px-5 py-3 font-medium text-right">Margin</th>
                    <th className="px-5 py-3 font-medium text-right">Opened</th>
                  </tr>
                </thead>
                <tbody data-testid="admin-positions-table">
                  {positions.map((p) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="px-5 py-3">
                        <div className="text-xs">{p.user?.email || p.userId}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold">{p.symbol}</td>
                      <td className="px-5 py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${p.side === 'buy' ? 'bg-[#00FF66]/15 text-[#00FF66]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]'}`}>{p.side}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{p.lots}</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtPrice(p.entryPrice, 2)}</td>
                      <td className="px-5 py-3 text-right font-mono">{p.leverage}x</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtMoney(p.margin)}</td>
                      <td className="px-5 py-3 text-right text-white/40 text-xs">{new Date(p.openedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {positions.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-white/25">No open positions on the platform.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== SETTINGS ===== */}
        {tab === 'settings' && (
          <div className="max-w-lg">
            <h1 className="text-xl font-bold mb-5">Platform settings</h1>
            {settings ? (
              <form onSubmit={saveSettings} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-5">
                <div>
                  <label className="text-[11px] text-white/40 block mb-1.5">Spread (%) — applied to bid/ask on every trade</label>
                  <input
                    data-testid="settings-spread-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="2"
                    value={(settings.spread * 100).toFixed(2)}
                    onChange={(e) => setSettings({ ...settings, spread: Number(e.target.value) / 100 })}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#00FF66]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/40 block mb-1.5">Maximum leverage</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2, 5, 10, 20, 50, 100].map((l) => (
                      <button type="button" key={l} data-testid={`settings-maxlev-${l}`} onClick={() => setSettings({ ...settings, maxLeverage: l })} className={`text-xs py-2 rounded-md border font-mono transition ${settings.maxLeverage === l ? 'border-[#00FF66]/60 bg-[#00FF66]/10 text-[#00FF66]' : 'border-white/10 text-white/40 hover:text-white'}`}>
                        {l}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">Trading enabled</div>
                    <div className="text-[11px] text-white/35">When disabled, all new orders are rejected platform-wide.</div>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-trading-toggle"
                    onClick={() => setSettings({ ...settings, tradingEnabled: !settings.tradingEnabled })}
                    className={`relative h-6 w-11 rounded-full transition ${settings.tradingEnabled ? 'bg-[#00FF66]' : 'bg-white/15'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${settings.tradingEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                <button data-testid="settings-save-btn" disabled={busy} type="submit" className="w-full bg-[#00FF66] text-black font-semibold py-3 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
                  Save settings
                </button>
              </form>
            ) : (
              <div className="text-white/30 text-sm">Loading settings…</div>
            )}
          </div>
        )}
      </main>

      {/* MANAGE USER MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-7 shadow-2xl" data-testid="admin-user-modal">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-white/40 hover:text-white" data-testid="user-modal-close">
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-bold">{selectedUser.name}</h2>
            <p className="text-xs text-white/35">{selectedUser.email}</p>
            <div className="mt-4 rounded-lg bg-white/[0.03] border border-white/5 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30">Current balance</div>
              <div data-testid="modal-user-balance" className="text-2xl font-mono font-semibold mt-1">{fmtMoney(selectedUser.balance || 0)}</div>
            </div>
            <form onSubmit={adjustBalance} className="mt-5 space-y-3">
              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">Adjustment amount (negative to debit)</label>
                <input
                  data-testid="adjust-amount-input"
                  type="number"
                  step="any"
                  placeholder="e.g. 500 or -200"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#00FF66]/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">Note (optional)</label>
                <input
                  data-testid="adjust-note-input"
                  placeholder="Reason for adjustment"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[#00FF66]/50"
                />
              </div>
              <button data-testid="adjust-submit-btn" disabled={busy} type="submit" className="w-full bg-[#00FF66] text-black font-semibold py-3 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
                Apply adjustment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
