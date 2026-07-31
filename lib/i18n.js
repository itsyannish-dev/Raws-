'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Globe } from 'lucide-react'

// Portuguese translations keyed by the English source string.
// t('Some text') returns the PT translation when lang==='pt', otherwise the English string itself.
const PT = {
  // Nav / menu
  'Home': 'Início',
  'Charts': 'Gráficos',
  'Chart': 'Gráfico',
  'Markets': 'Mercados',
  'Wallet': 'Carteira',
  'Deposit': 'Depositar',
  'Withdraw': 'Levantar',
  'Settings': 'Definições',
  'Admin panel': 'Painel admin',
  'Sign out': 'Sair',
  'Positions': 'Posições',
  'Trade': 'Negociar',
  'Sign in': 'Entrar',
  'Get started': 'Começar',
  'Open app': 'Abrir app',
  'Launch app': 'Abrir app',
  'Features': 'Funcionalidades',
  'How it works': 'Como funciona',
  'Pricing': 'Preçário',
  // Landing
  'Live markets. Real-time execution.': 'Mercados ao vivo. Execução em tempo real.',
  "Trade the world's markets.": 'Negoceie os mercados mundiais.',
  'Zero friction.': 'Zero fricção.',
  'Crypto, forex, metals, indices and stocks with live pricing, instant execution and real-time PnL. A trading terminal engineered to feel invisible.': 'Cripto, forex, metais, índices e ações com preços ao vivo, execução instantânea e PnL em tempo real. Um terminal de trading concebido para ser invisível.',
  'Start trading': 'Começar a negociar',
  'Live markets.': 'Mercados ao vivo.',
  'Real prices, streaming right now.': 'Preços reais, em direto agora.',
  'Engineered for serious traders.': 'Concebido para traders exigentes.',
  "Everything you need. Nothing you don't.": 'Tudo o que precisa. Nada do que não precisa.',
  'Live market data': 'Dados de mercado ao vivo',
  'Streaming prices for crypto, forex, metals, indices and stocks, tick by tick.': 'Preços em streaming de cripto, forex, metais, índices e ações, tick a tick.',
  'Instant execution': 'Execução instantânea',
  'Market orders filled in milliseconds with transparent pip-based spreads.': 'Ordens executadas em milissegundos com spreads transparentes em pips.',
  'Real-time PnL': 'PnL em tempo real',
  'Floating PnL, equity and margin recalculated live on every tick.': 'PnL flutuante, capital e margem recalculados ao vivo a cada tick.',
  'Crypto deposits': 'Depósitos em cripto',
  'Deposit with BTC, ETH, USDT and more. Withdrawals reviewed and protected.': 'Deposite com BTC, ETH, USDT e mais. Levantamentos revistos e protegidos.',
  'Up and running in a minute.': 'A operar em menos de um minuto.',
  'Create your account': 'Crie a sua conta',
  'Sign up with just your name, email and a password. No paperwork, no waiting.': 'Registe-se apenas com nome, email e palavra-passe. Sem burocracia, sem esperas.',
  'Fund your wallet': 'Carregue a sua carteira',
  'Deposit crypto — BTC, ETH, USDT and more. Funds are credited after network confirmation.': 'Deposite cripto — BTC, ETH, USDT e mais. Os fundos são creditados após confirmação na rede.',
  'Trade live markets': 'Negoceie mercados ao vivo',
  'Open positions with up to 1:100 leverage and watch your PnL update in real time.': 'Abra posições com alavancagem até 1:100 e veja o seu PnL atualizar em tempo real.',
  'Simple, transparent pricing.': 'Preçário simples e transparente.',
  'No commission. No monthly fees. No surprises.': 'Sem comissões. Sem mensalidades. Sem surpresas.',
  'Spread per trade': 'Spread por operação',
  'From 1 pip. The only cost you pay, applied transparently to bid and ask.': 'A partir de 1 pip. O único custo que paga, aplicado de forma transparente ao bid e ask.',
  'Commission': 'Comissão',
  'Zero commission on all markets, deposits and account maintenance.': 'Zero comissões em todos os mercados, depósitos e manutenção de conta.',
  'Max leverage': 'Alavancagem máxima',
  'Up to 1:100 on forex, 1:50 indices, 1:20 metals, 1:10 crypto and stocks.': 'Até 1:100 em forex, 1:50 índices, 1:20 metais, 1:10 cripto e ações.',
  'Execution': 'Execução',
  'Crypto trading': 'Trading de cripto',
  'Frequently asked questions.': 'Perguntas frequentes.',
  'Your edge starts here.': 'A sua vantagem começa aqui.',
  'Open an account in under a minute.': 'Abra uma conta em menos de um minuto.',
  'Create free account': 'Criar conta gratuita',
  'All rights reserved.': 'Todos os direitos reservados.',
  'Trading involves risk. Not financial advice.': 'Negociar envolve risco. Não é aconselhamento financeiro.',
  'Product': 'Produto',
  'Company': 'Empresa',
  'Legal': 'Legal',
  'Terms of service': 'Termos de serviço',
  'Privacy policy': 'Política de privacidade',
  'Risk disclosure': 'Divulgação de risco',
  'Open account': 'Abrir conta',
  'Premium online broker for crypto, forex, metals, indices and stocks. Live data, instant execution, real-time PnL.': 'Corretora online premium para cripto, forex, metais, índices e ações. Dados ao vivo, execução instantânea, PnL em tempo real.',
  'Create account': 'Criar conta',
  'Full name': 'Nome completo',
  'Email address': 'Endereço de email',
  'Password (min. 6 characters)': 'Palavra-passe (mín. 6 caracteres)',
  'Please wait…': 'Aguarde…',
  'New accounts start at $0. Fund your wallet with crypto to start trading.': 'Contas novas começam com $0. Carregue a carteira com cripto para começar a negociar.',
  'Loading live markets…': 'A carregar mercados…',
  'Loading markets…': 'A carregar mercados…',
  // FAQ
  'How do I start trading on RAWMarkets?': 'Como começo a negociar na RAWMarkets?',
  'Create a free account in under a minute, deposit crypto (BTC, ETH, USDT and more) and start trading 30+ markets with live data.': 'Crie uma conta gratuita em menos de um minuto, deposite cripto (BTC, ETH, USDT e mais) e comece a negociar mais de 30 mercados com dados ao vivo.',
  'What markets can I trade?': 'Que mercados posso negociar?',
  'Crypto 24/7 (BTC, ETH, SOL and more), major and cross forex pairs, gold and silver, US indices (S&P 500, Nasdaq 100, Dow) and leading US stocks.': 'Cripto 24/7 (BTC, ETH, SOL e mais), pares forex principais e cruzados, ouro e prata, índices dos EUA (S&P 500, Nasdaq 100, Dow) e as principais ações dos EUA.',
  'What are the fees?': 'Quais são as taxas?',
  'Zero commission. We charge a transparent spread of 1–2 pips on every trade — that is it. No hidden costs, no monthly fees.': 'Zero comissões. Cobramos um spread transparente de 1–2 pips em cada operação — e é tudo. Sem custos escondidos, sem mensalidades.',
  'How does leverage work?': 'Como funciona a alavancagem?',
  'Maximum leverage depends on the asset class: 1:100 on forex, 1:50 on indices, 1:20 on metals and 1:10 on crypto and stocks. Your required margin is the notional value divided by your leverage.': 'A alavancagem máxima depende da classe de ativos: 1:100 em forex, 1:50 em índices, 1:20 em metais e 1:10 em cripto e ações. A margem necessária é o valor nocional dividido pela alavancagem.',
  'How do deposits and withdrawals work?': 'Como funcionam os depósitos e levantamentos?',
  'Deposits are made in crypto via our payment gateway and credited after network confirmation. Withdrawals go to your crypto wallet and are reviewed by our team, typically within 24 hours.': 'Os depósitos são feitos em cripto através do nosso gateway de pagamento e creditados após confirmação na rede. Os levantamentos vão para a sua carteira cripto e são revistos pela nossa equipa, normalmente em 24 horas.',
  // Home / app
  'Welcome back': 'Bem-vindo de volta',
  "Here's your account at a glance.": 'A sua conta num relance.',
  'Balance': 'Saldo',
  'Equity': 'Capital',
  'Floating PnL': 'PnL flutuante',
  'Quick actions': 'Ações rápidas',
  'Market watch': 'Mercados',
  'All': 'Todos',
  'Crypto': 'Cripto',
  'Forex': 'Forex',
  'Metals': 'Metais',
  'Indices': 'Índices',
  'Stocks': 'Ações',
  // Dashboard / wallet
  'Total balance': 'Saldo total',
  'Free margin': 'Margem livre',
  'Open positions': 'Posições abertas',
  'Deposit crypto': 'Depositar cripto',
  'Pay with crypto. Credited after network confirmation.': 'Pague com cripto. Creditado após confirmação na rede.',
  'Amount (USD)': 'Montante (USD)',
  'Pay with': 'Pagar com',
  'Create deposit': 'Criar depósito',
  'Withdraw to your crypto wallet. Reviewed within 24h.': 'Levante para a sua carteira cripto. Revisto em 24h.',
  'Your crypto wallet address': 'O seu endereço de carteira cripto',
  'Network (e.g. TRC20, ERC20) — optional': 'Rede (ex.: TRC20, ERC20) — opcional',
  'Available to withdraw': 'Disponível para levantar',
  'Request withdrawal': 'Pedir levantamento',
  'Transaction history': 'Histórico de transações',
  'No transactions yet. Make your first deposit above.': 'Ainda sem transações. Faça o seu primeiro depósito acima.',
  'Send exactly': 'Envie exatamente',
  'to the address below': 'para o endereço abaixo',
  'Copy': 'Copiar',
  'Copied to clipboard': 'Copiado',
  'Waiting for payment': 'A aguardar pagamento',
  'Payment received — pending approval': 'Pagamento recebido — aprovação pendente',
  'Approved': 'Aprovado',
  'Failed / expired': 'Falhou / expirou',
  'Done': 'Concluir',
  'Deposit created — send the payment to complete': 'Depósito criado — envie o pagamento para concluir',
  'Withdrawal request submitted for review': 'Pedido de levantamento submetido para revisão',
  'Enter a valid amount': 'Insira um montante válido',
  'A valid crypto wallet address is required': 'É necessário um endereço de carteira cripto válido',
  'Crypto deposit': 'Depósito cripto',
  'Withdrawal': 'Levantamento',
  'Balance adjustment': 'Ajuste de saldo',
  'Rejected — funds refunded': 'Rejeitado — fundos devolvidos',
  'Adjusted by RAWMarkets team': 'Ajustado pela equipa RAWMarkets',
  'This payment is monitored automatically. You can close this window — the deposit stays in your history.': 'Este pagamento é monitorizado automaticamente. Pode fechar esta janela — o depósito fica no seu histórico.',
  'Payment detected — awaiting approval': 'Pagamento detetado — a aguardar aprovação',
  'View payment': 'Ver pagamento',
  'Language': 'Idioma',
  // status labels
  'completed': 'concluído',
  'pending': 'pendente',
  'approved': 'aprovado',
  'rejected': 'rejeitado',
  'failed': 'falhou',
  'awaiting payment': 'aguarda pagamento',
}

function currentLang() {
  if (typeof window === 'undefined') return 'en'
  return localStorage.getItem('rm_lang') || 'en'
}

export function useLang() {
  const [lang, setLangState] = useState('en')
  useEffect(() => {
    setLangState(currentLang())
    const h = () => setLangState(currentLang())
    window.addEventListener('rm-lang', h)
    return () => window.removeEventListener('rm-lang', h)
  }, [])
  const setLang = useCallback((l) => {
    try { localStorage.setItem('rm_lang', l) } catch (e) {}
    window.dispatchEvent(new Event('rm-lang'))
  }, [])
  const t = useCallback((s) => (lang === 'pt' ? (PT[s] || s) : s), [lang])
  return { lang, setLang, t }
}

export function LangToggle({ className = '' }) {
  const { lang, setLang } = useLang()
  return (
    <button
      data-testid="lang-toggle"
      onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}
      title={lang === 'en' ? 'Mudar para Português' : 'Switch to English'}
      className={`flex items-center gap-1.5 text-[11px] font-bold border border-white/15 rounded-full px-2.5 py-1.5 text-white/60 hover:text-white hover:border-[#00FF66]/40 transition uppercase ${className}`}
    >
      <Globe className="h-3.5 w-3.5" />
      {lang === 'en' ? 'EN' : 'PT'}
    </button>
  )
}
