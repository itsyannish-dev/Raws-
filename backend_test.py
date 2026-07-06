#!/usr/bin/env python3
"""
RAWMarkets Backend API Test Suite
Tests all backend endpoints with comprehensive scenarios
"""
import requests
import time
import random
import string
from typing import Dict, Any
import urllib3

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Base URL from .env
BASE_URL = "https://broker-live.preview.emergentagent.com/api"

# Test state
test_state = {
    "token": None,
    "user": None,
    "position_id": None,
    "initial_balance": 0,
    "deposit_amount": 10000
}

def generate_test_email():
    """Generate unique test email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{rand}@rawmarkets.test"

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")
    return passed

def make_request(method: str, endpoint: str, data: Dict = None, auth: bool = False, expect_error: bool = False):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}/{endpoint}"
    headers = {"Content-Type": "application/json"}
    if auth and test_state["token"]:
        headers["Authorization"] = f"Bearer {test_state['token']}"
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            if method == "GET":
                resp = requests.get(url, headers=headers, timeout=15, verify=False)
            elif method == "POST":
                resp = requests.post(url, json=data, headers=headers, timeout=15, verify=False)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Add small delay to avoid overwhelming server
            time.sleep(0.1)
            return resp
            
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"    ⚠️  Timeout, retrying ({attempt + 1}/{max_retries})...")
                time.sleep(2)
                continue
            else:
                print(f"    ⚠️  Request timed out after {max_retries} attempts")
                return None
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                print(f"    ⚠️  Request failed: {type(e).__name__}: {e}, retrying...")
                time.sleep(2)
                continue
            else:
                print(f"    ⚠️  Request failed: {type(e).__name__}: {e}")
                return None
        except Exception as e:
            print(f"    ⚠️  Unexpected error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    return None

# ============================================================
# TEST 1: AUTH - REGISTER
# ============================================================
def test_auth_register():
    print("\n" + "="*60)
    print("TEST 1: AUTH - REGISTER")
    print("="*60)
    
    # Generate fresh user
    test_email = generate_test_email()
    test_password = "TestPass123!"
    test_name = "Test User"
    
    # Valid registration
    resp = make_request("POST", "auth/register", {
        "name": test_name,
        "email": test_email,
        "password": test_password
    })
    
    if not resp:
        return log_test("Register new user", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Register new user", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if not data.get("token") or not data.get("user"):
        return log_test("Register new user", False, "Missing token or user in response")
    
    user = data["user"]
    if user.get("balance") != 0 or user.get("role") != "user":
        return log_test("Register new user", False, f"Expected balance=0, role=user, got balance={user.get('balance')}, role={user.get('role')}")
    
    # Save for later tests
    test_state["token"] = data["token"]
    test_state["user"] = user
    test_state["test_email"] = test_email
    test_state["test_password"] = test_password
    
    log_test("Register new user", True, f"User created: {user['email']}, balance: ${user['balance']}")
    
    # Duplicate email
    resp = make_request("POST", "auth/register", {
        "name": test_name,
        "email": test_email,
        "password": test_password
    })
    
    if resp and resp.status_code == 409:
        log_test("Duplicate email returns 409", True)
    else:
        log_test("Duplicate email returns 409", False, f"Expected 409, got {resp.status_code if resp else 'no response'}")
    
    # Short password
    resp = make_request("POST", "auth/register", {
        "name": "Test",
        "email": generate_test_email(),
        "password": "123"
    })
    
    if resp and resp.status_code == 400:
        log_test("Short password returns 400", True)
    else:
        log_test("Short password returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Invalid email
    resp = make_request("POST", "auth/register", {
        "name": "Test",
        "email": "invalid-email",
        "password": "TestPass123!"
    })
    
    if resp and resp.status_code == 400:
        log_test("Invalid email returns 400", True)
    else:
        log_test("Invalid email returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 2: AUTH - LOGIN
# ============================================================
def test_auth_login():
    print("\n" + "="*60)
    print("TEST 2: AUTH - LOGIN")
    print("="*60)
    
    # Valid login
    resp = make_request("POST", "auth/login", {
        "email": test_state["test_email"],
        "password": test_state["test_password"]
    })
    
    if not resp:
        return log_test("Login with valid credentials", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Login with valid credentials", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if not data.get("token"):
        return log_test("Login with valid credentials", False, "Missing token in response")
    
    log_test("Login with valid credentials", True, "Token received")
    
    # Wrong password
    resp = make_request("POST", "auth/login", {
        "email": test_state["test_email"],
        "password": "WrongPassword123!"
    })
    
    if resp and resp.status_code == 401:
        log_test("Wrong password returns 401", True)
    else:
        log_test("Wrong password returns 401", False, f"Expected 401, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 3: AUTH - ME
# ============================================================
def test_auth_me():
    print("\n" + "="*60)
    print("TEST 3: AUTH - ME")
    print("="*60)
    
    # With token
    resp = make_request("GET", "auth/me", auth=True)
    
    if not resp:
        return log_test("GET /auth/me with token", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /auth/me with token", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if not data.get("user"):
        return log_test("GET /auth/me with token", False, "Missing user in response")
    
    log_test("GET /auth/me with token", True, f"User: {data['user']['email']}")
    
    # Without token
    resp = make_request("GET", "auth/me", auth=False)
    
    if resp and resp.status_code == 401:
        log_test("GET /auth/me without token returns 401", True)
    else:
        log_test("GET /auth/me without token returns 401", False, f"Expected 401, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 4: MARKET DATA - SYMBOLS
# ============================================================
def test_market_symbols():
    print("\n" + "="*60)
    print("TEST 4: MARKET DATA - SYMBOLS")
    print("="*60)
    
    resp = make_request("GET", "market/symbols")
    
    if not resp:
        return log_test("GET /market/symbols", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /market/symbols", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    symbols = data.get("symbols", [])
    
    if len(symbols) != 14:
        return log_test("Returns 14 symbols", False, f"Expected 14, got {len(symbols)}")
    
    crypto_count = sum(1 for s in symbols if s.get("type") == "crypto")
    stock_count = sum(1 for s in symbols if s.get("type") == "stock")
    
    if crypto_count == 8 and stock_count == 6:
        log_test("Returns 14 symbols (8 crypto, 6 stocks)", True, f"Crypto: {crypto_count}, Stocks: {stock_count}")
    else:
        log_test("Returns 14 symbols (8 crypto, 6 stocks)", False, f"Expected 8 crypto + 6 stocks, got {crypto_count} crypto + {stock_count} stocks")

# ============================================================
# TEST 5: MARKET DATA - QUOTES
# ============================================================
def test_market_quotes():
    print("\n" + "="*60)
    print("TEST 5: MARKET DATA - QUOTES")
    print("="*60)
    
    # All quotes
    resp = make_request("GET", "market/quotes")
    
    if not resp:
        return log_test("GET /market/quotes (all)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /market/quotes (all)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    quotes = data.get("quotes", {})
    
    # Check for key symbols
    has_btc = "BTCUSD" in quotes
    has_aapl = "AAPL" in quotes
    
    if has_btc and has_aapl:
        btc_quote = quotes["BTCUSD"]
        log_test("GET /market/quotes (all)", True, f"BTCUSD: ${btc_quote.get('price')}, AAPL: ${quotes['AAPL'].get('price')}")
    else:
        log_test("GET /market/quotes (all)", False, f"Missing BTCUSD or AAPL in quotes")
    
    # Filtered quotes
    resp = make_request("GET", "market/quotes?symbols=BTCUSD,ETHUSD")
    
    if not resp:
        return log_test("GET /market/quotes?symbols=BTCUSD,ETHUSD", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /market/quotes?symbols=BTCUSD,ETHUSD", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    quotes = data.get("quotes", {})
    
    if "BTCUSD" in quotes and "ETHUSD" in quotes and "AAPL" not in quotes:
        log_test("GET /market/quotes with filter", True, f"Returned only requested symbols: {list(quotes.keys())}")
    else:
        log_test("GET /market/quotes with filter", False, f"Expected only BTCUSD and ETHUSD, got {list(quotes.keys())}")

# ============================================================
# TEST 6: MARKET DATA - CANDLES
# ============================================================
def test_market_candles():
    print("\n" + "="*60)
    print("TEST 6: MARKET DATA - CANDLES")
    print("="*60)
    
    # BTCUSD 1h
    resp = make_request("GET", "market/candles?symbol=BTCUSD&interval=1h")
    
    if not resp:
        return log_test("GET /market/candles BTCUSD 1h", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /market/candles BTCUSD 1h", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    candles = data.get("candles", [])
    
    if len(candles) > 0:
        first = candles[0]
        last = candles[-1]
        has_required_fields = all(k in first for k in ["time", "open", "high", "low", "close"])
        is_ascending = all(candles[i]["time"] <= candles[i+1]["time"] for i in range(len(candles)-1))
        
        if has_required_fields and is_ascending:
            log_test("GET /market/candles BTCUSD 1h", True, f"{len(candles)} candles, ascending order")
        else:
            log_test("GET /market/candles BTCUSD 1h", False, f"Missing fields or not ascending")
    else:
        log_test("GET /market/candles BTCUSD 1h", False, "No candles returned")
    
    # BTCUSD 1d
    resp = make_request("GET", "market/candles?symbol=BTCUSD&interval=1d")
    
    if resp and resp.status_code == 200:
        log_test("GET /market/candles BTCUSD 1d", True)
    else:
        log_test("GET /market/candles BTCUSD 1d", False, f"Expected 200, got {resp.status_code if resp else 'no response'}")
    
    # AAPL 1h (stock)
    resp = make_request("GET", "market/candles?symbol=AAPL&interval=1h")
    
    if resp and resp.status_code == 200:
        data = resp.json()
        candles = data.get("candles", [])
        log_test("GET /market/candles AAPL 1h (stock)", True, f"{len(candles)} candles")
    else:
        log_test("GET /market/candles AAPL 1h (stock)", False, f"Expected 200, got {resp.status_code if resp else 'no response'}")
    
    # Unknown symbol
    resp = make_request("GET", "market/candles?symbol=INVALID&interval=1h")
    
    if resp and resp.status_code == 400:
        log_test("Unknown symbol returns 400", True)
    else:
        log_test("Unknown symbol returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 7: MARKET DATA - WS CONFIG
# ============================================================
def test_market_ws_config():
    print("\n" + "="*60)
    print("TEST 7: MARKET DATA - WS CONFIG")
    print("="*60)
    
    # Without auth
    resp = make_request("GET", "market/ws-config", auth=False)
    
    if resp and resp.status_code == 401:
        log_test("GET /market/ws-config without auth returns 401", True)
    else:
        log_test("GET /market/ws-config without auth returns 401", False, f"Expected 401, got {resp.status_code if resp else 'no response'}")
    
    # With auth
    resp = make_request("GET", "market/ws-config", auth=True)
    
    if not resp:
        return log_test("GET /market/ws-config with auth", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /market/ws-config with auth", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if data.get("token") and data.get("subscriptions"):
        log_test("GET /market/ws-config with auth", True, f"{len(data['subscriptions'])} subscriptions")
    else:
        log_test("GET /market/ws-config with auth", False, "Missing token or subscriptions")

# ============================================================
# TEST 8: TRADING - ORDER WITH $0 BALANCE
# ============================================================
def test_order_insufficient_balance():
    print("\n" + "="*60)
    print("TEST 8: TRADING - ORDER WITH $0 BALANCE")
    print("="*60)
    
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if resp and resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "margin" in error_msg.lower():
            log_test("Order with $0 balance returns 400 insufficient margin", True, f"Error: {error_msg}")
        else:
            log_test("Order with $0 balance returns 400 insufficient margin", False, f"Wrong error message: {error_msg}")
    else:
        log_test("Order with $0 balance returns 400 insufficient margin", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 9: WALLET - DEPOSIT
# ============================================================
def test_deposit():
    print("\n" + "="*60)
    print("TEST 9: WALLET - DEPOSIT")
    print("="*60)
    
    deposit_amount = test_state["deposit_amount"]
    
    resp = make_request("POST", "transactions/deposit", {
        "amount": deposit_amount
    }, auth=True)
    
    if not resp:
        return log_test("POST /transactions/deposit", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("POST /transactions/deposit", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    tx = data.get("transaction")
    balance = data.get("balance")
    
    if not tx or balance != deposit_amount:
        return log_test("POST /transactions/deposit", False, f"Expected balance={deposit_amount}, got {balance}")
    
    if tx.get("status") != "completed":
        return log_test("POST /transactions/deposit", False, f"Expected status=completed, got {tx.get('status')}")
    
    test_state["initial_balance"] = balance
    log_test("POST /transactions/deposit", True, f"Deposited ${deposit_amount}, balance: ${balance}")

# ============================================================
# TEST 10: TRADING - PLACE ORDER
# ============================================================
def test_place_order():
    print("\n" + "="*60)
    print("TEST 10: TRADING - PLACE ORDER")
    print("="*60)
    
    # Get current market price
    resp = make_request("GET", "market/quotes?symbols=BTCUSD")
    if not resp or resp.status_code != 200:
        return log_test("Place buy order", False, "Failed to get market price")
    
    market_price = resp.json()["quotes"]["BTCUSD"]["price"]
    
    # Place buy order
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if not resp:
        return log_test("Place buy order", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Place buy order", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    position = data.get("position")
    
    if not position:
        return log_test("Place buy order", False, "Missing position in response")
    
    # Verify entry price (should be ask = market * 1.00025)
    entry_price = position.get("entryPrice")
    expected_ask = market_price * 1.00025
    price_diff_pct = abs(entry_price - expected_ask) / expected_ask * 100
    
    # Verify margin calculation
    lots = position.get("lots")
    leverage = position.get("leverage")
    margin = position.get("margin")
    expected_margin = (lots * entry_price) / leverage
    margin_diff_pct = abs(margin - expected_margin) / expected_margin * 100
    
    if price_diff_pct < 1 and margin_diff_pct < 1:  # Allow 1% tolerance
        test_state["position_id"] = position.get("id")
        log_test("Place buy order", True, f"Position created: {position['id']}, entry: ${entry_price:.2f}, margin: ${margin:.2f}")
    else:
        log_test("Place buy order", False, f"Price or margin calculation incorrect. Entry: ${entry_price:.2f} (expected ~${expected_ask:.2f}), Margin: ${margin:.2f} (expected ~${expected_margin:.2f})")

# ============================================================
# TEST 11: POSITIONS - GET OPEN
# ============================================================
def test_get_open_positions():
    print("\n" + "="*60)
    print("TEST 11: POSITIONS - GET OPEN")
    print("="*60)
    
    resp = make_request("GET", "positions?status=open", auth=True)
    
    if not resp:
        return log_test("GET /positions?status=open", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /positions?status=open", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    positions = data.get("positions", [])
    
    if len(positions) > 0 and any(p.get("id") == test_state["position_id"] for p in positions):
        log_test("GET /positions?status=open", True, f"Found {len(positions)} open position(s)")
    else:
        log_test("GET /positions?status=open", False, f"Position {test_state['position_id']} not found in open positions")

# ============================================================
# TEST 12: ACCOUNT SUMMARY
# ============================================================
def test_account_summary():
    print("\n" + "="*60)
    print("TEST 12: ACCOUNT SUMMARY")
    print("="*60)
    
    resp = make_request("GET", "account/summary", auth=True)
    
    if not resp:
        return log_test("GET /account/summary", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /account/summary", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    account = data.get("account")
    
    if not account:
        return log_test("GET /account/summary", False, "Missing account in response")
    
    balance = account.get("balance")
    equity = account.get("equity")
    floating_pnl = account.get("floatingPnl")
    used_margin = account.get("usedMargin")
    free_margin = account.get("freeMargin")
    
    # Verify calculations
    expected_equity = balance + floating_pnl
    expected_free_margin = equity - used_margin
    
    equity_correct = abs(equity - expected_equity) < 0.01
    free_margin_correct = abs(free_margin - expected_free_margin) < 0.01
    
    if equity_correct and free_margin_correct:
        log_test("GET /account/summary", True, f"Balance: ${balance:.2f}, Equity: ${equity:.2f}, Floating PnL: ${floating_pnl:.2f}, Used Margin: ${used_margin:.2f}, Free Margin: ${free_margin:.2f}")
    else:
        log_test("GET /account/summary", False, f"Calculation mismatch. Equity: ${equity:.2f} (expected ${expected_equity:.2f}), Free Margin: ${free_margin:.2f} (expected ${expected_free_margin:.2f})")

# ============================================================
# TEST 13: CLOSE POSITION
# ============================================================
def test_close_position():
    print("\n" + "="*60)
    print("TEST 13: CLOSE POSITION")
    print("="*60)
    
    if not test_state["position_id"]:
        return log_test("Close position", False, "No position ID available")
    
    # Get balance before close
    resp = make_request("GET", "auth/me", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Close position", False, "Failed to get balance before close")
    
    balance_before = resp.json()["user"]["balance"]
    
    # Close position
    resp = make_request("POST", f"positions/{test_state['position_id']}/close", auth=True)
    
    if not resp:
        return log_test("Close position", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Close position", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    position = data.get("position")
    balance_after = data.get("balance")
    
    if not position or balance_after is None:
        return log_test("Close position", False, "Missing position or balance in response")
    
    pnl = position.get("pnl")
    close_price = position.get("closePrice")
    
    # Verify balance updated by exactly PnL
    expected_balance = balance_before + pnl
    balance_correct = abs(balance_after - expected_balance) < 0.01
    
    if balance_correct and close_price:
        log_test("Close position", True, f"Position closed. Close price: ${close_price:.2f}, PnL: ${pnl:.2f}, Balance: ${balance_before:.2f} -> ${balance_after:.2f}")
    else:
        log_test("Close position", False, f"Balance mismatch. Expected ${expected_balance:.2f}, got ${balance_after:.2f}")
    
    # Verify position in closed list
    resp = make_request("GET", "positions?status=closed", auth=True)
    if resp and resp.status_code == 200:
        positions = resp.json().get("positions", [])
        if any(p.get("id") == test_state["position_id"] for p in positions):
            log_test("Closed position in closed list", True)
        else:
            log_test("Closed position in closed list", False, "Position not found in closed list")

# ============================================================
# TEST 14: CLOSE SAME POSITION AGAIN
# ============================================================
def test_close_position_again():
    print("\n" + "="*60)
    print("TEST 14: CLOSE SAME POSITION AGAIN")
    print("="*60)
    
    if not test_state["position_id"]:
        return log_test("Close same position again", False, "No position ID available")
    
    resp = make_request("POST", f"positions/{test_state['position_id']}/close", auth=True)
    
    if resp and resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "closed" in error_msg.lower():
            log_test("Close same position again returns 400", True, f"Error: {error_msg}")
        else:
            log_test("Close same position again returns 400", False, f"Wrong error message: {error_msg}")
    else:
        log_test("Close same position again returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 15: ORDER VALIDATION
# ============================================================
def test_order_validation():
    print("\n" + "="*60)
    print("TEST 15: ORDER VALIDATION")
    print("="*60)
    
    # Invalid side
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "invalid",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Invalid side returns 400", True)
    else:
        log_test("Invalid side returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Invalid leverage
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 0.01,
        "leverage": 7
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Invalid leverage returns 400", True)
    else:
        log_test("Invalid leverage returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Lots 0
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 0,
        "leverage": 10
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Lots 0 returns 400", True)
    else:
        log_test("Lots 0 returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Negative lots
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": -0.01,
        "leverage": 10
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Negative lots returns 400", True)
    else:
        log_test("Negative lots returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Unknown symbol
    resp = make_request("POST", "orders", {
        "symbol": "INVALID",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Unknown symbol returns 400", True)
    else:
        log_test("Unknown symbol returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Order without auth
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=False)
    
    if resp and resp.status_code == 401:
        log_test("Order without auth returns 401", True)
    else:
        log_test("Order without auth returns 401", False, f"Expected 401, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 16: OVERSIZED ORDER
# ============================================================
def test_oversized_order():
    print("\n" + "="*60)
    print("TEST 16: OVERSIZED ORDER")
    print("="*60)
    
    # Get current balance
    resp = make_request("GET", "auth/me", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Oversized order", False, "Failed to get balance")
    
    balance = resp.json()["user"]["balance"]
    
    # Try to place order that requires more margin than available
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 100,
        "leverage": 1
    }, auth=True)
    
    if resp and resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "margin" in error_msg.lower():
            log_test("Oversized order returns 400 insufficient margin", True, f"Error: {error_msg}")
        else:
            log_test("Oversized order returns 400 insufficient margin", False, f"Wrong error message: {error_msg}")
    else:
        log_test("Oversized order returns 400 insufficient margin", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 17: WALLET - WITHDRAW MORE THAN BALANCE
# ============================================================
def test_withdraw_insufficient():
    print("\n" + "="*60)
    print("TEST 17: WALLET - WITHDRAW MORE THAN BALANCE")
    print("="*60)
    
    # Get current balance
    resp = make_request("GET", "auth/me", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Withdraw more than balance", False, "Failed to get balance")
    
    balance = resp.json()["user"]["balance"]
    
    # Try to withdraw more than balance
    resp = make_request("POST", "transactions/withdraw", {
        "amount": balance + 1000
    }, auth=True)
    
    if resp and resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "insufficient" in error_msg.lower() or "available" in error_msg.lower():
            log_test("Withdraw more than balance returns 400", True, f"Error: {error_msg}")
        else:
            log_test("Withdraw more than balance returns 400", False, f"Wrong error message: {error_msg}")
    else:
        log_test("Withdraw more than balance returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 18: WALLET - VALID WITHDRAW
# ============================================================
def test_withdraw_valid():
    print("\n" + "="*60)
    print("TEST 18: WALLET - VALID WITHDRAW")
    print("="*60)
    
    # Get current balance
    resp = make_request("GET", "auth/me", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Valid withdraw", False, "Failed to get balance")
    
    balance_before = resp.json()["user"]["balance"]
    withdraw_amount = 500
    
    # Withdraw
    resp = make_request("POST", "transactions/withdraw", {
        "amount": withdraw_amount
    }, auth=True)
    
    if not resp:
        return log_test("Valid withdraw", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Valid withdraw", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    tx = data.get("transaction")
    balance_after = data.get("balance")
    
    if not tx or balance_after is None:
        return log_test("Valid withdraw", False, "Missing transaction or balance in response")
    
    if tx.get("status") != "pending":
        return log_test("Valid withdraw", False, f"Expected status=pending, got {tx.get('status')}")
    
    expected_balance = balance_before - withdraw_amount
    if abs(balance_after - expected_balance) < 0.01:
        log_test("Valid withdraw", True, f"Withdrew ${withdraw_amount}, status: pending, balance: ${balance_before:.2f} -> ${balance_after:.2f}")
    else:
        log_test("Valid withdraw", False, f"Balance mismatch. Expected ${expected_balance:.2f}, got ${balance_after:.2f}")

# ============================================================
# TEST 19: WALLET - DEPOSIT VALIDATION
# ============================================================
def test_deposit_validation():
    print("\n" + "="*60)
    print("TEST 19: WALLET - DEPOSIT VALIDATION")
    print("="*60)
    
    # Negative amount
    resp = make_request("POST", "transactions/deposit", {
        "amount": -5
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Negative deposit returns 400", True)
    else:
        log_test("Negative deposit returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")
    
    # Excessive amount
    resp = make_request("POST", "transactions/deposit", {
        "amount": 2000000
    }, auth=True)
    
    if resp and resp.status_code == 400:
        log_test("Excessive deposit returns 400", True)
    else:
        log_test("Excessive deposit returns 400", False, f"Expected 400, got {resp.status_code if resp else 'no response'}")

# ============================================================
# TEST 20: WALLET - GET TRANSACTIONS
# ============================================================
def test_get_transactions():
    print("\n" + "="*60)
    print("TEST 20: WALLET - GET TRANSACTIONS")
    print("="*60)
    
    resp = make_request("GET", "transactions", auth=True)
    
    if not resp:
        return log_test("GET /transactions", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /transactions", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    transactions = data.get("transactions", [])
    
    # Should have at least deposit and withdrawal
    has_deposit = any(tx.get("type") == "deposit" for tx in transactions)
    has_withdrawal = any(tx.get("type") == "withdrawal" for tx in transactions)
    
    if has_deposit and has_withdrawal:
        log_test("GET /transactions", True, f"Found {len(transactions)} transactions (deposit + withdrawal)")
    else:
        log_test("GET /transactions", False, f"Missing deposit or withdrawal in transactions. Has deposit: {has_deposit}, Has withdrawal: {has_withdrawal}")

# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "="*60)
    print("RAWMarkets Backend API Test Suite")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print("="*60)
    
    try:
        # Run all tests in sequence
        test_auth_register()
        test_auth_login()
        test_auth_me()
        test_market_symbols()
        test_market_quotes()
        test_market_candles()
        test_market_ws_config()
        test_order_insufficient_balance()
        test_deposit()
        test_place_order()
        test_get_open_positions()
        test_account_summary()
        test_close_position()
        test_close_position_again()
        test_order_validation()
        test_oversized_order()
        test_withdraw_insufficient()
        test_withdraw_valid()
        test_deposit_validation()
        test_get_transactions()
        
        print("\n" + "="*60)
        print("TEST SUITE COMPLETE")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
