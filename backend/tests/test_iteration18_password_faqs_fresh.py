"""
Iteration 18 backend tests:
- POST /api/auth/change-password (self password change)
- POST /api/admin/users/{id}/reset-password (super_admin only)
- POST /api/admin/fresh-start (guard only — do NOT actually wipe data)
- POST /api/admin/refresh-faqs (super_admin only) + FAQ content assertion
- GET /api/mlm/commission-breakdown (user)
- GET /api/admin/users/{id}/commission-breakdown (admin)
- Regression: /api/auth/login, /api/admin/dashboard, /api/mlm/businesses,
  /api/admin/search, /api/admin/users/{id}/login-history, /api/admin/users/{id}/activity
"""

import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    # fallback per iteration 17
    BASE_URL = "https://hamper-mlm-hub.preview.emergentagent.com"
API = f"{BASE_URL}/api"

SUPER_ADMIN_EMAIL = "admin@evergroemart.com"
SUPER_ADMIN_PASSWORD = "Admin@123"

SUB_ADMIN_EMAIL = "subadmin@evergroemart.com"
SUB_ADMIN_PASSWORD = "SubAdmin@123"

USER_UNAME = "test1_1785761123"
USER_PASSWORD = "NewPass@123"

CHROME_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)


# ---------- helpers ----------
def _login(s, identifier, password, ip="203.0.113.9"):
    r = s.post(
        f"{API}/auth/login",
        json={"identifier": identifier, "password": password},
        headers={"X-Forwarded-For": ip, "User-Agent": CHROME_UA},
        timeout=30,
    )
    return r


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def super_admin_login(s):
    r = _login(s, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def super_admin_token(super_admin_login):
    return super_admin_login["token"]


@pytest.fixture(scope="module")
def super_admin_h(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}"}


@pytest.fixture(scope="module")
def sub_admin_login(s):
    r = _login(s, SUB_ADMIN_EMAIL, SUB_ADMIN_PASSWORD)
    assert r.status_code == 200, f"sub admin login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def sub_admin_h(sub_admin_login):
    return {"Authorization": f"Bearer {sub_admin_login['token']}"}


@pytest.fixture(scope="module")
def user_login(s):
    r = _login(s, USER_UNAME, USER_PASSWORD)
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def user_token(user_login):
    return user_login["token"]


@pytest.fixture(scope="module")
def user_id(user_login):
    return user_login["user"]["id"]


@pytest.fixture(scope="module")
def user_h(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# ---------- Login audit (regression) ----------
class TestLoginAudit:
    def test_login_returns_token_and_user_shape(self, super_admin_login):
        assert "token" in super_admin_login
        u = super_admin_login["user"]
        assert u["email"] == SUPER_ADMIN_EMAIL
        assert u["role"] == "super_admin"
        assert u.get("user_code") == "EG000001"

    def test_login_audit_log_has_ip_and_ua(self, s, super_admin_h):
        r = s.get(f"{API}/admin/audit-logs", headers=super_admin_h, params={"limit": 20}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        logs = data.get("logs") or data.get("items") or data
        assert isinstance(logs, list) and len(logs) > 0
        # Find at least one login row with ip / user_agent
        found = False
        for row in logs[:20]:
            meta = row.get("metadata") or {}
            ip = row.get("ip") or meta.get("ip")
            ua = row.get("user_agent") or meta.get("user_agent")
            evt = row.get("event") or row.get("action")
            if evt == "login" and (ip or ua):
                found = True
                break
        assert found, "no login audit row with ip/user_agent found"


# ---------- Change own password ----------
class TestChangeOwnPassword:
    def test_wrong_current_password_401(self, s, user_h):
        r = s.post(
            f"{API}/auth/change-password",
            headers=user_h,
            json={"current_password": "WrongPass!", "new_password": "Whatever123"},
            timeout=30,
        )
        assert r.status_code == 401, r.text

    def test_short_new_password_400(self, s, user_h):
        r = s.post(
            f"{API}/auth/change-password",
            headers=user_h,
            json={"current_password": USER_PASSWORD, "new_password": "abc"},
            timeout=30,
        )
        assert r.status_code == 400, r.text

    def test_change_and_restore(self, s, user_h):
        new_pw = "Rotated@2026"
        # 1) change to new
        r = s.post(
            f"{API}/auth/change-password",
            headers=user_h,
            json={"current_password": USER_PASSWORD, "new_password": new_pw},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

        # 2) login with new password
        r2 = _login(requests.Session(), USER_UNAME, new_pw)
        assert r2.status_code == 200, f"login with new pw failed: {r2.text}"

        # 3) old password should now fail
        r3 = _login(requests.Session(), USER_UNAME, USER_PASSWORD)
        assert r3.status_code == 401

        # 4) restore original — use the freshly-logged-in session
        new_token = r2.json()["token"]
        h2 = {"Authorization": f"Bearer {new_token}"}
        r4 = s.post(
            f"{API}/auth/change-password",
            headers=h2,
            json={"current_password": new_pw, "new_password": USER_PASSWORD},
            timeout=30,
        )
        assert r4.status_code == 200, f"restore failed: {r4.text}"

        # 5) verify original works again
        r5 = _login(requests.Session(), USER_UNAME, USER_PASSWORD)
        assert r5.status_code == 200, f"original pw broken after restore: {r5.text}"


# ---------- Admin reset password ----------
class TestAdminResetPassword:
    def test_sub_admin_forbidden(self, s, sub_admin_h, user_id):
        r = s.post(
            f"{API}/admin/users/{user_id}/reset-password",
            headers=sub_admin_h,
            json={"new_password": "Something123"},
            timeout=30,
        )
        assert r.status_code == 403, r.text

    def test_short_password_400(self, s, super_admin_h, user_id):
        r = s.post(
            f"{API}/admin/users/{user_id}/reset-password",
            headers=super_admin_h,
            json={"new_password": "abc"},
            timeout=30,
        )
        assert r.status_code == 400, r.text

    def test_unknown_user_404(self, s, super_admin_h):
        r = s.post(
            f"{API}/admin/users/does-not-exist-xyz/reset-password",
            headers=super_admin_h,
            json={"new_password": "Whatever@123"},
            timeout=30,
        )
        assert r.status_code == 404, r.text

    def test_reset_and_login(self, s, super_admin_h, user_id):
        new_pw = "AdminReset@2026"
        r = s.post(
            f"{API}/admin/users/{user_id}/reset-password",
            headers=super_admin_h,
            json={"new_password": new_pw},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body.get("user_code")

        # Login with new pw
        r2 = _login(requests.Session(), USER_UNAME, new_pw)
        assert r2.status_code == 200, r2.text

        # Restore original via admin reset
        r3 = s.post(
            f"{API}/admin/users/{user_id}/reset-password",
            headers=super_admin_h,
            json={"new_password": USER_PASSWORD},
            timeout=30,
        )
        assert r3.status_code == 200, r3.text

        # Verify original works
        r4 = _login(requests.Session(), USER_UNAME, USER_PASSWORD)
        assert r4.status_code == 200


# ---------- Fresh start guard ----------
class TestFreshStartGuard:
    def test_sub_admin_forbidden(self, s, sub_admin_h):
        r = s.post(f"{API}/admin/fresh-start", headers=sub_admin_h, json={"confirm": "RESET"}, timeout=30)
        assert r.status_code == 403, r.text

    def test_empty_body_400(self, s, super_admin_h):
        r = s.post(f"{API}/admin/fresh-start", headers=super_admin_h, json={}, timeout=30)
        assert r.status_code == 400, r.text

    def test_wrong_confirm_400(self, s, super_admin_h):
        r = s.post(f"{API}/admin/fresh-start", headers=super_admin_h, json={"confirm": "wrong"}, timeout=30)
        assert r.status_code == 400, r.text


# ---------- Refresh FAQs ----------
class TestRefreshFaqs:
    def test_sub_admin_forbidden(self, s, sub_admin_h):
        r = s.post(f"{API}/admin/refresh-faqs", headers=sub_admin_h, timeout=30)
        assert r.status_code == 403, r.text

    def test_super_admin_refresh_and_content(self, s, super_admin_h):
        r = s.post(f"{API}/admin/refresh-faqs", headers=super_admin_h, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("count") == 7

        r2 = s.get(f"{API}/site/faqs", timeout=30)
        assert r2.status_code == 200, r2.text
        faqs = r2.json()
        assert isinstance(faqs, list) and len(faqs) >= 7

        by_q = {f["question"]: f["answer"] for f in faqs}
        assert "What is the joining amount?" in by_q
        assert by_q["What is the joining amount?"].startswith("₹7,499"), \
            f"joining answer wrong: {by_q['What is the joining amount?'][:80]}"

        assert "How does the MLM plan work?" in by_q
        mlm_ans = by_q["How does the MLM plan work?"]
        assert "Level 1 — ₹1,200" in mlm_ans, "L1 line missing"
        assert "Total lifetime earning potential: ₹19,20,99,600" in mlm_ans, "total missing"


# ---------- Commission breakdown (user + admin) ----------
class TestCommissionBreakdown:
    def _validate_shape(self, data):
        assert set(["totals", "by_level", "recent"]).issubset(data.keys()), data.keys()
        totals = data["totals"]
        for k in ("credited", "held_entries", "transactions"):
            assert k in totals, f"totals missing {k}"
        assert isinstance(data["by_level"], list)
        for row in data["by_level"]:
            for k in ("level", "credited", "held_count", "count"):
                assert k in row, f"by_level row missing {k}: {row}"
        assert isinstance(data["recent"], list)

    def test_user_breakdown(self, s, user_h):
        r = s.get(f"{API}/mlm/commission-breakdown", headers=user_h, timeout=30)
        assert r.status_code == 200, r.text
        self._validate_shape(r.json())

    def test_user_breakdown_requires_auth(self, s):
        r = s.get(f"{API}/mlm/commission-breakdown", timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_admin_breakdown(self, s, super_admin_h, user_id):
        r = s.get(f"{API}/admin/users/{user_id}/commission-breakdown", headers=super_admin_h, timeout=30)
        assert r.status_code == 200, r.text
        self._validate_shape(r.json())

    def test_admin_breakdown_404(self, s, super_admin_h):
        r = s.get(f"{API}/admin/users/nonexistent-abc/commission-breakdown", headers=super_admin_h, timeout=30)
        assert r.status_code == 404, r.text


# ---------- Regression ----------
class TestRegression:
    def test_admin_dashboard(self, s, super_admin_h):
        r = s.get(f"{API}/admin/dashboard", headers=super_admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stats" in d and isinstance(d["stats"], dict)
        assert isinstance(d.get("recent_joins"), list)
        assert isinstance(d.get("daily_stats"), list)
        assert len(d["daily_stats"]) == 7

    def test_businesses_pending_order_id(self, s, user_h):
        r = s.get(f"{API}/mlm/businesses", headers=user_h, timeout=30)
        assert r.status_code == 200, r.text
        biz_list = r.json().get("businesses", [])
        for b in biz_list:
            assert "pending_order_id" in b

    def test_admin_search(self, s, super_admin_h):
        r = s.get(f"{API}/admin/search", headers=super_admin_h, params={"q": "admin"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # search must return SOMETHING structured
        assert isinstance(data, dict)

    def test_login_history(self, s, super_admin_h, user_id):
        r = s.get(f"{API}/admin/users/{user_id}/login-history", headers=super_admin_h, timeout=30)
        assert r.status_code == 200, r.text
        # Accept either list or dict wrapper
        j = r.json()
        assert isinstance(j, (list, dict))

    def test_activity(self, s, super_admin_h, user_id):
        r = s.get(f"{API}/admin/users/{user_id}/activity", headers=super_admin_h, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j, (list, dict))
