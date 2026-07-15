'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtSignedMoney, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, LogOut, Wallet, Menu, TrendingUp, Scale, PiggyBank, SlidersHorizontal, Clock } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [meRes, acctRes, txRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/account/summary'),
        api.get('/transactions'),
      ])
      setUser(meRes.data.user)
      setAccount(acctRes.data.account)
      setTransactions(txRes.data.transactions)
    } catch (e) {
      localStorage.removeItem('rm_token')
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    if (!localStorage.getItem('rm_token')) { router.replace('/'); return }
    refresh()
    const t = setInterval(refresh, 20000)
    // deep-link: /dashboard?action=deposit|withdraw
    try {
      const action = new URLSearchParams(window.location.search).get('action')
      if (action === 'deposit' || action === 'withdraw') {
        setTimeout(() => {
          const el = document.querySelector(`[data-testid="${action}-amount-input"]`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
          }
        }, 500)
      }
    } catch (e) {}
    return () => clearInterval(t)
  }, [refresh, router])

  const deposit = async (e) => {
    e.preventDefault()
    const amt = Number(depositAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setBusy(true)
    try {
      await api.post('/transactions/deposit', { amount: amt })
      toast.success(`Deposited ${fmtMoney(amt)} — funds available instantly`)
      setDepositAmount('')
      refresh()
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Deposit failed')
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (e) => {
    e.preventDefault()
    const amt = Number(withdrawAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setBusy(true)
    try {
      await api.post('/transactions/withdraw', { amount: amt })
      toast.success(`Withdrawal request for ${fmtMoney(amt)} submitted for review`)
      setWithdrawAmount('')
      refresh()
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Withdrawal failed')
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

  const txMeta = (tx) => {
    if (tx.type === 'deposit') return { icon: ArrowDownToLine, iconCls: 'bg-[#00FF66]/10 text-[#00FF66]', label: 'Deposit', sub: 'Instant demo deposit', sign: '+', amtCls: 'text-[#00FF66]' }
    if (tx.type === 'withdrawal') {
      const refunded = tx.status === 'rejected'
      return { icon: ArrowUpFromLine, iconCls: 'bg-white/5 text-white/70', label: 'Withdrawal', sub: refunded ? 'Rejected — funds refunded' : 'Bank withdrawal', sign: '-', amtCls: refunded ? 'text-white/40 line-through' : 'text-white' }
    }
    // adjustment
    const credit = tx.direction !== 'debit'
    return { icon: SlidersHorizontal, iconCls: 'bg-blue-400/10 text-blue-400', label: 'Balance adjustment', sub: tx.note || 'Adjusted by RAWMarkets team', sign: credit ? '+' : '-', amtCls: credit ? 'text-[#00FF66]' : 'text-white' }
  }

  const pnlUp = (account?.floatingPnl || 0) >= 0

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" theme="dark" richColors />

      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sticky top-0 bg-black/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <button data-testid="hamburger-btn" onClick={() => setDrawerOpen(true)} className="p-1.5 -ml-1.5 text-white/70 hover:text-white transition">
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => router.push('/home')} className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
            <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="terminal-nav-btn" onClick={() => router.push('/terminal')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <CandlestickChart className="h-3.5 w-3.5" /> Terminal
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className="p-2 text-white/50 hover:text-white transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-white/40 text-sm mt-1">{user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Loading…'}</p>
          </div>
        </div>

        {/* BALANCE HERO CARD */}
        <div className="mt-6 rounded-3xl border border-[#00FF66]/15 bg-gradient-to-br from-[#00FF66]/[0.08] via-transparent to-transparent p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#00FF66]/[0.06] blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40">
            <Wallet className="h-3.5 w-3.5 text-[#00FF66]" /> Total balance
          </div>
          <div data-testid="card-balance" className="text-4xl sm:text-5xl font-mono font-bold mt-3 tracking-tight">
            {account ? fmtMoney(account.balance) : '—'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
            {[
              { icon: Scale, label: 'Equity', value: account ? fmtMoney(account.equity) : '—', testid: 'card-equity' },
              { icon: TrendingUp, label: 'Floating PnL', value: account ? fmtSignedMoney(account.floatingPnl) : '—', color: pnlUp ? 'text-[#00FF66]' : 'text-[#ff3b5c]', testid: 'card-pnl' },
              { icon: PiggyBank, label: 'Free margin', value: account ? fmtMoney(account.freeMargin) : '—', testid: 'card-free-margin' },
              { icon: CandlestickChart, label: 'Open positions', value: account ? account.openPositions : '—', testid: 'card-open-positions' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-black/40 border border-white/5 backdrop-blur px-4 py-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/35">
                  <c.icon className="h-3 w-3" /> {c.label}
                </div>
                <div data-testid={c.testid} className={`text-base sm:text-lg font-mono font-semibold mt-1 ${c.color || ''}`}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* DEPOSIT / WITHDRAW */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <form onSubmit={deposit} className="rounded-3xl border border-[#00FF66]/15 bg-[#00FF66]/[0.03] p-6 sm:p-7">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-2xl bg-[#00FF66]/10 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5 text-[#00FF66]" />
              </div>
              <div>
                <h2 className="font-semibold">Deposit</h2>
                <p className="text-[11px] text-white/35">Credited instantly to your balance.</p>
              </div>
            </div>
            <input
              data-testid="deposit-amount-input"
              type="number"
              min="1"
              step="any"
              placeholder="Amount (USD)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full mt-5 rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 text-base font-mono focus:outline-none focus:border-[#00FF66]/50"
            />
            <div className="flex gap-2 mt-3">
              {[100, 1000, 10000].map((v) => (
                <button type="button" key={v} onClick={() => setDepositAmount(String(v))} className="flex-1 text-xs py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-[#00FF66]/40 transition font-mono">
                  ${v.toLocaleString()}
                </button>
              ))}
            </div>
            <button data-testid="deposit-submit-btn" disabled={busy} type="submit" className="w-full mt-5 bg-[#00FF66] text-black font-semibold py-3.5 rounded-xl hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
              Deposit funds
            </button>
          </form>

          <form onSubmit={withdraw} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5 text-white/70" />
              </div>
              <div>
                <h2 className="font-semibold">Withdraw</h2>
                <p className="text-[11px] text-white/35">Reviewed by our team, typically within 24h.</p>
              </div>
            </div>
            <input
              data-testid="withdraw-amount-input"
              type="number"
              min="1"
              step="any"
              placeholder="Amount (USD)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full mt-5 rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 text-base font-mono focus:outline-none focus:border-white/30"
            />
            <div className="flex items-center justify-between mt-3 text-[11px] text-white/35 px-1">
              <span>Available to withdraw</span>
              <span className="font-mono text-white/60">{account ? fmtMoney(Math.max(0, Math.min(account.freeMargin, account.balance))) : '—'}</span>
            </div>
            <button data-testid="withdraw-submit-btn" disabled={busy} type="submit" className="w-full mt-5 border border-white/15 text-white font-semibold py-3.5 rounded-xl hover:bg-white/5 transition disabled:opacity-50 text-sm">
              Request withdrawal
            </button>
          </form>
        </div>

        {/* TRANSACTIONS */}
        <div className="mt-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#00FF66]" /> Transaction history
          </h2>
          <div className="mt-4 rounded-3xl border border-white/5 overflow-hidden divide-y divide-white/5" data-testid="transactions-table">
            {transactions.map((tx) => {
              const m = txMeta(tx)
              return (
                <div key={tx.id} className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center ${m.iconCls}`}>
                      <m.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                        {m.label}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusBadge(tx.status)}`}>{tx.status}</span>
                      </div>
                      <div className="text-[11px] text-white/35 truncate">{m.sub}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`font-mono text-sm font-semibold ${m.amtCls}`}>{m.sign}{fmtMoney(tx.amount)}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              )
            })}
            {transactions.length === 0 && (
              <div className="px-6 py-12 text-center text-white/25 text-sm">No transactions yet. Make your first deposit above.</div>
            )}
          </div>
        </div>
      </main>

      <BottomNav active="wallet" />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
