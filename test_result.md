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

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
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
