'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtPrice, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { ShieldCheck, LogOut, Users, ArrowUpFromLine, ArrowDownToLine, LineChart, Settings, LayoutDashboard, Search, Check, X, CandlestickChart, FileCheck, Eye } from 'lucide-react'

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'deposits', label: 'Deposits', icon: ArrowDownToLine },
  { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { key: 'verification', label: 'Verification', icon: FileCheck },
  { key: 'positions', label: 'Positions', icon: LineChart },
  { key: 'settings', label: 'Settings', icon: Settings },
]

const App = () => {
  const router = useRouter()
  const { light } = useTheme()
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
  const [documents, setDocuments] = useState([])
  const [docFilter, setDocFilter] = useState('pending')
  const [previewDoc, setPreviewDoc] = useState(null)
  const [positions, setPositions] = useState([])
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState(false)

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const T = {
    page: light ? 'bg-[#f5f6f5] text-gray-900' : 'bg-black text-white',
    header: light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/80',
    border: light ? 'border-black/5' : 'border-white/5',
    border10: light ? 'border-black/10' : 'border-white/10',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/5 bg-white/[0.02]',
    sub: light ? 'text-gray-500' : 'text-white/40',
    faint: light ? 'text-gray-400' : 'text-white/35',
    fainter: light ? 'text-gray-400' : 'text-white/30',
    faintest: light ? 'text-gray-300' : 'text-white/25',
    icon: light ? 'text-gray-500 hover:text-gray-900' : 'text-white/50 hover:text-white',
    input: light ? 'bg-black/[0.03] border-black/10 focus:border-[#00b34a]/60' : 'bg-white/5 border-white/10 focus:border-[#00FF66]/50',
    tableHead: light ? 'text-gray-400 bg-black/[0.03]' : 'text-white/30 bg-white/[0.02]',
    rowHover: light ? 'hover:bg-black/[0.02]' : 'hover:bg-white/[0.02]',
    modal: light ? 'border-black/10 bg-white' : 'border-white/10 bg-[#0a0a0a]',
    cardSoft: light ? 'bg-black/[0.03] border-black/5' : 'bg-white/[0.03] border-white/5',
    chip: light ? 'text-gray-500 bg-black/5 hover:text-gray-900' : 'text-white/40 bg-white/5 hover:text-white',
    outlineBtn: light ? 'border-black/15 hover:bg-black/5' : 'border-white/15 hover:bg-white/5',
    badgeNeutral: light ? 'bg-black/5 text-gray-500' : 'bg-white/10 text-white/50',
  }

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
  const loadTransactions = useCallback(async (type, filter) => {
    try {
      const qs = filter === 'pending' ? `?type=${type}&status=pending` : `?type=${type}`
      const r = await api.get(`/admin/transactions${qs}`)
      setTransactions(r.data.transactions)
    } catch (e) {}
  }, [])
  const loadDocuments = useCallback(async (filter) => {
    try {
      const r = await api.get(`/admin/documents${filter === 'pending' ? '?status=pending' : ''}`)
      setDocuments(r.data.documents)
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
    if (tab === 'deposits') loadTransactions('deposit', txFilter)
    if (tab === 'withdrawals') loadTransactions('withdrawal', txFilter)
    if (tab === 'verification') loadDocuments(docFilter)
    if (tab === 'positions') loadPositions()
    if (tab === 'settings') loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, txFilter, docFilter])

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

  const processTx = async (id, action, type) => {
    setBusy(true)
    try {
      await api.post(`/admin/transactions/${id}/${action}`)
      toast.success(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} ${action === 'approve' ? 'approved' : 'rejected'}`)
      loadTransactions(type, txFilter)
      loadStats()
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const processDoc = async (id, action) => {
    setBusy(true)
    try {
      await api.post(`/admin/documents/${id}/${action}`)
      toast.success(`Document ${action === 'approve' ? 'approved' : 'rejected'}`)
      setPreviewDoc(null)
      loadDocuments(docFilter)
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const openPreview = async (doc) => {
    try {
      const r = await api.get(`/admin/documents/${doc.id}/file`)
      setPreviewDoc(r.data.document)
    } catch (e) {
      toast.error('Could not load file')
    }
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.put('/admin/settings', { spreadPips: settings.spreadPips, tradingEnabled: settings.tradingEnabled })
      setSettings(r.data.settings)
      toast.success('Platform settings saved')
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const statusBadge = (s) => ({
    completed: light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]',
    approved: light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]',
    verified: light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]',
    pending: 'bg-yellow-400/15 text-yellow-500',
    waiting_payment: 'bg-blue-400/15 text-blue-500',
    rejected: light ? 'bg-[#e11d48]/10 text-[#e11d48]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]',
    failed: light ? 'bg-[#e11d48]/10 text-[#e11d48]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]',
    unverified: T.badgeNeutral,
  }[s] || T.badgeNeutral)

  if (!me) {
    return <div className={`min-h-screen flex items-center justify-center text-sm ${light ? 'bg-[#f5f6f5] text-gray-400' : 'bg-black text-white/30'}`}>Verifying admin access…</div>
  }

  const txTable = (type) => (
    <div className={`rounded-2xl border overflow-x-auto ${T.border}`}>
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className={`text-left text-xs ${T.tableHead}`}>
            <th className="px-5 py-3 font-medium">User</th>
            <th className="px-5 py-3 font-medium text-right">Amount</th>
            <th className="px-5 py-3 font-medium">{type === 'deposit' ? 'Crypto' : 'Wallet address'}</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium text-right">Created</th>
            <th className="px-5 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody data-testid={`admin-${type}s-table`}>
          {transactions.map((tx) => (
            <tr key={tx.id} className={`border-t ${T.border}`}>
              <td className="px-5 py-3">
                <div className="font-medium">{tx.user?.name || '—'}</div>
                <div className={`text-xs ${T.faint}`}>{tx.user?.email}</div>
              </td>
              <td className="px-5 py-3 text-right font-mono">{fmtMoney(tx.amount)}</td>
              <td className="px-5 py-3">
                {type === 'deposit' ? (
                  <div className="text-xs">
                    <span className="font-mono">{tx.payAmount ? `${tx.payAmount} ` : ''}{(tx.payCurrency || '').toUpperCase()}</span>
                    {tx.payAddress && <div className={`font-mono text-[10px] mt-0.5 ${T.fainter}`}>{tx.payAddress.slice(0, 18)}…</div>}
                  </div>
                ) : (
                  <div className="text-xs font-mono">
                    {tx.walletAddress ? `${tx.walletAddress.slice(0, 18)}…` : '—'}
                    {tx.network && <span className={`ml-1.5 ${T.sub}`}>({tx.network})</span>}
                  </div>
                )}
              </td>
              <td className="px-5 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusBadge(tx.status)}`}>{tx.status.replace('_', ' ')}</span>
              </td>
              <td className={`px-5 py-3 text-right text-xs ${T.sub}`}>{new Date(tx.createdAt).toLocaleString()}</td>
              <td className="px-5 py-3 text-right">
                {['pending', 'waiting_payment'].includes(tx.status) ? (
                  <div className="flex justify-end gap-2">
                    <button data-testid={`approve-${tx.id}`} disabled={busy} onClick={() => processTx(tx.id, 'approve', type)} className="inline-flex items-center gap-1 text-xs font-semibold bg-[#00FF66] text-black px-3 py-1.5 rounded-md hover:bg-[#00e65c] transition disabled:opacity-40">
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button data-testid={`reject-${tx.id}`} disabled={busy} onClick={() => processTx(tx.id, 'reject', type)} className="inline-flex items-center gap-1 text-xs font-semibold border border-[#ff3b5c]/40 text-[#e11d48] px-3 py-1.5 rounded-md hover:bg-[#ff3b5c]/10 transition disabled:opacity-40">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs ${T.faintest}`}>{tx.processedAt ? new Date(tx.processedAt).toLocaleString() : ''}</span>
                )}
              </td>
            </tr>
          ))}
          {transactions.length === 0 && <tr><td colSpan={6} className={`px-5 py-10 text-center ${T.faintest}`}>No {txFilter === 'pending' ? 'pending ' : ''}{type}s.</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className={`min-h-screen ${T.page}`}>
      <Toaster position="top-right" theme={light ? 'light' : 'dark'} richColors />

      {/* HEADER */}
      <header className={`h-14 border-b flex items-center justify-between px-4 sticky top-0 backdrop-blur-xl z-30 ${T.header}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">RAW<span className={GREEN}>MARKETS</span></span>
          </div>
          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/10 text-[#00FF66]'}`}>
            <ShieldCheck className="h-3 w-3" /> Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button data-testid="admin-terminal-btn" onClick={() => router.push('/terminal')} className={`flex items-center gap-1.5 text-xs font-semibold border px-3.5 py-2 rounded-full transition ${T.outlineBtn}`}>
            <CandlestickChart className="h-3.5 w-3.5" /> Terminal
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className={`p-2 transition ${T.icon}`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className={`border-b px-4 flex gap-1 overflow-x-auto ${T.border}`}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            data-testid={`admin-tab-${tb.key}`}
            onClick={() => { setTab(tb.key); setTxFilter('pending') }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === tb.key ? (light ? 'border-[#00b34a] text-gray-900' : 'border-[#00FF66] text-white') : (light ? 'border-transparent text-gray-400 hover:text-gray-900' : 'border-transparent text-white/40 hover:text-white')}`}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
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
                { label: 'Pending deposits', value: stats ? stats.pendingDeposits : '—', accent: stats?.pendingDeposits > 0, testid: 'stat-pending-deposits' },
                { label: 'Awaiting payment', value: stats ? stats.awaitingPaymentDeposits : '—' },
                { label: 'Pending documents', value: stats ? stats.pendingDocuments : '—', accent: stats?.pendingDocuments > 0, testid: 'stat-pending-docs' },
                { label: 'Total deposited', value: stats ? fmtMoney(stats.totalDeposited) : '—' },
                { label: 'Total withdrawn', value: stats ? fmtMoney(stats.totalWithdrawn) : '—' },
              ].map((c) => (
                <div key={c.label} className={`rounded-2xl border p-5 ${c.accent ? 'border-yellow-400/30 bg-yellow-400/[0.06]' : T.card}`}>
                  <div className={`text-[10px] uppercase tracking-widest ${T.fainter}`}>{c.label}</div>
                  <div data-testid={c.testid} className={`text-xl font-mono font-semibold mt-2 ${c.accent ? 'text-yellow-500' : ''}`}>{c.value}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-6">
              {stats?.pendingDeposits > 0 && (
                <button onClick={() => setTab('deposits')} className="text-sm text-yellow-500 hover:underline">→ {stats.pendingDeposits} deposit(s) awaiting approval</button>
              )}
              {stats?.pendingWithdrawals > 0 && (
                <button onClick={() => setTab('withdrawals')} className="text-sm text-yellow-500 hover:underline">→ {stats.pendingWithdrawals} withdrawal(s) awaiting review</button>
              )}
              {stats?.pendingDocuments > 0 && (
                <button onClick={() => setTab('verification')} className="text-sm text-yellow-500 hover:underline">→ {stats.pendingDocuments} document(s) awaiting verification</button>
              )}
            </div>
          </div>
        )}

        {/* ===== USERS ===== */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h1 className="text-xl font-bold">Users</h1>
              <div className="relative">
                <Search className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 ${T.fainter}`} />
                <input
                  data-testid="admin-user-search"
                  placeholder="Search name or email…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); loadUsers(e.target.value) }}
                  className={`rounded-lg border pl-9 pr-4 py-2.5 text-sm w-72 focus:outline-none ${T.input}`}
                />
              </div>
            </div>
            <div className={`rounded-2xl border overflow-x-auto ${T.border}`}>
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className={`text-left text-xs ${T.tableHead}`}>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">KYC</th>
                    <th className="px-5 py-3 font-medium text-right">Balance</th>
                    <th className="px-5 py-3 font-medium text-right">Joined</th>
                    <th className="px-5 py-3 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody data-testid="admin-users-table">
                  {users.map((u) => (
                    <tr key={u.id} className={`border-t ${T.border} ${T.rowHover}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium">{u.name}</div>
                        <div className={`text-xs ${T.faint}`}>{u.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${u.role === 'admin' ? (light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]') : T.badgeNeutral}`}>{u.role}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusBadge(u.verificationStatus || 'unverified')}`}>{u.verificationStatus || 'unverified'}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{fmtMoney(u.balance || 0)}</td>
                      <td className={`px-5 py-3 text-right text-xs ${T.sub}`}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <button data-testid={`admin-manage-${u.email}`} onClick={() => { setSelectedUser(u); setAdjustAmount(''); setAdjustNote('') }} className={`text-xs font-semibold border px-3 py-1.5 rounded-md transition ${light ? 'border-black/15 hover:border-[#00b34a]/50 hover:text-[#00b34a]' : 'border-white/15 hover:border-[#00FF66]/50 hover:text-[#00FF66]'}`}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={6} className={`px-5 py-10 text-center ${T.faintest}`}>No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== DEPOSITS ===== */}
        {tab === 'deposits' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h1 className="text-xl font-bold">Deposit approvals</h1>
              <div className="flex gap-1">
                {[{ k: 'pending', l: 'Pending' }, { k: 'all', l: 'All' }].map((f) => (
                  <button key={f.k} data-testid={`dep-filter-${f.k}`} onClick={() => setTxFilter(f.k)} className={`px-4 py-1.5 text-xs rounded-full font-medium transition ${txFilter === f.k ? 'bg-[#00FF66] text-black' : T.chip}`}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
            <p className={`text-xs mb-4 ${T.faint}`}>Deposits become <span className="text-yellow-500">pending</span> once the crypto payment is confirmed on-chain. Approving credits the user's balance. <span className="text-blue-500">Awaiting payment</span> means the user has not paid yet — approving manually credits the balance anyway.</p>
            {txTable('deposit')}
          </div>
        )}

        {/* ===== WITHDRAWALS ===== */}
        {tab === 'withdrawals' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h1 className="text-xl font-bold">Withdrawal requests</h1>
              <div className="flex gap-1">
                {[{ k: 'pending', l: 'Pending' }, { k: 'all', l: 'All' }].map((f) => (
                  <button key={f.k} data-testid={`wd-filter-${f.k}`} onClick={() => setTxFilter(f.k)} className={`px-4 py-1.5 text-xs rounded-full font-medium transition ${txFilter === f.k ? 'bg-[#00FF66] text-black' : T.chip}`}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
            {txTable('withdrawal')}
          </div>
        )}

        {/* ===== VERIFICATION ===== */}
        {tab === 'verification' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h1 className="text-xl font-bold">Account verification</h1>
              <div className="flex gap-1">
                {[{ k: 'pending', l: 'Pending' }, { k: 'all', l: 'All' }].map((f) => (
                  <button key={f.k} data-testid={`doc-filter-${f.k}`} onClick={() => setDocFilter(f.k)} className={`px-4 py-1.5 text-xs rounded-full font-medium transition ${docFilter === f.k ? 'bg-[#00FF66] text-black' : T.chip}`}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
            <p className={`text-xs mb-4 ${T.faint}`}>Users are marked <span className={GREEN}>verified</span> once both an identity document and a proof of address are approved.</p>
            <div className={`rounded-2xl border overflow-x-auto ${T.border}`}>
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className={`text-left text-xs ${T.tableHead}`}>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Submitted</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody data-testid="admin-documents-table">
                  {documents.map((doc) => (
                    <tr key={doc.id} className={`border-t ${T.border}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium">{doc.user?.name || '—'}</div>
                        <div className={`text-xs ${T.faint}`}>{doc.user?.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${T.badgeNeutral}`}>{doc.type === 'identity' ? 'Identity' : 'Address'}</span>
                      </td>
                      <td className={`px-5 py-3 text-xs max-w-[180px] truncate ${T.sub}`}>{doc.fileName}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusBadge(doc.status)}`}>{doc.status}</span>
                      </td>
                      <td className={`px-5 py-3 text-right text-xs ${T.sub}`}>{new Date(doc.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button data-testid={`view-doc-${doc.id}`} disabled={busy} onClick={() => openPreview(doc)} className={`inline-flex items-center gap-1 text-xs font-semibold border px-3 py-1.5 rounded-md transition disabled:opacity-40 ${light ? 'border-black/15 hover:border-black/40' : 'border-white/15 hover:border-white/40'}`}>
                            <Eye className="h-3 w-3" /> View
                          </button>
                          {doc.status === 'pending' && (
                            <>
                              <button data-testid={`approve-doc-${doc.id}`} disabled={busy} onClick={() => processDoc(doc.id, 'approve')} className="inline-flex items-center gap-1 text-xs font-semibold bg-[#00FF66] text-black px-3 py-1.5 rounded-md hover:bg-[#00e65c] transition disabled:opacity-40">
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button data-testid={`reject-doc-${doc.id}`} disabled={busy} onClick={() => processDoc(doc.id, 'reject')} className="inline-flex items-center gap-1 text-xs font-semibold border border-[#ff3b5c]/40 text-[#e11d48] px-3 py-1.5 rounded-md hover:bg-[#ff3b5c]/10 transition disabled:opacity-40">
                                <X className="h-3 w-3" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && <tr><td colSpan={6} className={`px-5 py-10 text-center ${T.faintest}`}>No {docFilter === 'pending' ? 'pending ' : ''}documents.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== POSITIONS ===== */}
        {tab === 'positions' && (
          <div>
            <h1 className="text-xl font-bold mb-5">Open positions ({positions.length})</h1>
            <div className={`rounded-2xl border overflow-x-auto ${T.border}`}>
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className={`text-left text-xs ${T.tableHead}`}>
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
                    <tr key={p.id} className={`border-t ${T.border}`}>
                      <td className="px-5 py-3"><div className="text-xs">{p.user?.email || p.userId}</div></td>
                      <td className="px-5 py-3 font-semibold">{p.symbol}</td>
                      <td className="px-5 py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${p.side === 'buy' ? (light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]') : (light ? 'bg-[#e11d48]/10 text-[#e11d48]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]')}`}>{p.side}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{p.lots}</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtPrice(p.entryPrice, 2)}</td>
                      <td className="px-5 py-3 text-right font-mono">{p.leverage}x</td>
                      <td className="px-5 py-3 text-right font-mono">{fmtMoney(p.margin)}</td>
                      <td className={`px-5 py-3 text-right text-xs ${T.sub}`}>{new Date(p.openedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {positions.length === 0 && <tr><td colSpan={8} className={`px-5 py-10 text-center ${T.faintest}`}>No open positions on the platform.</td></tr>}
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
              <form onSubmit={saveSettings} className={`rounded-2xl border p-6 space-y-5 ${T.card}`}>
                <div>
                  <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Base spread (pips) — actual spread varies between 1x and 2x this value</label>
                  <input
                    data-testid="settings-spread-input"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={settings.spreadPips}
                    onChange={(e) => setSettings({ ...settings, spreadPips: Number(e.target.value) })}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-mono focus:outline-none ${T.input}`}
                  />
                </div>
                <div>
                  <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Maximum leverage per category (fixed rules)</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Object.entries(settings.categoryLeverage || { forex: 100, index: 50, metal: 20, crypto: 10, stock: 10 }).map(([cat, lev]) => (
                      <div key={cat} className={`rounded-md border py-2 text-center ${T.border10}`}>
                        <div className={`text-[9px] uppercase tracking-wider ${T.fainter}`}>{cat}</div>
                        <div className={`text-xs font-mono ${GREEN}`}>1:{lev}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${T.border10}`}>
                  <div>
                    <div className="text-sm font-medium">Trading enabled</div>
                    <div className={`text-[11px] ${T.fainter}`}>When disabled, all new orders are rejected platform-wide.</div>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-trading-toggle"
                    onClick={() => setSettings({ ...settings, tradingEnabled: !settings.tradingEnabled })}
                    className={`relative h-6 w-11 rounded-full transition ${settings.tradingEnabled ? 'bg-[#00FF66]' : (light ? 'bg-black/15' : 'bg-white/15')}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${light ? 'bg-white shadow' : 'bg-black'} ${settings.tradingEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                <button data-testid="settings-save-btn" disabled={busy} type="submit" className="w-full bg-[#00FF66] text-black font-semibold py-3 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
                  Save settings
                </button>
              </form>
            ) : (
              <div className={`text-sm ${T.fainter}`}>Loading settings…</div>
            )}
          </div>
        )}
      </main>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setPreviewDoc(null)} />
          <div data-testid="doc-preview-modal" className={`relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto ${T.modal}`}>
            <button onClick={() => setPreviewDoc(null)} className={`absolute top-4 right-4 ${T.icon}`} data-testid="doc-preview-close">
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-bold text-sm">{previewDoc.type === 'identity' ? 'Identity document' : 'Proof of address'}</h2>
            <p className={`text-xs mt-0.5 ${T.faint}`}>{previewDoc.fileName}</p>
            <div className={`mt-4 rounded-xl overflow-hidden border ${light ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-black'}`}>
              {previewDoc.mimeType === 'application/pdf' ? (
                <iframe title="document" src={`data:application/pdf;base64,${previewDoc.data}`} className="w-full h-[60vh]" />
              ) : (
                <img src={`data:${previewDoc.mimeType};base64,${previewDoc.data}`} alt="document" className="w-full object-contain max-h-[60vh]" />
              )}
            </div>
            {previewDoc.status === 'pending' && (
              <div className="flex gap-3 mt-5">
                <button data-testid="preview-approve-btn" disabled={busy} onClick={() => processDoc(previewDoc.id, 'approve')} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold bg-[#00FF66] text-black py-3 rounded-xl hover:bg-[#00e65c] transition disabled:opacity-40">
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button data-testid="preview-reject-btn" disabled={busy} onClick={() => processDoc(previewDoc.id, 'reject')} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold border border-[#ff3b5c]/40 text-[#e11d48] py-3 rounded-xl hover:bg-[#ff3b5c]/10 transition disabled:opacity-40">
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANAGE USER MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-7 shadow-2xl ${T.modal}`} data-testid="admin-user-modal">
            <button onClick={() => setSelectedUser(null)} className={`absolute top-4 right-4 ${T.icon}`} data-testid="user-modal-close">
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-bold">{selectedUser.name}</h2>
            <p className={`text-xs ${T.faint}`}>{selectedUser.email}</p>
            <div className={`mt-4 rounded-lg border p-4 ${T.cardSoft}`}>
              <div className={`text-[10px] uppercase tracking-widest ${T.fainter}`}>Current balance</div>
              <div data-testid="modal-user-balance" className="text-2xl font-mono font-semibold mt-1">{fmtMoney(selectedUser.balance || 0)}</div>
            </div>
            <form onSubmit={adjustBalance} className="mt-5 space-y-3">
              <div>
                <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Adjustment amount (negative to debit)</label>
                <input
                  data-testid="adjust-amount-input"
                  type="number"
                  step="any"
                  placeholder="e.g. 500 or -200"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-sm font-mono focus:outline-none ${T.input}`}
                />
              </div>
              <div>
                <label className={`text-[11px] block mb-1.5 ${T.sub}`}>Note (optional)</label>
                <input
                  data-testid="adjust-note-input"
                  placeholder="Reason for adjustment"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none ${T.input}`}
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
