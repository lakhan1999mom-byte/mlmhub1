"""Iteration 22 — Admin DELETE + mark-kit-paid backend tests.

Covers:
  * DELETE /api/admin/users/{user_id} — super_admin only; 403 for sub_admin,
    404 for unknown id, 400 for admin roles. Success path returns stats with
    every collection key, and identifiers become re-registerable.
  * POST /api/admin/users/{user_id}/mark-kit-paid — super_admin only;
    primary path flips is_joining_paid + marks pending joining order as paid
    + triggers process_paid_joining so sponsor.direct_referrals_count increments.
    Second call returns already_paid=True.
  * Business path with body {business_id} — 404 for unknown / non-owned business.
  * Regression on /admin/users, /admin/users/{id}, /admin/users/{id}/reset-password,
    /admin/users/{id}/commission-breakdown, /admin/users/{id}/downline-tree,
    /admin/fresh-start (still requires confirm='RESET').
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"identifier": "admin@evergroemart.com", "password": "Admin@123"}
SUB = {"identifier": "subadmin@evergroemart.com", "password": "SubAdmin@123"}
SUPER_REFERRAL_CODE = "ADMIN001"


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def _pick_open_sponsor_code(super_token: str):
    """Find a paid user with <6 direct referrals to act as sponsor for new registrations.
    Returns their referral_code (or None if none available)."""
    r = requests.get(f"{API}/admin/users", headers=_auth(super_token),
                     params={"limit": 200}, timeout=15)
    if r.status_code != 200:
        return None
    payload = r.json()
    items = payload if isinstance(payload, list) else payload.get("items", [])
    for u in items:
        if u.get("role") == "user" and u.get("is_joining_paid") and \
           (u.get("direct_referrals_count", 0) or 0) < 6 and u.get("referral_code"):
            return u["referral_code"]
    return None


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def super_token():
    r = requests.post(f"{API}/auth/login", json=SUPER, timeout=30)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def sub_token():
    r = requests.post(f"{API}/auth/login", json=SUB, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"sub admin login unavailable: {r.status_code} {r.text}")
    return r.json()["token"]


def _register_fresh_user(suffix: str, sponsor_code=None):
    """Register a brand-new user prefixed TEST_. Returns the registration payload +
    api response so we can capture identifiers and the assigned id/user_code.
    If sponsor_code is None, register without any sponsor."""
    stamp = int(time.time() * 1000)
    body = {
        "name": f"TEST_ItGrant_{suffix}",
        "email": f"TEST_it22_{suffix}_{stamp}@example.com",
        "phone": f"9{str(stamp)[-9:]}",  # 10 digits
        "password": "Test@123",
        "username": f"test_it22_{suffix}_{stamp}",
        "terms_accepted": True,
    }
    if sponsor_code:
        body["referral_code"] = sponsor_code
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    user_id = data.get("user", {}).get("id") if isinstance(data.get("user"), dict) else None
    user_id = user_id or data.get("id")
    user_code = None
    if isinstance(data.get("user"), dict):
        user_code = data["user"].get("user_code")
    user_code = user_code or data.get("user_code")
    if not user_id:
        token = data.get("token")
        if token:
            me = requests.get(f"{API}/me", headers=_auth(token), timeout=15).json()
            user_id = me.get("id")
            user_code = me.get("user_code")
    return body, user_id, user_code, data.get("token")


# ============================================================
# 1. DELETE endpoint
# ============================================================
class TestAdminDeleteUser:
    def test_sub_admin_forbidden(self, sub_token):
        r = requests.delete(f"{API}/admin/users/some-id", headers=_auth(sub_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_unknown_user_404(self, super_token):
        r = requests.delete(f"{API}/admin/users/{uuid.uuid4()}", headers=_auth(super_token), timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_cannot_delete_super_admin(self, super_token):
        # Get super_admin id via /auth/me
        me = requests.get(f"{API}/auth/me", headers=_auth(super_token), timeout=15)
        assert me.status_code == 200, me.text
        target_id = me.json().get("id") or me.json().get("user", {}).get("id")
        assert target_id, f"/me returned no id: {me.json()}"
        r = requests.delete(f"{API}/admin/users/{target_id}", headers=_auth(super_token), timeout=15)
        assert r.status_code == 400, f"expected 400 protecting admin, got {r.status_code} {r.text}"

    def test_delete_and_reregister_flow(self, super_token):
        # 1. Register a fresh user (no sponsor needed for this flow)
        body, user_id, user_code, _ = _register_fresh_user("del")
        assert user_id, "could not obtain new user id after register"

        # 2. Ensure they show up via admin GET
        r = requests.get(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200, r.text

        # 3. Delete
        r = requests.delete(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        stats = data.get("stats") or {}
        for k in ("orders", "referral_businesses", "withdrawals", "transactions",
                  "notifications", "kyc", "tickets", "cart", "audit_logs"):
            assert k in stats, f"stats missing '{k}' → {stats}"
            assert isinstance(stats[k], int)

        # 4. GET now 404
        r = requests.get(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)
        assert r.status_code == 404, f"user still exists after delete: {r.status_code} {r.text}"

        # 5. Re-register with SAME phone/email/username should now succeed
        r = requests.post(f"{API}/auth/register", json=body, timeout=30)
        assert r.status_code == 200, f"re-register with freed identifiers failed: {r.status_code} {r.text}"
        new_user = r.json().get("user") or r.json()
        new_id = new_user.get("id") or r.json().get("id")

        # cleanup this second user too
        if new_id:
            requests.delete(f"{API}/admin/users/{new_id}", headers=_auth(super_token), timeout=15)


# ============================================================
# 2. mark-kit-paid endpoint — primary path
# ============================================================
class TestAdminMarkKitPaid:
    def test_sub_admin_forbidden(self, sub_token):
        r = requests.post(f"{API}/admin/users/{uuid.uuid4()}/mark-kit-paid",
                          headers=_auth(sub_token), json={}, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_unknown_user_404(self, super_token):
        r = requests.post(f"{API}/admin/users/{uuid.uuid4()}/mark-kit-paid",
                          headers=_auth(super_token), json={}, timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_primary_grant_and_idempotent(self, super_token):
        # Pick a sponsor who is paid and still has room. Fall back to no-sponsor.
        sponsor_code = _pick_open_sponsor_code(super_token)
        sponsor_id = None
        before_refs = 0
        if sponsor_code:
            # find sponsor id for later re-fetch
            r = requests.get(f"{API}/admin/users", headers=_auth(super_token),
                             params={"search": sponsor_code, "limit": 20}, timeout=15)
            items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
            for u in items:
                if u.get("referral_code") == sponsor_code:
                    sponsor_id = u["id"]
                    before_refs = u.get("direct_referrals_count", 0) or 0
                    break

        body, user_id, user_code, _ = _register_fresh_user("grant", sponsor_code=sponsor_code)

        # is_joining_paid should be False initially per /admin/users/{id}
        detail = requests.get(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15).json()
        user_before = detail.get("user", detail)
        assert user_before.get("is_joining_paid") in (False, None), \
            f"user unexpectedly already paid: {detail}"

        # Grant
        r = requests.post(f"{API}/admin/users/{user_id}/mark-kit-paid",
                          headers=_auth(super_token), json={}, timeout=30)
        assert r.status_code == 200, f"grant failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("activated") is True
        assert data.get("order_code")

        # Verify user now flagged paid
        detail2 = requests.get(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15).json()
        user_after = detail2.get("user", detail2)
        assert user_after.get("is_joining_paid") is True, f"is_joining_paid not flipped: {detail2}"

        # Sponsor.direct_referrals_count should have incremented (proof process_paid_joining ran)
        if sponsor_id:
            r = requests.get(f"{API}/admin/users/{sponsor_id}", headers=_auth(super_token), timeout=15)
            sd = r.json().get("user", r.json())
            after_refs = sd.get("direct_referrals_count", 0) or 0
            assert after_refs == before_refs + 1, (
                f"sponsor direct_referrals_count did not increment: {before_refs} → {after_refs}"
            )

        # Idempotent: second call returns already_paid=True
        r2 = requests.post(f"{API}/admin/users/{user_id}/mark-kit-paid",
                           headers=_auth(super_token), json={}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("already_paid") is True, f"expected already_paid true, got {r2.json()}"

        # cleanup
        requests.delete(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)

    def test_business_path_unknown_business_404(self, super_token):
        # Create fresh user, then try to grant business that doesn't belong to them
        _, user_id, _, _ = _register_fresh_user("bizneg")
        try:
            r = requests.post(
                f"{API}/admin/users/{user_id}/mark-kit-paid",
                headers=_auth(super_token), json={"business_id": str(uuid.uuid4())}, timeout=15,
            )
            assert r.status_code == 404, f"expected 404 unknown business, got {r.status_code} {r.text}"
        finally:
            requests.delete(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)


# ============================================================
# 3. Regression — untouched endpoints still respond correctly
# ============================================================
class TestRegression:
    def test_admin_users_list(self, super_token):
        r = requests.get(f"{API}/admin/users", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_user_detail_and_dependent_endpoints(self, super_token):
        # Pick super admin themselves as a stable target
        r = requests.get(f"{API}/admin/users", headers=_auth(super_token), params={"role": "super_admin"}, timeout=15)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert items, "no users returned"
        target_id = items[0]["id"]

        r = requests.get(f"{API}/admin/users/{target_id}", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{API}/admin/users/{target_id}/commission-breakdown", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{API}/admin/users/{target_id}/downline-tree", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200

    def test_admin_reset_password_still_works(self, super_token):
        # Create fresh user, reset their password, then delete.
        body, user_id, _, _ = _register_fresh_user("reset")
        try:
            r = requests.post(
                f"{API}/admin/users/{user_id}/reset-password",
                headers=_auth(super_token), json={"new_password": "NewPass@999"}, timeout=15,
            )
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True

            # login with the new password
            login = requests.post(f"{API}/auth/login", json={
                "identifier": body["email"], "password": "NewPass@999",
            }, timeout=15)
            assert login.status_code == 200, f"login with new password failed: {login.text}"
        finally:
            requests.delete(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)

    def test_admin_fresh_start_still_guarded(self, super_token):
        r = requests.post(f"{API}/admin/fresh-start", headers=_auth(super_token), json={}, timeout=15)
        assert r.status_code in (400, 422), f"fresh-start should reject without confirm=RESET, got {r.status_code}"

    def test_uropay_public_provider_unchanged(self):
        r = requests.get(f"{API}/site/payment-provider", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("provider") == "uropay"
        assert data.get("uropay_active") is True
