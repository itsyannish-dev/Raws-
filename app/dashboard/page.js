'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtSignedMoney, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, LogOut, Wallet } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [busy, setBusy] = useState(false)

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

  const statusBadge = (s) => {
    const map = {
      completed: 'bg-[#00FF66]/15 text-[#00FF66]',
      pending: 'bg-yellow-400/15 text-yellow-400',
      approved: 'bg-[#00FF66]/15 text-[#00FF66]',
      rejected: 'bg-[#ff3b5c]/15 text-[#ff3b5c]',
    }
    return map[s] || 'bg-white/10 text-white/50'
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" theme="dark" richColors />

      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sticky top-0 bg-black/80 backdrop-blur-xl z-10">
        <button onClick={() => router.push('/')} className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-[#00FF66] flex items-center justify-center"><span className="text-black font-extrabold text-xs">R</span></div>
          <span className="font-bold text-sm">RAW<span className="text-[#00FF66]">MARKETS</span></span>
        </button>
        <div className="flex items-center gap-2">
          <button data-testid="terminal-nav-btn" onClick={() => router.push('/terminal')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <CandlestickChart className="h-3.5 w-3.5" /> Terminal
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className="p-2 text-white/50 hover:text-white transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-white/40 text-sm mt-1">{user ? `Welcome back, ${user.name}` : 'Loading…'}</p>

        {/* SUMMARY CARDS */}
        <div className="grid md:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Balance', value: account ? fmtMoney(account.balance) : '—', testid: 'card-balance' },
            { label: 'Equity', value: account ? fmtMoney(account.equity) : '—', testid: 'card-equity' },
            { label: 'Floating PnL', value: account ? fmtSignedMoney(account.floatingPnl) : '—', color: account?.floatingPnl >= 0 ? 'text-[#00FF66]' : 'text-[#ff3b5c]', testid: 'card-pnl' },
            { label: 'Free margin', value: account ? fmtMoney(account.freeMargin) : '—', testid: 'card-free-margin' },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="text-[11px] uppercase tracking-widest text-white/30">{c.label}</div>
              <div data-testid={c.testid} className={`text-2xl font-mono font-semibold mt-2 ${c.color || ''}`}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* DEPOSIT / WITHDRAW */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <form onSubmit={deposit} className="rounded-2xl border border-[#00FF66]/15 bg-[#00FF66]/[0.03] p-6">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownToLine className="h-4 w-4 text-[#00FF66]" />
              <h2 className="font-semibold">Deposit</h2>
            </div>
            <p className="text-[11px] text-white/35 mb-4">Demo deposits are credited instantly.</p>
            <input
              data-testid="deposit-amount-input"
              type="number"
              min="1"
              step="any"
              placeholder="Amount (USD)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#00FF66]/50"
            />
            <div className="flex gap-2 mt-3">
              {[100, 1000, 10000].map((v) => (
                <button type="button" key={v} onClick={() => setDepositAmount(String(v))} className="flex-1 text-xs py-1.5 rounded-md border border-white/10 text-white/50 hover:text-white hover:border-[#00FF66]/40 transition font-mono">
                  ${v.toLocaleString()}
                </button>
              ))}
            </div>
            <button data-testid="deposit-submit-btn" disabled={busy} type="submit" className="w-full mt-4 bg-[#00FF66] text-black font-semibold py-3 rounded-lg hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
              Deposit funds
            </button>
          </form>

          <form onSubmit={withdraw} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpFromLine className="h-4 w-4 text-white/60" />
              <h2 className="font-semibold">Withdraw</h2>
            </div>
            <p className="text-[11px] text-white/35 mb-4">Withdrawals are reviewed by our team (pending approval).</p>
            <input
              data-testid="withdraw-amount-input"
              type="number"
              min="1"
              step="any"
              placeholder="Amount (USD)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono focus:outline-none focus:border-white/30"
            />
            <button data-testid="withdraw-submit-btn" disabled={busy} type="submit" className="w-full mt-4 border border-white/15 text-white font-semibold py-3 rounded-lg hover:bg-white/5 transition disabled:opacity-50 text-sm">
              Request withdrawal
            </button>
          </form>
        </div>

        {/* TRANSACTIONS */}
        <div className="mt-10">
          <h2 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-[#00FF66]" /> Transaction history</h2>
          <div className="mt-4 rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/30 text-xs bg-white/[0.02]">
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody data-testid="transactions-table">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/5">
                    <td className="px-5 py-3 capitalize font-medium">{tx.type}</td>
                    <td className={`px-5 py-3 text-right font-mono ${tx.type === 'deposit' ? 'text-[#00FF66]' : 'text-white'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{fmtMoney(tx.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusBadge(tx.status)}`}>{tx.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-white/40 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-white/25">No transactions yet. Make your first deposit above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
