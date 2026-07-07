#!/usr/bin/env python3
"""
RAWMarkets Admin Endpoints Test Suite
Tests all admin endpoints with proper access control and functionality
"""

import requests
import json
import time
from typing import Dict, Optional

# Configuration
BASE_URL = "https://broker-live.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@rawmarkets.com"
ADMIN_PASSWORD = "RawAdmin!2025"
REGULAR_EMAIL = "trader@rawmarkets.com"
REGULAR_PASSWORD = "Trader123!"

# Test state
admin_token = None
regular_token = None
test_user_id = None
test_withdrawal_id = None
original_settings = None

def log(msg: str):
    print(f"[TEST] {msg}")

def login(email: str, password: str) -> Optional[str]:
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            return resp.json()["token"]
        log(f"❌ Login failed for {email}: {resp.status_code} {resp.text}")
        return None
    except Exception as e:
        log(f"❌ Login exception for {email}: {e}")
        return None

def register_fresh_user(name: str, email: str, password: str) -> Optional[Dict]:
    """Register a new user and return user data + token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={"name": name, "email": email, "password": password}, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            return {"token": data["token"], "user": data["user"]}
        log(f"❌ Register failed for {email}: {resp.status_code} {resp.text}")
        return None
    except Exception as e:
        log(f"❌ Register exception for {email}: {e}")
        return None

def test_access_control():
    """Test 1: Access control - 401 without token, 403 with regular user token"""
    log("\n=== TEST 1: Access Control ===")
    
    # Test without token
    log("Testing admin endpoints without token...")
    endpoints = [
        ("GET", "/admin/stats"),
        ("GET", "/admin/users"),
        ("GET", "/admin/transactions"),
        ("GET", "/admin/positions"),
        ("GET", "/admin/settings"),
    ]
    
    for method, endpoint in endpoints:
        try:
            resp = requests.request(method, f"{BASE_URL}{endpoint}", timeout=10)
            if resp.status_code == 401:
                log(f"✅ {method} {endpoint} -> 401 without token")
            else:
                log(f"❌ {method} {endpoint} -> {resp.status_code} (expected 401)")
        except Exception as e:
            log(f"❌ {method} {endpoint} exception: {e}")
    
    # Test with regular user token
    log("\nTesting admin endpoints with regular user token...")
    headers = {"Authorization": f"Bearer {regular_token}"}
    for method, endpoint in endpoints:
        try:
            resp = requests.request(method, f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
            if resp.status_code == 403:
                log(f"✅ {method} {endpoint} -> 403 with regular user")
            else:
                log(f"❌ {method} {endpoint} -> {resp.status_code} (expected 403)")
        except Exception as e:
            log(f"❌ {method} {endpoint} exception: {e}")

def test_admin_stats():
    """Test 2: GET /api/admin/stats"""
    log("\n=== TEST 2: Admin Stats ===")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/stats", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get("stats", {})
            required_fields = ["totalUsers", "totalBalance", "openPositions", "pendingWithdrawals", "pendingWithdrawalAmount", "totalDeposited", "totalWithdrawn"]
            
            missing = [f for f in required_fields if f not in stats]
            if missing:
                log(f"❌ Missing fields in stats: {missing}")
            else:
                log(f"✅ Stats endpoint returns all required fields")
                log(f"   Total Users: {stats['totalUsers']}")
                log(f"   Total Balance: ${stats['totalBalance']:.2f}")
                log(f"   Open Positions: {stats['openPositions']}")
                log(f"   Pending Withdrawals: {stats['pendingWithdrawals']} (${stats['pendingWithdrawalAmount']:.2f})")
                log(f"   Total Deposited: ${stats['totalDeposited']:.2f}")
                log(f"   Total Withdrawn: ${stats['totalWithdrawn']:.2f}")
        else:
            log(f"❌ Stats endpoint failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Stats endpoint exception: {e}")

def test_admin_users():
    """Test 3: GET /api/admin/users with search"""
    log("\n=== TEST 3: Admin Users List ===")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test without search
        resp = requests.get(f"{BASE_URL}/admin/users", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            users = data.get("users", [])
            log(f"✅ Users list returned {len(users)} users")
            
            # Check no passwordHash in response
            has_password = any("passwordHash" in u for u in users)
            if has_password:
                log(f"❌ Users list contains passwordHash field")
            else:
                log(f"✅ Users list does not contain passwordHash")
        else:
            log(f"❌ Users list failed: {resp.status_code} {resp.text}")
        
        # Test with search
        resp = requests.get(f"{BASE_URL}/admin/users?search=trader", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            users = data.get("users", [])
            trader_found = any("trader" in u.get("email", "").lower() for u in users)
            if trader_found:
                log(f"✅ Search filter works correctly (found trader)")
            else:
                log(f"❌ Search filter did not find trader user")
        else:
            log(f"❌ Users search failed: {resp.status_code} {resp.text}")
            
    except Exception as e:
        log(f"❌ Users endpoint exception: {e}")

def test_adjust_balance():
    """Test 4: POST /api/admin/users/{id}/adjust-balance"""
    log("\n=== TEST 4: Adjust Balance ===")
    
    global test_user_id
    
    # Create fresh test user
    log("Creating fresh test user for balance adjustment...")
    fresh = register_fresh_user("Balance Test User", f"balancetest_{int(time.time())}@test.com", "Test123!")
    if not fresh:
        log("❌ Failed to create fresh test user")
        return
    
    test_user_id = fresh["user"]["id"]
    test_token = fresh["token"]
    log(f"✅ Created test user: {test_user_id}")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test 1: Add $500
    log("\nTest: Add $500 with note 'test credit'")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/users/{test_user_id}/adjust-balance",
            headers=headers,
            json={"amount": 500, "note": "test credit"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            tx = data.get("transaction", {})
            if user.get("balance") == 500:
                log(f"✅ Balance adjusted to $500")
            else:
                log(f"❌ Balance is ${user.get('balance')} (expected $500)")
            
            # Check transaction created
            if tx.get("type") == "adjustment" and tx.get("direction") == "credit":
                log(f"✅ Adjustment transaction created (type: adjustment, direction: credit)")
            else:
                log(f"❌ Transaction type/direction incorrect: {tx}")
        else:
            log(f"❌ Adjust balance +500 failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Adjust balance +500 exception: {e}")
    
    # Verify transaction appears in user's transaction list
    log("\nVerifying adjustment appears in user's transactions...")
    try:
        user_headers = {"Authorization": f"Bearer {test_token}"}
        resp = requests.get(f"{BASE_URL}/transactions", headers=user_headers, timeout=10)
        if resp.status_code == 200:
            txs = resp.json().get("transactions", [])
            adjustment_tx = [t for t in txs if t.get("type") == "adjustment"]
            if adjustment_tx:
                log(f"✅ Adjustment transaction visible in user's transaction list")
            else:
                log(f"❌ Adjustment transaction not found in user's list")
        else:
            log(f"❌ Failed to get user transactions: {resp.status_code}")
    except Exception as e:
        log(f"❌ Get user transactions exception: {e}")
    
    # Test 2: Subtract $200 (balance should be 300)
    log("\nTest: Subtract $200")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/users/{test_user_id}/adjust-balance",
            headers=headers,
            json={"amount": -200},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            if user.get("balance") == 300:
                log(f"✅ Balance adjusted to $300")
            else:
                log(f"❌ Balance is ${user.get('balance')} (expected $300)")
        else:
            log(f"❌ Adjust balance -200 failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Adjust balance -200 exception: {e}")
    
    # Test 3: Try to subtract $1000 (would go negative, should fail with 400)
    log("\nTest: Try to subtract $1000 (should fail - would go negative)")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/users/{test_user_id}/adjust-balance",
            headers=headers,
            json={"amount": -1000},
            timeout=10
        )
        if resp.status_code == 400:
            log(f"✅ Correctly rejected negative balance adjustment (400)")
        else:
            log(f"❌ Expected 400 for negative balance, got {resp.status_code}")
    except Exception as e:
        log(f"❌ Adjust balance -1000 exception: {e}")
    
    # Test 4: Amount = 0 (should fail with 400)
    log("\nTest: Amount = 0 (should fail)")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/users/{test_user_id}/adjust-balance",
            headers=headers,
            json={"amount": 0},
            timeout=10
        )
        if resp.status_code == 400:
            log(f"✅ Correctly rejected zero amount (400)")
        else:
            log(f"❌ Expected 400 for zero amount, got {resp.status_code}")
    except Exception as e:
        log(f"❌ Adjust balance 0 exception: {e}")

def test_withdrawal_flow():
    """Test 5: Withdrawal approval/rejection flow"""
    log("\n=== TEST 5: Withdrawal Flow ===")
    
    global test_withdrawal_id
    
    # Create fresh user for withdrawal test
    log("Creating fresh test user for withdrawal flow...")
    fresh = register_fresh_user("Withdrawal Test User", f"withdrawtest_{int(time.time())}@test.com", "Test123!")
    if not fresh:
        log("❌ Failed to create fresh test user")
        return
    
    wd_user_id = fresh["user"]["id"]
    wd_token = fresh["token"]
    log(f"✅ Created test user: {wd_user_id}")
    
    # Deposit $1000
    log("\nDepositing $1000...")
    try:
        headers = {"Authorization": f"Bearer {wd_token}"}
        resp = requests.post(f"{BASE_URL}/transactions/deposit", headers=headers, json={"amount": 1000}, timeout=10)
        if resp.status_code == 201:
            log(f"✅ Deposited $1000")
        else:
            log(f"❌ Deposit failed: {resp.status_code} {resp.text}")
            return
    except Exception as e:
        log(f"❌ Deposit exception: {e}")
        return
    
    # Withdraw $400
    log("\nWithdrawing $400...")
    try:
        resp = requests.post(f"{BASE_URL}/transactions/withdraw", headers=headers, json={"amount": 400}, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            tx = data.get("transaction", {})
            test_withdrawal_id = tx.get("id")
            balance = data.get("balance")
            if tx.get("status") == "pending" and balance == 600:
                log(f"✅ Withdrawal created (status: pending, balance: $600)")
            else:
                log(f"❌ Withdrawal status or balance incorrect: status={tx.get('status')}, balance=${balance}")
        else:
            log(f"❌ Withdrawal failed: {resp.status_code} {resp.text}")
            return
    except Exception as e:
        log(f"❌ Withdrawal exception: {e}")
        return
    
    # Admin: Get pending withdrawals
    log("\nAdmin: Getting pending withdrawals...")
    try:
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/transactions?type=withdrawal&status=pending", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            txs = data.get("transactions", [])
            found = any(t.get("id") == test_withdrawal_id for t in txs)
            has_user_info = any(t.get("user") is not None for t in txs)
            if found and has_user_info:
                log(f"✅ Pending withdrawal found with user info")
            else:
                log(f"❌ Pending withdrawal not found or missing user info (found={found}, has_user={has_user_info})")
        else:
            log(f"❌ Get pending withdrawals failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Get pending withdrawals exception: {e}")
    
    # Admin: Approve withdrawal
    log("\nAdmin: Approving withdrawal...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/transactions/{test_withdrawal_id}/approve", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            tx = data.get("transaction", {})
            if tx.get("status") == "approved":
                log(f"✅ Withdrawal approved")
            else:
                log(f"❌ Withdrawal status not approved: {tx.get('status')}")
        else:
            log(f"❌ Approve withdrawal failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Approve withdrawal exception: {e}")
    
    # Verify user balance is still 600 (not refunded)
    log("\nVerifying user balance after approval (should still be $600)...")
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if resp.status_code == 200:
            user = resp.json().get("user", {})
            if user.get("balance") == 600:
                log(f"✅ User balance still $600 after approval")
            else:
                log(f"❌ User balance is ${user.get('balance')} (expected $600)")
        else:
            log(f"❌ Get user failed: {resp.status_code}")
    except Exception as e:
        log(f"❌ Get user exception: {e}")
    
    # Test rejection flow with second withdrawal
    log("\n--- Testing Rejection Flow ---")
    
    # Create second withdrawal
    log("Creating second withdrawal of $200...")
    try:
        resp = requests.post(f"{BASE_URL}/transactions/withdraw", headers=headers, json={"amount": 200}, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            tx = data.get("transaction", {})
            wd2_id = tx.get("id")
            balance = data.get("balance")
            log(f"✅ Second withdrawal created (balance now $400)")
        else:
            log(f"❌ Second withdrawal failed: {resp.status_code} {resp.text}")
            return
    except Exception as e:
        log(f"❌ Second withdrawal exception: {e}")
        return
    
    # Admin: Reject withdrawal
    log("\nAdmin: Rejecting second withdrawal...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/transactions/{wd2_id}/reject", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            tx = data.get("transaction", {})
            if tx.get("status") == "rejected":
                log(f"✅ Withdrawal rejected")
            else:
                log(f"❌ Withdrawal status not rejected: {tx.get('status')}")
        else:
            log(f"❌ Reject withdrawal failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Reject withdrawal exception: {e}")
    
    # Verify user balance refunded (should be 600 again)
    log("\nVerifying user balance after rejection (should be refunded to $600)...")
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if resp.status_code == 200:
            user = resp.json().get("user", {})
            if user.get("balance") == 600:
                log(f"✅ User balance refunded to $600 after rejection")
            else:
                log(f"❌ User balance is ${user.get('balance')} (expected $600)")
        else:
            log(f"❌ Get user failed: {resp.status_code}")
    except Exception as e:
        log(f"❌ Get user exception: {e}")
    
    # Test approving already-approved transaction (should fail with 400)
    log("\nTesting approval of already-approved transaction (should fail)...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/transactions/{test_withdrawal_id}/approve", headers=admin_headers, timeout=10)
        if resp.status_code == 400:
            log(f"✅ Correctly rejected re-approval (400)")
        else:
            log(f"❌ Expected 400 for re-approval, got {resp.status_code}")
    except Exception as e:
        log(f"❌ Re-approval exception: {e}")

def test_admin_positions():
    """Test 6: GET /api/admin/positions"""
    log("\n=== TEST 6: Admin Positions ===")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/positions?status=open", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            positions = data.get("positions", [])
            log(f"✅ Admin positions endpoint returned {len(positions)} open positions")
            
            # Check if positions have user email attached
            if positions:
                has_user = all(p.get("user") is not None for p in positions)
                has_email = all(p.get("user", {}).get("email") is not None for p in positions if p.get("user"))
                if has_user and has_email:
                    log(f"✅ All positions have user info with email")
                else:
                    log(f"❌ Some positions missing user info or email")
            else:
                log(f"   (No open positions to verify user attachment)")
        else:
            log(f"❌ Admin positions failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Admin positions exception: {e}")

def test_settings():
    """Test 7: Settings GET/PUT with trading enforcement"""
    log("\n=== TEST 7: Platform Settings ===")
    
    global original_settings
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get current settings
    log("Getting current settings...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/settings", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            original_settings = data.get("settings", {})
            log(f"✅ Current settings: spread={original_settings.get('spread')}, maxLeverage={original_settings.get('maxLeverage')}, tradingEnabled={original_settings.get('tradingEnabled')}")
        else:
            log(f"❌ Get settings failed: {resp.status_code} {resp.text}")
            return
    except Exception as e:
        log(f"❌ Get settings exception: {e}")
        return
    
    # Update maxLeverage to 20
    log("\nUpdating maxLeverage to 20...")
    try:
        resp = requests.put(f"{BASE_URL}/admin/settings", headers=admin_headers, json={"maxLeverage": 20}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            settings = data.get("settings", {})
            if settings.get("maxLeverage") == 20:
                log(f"✅ maxLeverage updated to 20")
            else:
                log(f"❌ maxLeverage is {settings.get('maxLeverage')} (expected 20)")
        else:
            log(f"❌ Update maxLeverage failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Update maxLeverage exception: {e}")
    
    # Wait for cache to clear (cache is busted on PUT, so should be immediate)
    time.sleep(1)
    
    # Create fresh user with funds and try to place order with leverage 50 (should fail)
    log("\nCreating fresh user to test leverage enforcement...")
    fresh = register_fresh_user("Leverage Test User", f"leveragetest_{int(time.time())}@test.com", "Test123!")
    if not fresh:
        log("❌ Failed to create fresh test user")
    else:
        lev_token = fresh["token"]
        lev_headers = {"Authorization": f"Bearer {lev_token}"}
        
        # Deposit funds
        log("Depositing $10,000...")
        try:
            resp = requests.post(f"{BASE_URL}/transactions/deposit", headers=lev_headers, json={"amount": 10000}, timeout=10)
            if resp.status_code == 201:
                log(f"✅ Deposited $10,000")
            else:
                log(f"❌ Deposit failed: {resp.status_code}")
        except Exception as e:
            log(f"❌ Deposit exception: {e}")
        
        # Try to place order with leverage 50 (should fail)
        log("\nTrying to place order with leverage 50 (should fail)...")
        try:
            resp = requests.post(
                f"{BASE_URL}/orders",
                headers=lev_headers,
                json={"symbol": "BTCUSD", "side": "buy", "lots": 0.01, "leverage": 50},
                timeout=10
            )
            if resp.status_code == 400 and "Maximum allowed leverage is 20x" in resp.text:
                log(f"✅ Order correctly rejected with leverage enforcement message")
            else:
                log(f"❌ Expected 400 with leverage message, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log(f"❌ Order exception: {e}")
    
    # Disable trading
    log("\nDisabling trading...")
    try:
        resp = requests.put(f"{BASE_URL}/admin/settings", headers=admin_headers, json={"tradingEnabled": False}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            settings = data.get("settings", {})
            if settings.get("tradingEnabled") == False:
                log(f"✅ Trading disabled")
            else:
                log(f"❌ tradingEnabled is {settings.get('tradingEnabled')} (expected False)")
        else:
            log(f"❌ Disable trading failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Disable trading exception: {e}")
    
    time.sleep(1)
    
    # Try to place order (should fail with 403)
    if fresh:
        log("\nTrying to place order with trading disabled (should fail with 403)...")
        try:
            resp = requests.post(
                f"{BASE_URL}/orders",
                headers=lev_headers,
                json={"symbol": "BTCUSD", "side": "buy", "lots": 0.01, "leverage": 10},
                timeout=10
            )
            if resp.status_code == 403 and "trading" in resp.text.lower() and "disabled" in resp.text.lower():
                log(f"✅ Order correctly rejected with trading disabled message")
            else:
                log(f"❌ Expected 403 with trading disabled message, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log(f"❌ Order exception: {e}")
    
    # Restore settings
    log("\nRestoring original settings...")
    try:
        restore = {
            "spread": 0.0005,
            "maxLeverage": 100,
            "tradingEnabled": True
        }
        resp = requests.put(f"{BASE_URL}/admin/settings", headers=admin_headers, json=restore, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            settings = data.get("settings", {})
            if settings.get("spread") == 0.0005 and settings.get("maxLeverage") == 100 and settings.get("tradingEnabled") == True:
                log(f"✅ Settings restored to defaults")
            else:
                log(f"❌ Settings not fully restored: {settings}")
        else:
            log(f"❌ Restore settings failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log(f"❌ Restore settings exception: {e}")
    
    # Test invalid spread (should fail)
    log("\nTesting invalid spread value (0.5 > 0.02 max)...")
    try:
        resp = requests.put(f"{BASE_URL}/admin/settings", headers=admin_headers, json={"spread": 0.5}, timeout=10)
        if resp.status_code == 400:
            log(f"✅ Invalid spread correctly rejected (400)")
        else:
            log(f"❌ Expected 400 for invalid spread, got {resp.status_code}")
    except Exception as e:
        log(f"❌ Invalid spread exception: {e}")

def main():
    global admin_token, regular_token
    
    log("=== RAWMarkets Admin Endpoints Test Suite ===")
    log(f"Base URL: {BASE_URL}")
    
    # Login as admin
    log("\nLogging in as admin...")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ CRITICAL: Failed to login as admin. Aborting tests.")
        return
    log(f"✅ Admin logged in")
    
    # Login as regular user
    log("\nLogging in as regular user...")
    regular_token = login(REGULAR_EMAIL, REGULAR_PASSWORD)
    if not regular_token:
        log("❌ CRITICAL: Failed to login as regular user. Aborting tests.")
        return
    log(f"✅ Regular user logged in")
    
    # Run all tests
    try:
        test_access_control()
        test_admin_stats()
        test_admin_users()
        test_adjust_balance()
        test_withdrawal_flow()
        test_admin_positions()
        test_settings()
        
        log("\n" + "="*60)
        log("=== ALL ADMIN TESTS COMPLETED ===")
        log("="*60)
        
    except Exception as e:
        log(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
