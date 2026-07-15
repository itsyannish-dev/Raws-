#!/usr/bin/env python3
"""Test oversized order rejection"""
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://broker-live.preview.emergentagent.com/api"

# Use the token from the previous test
# We need to login first
resp = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "forex_test_dgd4n4sz@rawmarkets.test",
    "password": "ForexTest123!"
}, verify=False, timeout=15)

if resp.status_code != 200:
    print(f"Login failed: {resp.status_code}")
    exit(1)

token = resp.json()["token"]
print(f"✅ Logged in successfully")

# Check current balance
resp = requests.get(f"{BASE_URL}/account/summary", 
                   headers={"Authorization": f"Bearer {token}"},
                   verify=False, timeout=15)

if resp.status_code != 200:
    print(f"Failed to get account summary: {resp.status_code}")
    exit(1)

account = resp.json()["account"]
print(f"Balance: ${account['balance']:.2f}")
print(f"Free margin: ${account['freeMargin']:.2f}")

# Try oversized order
print("\nTrying oversized order: 10 lots EURUSD leverage 1...")
resp = requests.post(f"{BASE_URL}/orders", json={
    "symbol": "EURUSD",
    "side": "buy",
    "lots": 10,
    "leverage": 1
}, headers={"Authorization": f"Bearer {token}"}, verify=False, timeout=30)

print(f"Status: {resp.status_code}")
print(f"Response: {resp.json()}")

if resp.status_code == 400:
    error = resp.json().get("error", "")
    if "insufficient" in error.lower() or "margin" in error.lower():
        print("✅ PASS: Correctly rejected with insufficient margin error")
    else:
        print(f"❌ FAIL: Wrong error message: {error}")
else:
    print(f"❌ FAIL: Expected 400, got {resp.status_code}")
