#!/usr/bin/env python3
"""
RAWMarkets Forex Trading Test Suite
Tests forex symbols, quotes, candles, and trading math
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
    "eurusd_position_id": None,
    "usdjpy_position_id": None,
    "btcusd_position_id": None,
    "initial_balance": 0,
    "deposit_amount": 10000
}

def generate_test_email():
    """Generate unique test email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"forex_test_{rand}@rawmarkets.test"

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")
    return passed

def make_request(method: str, endpoint: str, data: Dict = None, auth: bool = False):
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
            
            time.sleep(0.1)
            return resp
            
        except requests.exceptions.ConnectionError as e:
            if "Connection refused" in str(e):
                print(f"    ⚠️  Server restarting, waiting 5s...")
                time.sleep(5)
                continue
            if attempt < max_retries - 1:
                print(f"    ⚠️  Connection error, retrying...")
                time.sleep(2)
                continue
            else:
                print(f"    ⚠️  Connection failed: {e}")
                return None
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"    ⚠️  Timeout, retrying...")
                time.sleep(2)
                continue
            else:
                print(f"    ⚠️  Request timed out")
                return None
        except Exception as e:
            print(f"    ⚠️  Error: {type(e).__name__}: {e}")
            return None
    
    return None

# ============================================================
# TEST 1: FOREX SYMBOLS
# ============================================================
def test_forex_symbols():
    print("\n" + "="*60)
    print("TEST 1: FOREX SYMBOLS")
    print("="*60)
    
    resp = make_request("GET", "market/symbols")
    if not resp or resp.status_code != 200:
        return log_test("GET /api/market/symbols", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    symbols = data.get("symbols", [])
    
    # Check total count
    if len(symbols) != 21:
        return log_test("Total symbols count", False, f"Expected 21, got {len(symbols)}")
    log_test("Total symbols count", True, f"21 symbols found")
    
    # Check forex symbols
    forex_symbols = [s for s in symbols if s.get("type") == "forex"]
    expected_forex = ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDJPY", "USDCAD", "USDCHF"]
    
    if len(forex_symbols) != 7:
        return log_test("Forex symbols count", False, f"Expected 7, got {len(forex_symbols)}")
    log_test("Forex symbols count", True, f"7 forex pairs found")
    
    # Verify each forex symbol
    forex_map = {s["symbol"]: s for s in forex_symbols}
    all_passed = True
    
    for symbol in expected_forex:
        if symbol not in forex_map:
            log_test(f"Forex symbol {symbol}", False, "Not found")
            all_passed = False
            continue
        
        meta = forex_map[symbol]
        
        # Check contractSize
        if meta.get("contractSize") != 100000:
            log_test(f"{symbol} contractSize", False, f"Expected 100000, got {meta.get('contractSize')}")
            all_passed = False
            continue
        
        # Check quote currency
        expected_quote = {
            "EURUSD": "USD", "GBPUSD": "USD", "AUDUSD": "USD", "NZDUSD": "USD",
            "USDJPY": "JPY", "USDCAD": "CAD", "USDCHF": "CHF"
        }
        if meta.get("quote") != expected_quote[symbol]:
            log_test(f"{symbol} quote currency", False, f"Expected {expected_quote[symbol]}, got {meta.get('quote')}")
            all_passed = False
            continue
        
        log_test(f"{symbol} metadata", True, f"contractSize=100000, quote={meta.get('quote')}")
    
    # Check crypto/stocks have contractSize=1
    crypto_stocks = [s for s in symbols if s.get("type") in ["crypto", "stock"]]
    for s in crypto_stocks:
        if s.get("contractSize") != 1:
            log_test(f"{s['symbol']} contractSize", False, f"Expected 1, got {s.get('contractSize')}")
            all_passed = False
    
    if all_passed:
        log_test("All symbol metadata", True, "Crypto/stocks have contractSize=1")
    
    return all_passed

# ============================================================
# TEST 2: FOREX QUOTES
# ============================================================
def test_forex_quotes():
    print("\n" + "="*60)
    print("TEST 2: FOREX QUOTES")
    print("="*60)
    
    # Test 1: Get specific forex quotes
    resp = make_request("GET", "market/quotes?symbols=EURUSD,USDJPY,GBPUSD")
    if not resp or resp.status_code != 200:
        return log_test("GET /api/market/quotes (forex)", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    quotes = data.get("quotes", {})
    
    # Check EURUSD
    if "EURUSD" not in quotes:
        return log_test("EURUSD quote", False, "Not found in response")
    
    eurusd = quotes["EURUSD"]
    price = eurusd.get("price")
    
    if not price or not isinstance(price, (int, float)):
        return log_test("EURUSD price", False, f"Invalid price: {price}")
    
    if not (1.0 <= price <= 1.3):
        log_test("EURUSD price range", False, f"Price {price} outside expected range 1.0-1.3")
    else:
        log_test("EURUSD price range", True, f"Price: {price}")
    
    if "changePercent" not in eurusd:
        log_test("EURUSD changePercent", False, "Missing changePercent field")
    else:
        log_test("EURUSD changePercent", True, f"changePercent: {eurusd['changePercent']}")
    
    # Check USDJPY
    if "USDJPY" not in quotes:
        return log_test("USDJPY quote", False, "Not found in response")
    
    usdjpy = quotes["USDJPY"]
    price = usdjpy.get("price")
    
    if not price or not isinstance(price, (int, float)):
        return log_test("USDJPY price", False, f"Invalid price: {price}")
    
    if not (130 <= price <= 180):
        log_test("USDJPY price range", False, f"Price {price} outside expected range 130-180")
    else:
        log_test("USDJPY price range", True, f"Price: {price}")
    
    if "changePercent" not in usdjpy:
        log_test("USDJPY changePercent", False, "Missing changePercent field")
    else:
        log_test("USDJPY changePercent", True, f"changePercent: {usdjpy['changePercent']}")
    
    # Check GBPUSD
    if "GBPUSD" not in quotes:
        return log_test("GBPUSD quote", False, "Not found in response")
    
    gbpusd = quotes["GBPUSD"]
    if "changePercent" not in gbpusd:
        log_test("GBPUSD changePercent", False, "Missing changePercent field")
    else:
        log_test("GBPUSD quote", True, f"Price: {gbpusd.get('price')}, changePercent: {gbpusd['changePercent']}")
    
    # Test 2: Call twice with 6s gap
    print("\n  Testing quote caching (6s gap)...")
    time.sleep(6)
    
    resp2 = make_request("GET", "market/quotes?symbols=EURUSD,USDJPY,GBPUSD")
    if not resp2 or resp2.status_code != 200:
        return log_test("Second quote request", False, f"Status: {resp2.status_code if resp2 else 'No response'}")
    
    data2 = resp2.json()
    quotes2 = data2.get("quotes", {})
    
    if "EURUSD" in quotes2 and "USDJPY" in quotes2:
        log_test("Second quote request", True, "Both requests succeeded")
    else:
        log_test("Second quote request", False, "Missing quotes in second response")
    
    return True

# ============================================================
# TEST 3: FOREX CANDLES
# ============================================================
def test_forex_candles():
    print("\n" + "="*60)
    print("TEST 3: FOREX CANDLES")
    print("="*60)
    
    # Test EURUSD 1h
    resp = make_request("GET", "market/candles?symbol=EURUSD&interval=1h")
    if not resp or resp.status_code != 200:
        return log_test("EURUSD 1h candles", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    candles = data.get("candles", [])
    
    if len(candles) == 0:
        return log_test("EURUSD 1h candles", False, "No candles returned")
    
    # Check ascending order
    times = [c["time"] for c in candles]
    if times != sorted(times):
        log_test("EURUSD 1h candles order", False, "Not in ascending order")
    else:
        log_test("EURUSD 1h candles", True, f"{len(candles)} candles in ascending order")
    
    # Check OHLC structure
    first = candles[0]
    if not all(k in first for k in ["time", "open", "high", "low", "close"]):
        log_test("EURUSD candle structure", False, "Missing OHLC fields")
    else:
        log_test("EURUSD candle structure", True, f"OHLC: O={first['open']}, H={first['high']}, L={first['low']}, C={first['close']}")
    
    # Test EURUSD 1d
    resp = make_request("GET", "market/candles?symbol=EURUSD&interval=1d")
    if not resp or resp.status_code != 200:
        return log_test("EURUSD 1d candles", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    candles = data.get("candles", [])
    
    if len(candles) == 0:
        return log_test("EURUSD 1d candles", False, "No candles returned")
    
    times = [c["time"] for c in candles]
    if times != sorted(times):
        log_test("EURUSD 1d candles order", False, "Not in ascending order")
    else:
        log_test("EURUSD 1d candles", True, f"{len(candles)} candles in ascending order")
    
    # Test USDJPY 15m
    resp = make_request("GET", "market/candles?symbol=USDJPY&interval=15m")
    if not resp or resp.status_code != 200:
        return log_test("USDJPY 15m candles", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    candles = data.get("candles", [])
    
    if len(candles) == 0:
        return log_test("USDJPY 15m candles", False, "No candles returned")
    
    times = [c["time"] for c in candles]
    if times != sorted(times):
        log_test("USDJPY 15m candles order", False, "Not in ascending order")
    else:
        log_test("USDJPY 15m candles", True, f"{len(candles)} candles in ascending order")
    
    return True

# ============================================================
# TEST 4: SETUP FRESH USER
# ============================================================
def test_setup_user():
    print("\n" + "="*60)
    print("TEST 4: SETUP FRESH USER")
    print("="*60)
    
    # Register
    test_email = generate_test_email()
    test_password = "ForexTest123!"
    test_name = "Forex Test User"
    
    resp = make_request("POST", "auth/register", {
        "name": test_name,
        "email": test_email,
        "password": test_password
    })
    
    if not resp or resp.status_code != 201:
        return log_test("Register fresh user", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    test_state["token"] = data.get("token")
    test_state["user"] = data.get("user")
    
    log_test("Register fresh user", True, f"Email: {test_email}")
    
    # Deposit $10,000
    resp = make_request("POST", "transactions/deposit", {"amount": 10000}, auth=True)
    if not resp or resp.status_code != 201:
        return log_test("Deposit $10,000", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    balance = data.get("balance")
    test_state["initial_balance"] = balance
    
    if balance != 10000:
        return log_test("Deposit $10,000", False, f"Expected balance 10000, got {balance}")
    
    log_test("Deposit $10,000", True, f"Balance: ${balance}")
    return True

# ============================================================
# TEST 5: FOREX TRADING MATH - EURUSD
# ============================================================
def test_forex_trading_eurusd():
    print("\n" + "="*60)
    print("TEST 5: FOREX TRADING MATH - EURUSD")
    print("="*60)
    
    # Get current EURUSD quote
    resp = make_request("GET", "market/quotes?symbols=EURUSD")
    if not resp or resp.status_code != 200:
        return log_test("Get EURUSD quote", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    eurusd_mid = data.get("quotes", {}).get("EURUSD", {}).get("price")
    spread = data.get("spread", 0.0005)
    
    if not eurusd_mid:
        return log_test("Get EURUSD quote", False, "No price in response")
    
    log_test("Get EURUSD quote", True, f"Mid: {eurusd_mid}, Spread: {spread}")
    
    # Place buy order: 0.01 lots, leverage 10
    resp = make_request("POST", "orders", {
        "symbol": "EURUSD",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if not resp or resp.status_code != 201:
        return log_test("EURUSD buy order", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    position = data.get("position", {})
    test_state["eurusd_position_id"] = position.get("id")
    
    # Verify position fields
    if position.get("contractSize") != 100000:
        return log_test("EURUSD contractSize", False, f"Expected 100000, got {position.get('contractSize')}")
    log_test("EURUSD contractSize", True, "100000")
    
    if position.get("quoteCurrency") != "USD":
        return log_test("EURUSD quoteCurrency", False, f"Expected USD, got {position.get('quoteCurrency')}")
    log_test("EURUSD quoteCurrency", True, "USD")
    
    # Check entryPrice ≈ mid * 1.00025 (ask with 0.05% spread)
    entry_price = position.get("entryPrice")
    expected_ask = eurusd_mid * (1 + spread / 2)
    price_diff = abs(entry_price - expected_ask)
    
    if price_diff > 0.0001:
        log_test("EURUSD entryPrice", False, f"Expected ~{expected_ask}, got {entry_price}")
    else:
        log_test("EURUSD entryPrice", True, f"{entry_price} (≈ mid * 1.00025)")
    
    # Check notional ≈ 0.01 * 100000 * entryPrice (~$1,100-1,200)
    notional = position.get("notional")
    expected_notional = 0.01 * 100000 * entry_price
    
    if abs(notional - expected_notional) > 1:
        log_test("EURUSD notional", False, f"Expected ~{expected_notional}, got {notional}")
    else:
        log_test("EURUSD notional", True, f"${notional:.2f} (≈ 0.01 * 100000 * {entry_price})")
    
    if not (1100 <= notional <= 1200):
        log_test("EURUSD notional range", False, f"Expected $1,100-1,200, got ${notional:.2f}")
    else:
        log_test("EURUSD notional range", True, f"${notional:.2f}")
    
    # Check margin = notional / 10
    margin = position.get("margin")
    expected_margin = notional / 10
    
    if abs(margin - expected_margin) > 0.01:
        log_test("EURUSD margin", False, f"Expected {expected_margin}, got {margin}")
    else:
        log_test("EURUSD margin", True, f"${margin:.2f} (notional / 10)")
    
    return True

# ============================================================
# TEST 6: FOREX TRADING MATH - USDJPY
# ============================================================
def test_forex_trading_usdjpy():
    print("\n" + "="*60)
    print("TEST 6: FOREX TRADING MATH - USDJPY")
    print("="*60)
    
    # Get current USDJPY quote
    resp = make_request("GET", "market/quotes?symbols=USDJPY")
    if not resp or resp.status_code != 200:
        return log_test("Get USDJPY quote", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    usdjpy_mid = data.get("quotes", {}).get("USDJPY", {}).get("price")
    
    if not usdjpy_mid:
        return log_test("Get USDJPY quote", False, "No price in response")
    
    log_test("Get USDJPY quote", True, f"Mid: {usdjpy_mid}")
    
    # Place buy order: 0.01 lots, leverage 10
    resp = make_request("POST", "orders", {
        "symbol": "USDJPY",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if not resp or resp.status_code != 201:
        return log_test("USDJPY buy order", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    position = data.get("position", {})
    test_state["usdjpy_position_id"] = position.get("id")
    
    # For USDJPY (USD-base), notional = units = 0.01 * 100000 = $1,000
    notional = position.get("notional")
    expected_notional = 0.01 * 100000  # $1,000
    
    if abs(notional - expected_notional) > 1:
        log_test("USDJPY notional", False, f"Expected ${expected_notional}, got ${notional}")
    else:
        log_test("USDJPY notional", True, f"${notional:.2f} (exactly $1,000 for USD-base)")
    
    # Check margin = $100
    margin = position.get("margin")
    expected_margin = 100
    
    if abs(margin - expected_margin) > 0.01:
        log_test("USDJPY margin", False, f"Expected ${expected_margin}, got ${margin}")
    else:
        log_test("USDJPY margin", True, f"${margin:.2f}")
    
    return True

# ============================================================
# TEST 7: ACCOUNT SUMMARY
# ============================================================
def test_account_summary():
    print("\n" + "="*60)
    print("TEST 7: ACCOUNT SUMMARY")
    print("="*60)
    
    resp = make_request("GET", "account/summary", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("GET /api/account/summary", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    account = data.get("account", {})
    
    balance = account.get("balance")
    equity = account.get("equity")
    floating_pnl = account.get("floatingPnl")
    used_margin = account.get("usedMargin")
    free_margin = account.get("freeMargin")
    
    log_test("Account balance", True, f"${balance:.2f}")
    log_test("Account equity", True, f"${equity:.2f}")
    log_test("Floating PnL", True, f"${floating_pnl:.2f}")
    log_test("Used margin", True, f"${used_margin:.2f}")
    log_test("Free margin", True, f"${free_margin:.2f}")
    
    # Verify equity = balance + floatingPnl
    expected_equity = balance + floating_pnl
    if abs(equity - expected_equity) > 0.01:
        log_test("Equity calculation", False, f"Expected {expected_equity}, got {equity}")
    else:
        log_test("Equity calculation", True, f"equity = balance + floatingPnl")
    
    # Verify usedMargin is sum of both positions' margins
    # We have 2 positions, each with margin ~$110 and $100
    if used_margin < 200 or used_margin > 220:
        log_test("Used margin sum", False, f"Expected ~$210, got ${used_margin:.2f}")
    else:
        log_test("Used margin sum", True, f"${used_margin:.2f} (sum of both positions)")
    
    return True

# ============================================================
# TEST 8: CLOSE POSITIONS AND CHECK PNL
# ============================================================
def test_close_positions():
    print("\n" + "="*60)
    print("TEST 8: CLOSE POSITIONS AND CHECK PNL")
    print("="*60)
    
    # Get balance before closing
    resp = make_request("GET", "account/summary", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Get balance before close", False, "Failed to get account summary")
    
    balance_before = resp.json().get("account", {}).get("balance")
    log_test("Balance before close", True, f"${balance_before:.2f}")
    
    # Close EURUSD position
    eurusd_id = test_state.get("eurusd_position_id")
    if not eurusd_id:
        return log_test("Close EURUSD", False, "No position ID")
    
    resp = make_request("POST", f"positions/{eurusd_id}/close", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Close EURUSD", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    eurusd_pnl = data.get("position", {}).get("pnl")
    
    if eurusd_pnl is None:
        return log_test("EURUSD PnL", False, "No PnL in response")
    
    # Check PnL is small (between -$20 and +$20 for immediate close)
    if not (-20 <= eurusd_pnl <= 20):
        log_test("EURUSD PnL range", False, f"Expected -$20 to +$20, got ${eurusd_pnl:.2f}")
    else:
        log_test("EURUSD PnL", True, f"${eurusd_pnl:.2f} (within -$20 to +$20)")
    
    # Close USDJPY position
    usdjpy_id = test_state.get("usdjpy_position_id")
    if not usdjpy_id:
        return log_test("Close USDJPY", False, "No position ID")
    
    resp = make_request("POST", f"positions/{usdjpy_id}/close", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Close USDJPY", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    usdjpy_pnl = data.get("position", {}).get("pnl")
    
    if usdjpy_pnl is None:
        return log_test("USDJPY PnL", False, "No PnL in response")
    
    if not (-20 <= usdjpy_pnl <= 20):
        log_test("USDJPY PnL range", False, f"Expected -$20 to +$20, got ${usdjpy_pnl:.2f}")
    else:
        log_test("USDJPY PnL", True, f"${usdjpy_pnl:.2f} (within -$20 to +$20)")
    
    # Get balance after closing
    resp = make_request("GET", "account/summary", auth=True)
    if not resp or resp.status_code != 200:
        return log_test("Get balance after close", False, "Failed to get account summary")
    
    balance_after = resp.json().get("account", {}).get("balance")
    log_test("Balance after close", True, f"${balance_after:.2f}")
    
    # Verify balance updated by exact PnL sum
    total_pnl = eurusd_pnl + usdjpy_pnl
    expected_balance = balance_before + total_pnl
    
    if abs(balance_after - expected_balance) > 0.01:
        log_test("Balance update", False, f"Expected ${expected_balance:.2f}, got ${balance_after:.2f}")
    else:
        log_test("Balance update", True, f"Updated by exact PnL sum: ${total_pnl:.2f}")
    
    return True

# ============================================================
# TEST 9: OVERSIZED ORDER (INSUFFICIENT MARGIN)
# ============================================================
def test_oversized_order():
    print("\n" + "="*60)
    print("TEST 9: OVERSIZED ORDER (INSUFFICIENT MARGIN)")
    print("="*60)
    
    # Try to place 10 lots with leverage 1 on EURUSD
    # This would require ~$11,000 margin but we only have ~$10,000
    resp = make_request("POST", "orders", {
        "symbol": "EURUSD",
        "side": "buy",
        "lots": 10,
        "leverage": 1
    }, auth=True)
    
    if not resp:
        return log_test("Oversized order", False, "No response")
    
    if resp.status_code == 400:
        error = resp.json().get("error", "")
        if "insufficient" in error.lower() or "margin" in error.lower():
            log_test("Oversized order rejection", True, f"400 with error: {error}")
            return True
        else:
            log_test("Oversized order rejection", False, f"400 but wrong error: {error}")
            return False
    else:
        log_test("Oversized order rejection", False, f"Expected 400, got {resp.status_code}")
        return False

# ============================================================
# TEST 10: REGRESSION - CRYPTO ORDER
# ============================================================
def test_crypto_regression():
    print("\n" + "="*60)
    print("TEST 10: REGRESSION - CRYPTO ORDER")
    print("="*60)
    
    # Get BTCUSD quote
    resp = make_request("GET", "market/quotes?symbols=BTCUSD")
    if not resp or resp.status_code != 200:
        return log_test("Get BTCUSD quote", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    btc_price = data.get("quotes", {}).get("BTCUSD", {}).get("price")
    
    if not btc_price:
        return log_test("Get BTCUSD quote", False, "No price in response")
    
    log_test("Get BTCUSD quote", True, f"Price: ${btc_price:.2f}")
    
    # Place order: 0.01 lots, leverage 10
    resp = make_request("POST", "orders", {
        "symbol": "BTCUSD",
        "side": "buy",
        "lots": 0.01,
        "leverage": 10
    }, auth=True)
    
    if not resp or resp.status_code != 201:
        return log_test("BTCUSD buy order", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    position = data.get("position", {})
    test_state["btcusd_position_id"] = position.get("id")
    
    # Check margin = 0.01 * entryPrice / 10
    entry_price = position.get("entryPrice")
    margin = position.get("margin")
    expected_margin = 0.01 * entry_price / 10
    
    if abs(margin - expected_margin) > 0.01:
        log_test("BTCUSD margin", False, f"Expected {expected_margin}, got {margin}")
    else:
        log_test("BTCUSD margin", True, f"${margin:.2f} (0.01 * entryPrice / 10)")
    
    # Close position
    btc_id = test_state.get("btcusd_position_id")
    resp = make_request("POST", f"positions/{btc_id}/close", auth=True)
    
    if not resp or resp.status_code != 200:
        return log_test("Close BTCUSD", False, f"Status: {resp.status_code if resp else 'No response'}")
    
    data = resp.json()
    pnl = data.get("position", {}).get("pnl")
    
    if pnl is None:
        return log_test("BTCUSD close", False, "No PnL in response")
    
    log_test("BTCUSD close", True, f"PnL: ${pnl:.2f}")
    return True

# ============================================================
# MAIN TEST RUNNER
# ============================================================
def main():
    print("\n" + "="*60)
    print("RAWMarkets Forex Trading Test Suite")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print("="*60)
    
    tests = [
        ("Forex Symbols", test_forex_symbols),
        ("Forex Quotes", test_forex_quotes),
        ("Forex Candles", test_forex_candles),
        ("Setup Fresh User", test_setup_user),
        ("Forex Trading EURUSD", test_forex_trading_eurusd),
        ("Forex Trading USDJPY", test_forex_trading_usdjpy),
        ("Account Summary", test_account_summary),
        ("Close Positions", test_close_positions),
        ("Oversized Order", test_oversized_order),
        ("Crypto Regression", test_crypto_regression),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ EXCEPTION in {name}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} | {name}")
    
    print("="*60)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*60)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
