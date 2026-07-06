#!/usr/bin/env python3
"""
Simple direct test for settings endpoints
"""
import requests
import random
import string
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://broker-live.preview.emergentagent.com/api"

def gen_email():
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{rand}@raw.test"

print("="*80)
print("Testing PATCH /api/auth/profile")
print("="*80)

# Create user
email = gen_email()
print(f"\n1. Register user: {email}")
r = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "Test User",
    "email": email,
    "password": "Test123!"
}, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
token = r.json()["token"]

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Test 1: Valid name update
print("\n2. Update profile with valid name")
r = requests.patch(f"{BASE_URL}/auth/profile", json={"name": "New Name"}, headers=headers, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
assert r.json()["user"]["name"] == "New Name", "Name not updated"
print("   ✅ PASS")

# Test 2: Verify with GET /api/auth/me
print("\n3. Verify with GET /api/auth/me")
r = requests.get(f"{BASE_URL}/auth/me", headers=headers, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
assert r.json()["user"]["name"] == "New Name", "Name not reflected in /me"
print("   ✅ PASS")

# Test 3: Empty name
print("\n4. Update profile with empty name (expect 400)")
r = requests.patch(f"{BASE_URL}/auth/profile", json={"name": ""}, headers=headers, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 400, f"Expected 400, got {r.status_code}"
print("   ✅ PASS")

# Test 4: Missing name
print("\n5. Update profile with missing name (expect 400)")
r = requests.patch(f"{BASE_URL}/auth/profile", json={}, headers=headers, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 400, f"Expected 400, got {r.status_code}"
print("   ✅ PASS")

# Test 5: No auth
print("\n6. Update profile without auth (expect 401)")
r = requests.patch(f"{BASE_URL}/auth/profile", json={"name": "Hacker"}, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 401, f"Expected 401, got {r.status_code}"
print("   ✅ PASS")

print("\n" + "="*80)
print("✅ PATCH /api/auth/profile - ALL TESTS PASSED")
print("="*80)

print("\n" + "="*80)
print("Testing POST /api/auth/change-password")
print("="*80)

# Create fresh user for password tests
email2 = gen_email()
old_pass = "OldPass123!"
print(f"\n1. Register user: {email2}")
r = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "Password Test",
    "email": email2,
    "password": old_pass
}, verify=False, timeout=15)
print(f"   Status: {r.status_code}")
token2 = r.json()["token"]
headers2 = {"Authorization": f"Bearer {token2}", "Content-Type": "application/json"}

# Test 1: No auth
print("\n2. Change password without auth (expect 401)")
r = requests.post(f"{BASE_URL}/auth/change-password", json={
    "currentPassword": old_pass,
    "newPassword": "NewPass123!"
}, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 401, f"Expected 401, got {r.status_code}"
print("   ✅ PASS")

# Test 2: Wrong current password
print("\n3. Change password with wrong current password (expect 401)")
r = requests.post(f"{BASE_URL}/auth/change-password", json={
    "currentPassword": "WrongPass123!",
    "newPassword": "NewPass123!"
}, headers=headers2, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 401, f"Expected 401, got {r.status_code}"
print("   ✅ PASS")

# Test 3: Short new password
print("\n4. Change password with short new password (expect 400)")
r = requests.post(f"{BASE_URL}/auth/change-password", json={
    "currentPassword": old_pass,
    "newPassword": "12345"
}, headers=headers2, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 400, f"Expected 400, got {r.status_code}"
print("   ✅ PASS")

# Test 4: Valid password change
new_pass = "NewPass123!"
print("\n5. Change password with valid credentials (expect 200)")
r = requests.post(f"{BASE_URL}/auth/change-password", json={
    "currentPassword": old_pass,
    "newPassword": new_pass
}, headers=headers2, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
assert r.json()["success"] == True, "Success not true"
print("   ✅ PASS")

# Test 5: Login with old password (should fail)
print("\n6. Login with OLD password (expect 401)")
r = requests.post(f"{BASE_URL}/auth/login", json={
    "email": email2,
    "password": old_pass
}, verify=False, timeout=15)
print(f"   Status: {r.status_code}, Response: {r.json()}")
assert r.status_code == 401, f"Expected 401, got {r.status_code}"
print("   ✅ PASS")

# Test 6: Login with new password (should succeed)
print("\n7. Login with NEW password (expect 200)")
r = requests.post(f"{BASE_URL}/auth/login", json={
    "email": email2,
    "password": new_pass
}, verify=False, timeout=15)
print(f"   Status: {r.status_code}")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
assert "token" in r.json(), "No token in response"
print("   ✅ PASS")

print("\n" + "="*80)
print("✅ POST /api/auth/change-password - ALL TESTS PASSED")
print("="*80)

print("\n" + "="*80)
print("✅✅✅ ALL SETTINGS ENDPOINTS TESTS PASSED ✅✅✅")
print("="*80)
