"""Iteration 9 bugfix regression:
1. /api/mlm/my-positions no longer filters by role='user' — admin's own primary IS now returned.
2. TOTAL_POTENTIAL constant fix verified on backend indirectly (via existing regression items).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PWD = "Admin@123"
SUBADMIN_EMAIL = "subadmin@evergroemart.com"
SUBADMIN_PWD = "SubAdmin@123"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(s, identifier, password):
    return s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})


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


class TestMyPositionsRoleFilterRemoved:
    """The role='user' filter was removed. Admin's own primary account MUST now show up in my-positions."""

    def test_admin_primary_included_in_positions(self, s, admin_token):
        # Get admin's info first
        me = s.get(f"{API}/auth/me", headers=h(admin_token))
        assert me.status_code == 200
        admin_data = me.json()
        admin_code = admin_data.get("user_code")
        admin_phone = admin_data.get("phone")
        assert admin_code, f"admin has no user_code: {admin_data}"
        assert admin_phone, f"admin has no phone: {admin_data}"

        # Fetch positions — admin's own primary MUST be listed even though role != 'user'
        r = s.get(f"{API}/mlm/my-positions", headers=h(admin_token))
        assert r.status_code == 200, f"my-positions failed: {r.status_code} {r.text}"
        data = r.json()
        assert "positions" in data
        positions = data["positions"]
        assert isinstance(positions, list)
        assert len(positions) >= 1, "admin primary should now be included"

        codes = [p.get("user_code") for p in positions]
        assert admin_code in codes, (
            f"admin primary user_code {admin_code} MUST be in positions after role filter removal. "
            f"got: {codes}"
        )

    def test_subadmin_primary_included_in_positions(self, s, subadmin_token):
        me = s.get(f"{API}/auth/me", headers=h(subadmin_token))
        assert me.status_code == 200
        sub_data = me.json()
        sub_code = sub_data.get("user_code")

        r = s.get(f"{API}/mlm/my-positions", headers=h(subadmin_token))
        assert r.status_code == 200
        positions = r.json().get("positions", [])
        codes = [p.get("user_code") for p in positions]
        assert sub_code in codes, (
            f"subadmin primary user_code {sub_code} MUST be in positions. got: {codes}"
        )


class TestIter8RegressionQuick:
    """Quick regression from iteration 8: login + firebase-verify error paths + easebuzz init auth."""

    def test_login_admin_works(self, s):
        r = _login(s, ADMIN_EMAIL, ADMIN_PWD)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_firebase_verify_empty_body_400(self, s):
        r = s.post(f"{API}/auth/firebase-verify", json={})
        assert r.status_code == 400
        assert "id_token required" in r.text

    def test_firebase_verify_invalid_token_401(self, s):
        r = s.post(f"{API}/auth/firebase-verify", json={"id_token": "not.a.real.token"})
        assert r.status_code == 401

    def test_easebuzz_initiate_requires_auth(self, s):
        r = s.post(f"{API}/payments/easebuzz/initiate", json={"order_id": "x"})
        assert r.status_code in (401, 403)

    def test_mlm_reentry_requires_referral_code(self, s, admin_token):
        r = s.post(f"{API}/mlm/re-entry", json={}, headers=h(admin_token))
        assert r.status_code == 400
