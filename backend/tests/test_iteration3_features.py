"""EverGro eMart - Iteration 3 Feature Tests

Covers:
- Admin sliders (3 locations) + CRUD
- Reels (vertical videos) + CRUD
- Audit logs (event filter, actor filter)
- 6-per-layer MLM referral cap (block 7th)
- Multi-account per phone (register, accounts-by-phone, OTP picker)
- Password login w/ multi-account phone
- /auth/login-with-code
- Min 3 direct referrals required for withdrawal
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hamper-mlm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"
SPONSOR_REF_CODE = "ADMIN001"


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def rand_phone(prefix="7"):
    # 10 digit phone unique per call
    return (prefix + uuid.uuid4().hex[:9])[:10].translate(str.maketrans("abcdef", "012345"))


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# =========================================================================
# 1. SLIDERS (public + admin CRUD)
# =========================================================================
class TestSliders:
    def test_public_list_all_active(self, session):
        r = session.get(f"{API}/sliders")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 8, f"Expected at least 8 seeded sliders, got {len(items)}"

    def test_filter_landing_top(self, session):
        r = session.get(f"{API}/sliders", params={"location": "landing_top"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 3
        assert all(s["location"] == "landing_top" for s in items)

    def test_filter_user_dashboard(self, session):
        r = session.get(f"{API}/sliders", params={"location": "user_dashboard"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 3
        assert all(s["location"] == "user_dashboard" for s in items)

    def test_admin_slider_crud(self, session, admin_token):
        payload = {
            "title": f"TEST Slide {uuid.uuid4().hex[:6]}",
            "subtitle": "x",
            "image_url": "https://example.com/a.jpg",
            "link": "/products",
            "cta_label": "Shop",
            "location": "landing_top",
            "sort_order": 99,
        }
        # CREATE
        r = session.post(f"{API}/admin/sliders", json=payload, headers=auth(admin_token))
        assert r.status_code == 200, r.text
        s = r.json()
        assert "id" in s and s["title"] == payload["title"]
        assert "_id" not in s
        sid = s["id"]

        # UPDATE
        new_title = payload["title"] + " UPD"
        r = session.put(f"{API}/admin/sliders/{sid}", json={"title": new_title}, headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["title"] == new_title

        # Verify via public list
        r = session.get(f"{API}/sliders", params={"location": "landing_top"})
        assert any(x["id"] == sid and x["title"] == new_title for x in r.json())

        # DELETE
        r = session.delete(f"{API}/admin/sliders/{sid}", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify removed
        r = session.get(f"{API}/sliders", params={"location": "landing_top"})
        assert not any(x["id"] == sid for x in r.json())


# =========================================================================
# 2. REELS (public + admin CRUD)
# =========================================================================
class TestReels:
    def test_public_list_all(self, session):
        r = session.get(f"{API}/reels")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 4

    def test_filter_location_landing_includes_both(self, session):
        r = session.get(f"{API}/reels", params={"location": "landing"})
        assert r.status_code == 200
        items = r.json()
        # Filter should match {landing, both}
        assert len(items) >= 4
        assert all(i["location"] in ("landing", "both") for i in items)

    def test_filter_location_user_includes_both(self, session):
        r = session.get(f"{API}/reels", params={"location": "user"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 4
        assert all(i["location"] in ("user", "both") for i in items)

    def test_admin_reel_crud(self, session, admin_token):
        payload = {
            "title": f"TEST Reel {uuid.uuid4().hex[:6]}",
            "video_url": "https://example.com/a.mp4",
            "location": "both",
        }
        r = session.post(f"{API}/admin/reels", json=payload, headers=auth(admin_token))
        assert r.status_code == 200, r.text
        reel = r.json()
        assert "_id" not in reel
        rid = reel["id"]
        # update
        r = session.put(f"{API}/admin/reels/{rid}", json={"title": "Updated Reel"}, headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["title"] == "Updated Reel"
        # delete
        r = session.delete(f"{API}/admin/reels/{rid}", headers=auth(admin_token))
        assert r.status_code == 200


# =========================================================================
# 3. AUDIT LOGS
# =========================================================================
class TestAuditLogs:
    def test_list_returns_items_and_total(self, session, admin_token):
        r = session.get(f"{API}/admin/audit-logs", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        assert isinstance(data["items"], list)
        assert data["total"] >= 0

    def test_filter_by_event_login(self, session, admin_token):
        # Ensure at least one login event present
        session.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r = session.get(f"{API}/admin/audit-logs", params={"event": "login"}, headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert all(item["event"] == "login" for item in data["items"])

    def test_filter_by_actor_code_admin(self, session, admin_token):
        r = session.get(f"{API}/admin/audit-logs", params={"actor_code": "EG000001"}, headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert all(item["actor_code"] == "EG000001" for item in data["items"])

    def test_slider_and_reel_crud_create_audit_entries(self, session, admin_token):
        # Create slider + reel then check audit logs
        s = session.post(f"{API}/admin/sliders", json={
            "title": "Audit Test Slide", "image_url": "https://example.com/x.jpg",
            "location": "landing_top", "sort_order": 100,
        }, headers=auth(admin_token)).json()
        r1 = session.post(f"{API}/admin/reels", json={
            "title": "Audit Test Reel", "video_url": "https://example.com/x.mp4", "location": "both",
        }, headers=auth(admin_token)).json()
        # delete to clean
        session.delete(f"{API}/admin/sliders/{s['id']}", headers=auth(admin_token))
        session.delete(f"{API}/admin/reels/{r1['id']}", headers=auth(admin_token))

        time.sleep(0.3)
        events_found = set()
        # check recent logs (paged limit 50 default)
        r = session.get(f"{API}/admin/audit-logs", headers=auth(admin_token))
        for item in r.json()["items"]:
            events_found.add(item["event"])
        for must in ["slider_create", "slider_delete", "reel_create", "reel_delete", "login"]:
            assert must in events_found, f"Missing audit event: {must}. Found: {events_found}"


# =========================================================================
# 4. MULTI-ACCOUNT PER PHONE
# =========================================================================
@pytest.fixture(scope="module")
def multi_phone():
    return rand_phone("78")


@pytest.fixture(scope="module")
def multi_phone_accounts(session, multi_phone):
    """Register 2 accounts with the same phone & DIFFERENT passwords."""
    nonce = uuid.uuid4().hex[:6]
    accts = []
    for i, pw in enumerate(["passA1234!", "passB1234!"]):
        r = session.post(f"{API}/auth/register", json={
            "name": f"TEST MultiPhone {nonce}-{i}",
            "email": f"multi_{nonce}_{i}@example.com",
            "phone": multi_phone,
            "password": pw,
            # no referral_code → don't consume admin quota
        })
        assert r.status_code == 200, f"Register failed: {r.text}"
        accts.append({"password": pw, "user": r.json()["user"], "token": r.json()["token"]})
    return accts


class TestMultiAccountPhone:
    def test_register_two_accounts_same_phone(self, multi_phone_accounts):
        u1 = multi_phone_accounts[0]["user"]
        u2 = multi_phone_accounts[1]["user"]
        assert u1["phone"] == u2["phone"]
        assert u1["user_code"] != u2["user_code"]
        assert u1["email"] != u2["email"]

    def test_accounts_by_phone(self, session, multi_phone, multi_phone_accounts):
        r = session.get(f"{API}/auth/accounts-by-phone", params={"phone": multi_phone})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        codes_returned = {a["user_code"] for a in data}
        for acct in multi_phone_accounts:
            assert acct["user"]["user_code"] in codes_returned
        assert len(data) >= 2

    def test_otp_verify_returns_multiple_accounts(self, session, multi_phone, multi_phone_accounts):
        r = session.post(f"{API}/auth/otp/send", json={"phone": multi_phone})
        assert r.status_code == 200
        otp = r.json()["dev_otp"]
        r2 = session.post(f"{API}/auth/otp/verify", json={"phone": multi_phone, "otp": otp})
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("verified") is True
        assert data.get("multiple") is True
        assert isinstance(data.get("accounts"), list)
        assert len(data["accounts"]) >= 2

    def test_otp_pick_account_returns_token(self, session, multi_phone, multi_phone_accounts):
        # Send + verify OTP first
        otp = session.post(f"{API}/auth/otp/send", json={"phone": multi_phone}).json()["dev_otp"]
        session.post(f"{API}/auth/otp/verify", json={"phone": multi_phone, "otp": otp})
        target = multi_phone_accounts[0]["user"]
        r = session.post(f"{API}/auth/otp/pick-account",
                         json={"phone": multi_phone, "user_code": target["user_code"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["user_code"] == target["user_code"]

    def test_password_login_multi_phone_picks_correct_account(self, session, multi_phone, multi_phone_accounts):
        # passA → first account
        acctA = multi_phone_accounts[0]
        r = session.post(f"{API}/auth/login", json={"identifier": multi_phone, "password": acctA["password"]})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["user_code"] == acctA["user"]["user_code"]
        # passB → second account
        acctB = multi_phone_accounts[1]
        r = session.post(f"{API}/auth/login", json={"identifier": multi_phone, "password": acctB["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["user_code"] == acctB["user"]["user_code"]
        # wrong → 401
        r = session.post(f"{API}/auth/login", json={"identifier": multi_phone, "password": "wrongPwC!"})
        assert r.status_code == 401

    def test_login_with_code(self, session, multi_phone_accounts):
        acctA = multi_phone_accounts[0]
        r = session.post(f"{API}/auth/login-with-code", json={
            "user_code": acctA["user"]["user_code"], "password": acctA["password"]
        })
        assert r.status_code == 200
        assert r.json()["user"]["user_code"] == acctA["user"]["user_code"]
        # wrong password
        r = session.post(f"{API}/auth/login-with-code", json={
            "user_code": acctA["user"]["user_code"], "password": "wrongPwX!"
        })
        assert r.status_code == 401


# =========================================================================
# 5. MIN 3 DIRECT REFERRALS FOR WITHDRAWAL
# =========================================================================
class TestWithdrawalMinReferrals:
    def test_withdrawal_blocked_without_3_referrals(self, session, admin_token):
        """Register user (no referrals), get KYC approved, attempt withdrawal → 400."""
        nonce = uuid.uuid4().hex[:6]
        reg = session.post(f"{API}/auth/register", json={
            "name": f"TEST Wd {nonce}",
            "email": f"wd_{nonce}@example.com",
            "phone": rand_phone("65"),
            "password": "Test@1234",
            # no sponsor
        })
        assert reg.status_code == 200, reg.text
        user = reg.json()
        token = user["token"]

        # Admin sets kyc_status=approved directly via /admin/users/{id}
        # (Bypassing /admin/kyc because GET /admin/kyc is currently broken — missing route decorator)
        r = session.put(f"{API}/admin/users/{user['user']['id']}",
                        json={"kyc_status": "approved"}, headers=auth(admin_token))
        assert r.status_code == 200, r.text
        assert r.json().get("kyc_status") == "approved"

        # Request withdrawal — should fail with referrals message
        r = session.post(f"{API}/withdrawals/request",
                         json={"amount": 100, "method": "bank",
                               "account_holder": "Test", "account_number": "1234567890",
                               "ifsc": "HDFC0000123", "bank_name": "HDFC"},
                         headers=auth(token))
        assert r.status_code == 400, r.text
        body = r.text.lower()
        assert "3 direct referral" in body or "at least 3" in body, f"Unexpected: {r.text}"


# =========================================================================
# 6. 6-PER-LAYER RULE (runs LAST — saturates ADMIN001)
# =========================================================================
class TestSixPerLayerRule:
    """This must run LAST because it fills ADMIN001 to its 6-referral cap."""

    def test_block_7th_referral(self, session, admin_token):
        # Detect current admin referrals count
        admin = session.post(f"{API}/auth/login",
                             json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["user"]
        current = admin.get("direct_referrals_count", 0)
        print(f"Admin starts with {current} direct referrals")
        assert current <= 6, f"Admin already over cap: {current}"

        slots_remaining = 6 - current
        # Fill remaining slots
        for i in range(slots_remaining):
            nonce = uuid.uuid4().hex[:6]
            r = session.post(f"{API}/auth/register", json={
                "name": f"TEST Layer {nonce}",
                "email": f"layer_{nonce}@example.com",
                "phone": rand_phone("69"),
                "password": "Test@1234",
                "referral_code": SPONSOR_REF_CODE,
            })
            assert r.status_code == 200, f"Slot fill {i+1}/{slots_remaining} failed: {r.text}"

        # Verify admin now at 6
        admin_after = session.post(f"{API}/auth/login",
                                   json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["user"]
        assert admin_after["direct_referrals_count"] >= 6, \
            f"Expected admin saturated at >=6, got {admin_after['direct_referrals_count']}"

        # 7th attempt — must be BLOCKED
        nonce = uuid.uuid4().hex[:6]
        r = session.post(f"{API}/auth/register", json={
            "name": f"TEST Overflow {nonce}",
            "email": f"overflow_{nonce}@example.com",
            "phone": rand_phone("69"),
            "password": "Test@1234",
            "referral_code": SPONSOR_REF_CODE,
        })
        assert r.status_code == 400, f"Expected 400 block, got {r.status_code}: {r.text}"
        assert "full" in r.text.lower() or "max" in r.text.lower(), f"Unexpected detail: {r.text}"


# =========================================================================
# 7. AUDIT LOG METHODS COVERAGE
# =========================================================================
class TestAuditLoginMethods:
    def test_login_methods_have_audit(self, session, admin_token, multi_phone_accounts, multi_phone):
        # Trigger one of each login method
        # password
        session.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        # user_code
        acct = multi_phone_accounts[0]
        session.post(f"{API}/auth/login-with-code", json={
            "user_code": acct["user"]["user_code"], "password": acct["password"]
        })
        # otp (single-account phone) — use a fresh phone single account
        nonce = uuid.uuid4().hex[:6]
        ph = rand_phone("75")
        reg = session.post(f"{API}/auth/register", json={
            "name": f"TEST OTP {nonce}",
            "email": f"otp_{nonce}@example.com",
            "phone": ph,
            "password": "Test@1234",
        })
        assert reg.status_code == 200, reg.text
        otp = session.post(f"{API}/auth/otp/send", json={"phone": ph}).json()["dev_otp"]
        v = session.post(f"{API}/auth/otp/verify", json={"phone": ph, "otp": otp})
        assert v.status_code == 200
        # otp_picker
        otp2 = session.post(f"{API}/auth/otp/send", json={"phone": multi_phone}).json()["dev_otp"]
        session.post(f"{API}/auth/otp/verify", json={"phone": multi_phone, "otp": otp2})
        session.post(f"{API}/auth/otp/pick-account",
                     json={"phone": multi_phone, "user_code": acct["user"]["user_code"]})

        time.sleep(0.5)
        # Pull last 50 login audit records
        r = session.get(f"{API}/admin/audit-logs", params={"event": "login", "limit": 50},
                        headers=auth(admin_token))
        assert r.status_code == 200
        items = r.json()["items"]
        methods_seen = {item.get("metadata", {}).get("method") for item in items}
        for m in ["password", "user_code", "otp", "otp_picker"]:
            assert m in methods_seen, f"Audit log method '{m}' not found. Seen: {methods_seen}"
