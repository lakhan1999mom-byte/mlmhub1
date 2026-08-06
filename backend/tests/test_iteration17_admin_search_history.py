"""
Iteration 17 backend tests:
- P0: /api/admin/dashboard (stats bag + daily_stats + recent_joins)
- P0: /api/mlm/businesses (pending_order_id field)
- New: POST /api/mlm/businesses/{business_id}/pay-kit (primary + additional; reuses order)
- New: /api/admin/search (global) with various terms
- New: /api/admin/users/{user_id} detail + counters
- New: /api/admin/users/{user_id}/login-history (device parsing, X-Forwarded-For)
- New: /api/admin/users/{user_id}/activity
- /api/admin/users?q= expanded search (by referral_code)
- Regression: audit-logs, exports, login records ip+user_agent
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://hamper-mlm-hub.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"
USER_UNAME = "test1_1785761123"
USER_PASSWORD = "NewPass@123"

CHROME_MAC_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(
        f"{API}/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        headers={"X-Forwarded-For": "203.0.113.9", "User-Agent": CHROME_MAC_UA},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def user_login_response(s):
    r = s.post(
        f"{API}/auth/login",
        json={"identifier": USER_UNAME, "password": USER_PASSWORD},
        headers={"X-Forwarded-For": "198.51.100.42", "User-Agent": CHROME_MAC_UA},
        timeout=30,
    )
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def user_token(user_login_response):
    return user_login_response.get("token") or user_login_response.get("access_token")


@pytest.fixture(scope="module")
def user_id(user_login_response):
    u = user_login_response.get("user") or {}
    return u.get("id")


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def user_h(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# ---------- P0: dashboard ----------
class TestAdminDashboard:
    def test_dashboard_shape(self, s, admin_h):
        r = s.get(f"{API}/admin/dashboard", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Flat + nested stats
        for k in ("total_users", "active_users", "total_orders", "total_revenue",
                  "new_users_today", "new_users_week", "referral_businesses", "kit_sales"):
            assert k in d, f"missing flat field {k}"
        assert "stats" in d and isinstance(d["stats"], dict)
        for k in ("total_users", "active_users", "total_orders", "total_revenue",
                  "new_users_today", "new_users_week", "referral_businesses", "kit_sales"):
            assert k in d["stats"], f"missing nested stats.{k}"
        # Types
        assert isinstance(d["stats"]["total_users"], int)
        assert isinstance(d["stats"]["total_revenue"], (int, float))
        # daily_stats
        assert isinstance(d.get("daily_stats"), list)
        assert len(d["daily_stats"]) == 7
        for row in d["daily_stats"]:
            for k in ("day", "date", "users", "revenue", "orders"):
                assert k in row, f"daily_stats row missing {k}"
        # recent_joins
        assert isinstance(d.get("recent_joins"), list)
        assert len(d["recent_joins"]) > 0, "recent_joins is empty"
        assert len(d["recent_joins"]) <= 8
        rj = d["recent_joins"][0]
        for k in ("name", "user_code", "phone", "email", "is_joining_paid", "created_at"):
            assert k in rj, f"recent_joins missing {k}"
        # Non-zero user count (seed data)
        assert d["stats"]["total_users"] > 0


# ---------- P0: pay-kit + businesses pending_order_id ----------
class TestPayKitAndBusinesses:
    def test_businesses_have_pending_order_id_field(self, s, user_h):
        r = s.get(f"{API}/mlm/businesses", headers=user_h, timeout=30)
        assert r.status_code == 200, r.text
        biz_list = r.json().get("businesses", [])
        assert len(biz_list) >= 1
        for b in biz_list:
            assert "pending_order_id" in b
            if b.get("is_active"):
                assert b["pending_order_id"] is None, f"active business has pending_order_id: {b}"

    def test_pay_kit_primary_creates_then_reuses(self, s, user_h, user_id):
        # Primary
        r1 = s.post(f"{API}/mlm/businesses/{user_id}/pay-kit", headers=user_h, timeout=30)
        # If already active, will 400. Test user should be pending primary per credentials.
        if r1.status_code == 400:
            pytest.skip(f"Primary already active: {r1.text}")
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        for k in ("order_id", "order_code", "amount", "reused"):
            assert k in d1
        assert d1["reused"] in (True, False)
        oid1 = d1["order_id"]

        r2 = s.post(f"{API}/mlm/businesses/{user_id}/pay-kit", headers=user_h, timeout=30)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["order_id"] == oid1
        assert d2["reused"] is True

    def test_pay_kit_additional_business(self, s, user_h):
        r = s.get(f"{API}/mlm/businesses", headers=user_h, timeout=30)
        assert r.status_code == 200
        biz = r.json().get("businesses", [])
        pending_additional = [b for b in biz if not b.get("is_primary") and not b.get("is_active")]
        active_additional = [b for b in biz if not b.get("is_primary") and b.get("is_active")]
        if not pending_additional and not active_additional:
            pytest.skip("No additional businesses for user")
        if pending_additional:
            bid = pending_additional[0]["id"]
            r1 = s.post(f"{API}/mlm/businesses/{bid}/pay-kit", headers=user_h, timeout=30)
            assert r1.status_code == 200, r1.text
            d1 = r1.json()
            assert "order_id" in d1
            # After first call — subsequent call must reuse
            r2 = s.post(f"{API}/mlm/businesses/{bid}/pay-kit", headers=user_h, timeout=30)
            assert r2.status_code == 200, r2.text
            assert r2.json()["order_id"] == d1["order_id"]
            assert r2.json()["reused"] is True
            # And that business now has pending_order_id populated
            r3 = s.get(f"{API}/mlm/businesses", headers=user_h, timeout=30)
            entry = next(b for b in r3.json()["businesses"] if b["id"] == bid)
            assert entry["pending_order_id"] == d1["order_id"]
        if active_additional:
            bid = active_additional[0]["id"]
            r = s.post(f"{API}/mlm/businesses/{bid}/pay-kit", headers=user_h, timeout=30)
            assert r.status_code == 400, f"expected 400 for active biz, got {r.status_code}: {r.text}"


# ---------- Global admin search ----------
class TestAdminGlobalSearch:
    def test_search_shape_and_users_match(self, s, admin_h):
        r = s.get(f"{API}/admin/search", params={"q": "test", "limit": 8}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("users", "businesses", "orders", "total"):
            assert k in d
        assert isinstance(d["users"], list)
        assert len(d["users"]) >= 1, "expected at least one user for q='test'"

    def test_search_by_user_code(self, s, admin_h):
        r = s.get(f"{API}/admin/search", params={"q": "EG000043"}, headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        codes = [u.get("user_code") for u in d["users"]]
        assert "EG000043" in codes

    def test_search_by_admin_referral_code(self, s, admin_h):
        r = s.get(f"{API}/admin/search", params={"q": "ADMIN001"}, headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        refs = [u.get("referral_code") for u in d["users"]]
        assert "ADMIN001" in refs

    def test_search_empty_q(self, s, admin_h):
        r = s.get(f"{API}/admin/search", params={"q": ""}, headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 0


# ---------- Admin user detail ----------
class TestAdminUserDetail:
    def test_user_detail(self, s, admin_h, user_id):
        r = s.get(f"{API}/admin/users/{user_id}", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "user" in d and d["user"].get("id") == user_id
        assert "referral_businesses" in d and isinstance(d["referral_businesses"], list)
        assert "counters" in d
        for k in ("orders_total", "orders_paid", "withdrawals_total", "direct_referrals", "additional_businesses"):
            assert k in d["counters"], f"counter missing {k}"

    def test_user_detail_404(self, s, admin_h):
        r = s.get(f"{API}/admin/users/does-not-exist-xyz", headers=admin_h, timeout=30)
        assert r.status_code == 404


# ---------- Login history + activity ----------
class TestAdminLoginHistoryActivity:
    def test_login_history_populated_with_ip_and_device(self, s, admin_h, user_id, user_login_response):
        # Trigger a fresh login with X-Forwarded-For + Chrome/macOS UA
        r_login = requests.post(
            f"{API}/auth/login",
            json={"identifier": USER_UNAME, "password": USER_PASSWORD},
            headers={"X-Forwarded-For": "198.51.100.77", "User-Agent": CHROME_MAC_UA},
            timeout=30,
        )
        assert r_login.status_code == 200

        r = s.get(f"{API}/admin/users/{user_id}/login-history",
                  params={"limit": 50}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d
        items = d["items"]
        assert len(items) >= 1
        top = items[0]
        for k in ("at", "ip", "user_agent", "device", "method"):
            assert k in top, f"login history item missing {k}"
        assert top["ip"] is not None, "IP should be populated on new login"
        dev = top["device"]
        assert dev.get("os") == "macOS", f"expected macOS OS parsing, got {dev}"
        assert dev.get("browser") == "Chrome", f"expected Chrome browser parsing, got {dev}"
        assert dev.get("kind") == "Desktop"

    def test_activity_log(self, s, admin_h, user_id):
        r = s.get(f"{API}/admin/users/{user_id}/activity",
                  params={"limit": 100}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        assert len(d["items"]) >= 1
        # DESC order
        created_ats = [i.get("created_at") for i in d["items"] if i.get("created_at")]
        assert created_ats == sorted(created_ats, reverse=True)
        # actor_id must match
        for it in d["items"]:
            assert it.get("actor_id") == user_id


# ---------- Admin users q search expanded ----------
class TestAdminUsersSearch:
    def test_search_by_referral_code_returns_owner(self, s, admin_h):
        r = s.get(f"{API}/admin/users", params={"q": "ADMIN001"}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("total", 0) >= 1
        assert any(u.get("referral_code") == "ADMIN001" for u in d.get("items", []))

    def test_search_by_user_code(self, s, admin_h):
        r = s.get(f"{API}/admin/users", params={"q": "EG000043"}, headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert any(u.get("user_code") == "EG000043" for u in d.get("items", []))


# ---------- Regression ----------
class TestRegression:
    def test_audit_logs_endpoint(self, s, admin_h):
        r = s.get(f"{API}/admin/audit-logs", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Accept either {items:[...]} or a list
        items = d.get("items") if isinstance(d, dict) else d
        assert isinstance(items, list)

    @pytest.mark.parametrize("kind", ["users", "orders", "withdrawals"])
    def test_admin_exports_csv(self, s, admin_h, kind):
        r = s.get(f"{API}/admin/export/{kind}", headers=admin_h, timeout=60)
        assert r.status_code == 200, f"{kind}: {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "csv" in ct or "text" in ct, f"unexpected content-type for {kind}: {ct}"
        # First line is header
        assert len(r.text.splitlines()) >= 1

    def test_login_records_ip_and_ua_in_audit_logs(self, s, admin_h, user_id):
        # Do a login with unique IP and inspect login-history for that IP
        marker_ip = "192.0.2.123"
        r = requests.post(
            f"{API}/auth/login",
            json={"identifier": USER_UNAME, "password": USER_PASSWORD},
            headers={"X-Forwarded-For": marker_ip, "User-Agent": CHROME_MAC_UA},
            timeout=30,
        )
        assert r.status_code == 200
        r2 = s.get(f"{API}/admin/users/{user_id}/login-history",
                   headers=admin_h, timeout=30)
        assert r2.status_code == 200
        items = r2.json().get("items", [])
        ips = [i.get("ip") for i in items[:5]]
        uas = [i.get("user_agent") for i in items[:5]]
        assert marker_ip in ips, f"expected IP {marker_ip} in recent login history, got {ips}"
        assert any(ua == CHROME_MAC_UA for ua in uas)
