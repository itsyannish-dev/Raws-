#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: |
  Build RAWMarkets, a production-quality MVP Broker Web Platform (public website, trading web app, admin panel).
  Brand: premium, minimal, Apple-inspired, black bg, vibrant green #00FF66, dark mode default.
  Confirmed decisions: MongoDB (not Supabase), email/password JWT auth, Finnhub live market data (key in .env),
  MOCK instant deposits, admin-approved withdrawals, users start at $0.
  Phase 1 (current): auth, live market data, trading terminal (charts, buy/sell, leverage), real-time PnL engine, wallet.

backend:
  - task: "Auth: register/login/me (JWT, bcrypt)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/auth/register, POST /api/auth/login, GET /api/auth/me. JWT Bearer. Manually verified register+login via UI."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/auth/register creates user with balance=0, role=user, returns JWT token. POST /api/auth/login returns token for valid credentials. GET /api/auth/me returns user data with Bearer token. Server logs confirm validation working (409 duplicate email, 400 short password/invalid email, 401 wrong password/no token)."
  - task: "Market data: symbols, quotes, candles, ws-config"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/market/symbols, /api/market/quotes (crypto via Binance Vision mirror, stocks via Finnhub), /api/market/candles (crypto=Binance klines, stocks=Yahoo), /api/market/ws-config (auth required, returns Finnhub WS token). 5s server-side quote cache."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: GET /api/market/symbols returns 14 symbols (8 crypto, 6 stocks). GET /api/market/quotes returns live quotes (BTCUSD, AAPL, etc.) with price/change/changePercent. Query param ?symbols=BTCUSD,ETHUSD filters correctly. GET /api/market/candles?symbol=BTCUSD&interval=1h returns 300 candles in ascending order with {time,open,high,low,close}. Tested intervals 1h, 1d for crypto and stocks (AAPL). GET /api/market/ws-config requires auth, returns token + subscriptions. Server logs confirm 400 for unknown symbols."
  - task: "Trading engine: orders, positions, close with PnL"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/orders (validates lots/leverage/side, free-margin check, 0.05% spread bid/ask), GET /api/positions?status=open|closed, POST /api/positions/{id}/close (server-authoritative close price, realizes PnL to balance). GET /api/account/summary computes equity/floating PnL/used+free margin/margin level."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Full trading flow with fresh user. POST /api/orders creates position with entryPrice ≈ market * 1.00025 (ask with 0.05% spread), margin = lots*entryPrice/leverage. GET /api/positions?status=open returns open positions. GET /api/account/summary calculates equity=balance+floatingPnl, freeMargin=equity-usedMargin correctly. POST /api/positions/{id}/close uses bid price, calculates PnL accurately, updates balance by exactly PnL amount. Closed position appears in GET /api/positions?status=closed. Server logs confirm validation: 400 for insufficient margin, invalid side/leverage/lots/symbol, 401 for no auth."
  - task: "Wallet: mock deposit, pending withdrawal, transactions"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/transactions/deposit (MOCK instant credit, max $1M), POST /api/transactions/withdraw (checks free margin+balance, deducts, status pending), GET /api/transactions. Verified deposit via UI."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/transactions/deposit {amount: 10000} returns 201, status=completed, balance updated to 10000. POST /api/transactions/withdraw {amount: 500} returns 201, status=pending, balance reduced by 500. GET /api/transactions returns list with deposit + withdrawal. Server logs confirm validation: 400 for negative/excessive deposits, 400 for withdraw more than balance."

  - task: "Settings endpoints: PATCH /api/auth/profile, POST /api/auth/change-password"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added profile name update and password change (verifies current password). Used by new /settings page."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: PATCH /api/auth/profile updates user name (200), GET /api/auth/me reflects change. Empty/missing name returns 400 'Name is required'. No auth returns 401 'Unauthorized'. POST /api/auth/change-password validates current password (wrong password -> 401 'Current password is incorrect'), validates new password length (< 6 chars -> 400 'New password must be at least 6 characters'), successfully changes password (200 {success: true}). Login with old password after change returns 401, login with new password returns 200 with token. No auth returns 401. All validation and error handling working correctly. Test script: /app/test_settings_simple.py"

frontend:
  - task: "Landing page + auth modal"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Hero, live ticker, features, CTA, login/register modal. Verified via screenshots."
  - task: "Trading terminal (chart, watchlist, orders, positions, live PnL)"
    implemented: true
    working: "NA"
    file: "app/terminal/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "lightweight-charts v5 candles + live tick updates via Finnhub WS (crypto) + 12s REST polling. Fixed locale bug (localization: en-US). Verified buy/sell orders, live floating PnL, equity bar via screenshots."
  - task: "Dashboard (wallet, deposit/withdraw, transactions)"
    implemented: true
    working: "NA"
    file: "app/dashboard/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Verified $10,000 mock deposit via UI screenshot; summary cards + tx history render."

  - task: "Dashboard v2: NOWPayments crypto deposit flow + withdrawal with wallet address"
    implemented: true
    working: "NA"
    file: "app/dashboard/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewritten: deposit form with amount + pay currency select (/api/payments/currencies), creates NOWPayments payment, modal with payAmount/payAddress/QR/copy + 10s status polling. Withdrawal requires wallet address + optional network. Tx history shows waiting_payment/failed statuses; waiting deposits reopen modal. Verified via screenshot: real payment created ($50 -> 49.97 USDTTRC20)."
  - task: "Terminal chart: bid/ask lines, markers without text, category leverage UI, metals/indices watchlist, mobile Positions/Markets tabs"
    implemented: true
    working: "NA"
    file: "app/terminal/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Live bid (red) / ask (green) dotted price lines. Buy/sell markers without text; entry lines deduped by side+price. Leverage buttons filtered by symbol maxLeverage with auto-clamp. Watchlist: Crypto/Forex/Metals/Indices/Stocks with icons. Mobile bottom nav: Chart/Trade/Positions/Markets/Wallet with ?tab= deep links. PnL/bid/ask from server pip-spread quotes. Verified via screenshots."
  - task: "i18n PT/EN toggle + symbol icons + public site hamburger menu"
    implemented: true
    working: "NA"
    file: "lib/i18n.js, components/symbol-icon.js, app/page.js, app/home/page.js, components/app-nav.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "useLang hook + LangToggle (EN default, PT via localStorage rm_lang). Landing translated + mobile hamburger drawer. SymbolIcon: crypto logos (coincap), stock logos (clearbit), forex flags, metal/index badges across landing/home/terminal. Home: metal/index filters. Verified via screenshots (PT toggle works)."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Phase 1 complete. Please test all backend APIs at {NEXT_PUBLIC_BASE_URL}/api. Test creds in /app/memory/test_credentials.md (trader@rawmarkets.com / Trader123!). Full flow: register new user -> login -> deposit -> place buy+sell orders (BTCUSD, lots 0.01, leverage 10) -> check account summary math (equity=balance+floating PnL, margin=notional/leverage) -> close position (PnL realized to balance) -> withdraw (pending status) -> edge cases (insufficient margin, invalid symbol/leverage, unauthorized access). NOTE: dev server may restart on memory threshold; retry once if connection refused."
  - agent: "testing"
    message: "Backend testing complete. All 4 high-priority backend tasks are WORKING. Tested with fresh user: auth flow (register/login/me), market data (symbols/quotes/candles/ws-config), full trading cycle (deposit → order → position → account summary → close → withdraw), and wallet transactions. All core functionality verified. Entry prices use correct spread (0.05%), margin calculations accurate, PnL computed correctly, balance updates precise. Server logs confirm all validation/error handling working (400/401/409 responses). Test script at /app/backend_test.py available for re-testing."
  - agent: "main"
    message: "Added 2 new settings endpoints: PATCH /api/auth/profile (update name) and POST /api/auth/change-password (verify current, update to new). Marked for testing."
  - agent: "testing"
    message: "Settings endpoints testing complete. Both endpoints WORKING. PATCH /api/auth/profile correctly updates user name, validates input (400 for empty/missing name), requires auth (401 without token). POST /api/auth/change-password correctly validates current password (401 if wrong), validates new password length (400 if < 6 chars), successfully updates password hash, and old password becomes invalid after change. All error handling and validation working as expected. Test script: /app/test_settings_simple.py"
  - agent: "testing"
    message: "Admin endpoints testing complete. All admin functionality WORKING. Access control enforced (401 without token, 403 for non-admin). Stats endpoint returns all required metrics. Users list works with search, no passwordHash exposed. Balance adjustment creates transactions, validates negative/zero amounts. Withdrawal approval/rejection flow correct (approve keeps deduction, reject refunds). Positions list includes user info. Settings GET/PUT working with enforcement (maxLeverage and tradingEnabled validated in order creation). Invalid settings correctly rejected. Settings restored to defaults (spread=0.0005, maxLeverage=100, tradingEnabled=true). Test script: /app/backend_test_admin.py"
  - agent: "main"
    message: "Added 7 forex pairs (EURUSD,GBPUSD,AUDUSD,NZDUSD,USDJPY,USDCAD,USDCHF). Server keeps a Finnhub WS (OANDA) singleton feeding live prices; Yahoo provides daily change + fallback. Candles via Yahoo. contractSize=100000/lot; notional USD = units*price (XXXUSD) or units (USDXXX); PnL converted from quote currency to USD for USD-base pairs. Positions now store contractSize + quoteCurrency. Please test forex functionality."
  - agent: "main"
    message: "MAJOR BACKEND REWRITE completed: (1) NOWPayments crypto deposits: GET /api/payments/currencies (popular pay currencies), POST /api/transactions/deposit now requires {amount, payCurrency} and creates a real NOWPayments payment (returns payAddress, payAmount, paymentId, status=waiting_payment). GET /api/transactions/deposit/{id}/status polls NOWPayments and maps status (finished/confirmed->pending for admin approval; failed/expired->failed). Admin approve credits balance. (2) Withdrawals now require walletAddress (min 15 chars) + optional network, status=pending for admin. (3) Category-based max leverage: crypto 1:10, forex 1:100, metal 1:20, index 1:50, stock 1:10 — enforced in POST /api/orders (error if leverage > category max). maxLeverage now included per-symbol in GET /api/market/symbols. (4) Dynamic spread in PIPS: settings.spreadPips (default 1), actual spread randomized between 1x-2x base pips per quote; quotes now include bid/ask/spreadPips/pipSize. Admin PUT /api/admin/settings accepts spreadPips (0.1-10) and tradingEnabled (maxLeverage setting REMOVED - replaced by category rules). (5) New symbols: XAUUSD/XAGUSD (metal), US500/US100/US30 (index), 6 new forex crosses, DOGE/ADA/LINK crypto, AMZN/GOOGL stocks — 32 symbols total. Please test all of this. NOTE: NOWPayments API key is real - creating deposits hits the live API (no funds move unless someone pays the address). Test creds: trader@rawmarkets.com / Trader123!, admin@rawmarkets.com / RawAdmin!2025."
  - agent: "testing"
    message: "Forex testing complete. All forex functionality WORKING. Tested: (1) 21 symbols total with 7 forex pairs having correct metadata (contractSize=100000, proper quote currencies). (2) Live quotes for EURUSD/USDJPY/GBPUSD with valid price ranges and changePercent. (3) Candles for EURUSD 1h/1d and USDJPY 15m in ascending order. (4) Full forex trading cycle with fresh user: EURUSD order (contractSize=100000, quoteCurrency=USD, entryPrice≈mid*1.00025, notional=$1,142.99, margin=$114.30), USDJPY order (notional=$1,000 exactly for USD-base, margin=$100), account summary shows correct usedMargin sum and equity calculation, both positions closed with small PnL within expected range, balance updated by exact PnL sum. (5) Oversized order correctly rejected with insufficient margin error. (6) Crypto regression test passed. Test script: /app/backend_test_forex.py"
  - agent: "testing"
    message: "MAJOR REWRITE TESTING COMPLETE - ALL FEATURES WORKING ✅. Comprehensive test of 7 new backend features: (1) SYMBOLS & CATEGORIES: GET /api/market/symbols returns exactly 32 symbols with correct maxLeverage per category (crypto=10, forex=100, metal=20, index=50, stock=10). All new symbols verified: XAUUSD/XAGUSD (metals), US500/US100/US30 (indices), EURGBP/EURJPY/GBPJPY/EURCHF/AUDJPY/EURAUD (forex crosses), DOGEUSD/ADAUSD/LINKUSD (crypto), AMZN/GOOGL (stocks). (2) DYNAMIC PIP SPREAD: GET /api/market/quotes returns bid/ask/spreadPips/pipSize for each symbol, spread calculation accurate (ask-bid ≈ spreadPips * pipSize), spreadPips randomized between 1x-2x base (tested: BTCUSD=1.32, EURUSD=1.43, XAUUSD=1.55). (3) CATEGORY LEVERAGE ENFORCEMENT: Fresh user funded via admin adjust-balance. BTCUSD leverage 20 correctly rejected (400 'Maximum leverage for crypto is 1:10'), EURUSD leverage 100 accepted, XAUUSD leverage 50 rejected (400 'Maximum leverage for metal is 1:20'), XAUUSD leverage 20 accepted, US500 leverage 100 rejected (400 'Maximum leverage for index is 1:50'), US500 leverage 50 accepted. All positions closed with PnL applied. (4) NOWPAYMENTS DEPOSITS: GET /api/payments/currencies returns 10 currencies. POST /api/transactions/deposit {amount: 50, payCurrency: 'usdttrc20'} creates real NOWPayments payment (payAddress, payAmount=50.050059, paymentId=6350514825, status=waiting_payment). GET /api/transactions/deposit/{id}/status polls status (paymentStatus='waiting'). Validation working: amount < 10 rejected, missing payCurrency rejected. Live API integration working. (5) WITHDRAWALS WITH WALLET: POST /api/transactions/withdraw without walletAddress rejected (400). With walletAddress creates pending withdrawal, balance deducted. Admin reject refunds balance, admin approve keeps deduction. (6) ADMIN SETTINGS: GET /api/admin/settings returns spreadPips/tradingEnabled/categoryLeverage. PUT {spreadPips: 2} works, PUT {spreadPips: 20} rejected (400, out of range 0.1-10). PUT {tradingEnabled: false} blocks orders (403 'Trading is temporarily disabled'). Settings restored. (7) REGRESSION: Auth flow (register/login/me), account summary math (equity=balance+floatingPnl, freeMargin=equity-usedMargin), positions, admin stats (includes pendingDeposits/awaitingPaymentDeposits) all working. Test script: /app/backend_test_rewrite.py. ALL 7/7 TESTS PASSED."

  - task: "Admin: stats, users, adjust-balance, withdrawals approve/reject, positions, platform settings"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Admin seeded (admin@rawmarkets.com / RawAdmin!2025, role admin). Endpoints under /api/admin/*: stats, users?search=, users/{id}/adjust-balance, transactions (withdrawal filters), transactions/{id}/approve|reject (reject refunds), positions, settings GET/PUT (spread, maxLeverage, tradingEnabled wired into trading engine). Non-admin gets 403."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: All admin endpoints working correctly. (1) Access control: all /api/admin/* endpoints return 401 without token, 403 with regular user token. (2) GET /api/admin/stats returns all required fields (totalUsers: 22, totalBalance: $257,513.97, openPositions: 13, pendingWithdrawals: 5/$4,000, totalDeposited: $260,000, totalWithdrawn: $0). (3) GET /api/admin/users returns 22 users without passwordHash, search filter correctly finds trader user. (4) POST /api/admin/users/{id}/adjust-balance: +$500 credit creates adjustment transaction visible in user's list, -$200 debit works, -$1000 correctly rejected (400 would go negative), amount=0 correctly rejected (400). (5) Withdrawal flow: deposit $1000 + withdraw $400 creates pending tx with balance $600, admin GET /api/admin/transactions?type=withdrawal&status=pending shows it with user info, approve keeps balance at $600, second withdrawal rejection refunds balance correctly, re-approval of approved tx correctly rejected (400). (6) GET /api/admin/positions?status=open returns 13 positions with user email attached. (7) Settings: GET returns current settings, PUT maxLeverage=20 enforced (order with leverage 50 rejected with 'Maximum allowed leverage is 20x'), PUT tradingEnabled=false enforced (order rejected with 403 'trading disabled'), settings restored to spread=0.0005/maxLeverage=100/tradingEnabled=true, invalid spread=0.5 correctly rejected (400). Test script: /app/backend_test_admin.py"

  - task: "Forex: symbols, live quotes (server-side Finnhub WS + Yahoo fallback), candles, forex PnL/margin math"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 7 forex pairs (EURUSD,GBPUSD,AUDUSD,NZDUSD,USDJPY,USDCAD,USDCHF). Server keeps a Finnhub WS (OANDA) singleton feeding live prices; Yahoo provides daily change + fallback. Candles via Yahoo. contractSize=100000/lot; notional USD = units*price (XXXUSD) or units (USDXXX); PnL converted from quote currency to USD for USD-base pairs. Positions now store contractSize + quoteCurrency. Chart trade markers + entry price lines added client-side."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Complete forex functionality verified. (1) GET /api/market/symbols returns 21 symbols: 7 forex (EURUSD,GBPUSD,AUDUSD,NZDUSD,USDJPY,USDCAD,USDCHF) with type='forex', contractSize=100000, correct quote currencies (USD for EURUSD/GBPUSD/AUDUSD/NZDUSD; JPY/CAD/CHF for USD-base pairs); crypto/stocks have contractSize=1. (2) GET /api/market/quotes?symbols=EURUSD,USDJPY,GBPUSD returns valid prices (EURUSD=1.143 in range 1.0-1.3, USDJPY=162.217 in range 130-180), changePercent present; called twice with 6s gap, both succeeded. (3) GET /api/market/candles works for EURUSD 1h (300 candles), EURUSD 1d (260 candles), USDJPY 15m (300 candles), all in ascending order with proper OHLC structure. (4) FOREX TRADING MATH with fresh user (deposit $10,000): EURUSD buy 0.01 lots leverage 10 -> position has contractSize=100000, quoteCurrency='USD', entryPrice=1.142985675 (≈ mid*1.00025), notional=$1,142.99 (≈ 0.01*100000*entryPrice), margin=$114.30 (notional/10). USDJPY buy 0.01 lots leverage 10 -> notional=$1,000 exactly (USD-base), margin=$100. GET /api/account/summary -> usedMargin=$214.30 (sum of both margins), equity=$9,998.93 (balance + floatingPnl). Closed both positions -> EURUSD pnl=-$0.57, USDJPY pnl=-$0.50 (both within -$20 to +$20 for immediate close), balance updated by exact pnl sum to $9,998.93. Oversized order (10 lots leverage 1 EURUSD) correctly rejected with 400 'Insufficient free margin. Required: $1,143,040.69, available: $9,998.60'. (5) REGRESSION: crypto order BTCUSD 0.01 lots leverage 10 works, margin=$65.34 (0.01*entryPrice/10), close works with pnl=-$0.33. All forex functionality working correctly. Test script: /app/backend_test_forex.py"

  - task: "Major Rewrite: 32 symbols with category-based leverage (crypto 1:10, forex 1:100, metal 1:20, index 1:50, stock 1:10)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "MAJOR BACKEND REWRITE: Added 32 symbols total (8 crypto, 13 forex, 2 metals, 3 indices, 6 stocks). Category-based max leverage enforced in POST /api/orders. maxLeverage included per-symbol in GET /api/market/symbols. New symbols: XAUUSD/XAGUSD (metal), US500/US100/US30 (index), EURGBP/EURJPY/GBPJPY/EURCHF/AUDJPY/EURAUD (forex crosses), DOGEUSD/ADAUSD/LINKUSD (crypto), AMZN/GOOGL (stocks)."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: GET /api/market/symbols returns exactly 32 symbols with correct maxLeverage per category (crypto=10, forex=100, metal=20, index=50, stock=10). All required new symbols present: XAUUSD/XAGUSD (type=metal, maxLeverage=20), US500/US100/US30 (type=index, maxLeverage=50), EURGBP/EURJPY/GBPJPY/EURCHF/AUDJPY/EURAUD (forex crosses, maxLeverage=100), DOGEUSD/ADAUSD/LINKUSD (crypto, maxLeverage=10), AMZN/GOOGL (stocks, maxLeverage=10). Each symbol includes pipSize, contractSize, quote fields. Category leverage enforcement tested with fresh user: BTCUSD leverage 20 rejected (400 'Maximum leverage for crypto is 1:10'), EURUSD leverage 100 accepted, XAUUSD leverage 50 rejected (400 'Maximum leverage for metal is 1:20'), XAUUSD leverage 20 accepted, US500 leverage 100 rejected (400 'Maximum leverage for index is 1:50'), US500 leverage 50 accepted. All positions closed successfully with PnL applied. Test script: /app/backend_test_rewrite.py"

  - task: "Dynamic pip-based spread: quotes include bid/ask/spreadPips/pipSize, spread randomized 1x-2x base pips"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Dynamic spread in PIPS: settings.spreadPips (default 1), actual spread randomized between 1x-2x base pips per quote. Quotes now include bid/ask/spreadPips/pipSize where bid < price < ask, and (ask-bid) ≈ spreadPips * pipSize. Response includes baseSpreadPips."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: GET /api/market/quotes?symbols=BTCUSD,EURUSD,XAUUSD returns quotes with bid/ask/spreadPips/pipSize. baseSpreadPips=1 returned. For each symbol: bid < price < ask verified, spread calculation (ask-bid) ≈ spreadPips * pipSize accurate within 10% tolerance. spreadPips values between 1.0 and 2.0 (1x-2x base). Examples: BTCUSD spreadPips=1.32, EURUSD spreadPips=1.43, XAUUSD spreadPips=1.55. All spread math correct. Test script: /app/backend_test_rewrite.py"

  - task: "NOWPayments crypto deposits: GET /api/payments/currencies, POST /api/transactions/deposit with payCurrency, status polling"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "NOWPayments crypto deposits: GET /api/payments/currencies returns popular pay currencies. POST /api/transactions/deposit requires {amount, payCurrency}, creates real NOWPayments payment (returns payAddress, payAmount, paymentId, status=waiting_payment). GET /api/transactions/deposit/{id}/status polls NOWPayments and maps status (finished/confirmed->pending for admin approval; failed/expired->failed). Admin approve credits balance. NOTE: NOWPayments API key is real - creating deposits hits live API (no funds move unless someone pays the address)."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: GET /api/payments/currencies returns 10 currencies (btc, eth, usdttrc20, etc.) with code/label. POST /api/transactions/deposit {amount: 50, payCurrency: 'usdttrc20'} returns 201 with transaction containing payAddress (TWfLdph4qtBaUkG1xgtEHxKk4FmVAo1aAK), payAmount (50.050059), paymentId (6350514825), status=waiting_payment. GET /api/transactions/deposit/{id}/status returns transaction with paymentStatus='waiting' (mapped to status=waiting_payment). Validation working: amount < 10 returns 400 'Minimum deposit is $10', missing payCurrency returns 400 'Select the cryptocurrency you will pay with'. Live NOWPayments API integration working correctly. Test script: /app/backend_test_rewrite.py"

  - task: "Withdrawals require walletAddress (min 15 chars), admin approve/reject flow"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Withdrawals now require walletAddress (min 15 chars) + optional network. POST /api/transactions/withdraw {amount, walletAddress, network} creates status=pending for admin approval. Admin reject refunds balance."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/transactions/withdraw without walletAddress returns 400 'A valid crypto wallet address is required'. POST with {amount: 100, walletAddress: 'TXYZabc1234567890abcdefghijklmnop', network: 'TRC20'} returns 201, status=pending, balance deducted from $1000 to $900. Admin POST /api/admin/transactions/{id}/reject returns 200, balance refunded to $1000. Admin POST /api/admin/transactions/{id}/approve returns 200, balance stays at $800 (deduction kept). Withdrawal flow working correctly. Test script: /app/backend_test_rewrite.py"

  - task: "Admin settings: GET/PUT /api/admin/settings with spreadPips (0.1-10), tradingEnabled, categoryLeverage"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Admin settings: GET /api/admin/settings returns {spreadPips, tradingEnabled, categoryLeverage}. PUT accepts spreadPips (0.1-10 range enforced) and tradingEnabled. maxLeverage setting REMOVED - replaced by category rules. tradingEnabled=false blocks orders (403)."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: GET /api/admin/settings returns spreadPips=1, tradingEnabled=true, categoryLeverage={crypto:10, forex:100, metal:20, index:50, stock:10}. PUT {spreadPips: 2} returns 200, setting updated. PUT {spreadPips: 20} returns 400 'Base spread must be between 0.1 and 10 pips'. PUT {tradingEnabled: false} returns 200, subsequent order attempt returns 403 'Trading is temporarily disabled by the platform'. Settings restored to spreadPips=1, tradingEnabled=true. All admin settings working correctly. Test script: /app/backend_test_rewrite.py"
