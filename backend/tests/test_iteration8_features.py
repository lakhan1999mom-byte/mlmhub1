"""Iteration 8: Firebase Phone Auth error paths, Easebuzz init/verify hash, MLM re-entry, my-positions."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hamper-mlm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PWD = "Admin@123"
SUBADMIN_EMAIL = "subadmin@evergroemart.com"
SUBADMIN_PWD = "SubAdmin@123"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(s, identifier, password):
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    return r


@pytest.fixture(scope="module")
def admin_token(s):
    r = _login(s, ADMIN_EMAIL, ADMIN_PWD)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def subadmin_token(s):
    r = _login(s, SUBADMIN_EMAIL, SUBADMIN_PWD)
    assert r.status_code == 200, f"subadmin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ==================== FIREBASE PHONE AUTH ====================
class TestFirebaseVerify:
    def test_empty_body_returns_400_id_token_required(self, s):
        r = s.post(f"{API}/auth/firebase-verify", json={})
        assert r.status_code == 400
        assert "id_token required" in r.text

    def test_invalid_token_returns_401(self, s):
        r = s.post(f"{API}/auth/firebase-verify", json={"id_token": "not.a.real.token"})
        assert r.status_code == 401
        assert "Firebase token verification failed" in r.text


# ==================== EASEBUZZ ====================
class TestEasebuzz:
    def test_initiate_requires_auth(self, s):
        r = s.post(f"{API}/payments/easebuzz/initiate", json={"order_id": "x"})
        assert r.status_code in (401, 403)

    def test_initiate_missing_order_id(self, s, admin_token):
        r = s.post(f"{API}/payments/easebuzz/initiate", json={}, headers=h(admin_token))
        assert r.status_code == 400
        assert "order_id required" in r.text

    def test_initiate_unknown_order(self, s, admin_token):
        r = s.post(f"{API}/payments/easebuzz/initiate", json={"order_id": "nonexistent-order-id"}, headers=h(admin_token))
        assert r.status_code == 404

    def test_verify_invalid_signature(self, s, admin_token):
        # Fake payload; hash won't match
        payload = {
            "txnid": "FAKETXN123",
            "status": "success",
            "amount": "7200.00",
            "productinfo": "Test",
            "firstname": "Test",
            "email": "t@t.com",
            "hash": "0" * 128,
            "udf1": "some-order",
        }
        r = s.post(f"{API}/payments/easebuzz/verify", json=payload, headers=h(admin_token))
        assert r.status_code == 400
        assert "Invalid payment signature" in r.text

    def test_reverse_hash_computation(self):
        """Verify build_reverse_hash locally against known input."""
        import sys
        sys.path.insert(0, "/app/backend")
        os.environ.setdefault("EASEBUZZ_MERCHANT_KEY", "APPJYXIJU")
        os.environ.setdefault("EASEBUZZ_SALT", "VPHISF7SP")
        # Reload the module in case env was set after import
        import importlib
        import easebuzz_utils as ez
        importlib.reload(ez)
        computed = ez.build_reverse_hash("success", "TXN1", "7200.00", "Kit", "John", "j@x.com", udf1="ord1")
        # Just verify it's a lower-case sha512 hex (128 chars)
        assert len(computed) == 128
        assert computed == computed.lower()


# ==================== MLM RE-ENTRY ====================
class TestMlmReEntry:
    def test_requires_auth(self, s):
        r = s.post(f"{API}/mlm/re-entry", json={"referral_code": "ADMIN001"})
        assert r.status_code in (401, 403)

    def test_paid_user_missing_referral(self, s, admin_token):
        r = s.post(f"{API}/mlm/re-entry", json={}, headers=h(admin_token))
        assert r.status_code == 400
        assert "referral_code required" in r.text

    def test_invalid_referral(self, s, admin_token):
        r = s.post(f"{API}/mlm/re-entry", json={"referral_code": "ZZZZZZZZ"}, headers=h(admin_token))
        assert r.status_code == 400
        assert "Invalid referral code" in r.text

    def test_own_referral_rejected(self, s, admin_token):
        # Admin's own referral code = ADMIN001
        r = s.post(f"{API}/mlm/re-entry", json={"referral_code": "ADMIN001"}, headers=h(admin_token))
        # Could be "own" or "already have position under this sponsor" or "sponsor full"
        assert r.status_code == 400

    def test_unpaid_user_rejected(self, s, subadmin_token):
        """SubAdmin might or might not be paid — check the branch. If subadmin is paid, skip."""
        me = s.get(f"{API}/auth/me", headers=h(subadmin_token)).json()
        if me.get("is_joining_paid"):
            pytest.skip("subadmin is paid; cannot test unpaid rejection here")
        r = s.post(f"{API}/mlm/re-entry", json={"referral_code": "ADMIN001"}, headers=h(subadmin_token))
        assert r.status_code == 400
        assert "paid" in r.text.lower()

    def test_successful_re_entry_and_my_positions(self, s, admin_token):
        """Create fresh unpaid user, promote to paid via DB, then do re-entry under SUBADMIN1."""
        import subprocess
        import json
        import uuid

        # Step 1: register fresh user with unique phone
        unique = int(time.time()) % 1000000
        phone = f"98{unique:08d}"[:10]
        email = f"reentry_{unique}@test.com"
        password = "TestPass@123"

        # Register under SUBADMIN1 to avoid conflict
        reg = s.post(f"{API}/auth/register", json={
            "name": "ReEntry Tester",
            "email": email,
            "phone": phone,
            "password": password,
            "referral_code": "SUBADMIN1",
            "terms_accepted": True,
        })
        assert reg.status_code == 200, f"register failed: {reg.status_code} {reg.text}"
        new_user = reg.json().get("user") or reg.json()
        new_user_id = new_user.get("id")
        new_token = reg.json().get("token")
        assert new_user_id and new_token

        # Step 2: Directly mark as paid in DB (per instructions)
        py_cmd = f"""
import os, asyncio
from motor.motor_asyncio import AsyncIOMotorClient
async def go():
    c = AsyncIOMotorClient(os.environ.get('MONGO_URL','mongodb://localhost:27017'))
    db = c[os.environ.get('DB_NAME','evergro_emart')]
    res = await db.users.update_one({{'id':'{new_user_id}'}}, {{'$set': {{'is_joining_paid': True}}}})
    print('modified:', res.modified_count)
asyncio.run(go())
"""
        r_env = subprocess.run(
            ["python", "-c", py_cmd],
            capture_output=True, text=True,
            env={**os.environ, "MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "evergro_emart"},
        )
        assert "modified: 1" in r_env.stdout, f"DB update failed: {r_env.stdout} {r_env.stderr}"

        # Step 3: call /mlm/re-entry with a fresh sponsor referral code (admin's or another available)
        # Admin (ADMIN001) may be full. Try ADMIN001 first, then subadmin's original account can't be used
        # since new user was registered under SUBADMIN1. Use ADMIN001.
        r = s.post(f"{API}/mlm/re-entry",
                   json={"referral_code": "ADMIN001"},
                   headers=h(new_token))
        if r.status_code == 400 and "full" in r.text.lower():
            pytest.skip(f"ADMIN001 is saturated; skipping: {r.text}")
        assert r.status_code == 200, f"re-entry failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert "new_position" in body
        assert "token" in body
        np = body["new_position"]
        assert np.get("user_code") != new_user.get("user_code")
        assert np.get("referral_code")
        assert "+re" in np.get("email", ""), f"email should have +re suffix: {np.get('email')}"
        # is_joining_paid must be False on new position
        assert np.get("is_joining_paid") is False

        # Step 4: /mlm/my-positions should now return 2 entries
        r2 = s.get(f"{API}/mlm/my-positions", headers=h(new_token))
        assert r2.status_code == 200
        pos = r2.json().get("positions", [])
        assert len(pos) >= 2, f"expected >=2 positions, got {len(pos)}: {pos}"
        codes = {p.get("user_code") for p in pos}
        assert new_user.get("user_code") in codes
        assert np.get("user_code") in codes


class TestMyPositionsSolo:
    def test_admin_my_positions(self, s, admin_token):
        r = s.get(f"{API}/mlm/my-positions", headers=h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "positions" in data
        assert isinstance(data["positions"], list)
        # NOTE: /mlm/my-positions filters by role='user' so admin primary (super_admin) is excluded.
        # We only validate the endpoint contract here.
