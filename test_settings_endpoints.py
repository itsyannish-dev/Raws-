#!/usr/bin/env python3
"""
RAWMarkets Settings Endpoints Test
Tests PATCH /api/auth/profile and POST /api/auth/change-password
"""
import requests
import time
import random
import string
import urllib3

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://broker-live.preview.emergentagent.com/api"

def generate_test_email():
    """Generate unique test email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"settingstest_{rand}@rawmarkets.test"

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")
    return passed

def make_request(method: str, endpoint: str, data: dict = None, headers: dict = None, expect_error: bool = False):
    """Make HTTP request with retry logic"""
    url = f"{BASE_URL}/{endpoint}"
    if headers is None:
        headers = {"Content-Type": "application/json"}
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            if method == "GET":
                resp = requests.get(url, headers=headers, verify=False, timeout=15)
            elif method == "POST":
                resp = requests.post(url, json=data, headers=headers, verify=False, timeout=15)
            elif method == "PATCH":
                resp = requests.patch(url, json=data, headers=headers, verify=False, timeout=15)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return resp
        except requests.exceptions.Timeout as e:
            if attempt < max_retries - 1:
                print(f"    Timeout, retrying in 5s... ({str(e)[:50]})")
                time.sleep(5)
            else:
                print(f"    ❌ Request timed out after {max_retries} attempts")
                return None
        except requests.exceptions.ConnectionError as e:
            if attempt < max_retries - 1:
                print(f"    Connection error, retrying in 5s... ({str(e)[:50]})")
                time.sleep(5)
            else:
                print(f"    ❌ Connection failed after {max_retries} attempts")
                return None
        except Exception as e:
            print(f"    ❌ Unexpected error: {type(e).__name__}: {str(e)[:100]}")
            return None
    return None

def test_profile_update():
    """Test PATCH /api/auth/profile endpoint"""
    print("\n" + "="*60)
    print("TEST: PATCH /api/auth/profile")
    print("="*60)
    
    # Create a fresh user for profile tests
    email = generate_test_email()
    password = "ProfileTest123!"
    
    print(f"\n1. Creating test user: {email}")
    resp = make_request("POST", "auth/register", {
        "name": "Profile Test User",
        "email": email,
        "password": password
    })
    
    if not resp or resp.status_code != 201:
        log_test("Create test user", False, f"Status: {resp.status_code if resp else 'No response'}")
        return False
    
    token = resp.json().get("token")
    if not token:
        log_test("Get token from registration", False, "No token in response")
        return False
    
    log_test("Create test user", True, f"Token received")
    
    # Test 1: Update profile with valid token and name
    print("\n2. Test: Update profile with valid name")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    resp = make_request("PATCH", "auth/profile", {"name": "Updated Profile Name"}, headers)
    
    if not resp:
        log_test("Update profile with valid name", False, "No response")
        return False
    
    if resp.status_code != 200:
        log_test("Update profile with valid name", False, f"Expected 200, got {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json()
    if data.get("user", {}).get("name") != "Updated Profile Name":
        log_test("Update profile with valid name", False, f"Name not updated: {data}")
        return False
    
    log_test("Update profile with valid name", True, f"Name updated to: {data['user']['name']}")
    
    # Test 2: Verify GET /api/auth/me reflects the change
    print("\n3. Test: Verify GET /api/auth/me reflects new name")
    resp = make_request("GET", "auth/me", headers=headers)
    
    if not resp or resp.status_code != 200:
        log_test("GET /api/auth/me after profile update", False, f"Status: {resp.status_code if resp else 'No response'}")
        return False
    
    data = resp.json()
    if data.get("user", {}).get("name") != "Updated Profile Name":
        log_test("GET /api/auth/me reflects new name", False, f"Name mismatch: {data}")
        return False
    
    log_test("GET /api/auth/me reflects new name", True, f"Name confirmed: {data['user']['name']}")
    
    # Test 3: Update profile with empty name (should fail with 400)
    print("\n4. Test: Update profile with empty name (expect 400)")
    try:
        resp = make_request("PATCH", "auth/profile", {"name": ""}, headers, expect_error=True)
        
        if not resp:
            log_test("Empty name returns 400", False, "No response received")
            # Continue with other tests instead of returning
        elif resp.status_code != 400:
            log_test("Empty name returns 400", False, f"Expected 400, got {resp.status_code}: {resp.text}")
        else:
            log_test("Empty name returns 400", True, f"Error: {resp.json().get('error', 'N/A')}")
    except Exception as e:
        log_test("Empty name returns 400", False, f"Exception: {e}")
        # Continue with other tests
    
    # Test 4: Update profile with missing name (should fail with 400)
    print("\n5. Test: Update profile with missing name (expect 400)")
    resp = make_request("PATCH", "auth/profile", {}, headers, expect_error=True)
    
    if not resp:
        log_test("Missing name returns 400", False, "No response")
        return False
    
    if resp.status_code != 400:
        log_test("Missing name returns 400", False, f"Expected 400, got {resp.status_code}: {resp.text}")
        return False
    
    log_test("Missing name returns 400", True, f"Error: {resp.json().get('error', 'N/A')}")
    
    # Test 5: Update profile without auth (should fail with 401)
    print("\n6. Test: Update profile without auth (expect 401)")
    no_auth_headers = {"Content-Type": "application/json"}
    resp = make_request("PATCH", "auth/profile", {"name": "Hacker Name"}, no_auth_headers, expect_error=True)
    
    if not resp:
        log_test("No auth returns 401", False, "No response")
        return False
    
    if resp.status_code != 401:
        log_test("No auth returns 401", False, f"Expected 401, got {resp.status_code}: {resp.text}")
        return False
    
    log_test("No auth returns 401", True, f"Error: {resp.json().get('error', 'N/A')}")
    
    print("\n" + "="*60)
    print("✅ PATCH /api/auth/profile - ALL TESTS PASSED")
    print("="*60)
    return True

def test_change_password():
    """Test POST /api/auth/change-password endpoint"""
    print("\n" + "="*60)
    print("TEST: POST /api/auth/change-password")
    print("="*60)
    
    # Create a fresh user for password change tests (NOT trader@rawmarkets.com)
    email = generate_test_email()
    original_password = "PasswordTest123!"
    
    print(f"\n1. Creating test user: {email}")
    resp = make_request("POST", "auth/register", {
        "name": "Password Test User",
        "email": email,
        "password": original_password
    })
    
    if not resp or resp.status_code != 201:
        log_test("Create test user", False, f"Status: {resp.status_code if resp else 'No response'}")
        return False
    
    token = resp.json().get("token")
    if not token:
        log_test("Get token from registration", False, "No token in response")
        return False
    
    log_test("Create test user", True, f"Email: {email}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    # Test 1: Change password without auth (should fail with 401)
    print("\n2. Test: Change password without auth (expect 401)")
    no_auth_headers = {"Content-Type": "application/json"}
    resp = make_request("POST", "auth/change-password", {
        "currentPassword": original_password,
        "newPassword": "NewPassword123!"
    }, no_auth_headers, expect_error=True)
    
    if not resp:
        log_test("No auth returns 401", False, "No response")
        return False
    
    if resp.status_code != 401:
        log_test("No auth returns 401", False, f"Expected 401, got {resp.status_code}: {resp.text}")
        return False
    
    log_test("No auth returns 401", True, f"Error: {resp.json().get('error', 'N/A')}")
    
    # Test 2: Change password with wrong current password (should fail with 401)
    print("\n3. Test: Change password with wrong current password (expect 401)")
    resp = make_request("POST", "auth/change-password", {
        "currentPassword": "WrongPassword123!",
        "newPassword": "NewPassword123!"
    }, headers, expect_error=True)
    
    if not resp:
        log_test("Wrong current password returns 401", False, "No response")
        return False
    
    if resp.status_code != 401:
        log_test("Wrong current password returns 401", False, f"Expected 401, got {resp.status_code}: {resp.text}")
        return False
    
    log_test("Wrong current password returns 401", True, f"Error: {resp.json().get('error', 'N/A')}")
    
    # Test 3: Change password with new password < 6 chars (should fail with 400)
    print("\n4. Test: Change password with new password < 6 chars (expect 400)")
    resp = make_request("POST", "auth/change-password", {
        "currentPassword": original_password,
        "newPassword": "12345"
    }, headers, expect_error=True)
    
    if not resp:
        log_test("Short new password returns 400", False, "No response")
        return False
    
    if resp.status_code != 400:
        log_test("Short new password returns 400", False, f"Expected 400, got {resp.status_code}: {resp.text}")
        return False
    
    log_test("Short new password returns 400", True, f"Error: {resp.json().get('error', 'N/A')}")
    
    # Test 4: Change password with valid credentials (should succeed with 200)
    print("\n5. Test: Change password with valid credentials (expect 200)")
    new_password = "NewPassword123!"
    resp = make_request("POST", "auth/change-password", {
        "currentPassword": original_password,
        "newPassword": new_password
    }, headers)
    
    if not resp:
        log_test("Valid password change returns 200", False, "No response")
        return False
    
    if resp.status_code != 200:
        log_test("Valid password change returns 200", False, f"Expected 200, got {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json()
    if not data.get("success"):
        log_test("Valid password change returns success", False, f"Response: {data}")
        return False
    
    log_test("Valid password change returns 200", True, f"Response: {data}")
    
    # Test 5: Try to login with OLD password (should fail with 401)
    print("\n6. Test: Login with OLD password after change (expect 401)")
    resp = make_request("POST", "auth/login", {
        "email": email,
        "password": original_password
    }, expect_error=True)
    
    if not resp:
        log_test("Login with old password returns 401", False, "No response")
        return False
    
    if resp.status_code != 401:
        log_test("Login with old password returns 401", False, f"Expected 401, got {resp.status_code}: {resp.text}")
        return False
    
    log_test("Login with old password returns 401", True, f"Error: {resp.json().get('error', 'N/A')}")
    
    # Test 6: Login with NEW password (should succeed with 200)
    print("\n7. Test: Login with NEW password after change (expect 200)")
    resp = make_request("POST", "auth/login", {
        "email": email,
        "password": new_password
    })
    
    if not resp:
        log_test("Login with new password returns 200", False, "No response")
        return False
    
    if resp.status_code != 200:
        log_test("Login with new password returns 200", False, f"Expected 200, got {resp.status_code}: {resp.text}")
        return False
    
    new_token = resp.json().get("token")
    if not new_token:
        log_test("Login with new password returns token", False, "No token in response")
        return False
    
    log_test("Login with new password returns 200", True, f"New token received")
    
    print("\n" + "="*60)
    print("✅ POST /api/auth/change-password - ALL TESTS PASSED")
    print("="*60)
    return True

def main():
    """Run all settings endpoint tests"""
    print("\n" + "="*80)
    print("RAWMarkets Settings Endpoints Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing: PATCH /api/auth/profile, POST /api/auth/change-password")
    print("="*80)
    
    results = []
    
    # Test profile update endpoint
    try:
        results.append(("PATCH /api/auth/profile", test_profile_update()))
    except Exception as e:
        print(f"\n❌ EXCEPTION in profile update tests: {e}")
        results.append(("PATCH /api/auth/profile", False))
    
    # Test change password endpoint
    try:
        results.append(("POST /api/auth/change-password", test_change_password()))
    except Exception as e:
        print(f"\n❌ EXCEPTION in change password tests: {e}")
        results.append(("POST /api/auth/change-password", False))
    
    # Summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} | {test_name}")
        if not passed:
            all_passed = False
    
    print("="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*80)
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
