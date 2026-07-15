#!/usr/bin/env python3
"""
RAWMarkets Backend Test - Major Rewrite Features
Tests: symbols, categories, leverage, pip spread, NOWPayments, withdrawals, admin settings
"""
import requests
import time
import random
import string

BASE_URL = "https://broker-live.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@rawmarkets.com"
ADMIN_PASSWORD = "RawAdmin!2025"

def random_email():
    return f"test_{int(time.time())}_{random.randint(1000,9999)}@rawtest.com"

def test_symbols_and_categories():
    """Test 1: GET /api/market/symbols - 32 symbols with maxLeverage per category"""
    print("\n=== TEST 1: Symbols & Categories ===")
    try:
        r = requests.get(f"{BASE_URL}/market/symbols", timeout=10)
        print(f"GET /market/symbols -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        symbols = data.get('symbols', [])
        print(f"Total symbols: {len(symbols)}")
        assert len(symbols) == 32, f"Expected 32 symbols, got {len(symbols)}"
        
        # Check category leverage
        expected_leverage = {'crypto': 10, 'forex': 100, 'metal': 20, 'index': 50, 'stock': 10}
        for sym in symbols:
            assert 'maxLeverage' in sym, f"{sym['symbol']} missing maxLeverage"
            expected = expected_leverage.get(sym['type'])
            assert sym['maxLeverage'] == expected, f"{sym['symbol']} maxLeverage={sym['maxLeverage']}, expected {expected}"
        
        # Check new symbols exist
        required_symbols = [
            'XAUUSD', 'XAGUSD',  # metals
            'US500', 'US100', 'US30',  # indices
            'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'EURAUD',  # forex crosses
            'DOGEUSD', 'ADAUSD', 'LINKUSD',  # crypto
            'AMZN', 'GOOGL'  # stocks
        ]
        symbol_names = [s['symbol'] for s in symbols]
        for req in required_symbols:
            assert req in symbol_names, f"Required symbol {req} not found"
        
        # Check metal symbols
        xauusd = next((s for s in symbols if s['symbol'] == 'XAUUSD'), None)
        assert xauusd and xauusd['type'] == 'metal', "XAUUSD not metal type"
        assert xauusd['maxLeverage'] == 20, f"XAUUSD maxLeverage={xauusd['maxLeverage']}, expected 20"
        assert 'pipSize' in xauusd and 'contractSize' in xauusd and 'quote' in xauusd
        
        xagusd = next((s for s in symbols if s['symbol'] == 'XAGUSD'), None)
        assert xagusd and xagusd['type'] == 'metal', "XAGUSD not metal type"
        
        # Check index symbols
        us500 = next((s for s in symbols if s['symbol'] == 'US500'), None)
        assert us500 and us500['type'] == 'index', "US500 not index type"
        assert us500['maxLeverage'] == 50, f"US500 maxLeverage={us500['maxLeverage']}, expected 50"
        
        print("✅ TEST 1 PASSED: 32 symbols with correct maxLeverage per category")
        return True
    except Exception as e:
        print(f"❌ TEST 1 FAILED: {e}")
        return False

def test_dynamic_pip_spread():
    """Test 2: GET /api/market/quotes - dynamic pip spread"""
    print("\n=== TEST 2: Dynamic Pip Spread ===")
    try:
        r = requests.get(f"{BASE_URL}/market/quotes?symbols=BTCUSD,EURUSD,XAUUSD", timeout=15)
        print(f"GET /market/quotes -> {r.status_code}")
        
        if r.status_code == 502:
            print("⚠️ Market price temporarily unavailable (502), retrying in 5s...")
            time.sleep(5)
            r = requests.get(f"{BASE_URL}/market/quotes?symbols=BTCUSD,EURUSD,XAUUSD", timeout=15)
        
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        quotes = data.get('quotes', {})
        base_spread = data.get('baseSpreadPips')
        print(f"baseSpreadPips: {base_spread}")
        assert base_spread is not None, "Missing baseSpreadPips"
        
        for symbol in ['BTCUSD', 'EURUSD', 'XAUUSD']:
            if symbol not in quotes:
                print(f"⚠️ {symbol} quote unavailable (may be market closed)")
                continue
            
            q = quotes[symbol]
            print(f"{symbol}: price={q.get('price')}, bid={q.get('bid')}, ask={q.get('ask')}, spreadPips={q.get('spreadPips')}, pipSize={q.get('pipSize')}")
            
            assert 'bid' in q and 'ask' in q, f"{symbol} missing bid/ask"
            assert 'spreadPips' in q and 'pipSize' in q, f"{symbol} missing spreadPips/pipSize"
            assert q['bid'] < q['price'] < q['ask'], f"{symbol} bid/ask not around price"
            
            # Check spread calculation: (ask - bid) ≈ spreadPips * pipSize
            actual_spread = q['ask'] - q['bid']
            expected_spread = q['spreadPips'] * q['pipSize']
            diff = abs(actual_spread - expected_spread)
            assert diff < expected_spread * 0.1, f"{symbol} spread mismatch: actual={actual_spread}, expected={expected_spread}"
            
            # Check spreadPips is between 1x and 2x base
            assert base_spread <= q['spreadPips'] <= base_spread * 2, f"{symbol} spreadPips={q['spreadPips']} not in range [{base_spread}, {base_spread*2}]"
        
        print("✅ TEST 2 PASSED: Dynamic pip spread working correctly")
        return True
    except Exception as e:
        print(f"❌ TEST 2 FAILED: {e}")
        return False

def test_category_leverage_enforcement():
    """Test 3: Category leverage enforcement with fresh user"""
    print("\n=== TEST 3: Category Leverage Enforcement ===")
    try:
        # Register fresh user
        email = random_email()
        password = "TestUser123!"
        r = requests.post(f"{BASE_URL}/auth/register", json={"name": "Test User", "email": email, "password": password}, timeout=10)
        print(f"POST /auth/register -> {r.status_code}")
        assert r.status_code == 201, f"Register failed: {r.status_code}"
        user_token = r.json()['token']
        user_id = r.json()['user']['id']
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Login as admin
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert r.status_code == 200, f"Admin login failed: {r.status_code}"
        admin_token = r.json()['token']
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Fund user via admin adjust-balance
        r = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust-balance", json={"amount": 10000}, headers=admin_headers, timeout=10)
        print(f"POST /admin/users/{user_id}/adjust-balance -> {r.status_code}")
        assert r.status_code == 200, f"Adjust balance failed: {r.status_code}"
        print(f"User funded with $10,000")
        
        # Test 3a: BTCUSD (crypto) with leverage 20 -> REJECTED (max 10)
        print("\n--- Test 3a: BTCUSD leverage 20 (should reject) ---")
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "BTCUSD", "side": "buy", "lots": 0.01, "leverage": 20}, headers=headers, timeout=10)
        print(f"POST /orders BTCUSD leverage 20 -> {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        error = r.json().get('error', '')
        print(f"Error: {error}")
        assert 'Maximum leverage for crypto is 1:10' in error, f"Wrong error message: {error}"
        print("✅ BTCUSD leverage 20 correctly rejected")
        
        # Test 3b: EURUSD with leverage 100 -> ACCEPTED (max 100)
        print("\n--- Test 3b: EURUSD leverage 100 (should accept) ---")
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "EURUSD", "side": "buy", "lots": 0.01, "leverage": 100}, headers=headers, timeout=10)
        print(f"POST /orders EURUSD leverage 100 -> {r.status_code}")
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        pos1 = r.json()['position']
        print(f"✅ EURUSD position created: id={pos1['id']}, entryPrice={pos1['entryPrice']}, margin=${pos1['margin']:.2f}")
        
        # Test 3c: XAUUSD with leverage 50 -> REJECTED (max 20)
        print("\n--- Test 3c: XAUUSD leverage 50 (should reject) ---")
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "XAUUSD", "side": "buy", "lots": 0.01, "leverage": 50}, headers=headers, timeout=10)
        print(f"POST /orders XAUUSD leverage 50 -> {r.status_code}")
        if r.status_code == 502:
            print("⚠️ XAUUSD quote unavailable (502), may be market closed - skipping")
        else:
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            error = r.json().get('error', '')
            print(f"Error: {error}")
            assert 'Maximum leverage for metal is 1:20' in error, f"Wrong error message: {error}"
            print("✅ XAUUSD leverage 50 correctly rejected")
        
        # Test 3d: XAUUSD with leverage 20 -> ACCEPTED
        print("\n--- Test 3d: XAUUSD leverage 20 (should accept) ---")
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "XAUUSD", "side": "buy", "lots": 0.01, "leverage": 20}, headers=headers, timeout=10)
        print(f"POST /orders XAUUSD leverage 20 -> {r.status_code}")
        if r.status_code == 502:
            print("⚠️ XAUUSD quote unavailable (502), may be market closed - skipping")
        else:
            assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
            pos2 = r.json()['position']
            print(f"✅ XAUUSD position created: id={pos2['id']}, entryPrice={pos2['entryPrice']}, margin=${pos2['margin']:.2f}")
        
        # Test 3e: US500 with leverage 100 -> REJECTED (max 50)
        print("\n--- Test 3e: US500 leverage 100 (should reject) ---")
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "US500", "side": "buy", "lots": 0.01, "leverage": 100}, headers=headers, timeout=10)
        print(f"POST /orders US500 leverage 100 -> {r.status_code}")
        if r.status_code == 502:
            print("⚠️ US500 quote unavailable (502), may be market closed - skipping")
        else:
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            error = r.json().get('error', '')
            print(f"Error: {error}")
            assert 'Maximum leverage for index is 1:50' in error, f"Wrong error message: {error}"
            print("✅ US500 leverage 100 correctly rejected")
        
        # Test 3f: US500 with leverage 50 -> ACCEPTED
        print("\n--- Test 3f: US500 leverage 50 (should accept) ---")
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "US500", "side": "buy", "lots": 0.01, "leverage": 50}, headers=headers, timeout=10)
        print(f"POST /orders US500 leverage 50 -> {r.status_code}")
        if r.status_code == 502:
            print("⚠️ US500 quote unavailable (502), may be market closed - skipping")
        else:
            assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
            pos3 = r.json()['position']
            print(f"✅ US500 position created: id={pos3['id']}, entryPrice={pos3['entryPrice']}, margin=${pos3['margin']:.2f}")
        
        # Close all positions
        print("\n--- Closing all positions ---")
        r = requests.get(f"{BASE_URL}/positions?status=open", headers=headers, timeout=10)
        positions = r.json().get('positions', [])
        for pos in positions:
            r = requests.post(f"{BASE_URL}/positions/{pos['id']}/close", headers=headers, timeout=10)
            if r.status_code == 200:
                pnl = r.json()['position']['pnl']
                print(f"Closed {pos['symbol']}: PnL=${pnl:.2f}")
        
        print("✅ TEST 3 PASSED: Category leverage enforcement working")
        return True
    except Exception as e:
        print(f"❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_nowpayments_deposits():
    """Test 4: NOWPayments deposits (live API)"""
    print("\n=== TEST 4: NOWPayments Deposits ===")
    try:
        # Get payment currencies
        print("\n--- Test 4a: GET /api/payments/currencies ---")
        r = requests.get(f"{BASE_URL}/payments/currencies", timeout=10)
        print(f"GET /payments/currencies -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        currencies = r.json().get('currencies', [])
        print(f"Available currencies: {len(currencies)}")
        assert len(currencies) > 0, "No currencies returned"
        for c in currencies[:3]:
            print(f"  - {c['code']}: {c['label']}")
        
        # Register fresh user
        email = random_email()
        password = "TestUser123!"
        r = requests.post(f"{BASE_URL}/auth/register", json={"name": "Test Deposit", "email": email, "password": password}, timeout=10)
        assert r.status_code == 201, f"Register failed: {r.status_code}"
        token = r.json()['token']
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 4b: Create deposit with USDT TRC20 (lower minimum)
        print("\n--- Test 4b: POST /api/transactions/deposit ---")
        pay_currency = "usdttrc20"
        r = requests.post(f"{BASE_URL}/transactions/deposit", json={"amount": 50, "payCurrency": pay_currency}, headers=headers, timeout=15)
        print(f"POST /transactions/deposit (amount=50, payCurrency={pay_currency}) -> {r.status_code}")
        
        if r.status_code == 502:
            # Try with higher amount or different currency
            print("⚠️ Gateway error, trying amount=100...")
            r = requests.post(f"{BASE_URL}/transactions/deposit", json={"amount": 100, "payCurrency": pay_currency}, headers=headers, timeout=15)
            print(f"POST /transactions/deposit (amount=100) -> {r.status_code}")
        
        if r.status_code != 201:
            print(f"Response: {r.text}")
        
        assert r.status_code == 201, f"Expected 201, got {r.status_code}"
        tx = r.json()['transaction']
        print(f"Deposit created:")
        print(f"  - id: {tx['id']}")
        print(f"  - amount: ${tx['amount']}")
        print(f"  - payCurrency: {tx['payCurrency']}")
        print(f"  - payAddress: {tx['payAddress']}")
        print(f"  - payAmount: {tx['payAmount']}")
        print(f"  - paymentId: {tx['paymentId']}")
        print(f"  - status: {tx['status']}")
        
        assert tx['status'] == 'waiting_payment', f"Expected status=waiting_payment, got {tx['status']}"
        assert 'payAddress' in tx and tx['payAddress'], "Missing payAddress"
        assert 'payAmount' in tx and tx['payAmount'], "Missing payAmount"
        assert 'paymentId' in tx and tx['paymentId'], "Missing paymentId"
        
        # Test 4c: Poll deposit status
        print("\n--- Test 4c: GET /api/transactions/deposit/{id}/status ---")
        r = requests.get(f"{BASE_URL}/transactions/deposit/{tx['id']}/status", headers=headers, timeout=10)
        print(f"GET /transactions/deposit/{tx['id']}/status -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        status_tx = r.json()['transaction']
        print(f"Payment status: {status_tx.get('paymentStatus')} (mapped to {status_tx.get('status')})")
        assert 'paymentStatus' in status_tx, "Missing paymentStatus"
        
        # Test 4d: Validation - amount < 10
        print("\n--- Test 4d: Validation - amount < 10 ---")
        r = requests.post(f"{BASE_URL}/transactions/deposit", json={"amount": 5, "payCurrency": pay_currency}, headers=headers, timeout=10)
        print(f"POST /transactions/deposit (amount=5) -> {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        error = r.json().get('error', '')
        print(f"Error: {error}")
        assert 'Minimum deposit is $10' in error, f"Wrong error: {error}"
        
        # Test 4e: Validation - missing payCurrency
        print("\n--- Test 4e: Validation - missing payCurrency ---")
        r = requests.post(f"{BASE_URL}/transactions/deposit", json={"amount": 50}, headers=headers, timeout=10)
        print(f"POST /transactions/deposit (no payCurrency) -> {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        error = r.json().get('error', '')
        print(f"Error: {error}")
        
        print("✅ TEST 4 PASSED: NOWPayments deposits working")
        return True
    except Exception as e:
        print(f"❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_withdrawals_with_wallet():
    """Test 5: Withdrawals with wallet address"""
    print("\n=== TEST 5: Withdrawals with Wallet Address ===")
    try:
        # Register and fund user
        email = random_email()
        password = "TestUser123!"
        r = requests.post(f"{BASE_URL}/auth/register", json={"name": "Test Withdraw", "email": email, "password": password}, timeout=10)
        assert r.status_code == 201, f"Register failed: {r.status_code}"
        token = r.json()['token']
        user_id = r.json()['user']['id']
        headers = {"Authorization": f"Bearer {token}"}
        
        # Fund via admin
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        admin_token = r.json()['token']
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust-balance", json={"amount": 1000}, headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Fund failed: {r.status_code}"
        print("User funded with $1,000")
        
        # Test 5a: Withdrawal without wallet address -> 400
        print("\n--- Test 5a: Withdrawal without wallet address ---")
        r = requests.post(f"{BASE_URL}/transactions/withdraw", json={"amount": 100}, headers=headers, timeout=10)
        print(f"POST /transactions/withdraw (no wallet) -> {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        error = r.json().get('error', '')
        print(f"Error: {error}")
        assert 'wallet address' in error.lower(), f"Wrong error: {error}"
        
        # Test 5b: Withdrawal with valid wallet address -> 201
        print("\n--- Test 5b: Withdrawal with wallet address ---")
        wallet = "TXYZabc1234567890abcdefghijklmnop"
        r = requests.post(f"{BASE_URL}/transactions/withdraw", json={"amount": 100, "walletAddress": wallet, "network": "TRC20"}, headers=headers, timeout=10)
        print(f"POST /transactions/withdraw (wallet={wallet}) -> {r.status_code}")
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        tx = r.json()['transaction']
        balance = r.json()['balance']
        print(f"Withdrawal created: id={tx['id']}, status={tx['status']}, walletAddress={tx['walletAddress']}, network={tx.get('network')}")
        print(f"Balance after withdrawal: ${balance}")
        assert tx['status'] == 'pending', f"Expected status=pending, got {tx['status']}"
        assert tx['walletAddress'] == wallet, f"Wallet address mismatch"
        assert balance == 900, f"Expected balance=900, got {balance}"
        
        # Test 5c: Admin reject refunds balance
        print("\n--- Test 5c: Admin reject withdrawal ---")
        r = requests.post(f"{BASE_URL}/admin/transactions/{tx['id']}/reject", headers=admin_headers, timeout=10)
        print(f"POST /admin/transactions/{tx['id']}/reject -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        # Check balance refunded
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        balance = r.json()['user']['balance']
        print(f"Balance after rejection: ${balance}")
        assert balance == 1000, f"Expected balance=1000 (refunded), got {balance}"
        
        # Test 5d: Admin approve keeps deduction
        print("\n--- Test 5d: Admin approve withdrawal ---")
        r = requests.post(f"{BASE_URL}/transactions/withdraw", json={"amount": 200, "walletAddress": wallet, "network": "TRC20"}, headers=headers, timeout=10)
        assert r.status_code == 201, f"Withdraw failed: {r.status_code}"
        tx2 = r.json()['transaction']
        
        r = requests.post(f"{BASE_URL}/admin/transactions/{tx2['id']}/approve", headers=admin_headers, timeout=10)
        print(f"POST /admin/transactions/{tx2['id']}/approve -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        balance = r.json()['user']['balance']
        print(f"Balance after approval: ${balance}")
        assert balance == 800, f"Expected balance=800 (deduction kept), got {balance}"
        
        print("✅ TEST 5 PASSED: Withdrawals with wallet address working")
        return True
    except Exception as e:
        print(f"❌ TEST 5 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_admin_settings():
    """Test 6: Admin settings (spreadPips, tradingEnabled, categoryLeverage)"""
    print("\n=== TEST 6: Admin Settings ===")
    try:
        # Login as admin
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert r.status_code == 200, f"Admin login failed: {r.status_code}"
        admin_token = r.json()['token']
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test 6a: GET /api/admin/settings
        print("\n--- Test 6a: GET /api/admin/settings ---")
        r = requests.get(f"{BASE_URL}/admin/settings", headers=admin_headers, timeout=10)
        print(f"GET /admin/settings -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        settings = r.json()['settings']
        print(f"Settings: {settings}")
        assert 'spreadPips' in settings, "Missing spreadPips"
        assert 'tradingEnabled' in settings, "Missing tradingEnabled"
        assert 'categoryLeverage' in settings, "Missing categoryLeverage"
        assert settings['categoryLeverage'] == {'crypto': 10, 'forex': 100, 'metal': 20, 'index': 50, 'stock': 10}
        original_spread = settings['spreadPips']
        
        # Test 6b: PUT spreadPips=2
        print("\n--- Test 6b: PUT /api/admin/settings (spreadPips=2) ---")
        r = requests.put(f"{BASE_URL}/admin/settings", json={"spreadPips": 2}, headers=admin_headers, timeout=10)
        print(f"PUT /admin/settings (spreadPips=2) -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        settings = r.json()['settings']
        assert settings['spreadPips'] == 2, f"Expected spreadPips=2, got {settings['spreadPips']}"
        print("✅ spreadPips updated to 2")
        
        # Test 6c: PUT spreadPips=20 -> 400 (out of range)
        print("\n--- Test 6c: PUT /api/admin/settings (spreadPips=20, should reject) ---")
        r = requests.put(f"{BASE_URL}/admin/settings", json={"spreadPips": 20}, headers=admin_headers, timeout=10)
        print(f"PUT /admin/settings (spreadPips=20) -> {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        error = r.json().get('error', '')
        print(f"Error: {error}")
        assert '0.1' in error and '10' in error, f"Wrong error: {error}"
        
        # Test 6d: PUT tradingEnabled=false blocks orders
        print("\n--- Test 6d: PUT tradingEnabled=false ---")
        r = requests.put(f"{BASE_URL}/admin/settings", json={"tradingEnabled": False}, headers=admin_headers, timeout=10)
        print(f"PUT /admin/settings (tradingEnabled=false) -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        # Try to place order
        email = random_email()
        r = requests.post(f"{BASE_URL}/auth/register", json={"name": "Test", "email": email, "password": "Test123!"}, timeout=10)
        token = r.json()['token']
        user_id = r.json()['user']['id']
        headers = {"Authorization": f"Bearer {token}"}
        
        r = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust-balance", json={"amount": 1000}, headers=admin_headers, timeout=10)
        
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "BTCUSD", "side": "buy", "lots": 0.01, "leverage": 10}, headers=headers, timeout=10)
        print(f"POST /orders (trading disabled) -> {r.status_code}")
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        error = r.json().get('error', '')
        print(f"Error: {error}")
        assert 'disabled' in error.lower(), f"Wrong error: {error}"
        print("✅ Trading correctly blocked when disabled")
        
        # Test 6e: Restore settings
        print("\n--- Test 6e: Restore settings ---")
        r = requests.put(f"{BASE_URL}/admin/settings", json={"spreadPips": original_spread, "tradingEnabled": True}, headers=admin_headers, timeout=10)
        print(f"PUT /admin/settings (restore) -> {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print(f"✅ Settings restored to spreadPips={original_spread}, tradingEnabled=true")
        
        print("✅ TEST 6 PASSED: Admin settings working")
        return True
    except Exception as e:
        print(f"❌ TEST 6 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_regression():
    """Test 7: Regression tests (auth, account summary, positions, admin stats)"""
    print("\n=== TEST 7: Regression Tests ===")
    try:
        # Test 7a: Auth flow
        print("\n--- Test 7a: Auth (register, login, me) ---")
        email = random_email()
        r = requests.post(f"{BASE_URL}/auth/register", json={"name": "Regression Test", "email": email, "password": "Test123!"}, timeout=10)
        assert r.status_code == 201, f"Register failed: {r.status_code}"
        token = r.json()['token']
        headers = {"Authorization": f"Bearer {token}"}
        
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "Test123!"}, timeout=10)
        assert r.status_code == 200, f"Login failed: {r.status_code}"
        
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        assert r.status_code == 200, f"Me failed: {r.status_code}"
        print("✅ Auth flow working")
        
        # Test 7b: Account summary math
        print("\n--- Test 7b: Account summary math ---")
        user_id = r.json()['user']['id']
        
        # Fund and create position
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        admin_token = r.json()['token']
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        r = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust-balance", json={"amount": 5000}, headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Fund failed: {r.status_code}"
        
        r = requests.post(f"{BASE_URL}/orders", json={"symbol": "BTCUSD", "side": "buy", "lots": 0.01, "leverage": 10}, headers=headers, timeout=10)
        assert r.status_code == 201, f"Order failed: {r.status_code}"
        pos = r.json()['position']
        
        r = requests.get(f"{BASE_URL}/account/summary", headers=headers, timeout=10)
        assert r.status_code == 200, f"Summary failed: {r.status_code}"
        account = r.json()['account']
        print(f"Account: balance=${account['balance']:.2f}, equity=${account['equity']:.2f}, floatingPnl=${account['floatingPnl']:.2f}, usedMargin=${account['usedMargin']:.2f}, freeMargin=${account['freeMargin']:.2f}")
        
        # Verify math
        assert abs(account['equity'] - (account['balance'] + account['floatingPnl'])) < 0.01, "equity != balance + floatingPnl"
        assert abs(account['freeMargin'] - (account['equity'] - account['usedMargin'])) < 0.01, "freeMargin != equity - usedMargin"
        print("✅ Account summary math correct")
        
        # Test 7c: Positions
        print("\n--- Test 7c: GET /api/positions ---")
        r = requests.get(f"{BASE_URL}/positions?status=open", headers=headers, timeout=10)
        assert r.status_code == 200, f"Positions failed: {r.status_code}"
        positions = r.json()['positions']
        assert len(positions) > 0, "No open positions"
        print(f"✅ {len(positions)} open position(s)")
        
        # Close position
        r = requests.post(f"{BASE_URL}/positions/{pos['id']}/close", headers=headers, timeout=10)
        assert r.status_code == 200, f"Close failed: {r.status_code}"
        pnl = r.json()['position']['pnl']
        print(f"Position closed: PnL=${pnl:.2f}")
        
        # Test 7d: Admin stats
        print("\n--- Test 7d: GET /api/admin/stats ---")
        r = requests.get(f"{BASE_URL}/admin/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Stats failed: {r.status_code}"
        stats = r.json()['stats']
        print(f"Stats: totalUsers={stats['totalUsers']}, openPositions={stats['openPositions']}, pendingDeposits={stats.get('pendingDeposits')}, awaitingPaymentDeposits={stats.get('awaitingPaymentDeposits')}")
        assert 'pendingDeposits' in stats, "Missing pendingDeposits"
        assert 'awaitingPaymentDeposits' in stats, "Missing awaitingPaymentDeposits"
        print("✅ Admin stats working")
        
        print("✅ TEST 7 PASSED: Regression tests passed")
        return True
    except Exception as e:
        print(f"❌ TEST 7 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("RAWMarkets Backend Test - Major Rewrite")
    print("=" * 60)
    
    results = []
    results.append(("Symbols & Categories", test_symbols_and_categories()))
    results.append(("Dynamic Pip Spread", test_dynamic_pip_spread()))
    results.append(("Category Leverage Enforcement", test_category_leverage_enforcement()))
    results.append(("NOWPayments Deposits", test_nowpayments_deposits()))
    results.append(("Withdrawals with Wallet", test_withdrawals_with_wallet()))
    results.append(("Admin Settings", test_admin_settings()))
    results.append(("Regression Tests", test_regression()))
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")
    
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    return all(p for _, p in results)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
