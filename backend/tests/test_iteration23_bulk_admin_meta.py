"""Iteration 23 backend tests.

Covers:
  * DELETE /api/admin/users/{id}?cascade=true — recursive downstream deletion
  * DELETE /api/admin/users/{id} (no cascade) — single-user deletion, stats.cascade=false
  * POST /api/admin/users/bulk-delete {user_ids, cascade}
  * POST /api/admin/users/bulk-update — whitelisted fields + 400 for unknown-only
  * PUT /api/admin/settings/site meta_pixel_id + meta_pixel_code persistence
  * GET /api/site/settings tagline + notification_bar_text migration
  * Regression on core admin endpoints
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"identifier": "admin@evergroemart.com", "password": "Admin@123"}
SUB = {"identifier": "subadmin@evergroemart.com", "password": "SubAdmin@123"}


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def super_token():
    r = requests.post(f"{API}/auth/login", json=SUPER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def sub_token():
    r = requests.post(f"{API}/auth/login", json=SUB, timeout=30)
    if r.status_code != 200:
        pytest.skip("sub admin unavailable")
    return r.json()["token"]


def _pick_open_sponsor(super_token: str):
    r = requests.get(f"{API}/admin/users", headers=_auth(super_token),
                     params={"limit": 200}, timeout=15)
    payload = r.json()
    items = payload if isinstance(payload, list) else payload.get("items", [])
    for u in items:
        if u.get("role") == "user" and (u.get("direct_referrals_count", 0) or 0) < 6 \
                and u.get("referral_code"):
            return u["referral_code"]
    return None


def _register(suffix: str, sponsor_code=None):
    stamp = int(time.time() * 1000)
    short = f"t23{suffix}{stamp}"[:28]
    body = {
        "name": f"TEST_it23_{suffix}",
        "email": f"TEST_it23_{suffix}_{stamp}@example.com",
        "phone": f"9{str(stamp)[-9:]}",
        "password": "Test@123",
        "username": short,
        "terms_accepted": True,
    }
    if sponsor_code:
        body["referral_code"] = sponsor_code
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return body, data


def _find_admin_user(super_token):
    # search by known admin email via admin/search
    r = requests.get(f"{API}/admin/users", headers=_auth(super_token),
                     params={"q": "admin@evergroemart.com", "limit": 5}, timeout=15)
    payload = r.json()
    items = payload if isinstance(payload, list) else payload.get("items", [])
    for u in items:
        if u.get("role") in ("super_admin", "sub_admin"):
            return u
    return None


def _get_user_detail(super_token, user_id):
    r = requests.get(f"{API}/admin/users/{user_id}", headers=_auth(super_token), timeout=15)
    return r


# ---------------- site settings ----------------
class TestSiteSettings:
    def test_public_site_settings_migration(self):
        r = requests.get(f"{API}/site/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        tagline = (data.get("tagline") or "").lower()
        notif = (data.get("notification_bar_text") or "").lower()
        assert "8-level" not in notif
        assert "income plan" not in notif
        # tagline should be the migrated one (or at least not contain MLM-like phrases)
        assert "pyramid" not in tagline
        assert "mlm" not in tagline

    def test_admin_can_persist_meta_pixel(self, super_token):
        pid = f"TESTPIXEL_{int(time.time())}"
        code = "<script>console.log('meta-pixel-test')</script>"
        r = requests.put(f"{API}/admin/settings/site",
                         headers=_auth(super_token),
                         json={"meta_pixel_id": pid, "meta_pixel_code": code},
                         timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # read back via public endpoint
        r2 = requests.get(f"{API}/site/settings", timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("meta_pixel_id") == pid
        assert d.get("meta_pixel_code") == code

        # clear it
        r3 = requests.put(f"{API}/admin/settings/site",
                          headers=_auth(super_token),
                          json={"meta_pixel_id": "", "meta_pixel_code": ""},
                          timeout=15)
        assert r3.status_code == 200

        r4 = requests.get(f"{API}/site/settings", timeout=15)
        assert r4.json().get("meta_pixel_id") in ("", None)


# ---------------- DELETE with cascade ----------------
class TestDeleteCascade:
    def test_delete_single_no_cascade(self, super_token):
        _, resp = _register("no_cascade")
        uid = resp["user"]["id"]
        r = requests.delete(f"{API}/admin/users/{uid}",
                            headers=_auth(super_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        stats = data.get("stats") or {}
        assert stats.get("cascade") is False
        assert stats.get("users_deleted") == 1
        # user really gone
        r2 = _get_user_detail(super_token, uid)
        assert r2.status_code == 404

    def test_delete_with_cascade_removes_downline(self, super_token):
        sponsor_code = _pick_open_sponsor(super_token)
        if not sponsor_code:
            pytest.skip("no open sponsor available")
        # parent under existing sponsor
        _, parent_resp = _register("cascp", sponsor_code=sponsor_code)
        parent_code = parent_resp["user"]["referral_code"]
        parent_id = parent_resp["user"]["id"]
        # child under parent
        _, child_resp = _register("cascc", sponsor_code=parent_code)
        child_id = child_resp["user"]["id"]

        r = requests.delete(f"{API}/admin/users/{parent_id}?cascade=true",
                            headers=_auth(super_token), timeout=20)
        assert r.status_code == 200, r.text
        stats = r.json()["stats"]
        assert stats["cascade"] is True
        assert stats["users_deleted"] >= 2

        assert _get_user_detail(super_token, parent_id).status_code == 404
        assert _get_user_detail(super_token, child_id).status_code == 404

    def test_delete_admin_forbidden(self, super_token):
        admin_user = _find_admin_user(super_token)
        assert admin_user, "expected an admin user"
        r2 = requests.delete(f"{API}/admin/users/{admin_user['id']}",
                             headers=_auth(super_token), timeout=15)
        assert r2.status_code == 400

    def test_delete_requires_super_admin(self, sub_token):
        r = requests.delete(f"{API}/admin/users/nonexistent",
                            headers=_auth(sub_token), timeout=15)
        assert r.status_code == 403


# ---------------- bulk delete ----------------
class TestBulkDelete:
    def test_bulk_delete_users(self, super_token):
        _, a = _register("bd1")
        _, b = _register("bd2")
        ids = [a["user"]["id"], b["user"]["id"]]
        r = requests.post(f"{API}/admin/users/bulk-delete",
                          headers=_auth(super_token),
                          json={"user_ids": ids, "cascade": False}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["total_requested"] == 2
        oks = [x for x in body["results"] if x["ok"]]
        assert len(oks) == 2
        for uid in ids:
            assert _get_user_detail(super_token, uid).status_code == 404

    def test_bulk_delete_skips_admin(self, super_token):
        admin_user = _find_admin_user(super_token)
        assert admin_user
        r2 = requests.post(f"{API}/admin/users/bulk-delete",
                           headers=_auth(super_token),
                           json={"user_ids": [admin_user["id"]], "cascade": False},
                           timeout=15)
        assert r2.status_code == 200
        results = r2.json()["results"]
        assert results[0]["ok"] is False
        assert results[0]["reason"] == "admin_or_missing"

    def test_bulk_delete_requires_ids(self, super_token):
        r = requests.post(f"{API}/admin/users/bulk-delete",
                          headers=_auth(super_token),
                          json={"user_ids": [], "cascade": False}, timeout=10)
        assert r.status_code == 400

    def test_bulk_delete_forbidden_for_sub_admin(self, sub_token):
        r = requests.post(f"{API}/admin/users/bulk-delete",
                          headers=_auth(sub_token),
                          json={"user_ids": ["x"], "cascade": False}, timeout=10)
        assert r.status_code == 403


# ---------------- bulk update ----------------
class TestBulkUpdate:
    def test_bulk_update_allowed_field(self, super_token):
        _, a = _register("bu1")
        _, b = _register("bu2")
        ids = [a["user"]["id"], b["user"]["id"]]
        try:
            r = requests.post(f"{API}/admin/users/bulk-update",
                              headers=_auth(super_token),
                              json={"user_ids": ids, "updates": {"is_active": False}},
                              timeout=15)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["ok"] is True
            assert body["matched"] == 2
            # verify persistence
            d = _get_user_detail(super_token, ids[0]).json()
            user = d.get("user", d)
            assert user.get("is_active") is False
        finally:
            requests.post(f"{API}/admin/users/bulk-delete",
                          headers=_auth(super_token),
                          json={"user_ids": ids, "cascade": False}, timeout=15)

    def test_bulk_update_rejects_unknown_only(self, super_token):
        _, a = _register("bu3")
        try:
            r = requests.post(f"{API}/admin/users/bulk-update",
                              headers=_auth(super_token),
                              json={"user_ids": [a["user"]["id"]],
                                    "updates": {"password_hash": "hacked", "email": "x@y.z"}},
                              timeout=15)
            assert r.status_code == 400
            assert "No allowed fields" in r.text
        finally:
            requests.delete(f"{API}/admin/users/{a['user']['id']}",
                            headers=_auth(super_token), timeout=15)

    def test_bulk_update_forbidden_for_sub(self, sub_token):
        r = requests.post(f"{API}/admin/users/bulk-update",
                          headers=_auth(sub_token),
                          json={"user_ids": ["x"], "updates": {"is_active": True}},
                          timeout=10)
        assert r.status_code == 403


# ---------------- regression ----------------
class TestRegression:
    def test_admin_dashboard(self, super_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_auth(super_token), timeout=15)
        assert r.status_code == 200

    def test_admin_users_list(self, super_token):
        r = requests.get(f"{API}/admin/users", headers=_auth(super_token),
                         params={"limit": 5}, timeout=15)
        assert r.status_code == 200
