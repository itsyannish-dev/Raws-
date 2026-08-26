'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtMoney, fmtSignedMoney, logout } from '@/lib/rm'
import { Toaster, toast } from 'sonner'
import { AppDrawer, BottomNav } from '@/components/app-nav'
import { useLang, LangToggle } from '@/lib/i18n'
import { useTheme, ThemeToggle } from '@/lib/theme'
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, LogOut, Wallet, Menu, TrendingUp, Scale, PiggyBank, SlidersHorizontal, Clock, Copy, X, Bitcoin, QrCode } from 'lucide-react'

const App = () => {
  const router = useRouter()
  const { t } = useLang()
  const { light } = useTheme()
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [depositAmount, setDepositAmount] = useState('')
  const [payCurrency, setPayCurrency] = useState('btc')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [network, setNetwork] = useState('')
  const [busy, setBusy] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeDeposit, setActiveDeposit] = useState(null)

  const GREEN = light ? 'text-[#00b34a]' : 'text-[#00FF66]'
  const RED = light ? 'text-[#e11d48]' : 'text-[#ff3b5c]'
  const T = {
    page: light ? 'bg-[#f5f6f5] text-gray-900' : 'bg-black text-white',
    header: light ? 'border-black/5 bg-white/85' : 'border-white/5 bg-black/80',
    icon: light ? 'text-gray-600 hover:text-gray-900' : 'text-white/70 hover:text-white',
    iconFaint: light ? 'text-gray-400 hover:text-gray-900' : 'text-white/50 hover:text-white',
    card: light ? 'border-black/5 bg-white shadow-sm' : 'border-white/10 bg-white/[0.02]',
    label: light ? 'text-gray-400' : 'text-white/35',
    sub: light ? 'text-gray-500' : 'text-white/40',
    faint: light ? 'text-gray-400' : 'text-white/35',
    input: light ? 'bg-black/[0.03] border-black/10 focus:border-[#00b34a]/60 placeholder:text-gray-400' : 'bg-white/5 border-white/10 focus:border-[#00FF66]/50',
    divide: light ? 'divide-black/5 border-black/5' : 'divide-white/5 border-white/5',
    rowHover: light ? 'hover:bg-black/[0.02]' : 'hover:bg-white/[0.02]',
    modal: light ? 'border-black/10 bg-white' : 'border-white/10 bg-[#0a0a0a]',
    heroCard: light ? 'border-[#00b34a]/20 bg-gradient-to-br from-[#00b34a]/[0.07] via-white to-white shadow-sm' : 'border-[#00FF66]/15 bg-gradient-to-br from-[#00FF66]/[0.08] via-transparent to-transparent',
    innerCard: light ? 'bg-black/[0.02] border-black/5' : 'bg-black/40 border-white/5',
    depCard: light ? 'border-[#00b34a]/20 bg-[#00b34a]/[0.04]' : 'border-[#00FF66]/15 bg-[#00FF66]/[0.03]',
  }

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
    api.get('/payments/currencies').then((r) => {
      const list = r.data.currencies || []
      setCurrencies(list)
      if (list.length && !list.find((c) => c.code === 'btc')) setPayCurrency(list[0].code)
    }).catch(() => {})
    const timer = setInterval(refresh, 20000)
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
    return () => clearInterval(timer)
  }, [refresh, router])

  useEffect(() => {
    if (!activeDeposit || activeDeposit.status !== 'waiting_payment') return
    const iv = setInterval(async () => {
      try {
        const r = await api.get(`/transactions/deposit/${activeDeposit.id}/status`)
        const tx = r.data.transaction
        setActiveDeposit(tx)
        if (tx.status !== 'waiting_payment') {
          refresh()
          if (tx.status === 'pending' || tx.status === 'approved') toast.success(t('Payment detected — awaiting approval'))
        }
      } catch (e) {}
    }, 10000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeposit?.id, activeDeposit?.status])

  const deposit = async (e) => {
    e.preventDefault()
    const amt = Number(depositAmount)
    if (!amt || amt <= 0) { toast.error(t('Enter a valid amount')); return }
    setBusy(true)
    try {
      const r = await api.post('/transactions/deposit', { amount: amt, payCurrency })
      setActiveDeposit(r.data.transaction)
      toast.success(t('Deposit created — send the payment to complete'))
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
    if (!amt || amt <= 0) { toast.error(t('Enter a valid amount')); return }
    if (!walletAddress || walletAddress.trim().length < 15) { toast.error(t('A valid crypto wallet address is required')); return }
    setBusy(true)
    try {
      await api.post('/transactions/withdraw', { amount: amt, walletAddress: walletAddress.trim(), network: network.trim() })
      toast.success(t('Withdrawal request submitted for review'))
      setWithdrawAmount('')
      setWalletAddress('')
      setNetwork('')
      refresh()
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Withdrawal failed')
    } finally {
      setBusy(false)
    }
  }

  const copyText = (text) => {
    try {
      navigator.clipboard.writeText(text)
      toast.success(t('Copied to clipboard'))
    } catch (e) {}
  }

  const statusBadge = (s) => ({
    completed: light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]',
    approved: light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/15 text-[#00FF66]',
    pending: light ? 'bg-yellow-500/10 text-yellow-600' : 'bg-yellow-400/15 text-yellow-400',
    waiting_payment: light ? 'bg-blue-500/10 text-blue-600' : 'bg-blue-400/15 text-blue-400',
    rejected: light ? 'bg-[#e11d48]/10 text-[#e11d48]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]',
    failed: light ? 'bg-[#e11d48]/10 text-[#e11d48]' : 'bg-[#ff3b5c]/15 text-[#ff3b5c]',
  }[s] || (light ? 'bg-black/5 text-gray-500' : 'bg-white/10 text-white/50'))

  const statusLabel = (s) => t(s === 'waiting_payment' ? 'awaiting payment' : s)

  const txMeta = (tx) => {
    if (tx.type === 'deposit') {
      const sub = tx.payCurrency
        ? `${tx.payAmount ? `${tx.payAmount} ` : ''}${tx.payCurrency.toUpperCase()}${tx.payAddress ? ` • ${tx.payAddress.slice(0, 12)}…` : ''}`
        : t('Crypto deposit')
      return { icon: ArrowDownToLine, iconCls: light ? 'bg-[#00b34a]/10 text-[#00b34a]' : 'bg-[#00FF66]/10 text-[#00FF66]', label: t('Deposit'), sub, sign: '+', amtCls: tx.status === 'failed' || tx.status === 'rejected' ? `${T.faint} line-through` : GREEN }
    }
    if (tx.type === 'withdrawal') {
      const refunded = tx.status === 'rejected'
      const sub = refunded ? t('Rejected — funds refunded') : `${tx.walletAddress ? `${tx.walletAddress.slice(0, 12)}…` : ''}${tx.network ? ` • ${tx.network}` : ''}`
      return { icon: ArrowUpFromLine, iconCls: light ? 'bg-black/5 text-gray-600' : 'bg-white/5 text-white/70', label: t('Withdrawal'), sub, sign: '-', amtCls: refunded ? `${T.faint} line-through` : '' }
    }
    const credit = tx.direction !== 'debit'
    return { icon: SlidersHorizontal, iconCls: light ? 'bg-blue-500/10 text-blue-600' : 'bg-blue-400/10 text-blue-400', label: t('Balance adjustment'), sub: tx.note || t('Adjusted by RAWMarkets team'), sign: credit ? '+' : '-', amtCls: credit ? GREEN : '' }
  }

  const pnlUp = (account?.floatingPnl || 0) >= 0

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
          <ThemeToggle className="hidden sm:flex" />
          <LangToggle className="hidden sm:flex" />
          <button data-testid="terminal-nav-btn" onClick={() => router.push('/terminal')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black px-3.5 py-2 rounded-full hover:bg-[#00e65c] transition">
            <CandlestickChart className="h-3.5 w-3.5" /> Terminal
          </button>
          <button data-testid="logout-btn" onClick={() => logout(router)} className={`p-2 transition ${T.iconFaint}`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-28 md:pb-12">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{t('Wallet')}</h1>
            <p className={`text-sm mt-1 ${T.sub}`}>{user ? `${t('Welcome back')}, ${user.name.split(' ')[0]}` : '…'}</p>
          </div>
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>

        {/* BALANCE HERO CARD */}
        <div className={`mt-6 rounded-3xl border p-6 sm:p-8 relative overflow-hidden ${T.heroCard}`}>
          <div className={`flex items-center gap-2 text-[11px] uppercase tracking-widest ${T.label}`}>
            <Wallet className={`h-3.5 w-3.5 ${GREEN}`} /> {t('Total balance')}
          </div>
          <div data-testid="card-balance" className="text-4xl sm:text-5xl font-mono font-bold mt-3 tracking-tight">
            {account ? fmtMoney(account.balance) : '—'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
            {[
              { icon: Scale, label: t('Equity'), value: account ? fmtMoney(account.equity) : '—', testid: 'card-equity' },
              { icon: TrendingUp, label: t('Floating PnL'), value: account ? fmtSignedMoney(account.floatingPnl) : '—', color: pnlUp ? GREEN : RED, testid: 'card-pnl' },
              { icon: PiggyBank, label: t('Free margin'), value: account ? fmtMoney(account.freeMargin) : '—', testid: 'card-free-margin' },
              { icon: CandlestickChart, label: t('Open positions'), value: account ? account.openPositions : '—', testid: 'card-open-positions' },
            ].map((c) => (
              <div key={c.label} className={`rounded-xl border backdrop-blur px-4 py-3 ${T.innerCard}`}>
                <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest ${T.label}`}>
                  <c.icon className="h-3 w-3" /> {c.label}
                </div>
                <div data-testid={c.testid} className={`text-base sm:text-lg font-mono font-semibold mt-1 ${c.color || ''}`}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* DEPOSIT / WITHDRAW */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <form onSubmit={deposit} className={`rounded-3xl border p-6 sm:p-7 ${T.depCard}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${light ? 'bg-[#00b34a]/10' : 'bg-[#00FF66]/10'}`}>
                <Bitcoin className={`h-5 w-5 ${GREEN}`} />
              </div>
              <div>
                <h2 className="font-semibold">{t('Deposit crypto')}</h2>
                <p className={`text-[11px] ${T.faint}`}>{t('Pay with crypto. Credited after network confirmation.')}</p>
              </div>
            </div>
            <input
              data-testid="deposit-amount-input"
              type="number"
              min="10"
              step="any"
              placeholder={t('Amount (USD)')}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className={`w-full mt-5 rounded-xl border px-4 py-3.5 text-base font-mono focus:outline-none ${T.input}`}
            />
            <div className="flex gap-2 mt-3">
              {[100, 500, 1000].map((v) => (
                <button type="button" key={v} onClick={() => setDepositAmount(String(v))} className={`flex-1 text-xs py-2 rounded-lg border transition font-mono ${light ? 'border-black/10 text-gray-500 hover:text-gray-900 hover:border-[#00b34a]/50' : 'border-white/10 text-white/50 hover:text-white hover:border-[#00FF66]/40'}`}>
                  ${v.toLocaleString()}
                </button>
              ))}
            </div>
            <label className={`block text-[11px] mt-4 mb-1.5 ${T.sub}`}>{t('Pay with')}</label>
            <select
              data-testid="deposit-currency-select"
              value={payCurrency}
              onChange={(e) => setPayCurrency(e.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none ${T.input}`}
            >
              {(currencies.length ? currencies : [{ code: 'btc', label: 'Bitcoin (BTC)' }]).map((c) => (
                <option key={c.code} value={c.code} className={light ? 'bg-white' : 'bg-black'}>{c.label}</option>
              ))}
            </select>
            <button data-testid="deposit-submit-btn" disabled={busy} type="submit" className="w-full mt-5 bg-[#00FF66] text-black font-semibold py-3.5 rounded-xl hover:bg-[#00e65c] transition disabled:opacity-50 text-sm">
              {t('Create deposit')}
            </button>
          </form>

          <form onSubmit={withdraw} className={`rounded-3xl border p-6 sm:p-7 ${T.card}`}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${light ? 'bg-black/5' : 'bg-white/5'}`}>
                <ArrowUpFromLine className={`h-5 w-5 ${light ? 'text-gray-600' : 'text-white/70'}`} />
              </div>
              <div>
                <h2 className="font-semibold">{t('Withdraw')}</h2>
                <p className={`text-[11px] ${T.faint}`}>{t('Withdraw to your crypto wallet. Reviewed within 24h.')}</p>
              </div>
            </div>
            <input
              data-testid="withdraw-amount-input"
              type="number"
              min="1"
              step="any"
              placeholder={t('Amount (USD)')}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className={`w-full mt-5 rounded-xl border px-4 py-3.5 text-base font-mono focus:outline-none ${T.input}`}
            />
            <input
              data-testid="withdraw-address-input"
              type="text"
              placeholder={t('Your crypto wallet address')}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className={`w-full mt-3 rounded-xl border px-4 py-3 text-sm font-mono focus:outline-none ${T.input}`}
            />
            <input
              data-testid="withdraw-network-input"
              type="text"
              placeholder={t('Network (e.g. TRC20, ERC20) — optional')}
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className={`w-full mt-3 rounded-xl border px-4 py-3 text-sm focus:outline-none ${T.input}`}
            />
            <div className={`flex items-center justify-between mt-3 text-[11px] px-1 ${T.faint}`}>
              <span>{t('Available to withdraw')}</span>
              <span className="font-mono">{account ? fmtMoney(Math.max(0, Math.min(account.freeMargin, account.balance))) : '—'}</span>
            </div>
            <button data-testid="withdraw-submit-btn" disabled={busy} type="submit" className={`w-full mt-4 border font-semibold py-3.5 rounded-xl transition disabled:opacity-50 text-sm ${light ? 'border-black/15 hover:bg-black/5' : 'border-white/15 hover:bg-white/5'}`}>
              {t('Request withdrawal')}
            </button>
          </form>
        </div>

        {/* TRANSACTIONS */}
        <div className="mt-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className={`h-4 w-4 ${GREEN}`} /> {t('Transaction history')}
          </h2>
          <div className={`mt-4 rounded-3xl border overflow-hidden divide-y ${T.card} ${T.divide}`} data-testid="transactions-table">
            {transactions.map((tx) => {
              const m = txMeta(tx)
              const clickable = tx.type === 'deposit' && tx.status === 'waiting_payment' && tx.payAddress
              return (
                <div
                  key={tx.id}
                  onClick={clickable ? () => setActiveDeposit(tx) : undefined}
                  className={`flex items-center justify-between px-4 sm:px-6 py-4 transition ${T.rowHover} ${clickable ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center ${m.iconCls}`}>
                      <m.icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                        {m.label}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusBadge(tx.status)}`}>{statusLabel(tx.status)}</span>
                        {clickable && <span className={`text-[10px] flex items-center gap-1 ${GREEN}`}><QrCode className="h-3 w-3" />{t('View payment')}</span>}
                      </div>
                      <div className={`text-[11px] truncate ${T.faint}`}>{m.sub}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`font-mono text-sm font-semibold ${m.amtCls}`}>{m.sign}{fmtMoney(tx.amount)}</div>
                    <div className={`text-[10px] mt-0.5 ${T.faint}`}>{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              )
            })}
            {transactions.length === 0 && (
              <div className={`px-6 py-12 text-center text-sm ${T.faint}`}>{t('No transactions yet. Make your first deposit above.')}</div>
            )}
          </div>
        </div>
      </main>

      {/* NOWPAYMENTS DEPOSIT MODAL */}
      {activeDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActiveDeposit(null)} />
          <div data-testid="deposit-payment-modal" className={`relative w-full max-w-md rounded-2xl border p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto ${T.modal}`}>
            <button data-testid="deposit-modal-close" onClick={() => setActiveDeposit(null)} className={`absolute top-4 right-4 ${T.iconFaint}`}>
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${light ? 'bg-[#00b34a]/10' : 'bg-[#00FF66]/10'}`}><Bitcoin className={`h-4 w-4 ${GREEN}`} /></div>
              <div>
                <div className="font-semibold text-sm">{t('Deposit crypto')} — {fmtMoney(activeDeposit.amount)}</div>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge(activeDeposit.status)}`}>
                  {activeDeposit.status === 'waiting_payment' ? t('Waiting for payment') : activeDeposit.status === 'pending' ? t('Payment received — pending approval') : activeDeposit.status === 'approved' ? t('Approved') : t('Failed / expired')}
                </span>
              </div>
            </div>

            {activeDeposit.status === 'waiting_payment' && activeDeposit.payAddress && (
              <>
                <div className={`rounded-xl border p-4 text-center ${light ? 'border-[#00b34a]/20 bg-[#00b34a]/[0.05]' : 'border-[#00FF66]/15 bg-[#00FF66]/[0.04]'}`}>
                  <div className={`text-[11px] ${T.sub}`}>{t('Send exactly')}</div>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span data-testid="deposit-pay-amount" className={`font-mono font-bold text-lg ${GREEN}`}>{activeDeposit.payAmount} {activeDeposit.payCurrency?.toUpperCase()}</span>
                    <button onClick={() => copyText(String(activeDeposit.payAmount))} className={T.iconFaint}><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className={`text-[11px] mt-1 ${T.sub}`}>{t('to the address below')}</div>
                </div>

                <div className="flex justify-center my-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(activeDeposit.payAddress)}`}
                    alt="QR"
                    className={`rounded-xl border bg-white p-1.5 h-[170px] w-[170px] ${light ? 'border-black/10' : 'border-white/10'}`}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>

                <div className={`rounded-xl border p-3 ${light ? 'bg-black/[0.03] border-black/10' : 'bg-white/5 border-white/10'}`}>
                  <div data-testid="deposit-pay-address" className={`font-mono text-xs break-all ${light ? 'text-gray-700' : 'text-white/80'}`}>{activeDeposit.payAddress}</div>
                  <button data-testid="copy-address-btn" onClick={() => copyText(activeDeposit.payAddress)} className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#00FF66] text-black py-2.5 rounded-lg hover:bg-[#00e65c] transition">
                    <Copy className="h-3.5 w-3.5" /> {t('Copy')}
                  </button>
                </div>

                <p className={`text-[11px] mt-4 leading-relaxed text-center ${T.faint}`}>
                  {t('This payment is monitored automatically. You can close this window — the deposit stays in your history.')}
                </p>
              </>
            )}

            {activeDeposit.status !== 'waiting_payment' && (
              <button onClick={() => setActiveDeposit(null)} className="w-full mt-4 bg-[#00FF66] text-black font-semibold py-3 rounded-xl hover:bg-[#00e65c] transition text-sm">
                {t('Done')}
              </button>
            )}
          </div>
        </div>
      )}

      <BottomNav active="wallet" />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default App
