"""Iteration 5 tests — Purchasing Kit rename, Brands CRUD, Testimonials CRUD, Multi-login."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None

# fallback via frontend/.env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PW = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ==================== PURCHASING KIT RENAME ====================
class TestPurchasingKitRename:
    def test_single_active_hamper_named_purchasing_kit(self):
        r = requests.get(f"{API}/products?is_hamper=true", timeout=15)
        assert r.status_code == 200
        hampers = r.json()
        # Filter active only (backend returns is_active=True products via list_products)
        active = [h for h in hampers if h.get("is_active", True) and not h.get("is_locked", False)]
        assert len(active) == 1, f"Expected exactly 1 active hamper, got {len(active)}: {[h['name'] for h in active]}"
        h = active[0]
        assert h["name"] == "EverGro Purchasing Kit", f"Expected 'EverGro Purchasing Kit', got '{h['name']}'"
        assert h.get("hamper_tier") == "Purchasing", f"Expected hamper_tier='Purchasing', got '{h.get('hamper_tier')}'"
        assert h["sku"] == "HMP-JOINING-7200"
        assert h["price"] == 7200.0

    def test_notification_bar_uses_purchasing_kit_text(self):
        r = requests.get(f"{API}/site/settings", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert "Purchasing Kit" in s.get("notification_bar_text", ""), \
            f"Expected 'Purchasing Kit' in notification bar, got: {s.get('notification_bar_text')}"
        assert "Joining Kit" not in s.get("notification_bar_text", ""), \
            "Old 'Joining Kit' text still in notification bar"


# ==================== TESTIMONIALS (≥20) ====================
class TestTestimonials:
    def test_at_least_20_active_testimonials(self):
        r = requests.get(f"{API}/site/testimonials", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 20, f"Expected ≥20 testimonials, got {len(items)}"
        # Basic shape
        for t in items[:3]:
            assert "name" in t and "message" in t and "rating" in t


# ==================== BRANDS (Public + Admin CRUD) ====================
class TestBrandsPublic:
    def test_site_brands_returns_10_plus(self):
        r = requests.get(f"{API}/site/brands", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 10, f"Expected ≥10 brands, got {len(items)}"
        for b in items[:3]:
            assert "name" in b and "logo_url" in b
            assert b["logo_url"].startswith("http"), f"Bad logo_url: {b['logo_url']}"


class TestAdminBrandsCRUD:
    created_id = None

    def test_admin_list_brands(self, admin_headers):
        r = requests.get(f"{API}/admin/brands", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_brand(self, admin_headers):
        payload = {
            "name": f"TEST_Brand_{uuid.uuid4().hex[:6]}",
            "logo_url": "https://dummyimage.com/400x200/000/fff.png&text=TEST",
            "sort_order": 99,
        }
        r = requests.post(f"{API}/admin/brands", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["logo_url"] == payload["logo_url"]
        assert "id" in data
        TestAdminBrandsCRUD.created_id = data["id"]

        # Verify via GET
        r2 = requests.get(f"{API}/site/brands", timeout=15)
        names = [b["name"] for b in r2.json()]
        assert payload["name"] in names

    def test_update_brand(self, admin_headers):
        bid = TestAdminBrandsCRUD.created_id
        assert bid, "Create must run first"
        r = requests.put(f"{API}/admin/brands/{bid}", headers=admin_headers,
                         json={"name": "TEST_Brand_Updated"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST_Brand_Updated"

    def test_delete_brand(self, admin_headers):
        bid = TestAdminBrandsCRUD.created_id
        r = requests.delete(f"{API}/admin/brands/{bid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        # Verify removed
        r2 = requests.get(f"{API}/admin/brands", headers=admin_headers, timeout=15)
        ids = [b["id"] for b in r2.json()]
        assert bid not in ids


# ==================== TESTIMONIALS CRUD ====================
class TestAdminTestimonialsCRUD:
    created_id = None

    def test_admin_list_testimonials(self, admin_headers):
        r = requests.get(f"{API}/admin/testimonials", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_testimonial(self, admin_headers):
        payload = {
            "name": f"TEST_User_{uuid.uuid4().hex[:6]}",
            "role": "Level 1 Member",
            "message": "Test testimonial message from pytest.",
            "rating": 5,
            "avatar": "https://i.pravatar.cc/100?img=1",
        }
        r = requests.post(f"{API}/admin/testimonials", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["rating"] == 5
        assert "id" in data
        TestAdminTestimonialsCRUD.created_id = data["id"]

    def test_update_testimonial(self, admin_headers):
        tid = TestAdminTestimonialsCRUD.created_id
        r = requests.put(f"{API}/admin/testimonials/{tid}", headers=admin_headers,
                         json={"rating": 4, "message": "Updated message"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rating"] == 4
        assert d["message"] == "Updated message"

    def test_delete_testimonial(self, admin_headers):
        tid = TestAdminTestimonialsCRUD.created_id
        r = requests.delete(f"{API}/admin/testimonials/{tid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        # Verify removed
        r2 = requests.get(f"{API}/admin/testimonials", headers=admin_headers, timeout=15)
        ids = [t["id"] for t in r2.json()]
        assert tid not in ids


# ==================== MULTI-LOGIN (Same phone, unique email) ====================
class TestMultiLogin:
    """Register 2 users with same phone but different email + different password.
    Test password-login-by-phone and OTP flow with account picker."""

    phone = None
    user1_email = None
    user1_pw = "Pass@111"
    user1_code = None
    user2_email = None
    user2_pw = "Pass@222"
    user2_code = None
    fresh_referral = None

    def _create_fresh_sponsor(self, admin_headers):
        """Create a fresh sponsor with is_joining_paid=True so their referral code is usable."""
        # Register a fresh user under admin
        seed = uuid.uuid4().hex[:6]
        email = f"TEST_sponsor_{seed}@t.com"
        phone = "8" + "".join([str((i * 7) % 10) for i in range(9)])
        # Ensure phone is unique-ish
        phone = "8" + uuid.uuid4().hex[:9].translate(str.maketrans("abcdef", "012345"))[:9]
        r = requests.post(f"{API}/auth/register", json={
            "name": f"TEST Sponsor {seed}",
            "email": email,
            "phone": phone,
            "password": "Sponsor@123",
            "referral_code": "ADMIN001",  # attempt; if full will fail
            "terms_accepted": True,
        }, timeout=15)
        if r.status_code != 200:
            # ADMIN001 saturated — use SUBADMIN1 instead
            r = requests.post(f"{API}/auth/register", json={
                "name": f"TEST Sponsor {seed}",
                "email": email,
                "phone": phone,
                "password": "Sponsor@123",
                "referral_code": "SUBADMIN1",
                "terms_accepted": True,
            }, timeout=15)
        assert r.status_code == 200, f"Sponsor register failed: {r.text}"
        sponsor = r.json()["user"]
        return sponsor["referral_code"]

    def test_01_create_sponsor(self, admin_headers):
        TestMultiLogin.fresh_referral = self._create_fresh_sponsor(admin_headers)
        assert TestMultiLogin.fresh_referral

    def test_02_register_first_account(self):
        seed = uuid.uuid4().hex[:6]
        TestMultiLogin.phone = "9" + uuid.uuid4().hex[:9].translate(str.maketrans("abcdef", "012345"))[:9]
        TestMultiLogin.user1_email = f"TEST_multi1_{seed}@t.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Multi User One",
            "email": TestMultiLogin.user1_email,
            "phone": TestMultiLogin.phone,
            "password": TestMultiLogin.user1_pw,
            "referral_code": TestMultiLogin.fresh_referral,
            "terms_accepted": True,
        }, timeout=15)
        assert r.status_code == 200, r.text
        TestMultiLogin.user1_code = r.json()["user"]["user_code"]

    def test_03_register_second_account_same_phone(self):
        seed = uuid.uuid4().hex[:6]
        TestMultiLogin.user2_email = f"TEST_multi2_{seed}@t.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Multi User Two",
            "email": TestMultiLogin.user2_email,
            "phone": TestMultiLogin.phone,  # SAME phone
            "password": TestMultiLogin.user2_pw,
            "referral_code": TestMultiLogin.fresh_referral,
            "terms_accepted": True,
        }, timeout=15)
        assert r.status_code == 200, f"Second account should succeed with same phone: {r.text}"
        TestMultiLogin.user2_code = r.json()["user"]["user_code"]
        assert TestMultiLogin.user2_code != TestMultiLogin.user1_code

    def test_04_accounts_by_phone(self):
        r = requests.get(f"{API}/auth/accounts-by-phone", params={"phone": TestMultiLogin.phone}, timeout=15)
        assert r.status_code == 200
        accts = r.json()
        assert len(accts) >= 2, f"Expected ≥2 accounts, got {len(accts)}"
        codes = [a["user_code"] for a in accts]
        assert TestMultiLogin.user1_code in codes
        assert TestMultiLogin.user2_code in codes

    def test_05_password_login_by_phone_picks_correct_account(self):
        # Login with phone + user1's password — should return user1
        r = requests.post(f"{API}/auth/login", json={
            "identifier": TestMultiLogin.phone,
            "password": TestMultiLogin.user1_pw,
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["user_code"] == TestMultiLogin.user1_code, \
            f"Expected {TestMultiLogin.user1_code}, got {r.json()['user']['user_code']}"

        # Login with phone + user2's password — should return user2
        r2 = requests.post(f"{API}/auth/login", json={
            "identifier": TestMultiLogin.phone,
            "password": TestMultiLogin.user2_pw,
        }, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["user"]["user_code"] == TestMultiLogin.user2_code

    def test_06_otp_send_and_verify_returns_multiple(self):
        r = requests.post(f"{API}/auth/otp/send", json={"phone": TestMultiLogin.phone}, timeout=15)
        assert r.status_code == 200
        otp = r.json().get("dev_otp")
        assert otp

        r2 = requests.post(f"{API}/auth/otp/verify", json={"phone": TestMultiLogin.phone, "otp": otp}, timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("verified") is True
        assert d.get("multiple") is True, f"Expected multiple=True, got {d}"
        assert "accounts" in d and len(d["accounts"]) >= 2

    def test_07_otp_pick_account(self):
        # Pick user2 explicitly
        r = requests.post(f"{API}/auth/otp/pick-account", json={
            "phone": TestMultiLogin.phone,
            "user_code": TestMultiLogin.user2_code,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and d["user"]["user_code"] == TestMultiLogin.user2_code


# ==================== HAMPER CONTENTS EDITABLE (PUT preserves contents array) ====================
class TestHamperContentsEdit:
    def test_update_hamper_contents_persists(self, admin_headers):
        # Fetch the joining hamper
        r = requests.get(f"{API}/products?is_hamper=true", timeout=15)
        assert r.status_code == 200
        hampers = [h for h in r.json() if h.get("is_active", True) and not h.get("is_locked", False)]
        assert hampers, "No active hamper"
        hid = hampers[0]["id"]
        original_contents = hampers[0].get("contents", [])

        new_contents = original_contents + [f"TEST_ItemPytest_{uuid.uuid4().hex[:4]}"]
        r2 = requests.put(f"{API}/admin/products/{hid}", headers=admin_headers,
                          json={"contents": new_contents}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("contents") == new_contents

        # Verify via GET
        r3 = requests.get(f"{API}/products/{hid}", timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("contents") == new_contents

        # Restore
        requests.put(f"{API}/admin/products/{hid}", headers=admin_headers,
                     json={"contents": original_contents}, timeout=15)
