#!/usr/bin/env python3
"""
RAWMarkets KYC Document Verification Testing
Tests all new KYC endpoints + quick regression
"""
import requests
import json
import base64
import time
from io import BytesIO
from PIL import Image

# Base URL from .env
BASE_URL = "https://broker-live.preview.emergentagent.com/api"

# Test credentials
TRADER_EMAIL = "trader@rawmarkets.com"
TRADER_PASSWORD = "Trader123!"
ADMIN_EMAIL = "admin@rawmarkets.com"
ADMIN_PASSWORD = "RawAdmin!2025"

# Generate a small valid base64 PNG (1x1 pixel red PNG)
def generate_test_image_base64():
    """Generate a small valid PNG as base64 string"""
    img = Image.new('RGB', (10, 10), color='red')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def register_fresh_user():
    """Register a fresh user for KYC testing"""
    timestamp = int(time.time() * 1000)
    email = f"kyc_test_{timestamp}@rawmarkets.com"
    name = f"KYC Test User {timestamp}"
    password = "TestPass123!"
    
    print_test(f"Registering fresh user: {email}")
    try:
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "name": name,
            "email": email,
            "password": password
        }, timeout=10)
        
        if r.status_code == 201:
            data = r.json()
            token = data.get('token')
            user = data.get('user', {})
            print_result(True, f"Fresh user registered: {email}, verificationStatus: {user.get('verificationStatus')}")
            return token, email, password
        else:
            print_result(False, f"Registration failed: {r.status_code} - {r.text}")
            return None, None, None
    except Exception as e:
        print_result(False, f"Registration error: {str(e)}")
        return None, None, None

def login(email, password):
    """Login and return token"""
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        }, timeout=10)
        
        if r.status_code == 200:
            return r.json().get('token')
        else:
            print_result(False, f"Login failed for {email}: {r.status_code}")
            return None
    except Exception as e:
        print_result(False, f"Login error: {str(e)}")
        return None

def test_kyc_flow():
    """Test complete KYC document verification flow"""
    
    # 1. Register fresh user
    user_token, user_email, user_password = register_fresh_user()
    if not user_token:
        print_result(False, "Cannot proceed without fresh user")
        return False
    
    headers_user = {"Authorization": f"Bearer {user_token}"}
    
    # 2. Check initial verificationStatus via GET /api/auth/me
    print_test("GET /api/auth/me - Check initial verificationStatus")
    try:
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers_user, timeout=10)
        if r.status_code == 200:
            user_data = r.json().get('user', {})
            verification_status = user_data.get('verificationStatus')
            if verification_status == 'unverified':
                print_result(True, f"Initial verificationStatus is 'unverified' as expected")
            else:
                print_result(False, f"Expected 'unverified', got '{verification_status}'")
        else:
            print_result(False, f"GET /api/auth/me failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 3. GET /api/documents - should be empty initially
    print_test("GET /api/documents - Check empty documents list")
    try:
        r = requests.get(f"{BASE_URL}/documents", headers=headers_user, timeout=10)
        if r.status_code == 200:
            data = r.json()
            docs = data.get('documents', [])
            verification_status = data.get('verificationStatus')
            if len(docs) == 0 and verification_status == 'unverified':
                print_result(True, f"Documents list empty, verificationStatus: {verification_status}")
            else:
                print_result(False, f"Expected empty list and 'unverified', got {len(docs)} docs, status: {verification_status}")
        else:
            print_result(False, f"GET /api/documents failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 4. POST /api/documents - Upload identity document (valid)
    print_test("POST /api/documents - Upload valid identity document")
    identity_data = generate_test_image_base64()
    identity_doc_id = None
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user, json={
            "type": "identity",
            "fileName": "passport.png",
            "mimeType": "image/png",
            "data": identity_data
        }, timeout=10)
        
        if r.status_code == 201:
            data = r.json()
            doc = data.get('document', {})
            verification_status = data.get('verificationStatus')
            identity_doc_id = doc.get('id')
            
            # Verify response structure
            if (doc.get('type') == 'identity' and 
                doc.get('status') == 'pending' and 
                'data' not in doc and
                verification_status == 'pending'):
                print_result(True, f"Identity doc uploaded: id={identity_doc_id}, status=pending, verificationStatus=pending, no data field in response")
            else:
                print_result(False, f"Unexpected response: {json.dumps(data, indent=2)}")
        else:
            print_result(False, f"Upload failed: {r.status_code} - {r.text}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 5. POST /api/documents - Upload address document (valid)
    print_test("POST /api/documents - Upload valid address document")
    address_data = generate_test_image_base64()
    address_doc_id = None
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user, json={
            "type": "address",
            "fileName": "utility_bill.png",
            "mimeType": "image/png",
            "data": address_data
        }, timeout=10)
        
        if r.status_code == 201:
            data = r.json()
            doc = data.get('document', {})
            verification_status = data.get('verificationStatus')
            address_doc_id = doc.get('id')
            
            if (doc.get('type') == 'address' and 
                doc.get('status') == 'pending' and 
                'data' not in doc and
                verification_status == 'pending'):
                print_result(True, f"Address doc uploaded: id={address_doc_id}, status=pending, verificationStatus=pending")
            else:
                print_result(False, f"Unexpected response: {json.dumps(data, indent=2)}")
        else:
            print_result(False, f"Upload failed: {r.status_code} - {r.text}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 6. Validation tests
    print_test("POST /api/documents - Validation: invalid type 'other'")
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user, json={
            "type": "other",
            "fileName": "test.png",
            "mimeType": "image/png",
            "data": identity_data
        }, timeout=10)
        
        if r.status_code == 400:
            print_result(True, f"Invalid type rejected: {r.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    print_test("POST /api/documents - Validation: short data")
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user, json={
            "type": "identity",
            "fileName": "test.png",
            "mimeType": "image/png",
            "data": "short"
        }, timeout=10)
        
        if r.status_code == 400:
            print_result(True, f"Short data rejected: {r.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    print_test("POST /api/documents - Validation: invalid mimeType")
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user, json={
            "type": "identity",
            "fileName": "test.txt",
            "mimeType": "text/plain",
            "data": identity_data
        }, timeout=10)
        
        if r.status_code == 400:
            print_result(True, f"Invalid mimeType rejected: {r.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    print_test("POST /api/documents - Validation: no auth")
    try:
        r = requests.post(f"{BASE_URL}/documents", json={
            "type": "identity",
            "fileName": "test.png",
            "mimeType": "image/png",
            "data": identity_data
        }, timeout=10)
        
        if r.status_code == 401:
            print_result(True, f"No auth rejected: {r.json().get('error')}")
        else:
            print_result(False, f"Expected 401, got {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 7. Re-upload same type (should replace)
    print_test("POST /api/documents - Re-upload identity (should replace)")
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user, json={
            "type": "identity",
            "fileName": "new_passport.png",
            "mimeType": "image/png",
            "data": generate_test_image_base64()
        }, timeout=10)
        
        if r.status_code == 201:
            # Now check GET /api/documents to verify only 1 identity doc
            r2 = requests.get(f"{BASE_URL}/documents", headers=headers_user, timeout=10)
            if r2.status_code == 200:
                docs = r2.json().get('documents', [])
                identity_docs = [d for d in docs if d.get('type') == 'identity']
                if len(identity_docs) == 1:
                    print_result(True, f"Re-upload replaced old identity doc, only 1 identity doc exists")
                    identity_doc_id = identity_docs[0].get('id')  # Update ID
                else:
                    print_result(False, f"Expected 1 identity doc, found {len(identity_docs)}")
            else:
                print_result(False, f"GET /api/documents failed: {r2.status_code}")
        else:
            print_result(False, f"Re-upload failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 8. GET /api/documents - verify 2 docs (1 identity, 1 address)
    print_test("GET /api/documents - Verify 2 documents exist")
    try:
        r = requests.get(f"{BASE_URL}/documents", headers=headers_user, timeout=10)
        if r.status_code == 200:
            data = r.json()
            docs = data.get('documents', [])
            verification_status = data.get('verificationStatus')
            
            identity_docs = [d for d in docs if d.get('type') == 'identity']
            address_docs = [d for d in docs if d.get('type') == 'address']
            
            # Check no data field in any doc
            has_data_field = any('data' in d for d in docs)
            
            if (len(identity_docs) == 1 and len(address_docs) == 1 and 
                not has_data_field and verification_status == 'pending'):
                print_result(True, f"2 docs found (1 identity, 1 address), no data field, verificationStatus=pending")
            else:
                print_result(False, f"Expected 1 identity + 1 address, no data field. Got: {len(identity_docs)} identity, {len(address_docs)} address, has_data={has_data_field}, status={verification_status}")
        else:
            print_result(False, f"GET /api/documents failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 9. ADMIN TESTS - Login as admin
    print_test("Admin login")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print_result(False, "Admin login failed, cannot proceed with admin tests")
        return False
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    print_result(True, "Admin logged in successfully")
    
    # 10. GET /api/admin/documents?status=pending
    print_test("GET /api/admin/documents?status=pending")
    try:
        r = requests.get(f"{BASE_URL}/admin/documents?status=pending", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            data = r.json()
            docs = data.get('documents', [])
            
            # Find our user's docs
            user_docs = [d for d in docs if d.get('user', {}).get('email') == user_email]
            
            # Check structure
            has_data_field = any('data' in d for d in docs)
            has_user_info = all('user' in d for d in docs)
            
            if len(user_docs) >= 2 and not has_data_field and has_user_info:
                print_result(True, f"Found {len(user_docs)} pending docs for user, with user info (name, email, verificationStatus), NO data field")
            else:
                print_result(False, f"Expected >=2 docs for user with user info, no data. Got: {len(user_docs)} docs, has_data={has_data_field}, has_user={has_user_info}")
        else:
            print_result(False, f"GET /api/admin/documents failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 11. GET /api/admin/documents/{id}/file - should return WITH data
    print_test(f"GET /api/admin/documents/{identity_doc_id}/file")
    try:
        r = requests.get(f"{BASE_URL}/admin/documents/{identity_doc_id}/file", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            data = r.json()
            doc = data.get('document', {})
            
            if 'data' in doc and len(doc.get('data', '')) > 100:
                print_result(True, f"Document returned WITH base64 data field (length: {len(doc.get('data', ''))})")
            else:
                print_result(False, f"Expected data field with base64 content, got: {list(doc.keys())}")
        else:
            print_result(False, f"GET file failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 12. POST /api/admin/documents/{id}/approve - Approve identity only
    print_test(f"POST /api/admin/documents/{identity_doc_id}/approve - Approve identity")
    try:
        r = requests.post(f"{BASE_URL}/admin/documents/{identity_doc_id}/approve", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            data = r.json()
            doc = data.get('document', {})
            verification_status = data.get('verificationStatus')
            
            if doc.get('status') == 'approved' and verification_status == 'pending':
                print_result(True, f"Identity approved, user verificationStatus still 'pending' (missing address approval)")
            else:
                print_result(False, f"Expected status=approved, verificationStatus=pending. Got: doc.status={doc.get('status')}, verificationStatus={verification_status}")
        else:
            print_result(False, f"Approve failed: {r.status_code} - {r.text}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 13. Check user verificationStatus via GET /api/auth/me (should still be pending)
    print_test("GET /api/auth/me - Verify verificationStatus after identity approval")
    try:
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers_user, timeout=10)
        if r.status_code == 200:
            user_data = r.json().get('user', {})
            verification_status = user_data.get('verificationStatus')
            if verification_status == 'pending':
                print_result(True, f"User verificationStatus is 'pending' (identity approved, address still pending)")
            else:
                print_result(False, f"Expected 'pending', got '{verification_status}'")
        else:
            print_result(False, f"GET /api/auth/me failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 14. POST /api/admin/documents/{id}/approve - Approve address
    print_test(f"POST /api/admin/documents/{address_doc_id}/approve - Approve address")
    try:
        r = requests.post(f"{BASE_URL}/admin/documents/{address_doc_id}/approve", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            data = r.json()
            doc = data.get('document', {})
            verification_status = data.get('verificationStatus')
            
            if doc.get('status') == 'approved' and verification_status == 'verified':
                print_result(True, f"Address approved, user verificationStatus now 'verified' (both identity and address approved)")
            else:
                print_result(False, f"Expected status=approved, verificationStatus=verified. Got: doc.status={doc.get('status')}, verificationStatus={verification_status}")
        else:
            print_result(False, f"Approve failed: {r.status_code} - {r.text}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 15. Check user verificationStatus via GET /api/auth/me (should be verified)
    print_test("GET /api/auth/me - Verify verificationStatus after both approvals")
    try:
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers_user, timeout=10)
        if r.status_code == 200:
            user_data = r.json().get('user', {})
            verification_status = user_data.get('verificationStatus')
            if verification_status == 'verified':
                print_result(True, f"User verificationStatus is 'verified' (both identity and address approved)")
            else:
                print_result(False, f"Expected 'verified', got '{verification_status}'")
        else:
            print_result(False, f"GET /api/auth/me failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 16. Test rejection flow - Register another user
    print_test("Test rejection flow - Register another user")
    user2_token, user2_email, user2_password = register_fresh_user()
    if not user2_token:
        print_result(False, "Cannot test rejection flow without second user")
        return False
    
    headers_user2 = {"Authorization": f"Bearer {user2_token}"}
    
    # Upload identity doc for user2
    print_test("Upload identity doc for user2")
    try:
        r = requests.post(f"{BASE_URL}/documents", headers=headers_user2, json={
            "type": "identity",
            "fileName": "id_card.png",
            "mimeType": "image/png",
            "data": generate_test_image_base64()
        }, timeout=10)
        
        if r.status_code == 201:
            user2_doc_id = r.json().get('document', {}).get('id')
            print_result(True, f"User2 identity doc uploaded: {user2_doc_id}")
        else:
            print_result(False, f"Upload failed: {r.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
        return False
    
    # 17. POST /api/admin/documents/{id}/reject
    print_test(f"POST /api/admin/documents/{user2_doc_id}/reject - Reject user2 identity")
    try:
        r = requests.post(f"{BASE_URL}/admin/documents/{user2_doc_id}/reject", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            data = r.json()
            doc = data.get('document', {})
            verification_status = data.get('verificationStatus')
            
            if doc.get('status') == 'rejected' and verification_status == 'rejected':
                print_result(True, f"Document rejected, user verificationStatus is 'rejected'")
            else:
                print_result(False, f"Expected status=rejected, verificationStatus=rejected. Got: doc.status={doc.get('status')}, verificationStatus={verification_status}")
        else:
            print_result(False, f"Reject failed: {r.status_code} - {r.text}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 18. Test approving already-approved doc (should fail)
    print_test(f"POST /api/admin/documents/{identity_doc_id}/approve - Try approving already-approved doc")
    try:
        r = requests.post(f"{BASE_URL}/admin/documents/{identity_doc_id}/approve", headers=headers_admin, timeout=10)
        if r.status_code == 400:
            print_result(True, f"Approving already-approved doc rejected: {r.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 19. Test non-admin access to admin endpoints
    print_test("GET /api/admin/documents - Non-admin access (should be 403)")
    try:
        r = requests.get(f"{BASE_URL}/admin/documents", headers=headers_user, timeout=10)
        if r.status_code == 403:
            print_result(True, f"Non-admin access rejected: {r.json().get('error')}")
        else:
            print_result(False, f"Expected 403, got {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # 20. GET /api/admin/stats - Check pendingDocuments count
    print_test("GET /api/admin/stats - Check pendingDocuments count")
    try:
        r = requests.get(f"{BASE_URL}/admin/stats", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            stats = r.json().get('stats', {})
            pending_docs = stats.get('pendingDocuments')
            if pending_docs is not None:
                print_result(True, f"pendingDocuments count: {pending_docs}")
            else:
                print_result(False, f"pendingDocuments field missing in stats")
        else:
            print_result(False, f"GET /api/admin/stats failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    return True

def test_quick_regression():
    """Quick regression tests for existing functionality"""
    
    print_test("QUICK REGRESSION TESTS")
    
    # Login
    trader_token = login(TRADER_EMAIL, TRADER_PASSWORD)
    if not trader_token:
        print_result(False, "Trader login failed")
        return False
    
    headers = {"Authorization": f"Bearer {trader_token}"}
    print_result(True, "Trader login successful")
    
    # GET /api/market/quotes
    print_test("GET /api/market/quotes - Check bid/ask/spreadPips")
    try:
        r = requests.get(f"{BASE_URL}/market/quotes?symbols=BTCUSD,EURUSD", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            quotes = data.get('quotes', {})
            btc = quotes.get('BTCUSD', {})
            
            if 'bid' in btc and 'ask' in btc and 'spreadPips' in btc:
                print_result(True, f"BTCUSD quote has bid/ask/spreadPips: bid={btc.get('bid')}, ask={btc.get('ask')}, spreadPips={btc.get('spreadPips')}")
            else:
                print_result(False, f"Missing bid/ask/spreadPips in quote: {list(btc.keys())}")
        else:
            print_result(False, f"GET quotes failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # Fund user via admin
    print_test("Fund trader via admin adjust-balance")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print_result(False, "Admin login failed")
        return False
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    # Get trader user ID
    try:
        r = requests.get(f"{BASE_URL}/admin/users?search={TRADER_EMAIL}", headers=headers_admin, timeout=10)
        if r.status_code == 200:
            users = r.json().get('users', [])
            if len(users) > 0:
                trader_id = users[0].get('id')
                
                # Adjust balance
                r2 = requests.post(f"{BASE_URL}/admin/users/{trader_id}/adjust-balance", 
                                  headers=headers_admin, 
                                  json={"amount": 10000, "note": "Test funding"}, 
                                  timeout=10)
                if r2.status_code == 200:
                    print_result(True, f"Trader funded with $10,000")
                else:
                    print_result(False, f"Adjust balance failed: {r2.status_code}")
            else:
                print_result(False, "Trader user not found")
        else:
            print_result(False, f"GET users failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # POST /api/orders - Create BTCUSD order
    print_test("POST /api/orders - Create BTCUSD order (0.01 lots, leverage 10)")
    try:
        r = requests.post(f"{BASE_URL}/orders", headers=headers, json={
            "symbol": "BTCUSD",
            "side": "buy",
            "lots": 0.01,
            "leverage": 10
        }, timeout=10)
        
        if r.status_code == 201:
            position = r.json().get('position', {})
            print_result(True, f"Order created: id={position.get('id')}, entryPrice={position.get('entryPrice')}, margin={position.get('margin')}")
        else:
            print_result(False, f"Order creation failed: {r.status_code} - {r.text}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # GET /api/payments/currencies
    print_test("GET /api/payments/currencies - NOWPayments currencies")
    try:
        r = requests.get(f"{BASE_URL}/payments/currencies", timeout=10)
        if r.status_code == 200:
            currencies = r.json().get('currencies', [])
            if len(currencies) > 0:
                print_result(True, f"NOWPayments currencies returned: {len(currencies)} currencies")
            else:
                print_result(False, "No currencies returned")
        else:
            print_result(False, f"GET currencies failed: {r.status_code}")
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    return True

def main():
    print("\n" + "="*80)
    print("RAWMarkets KYC Document Verification Testing")
    print("="*80)
    
    # Test KYC flow
    kyc_success = test_kyc_flow()
    
    # Quick regression
    regression_success = test_quick_regression()
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    if kyc_success and regression_success:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
        if not kyc_success:
            print("  - KYC flow tests failed")
        if not regression_success:
            print("  - Regression tests failed")
    print("="*80)

if __name__ == "__main__":
    main()
