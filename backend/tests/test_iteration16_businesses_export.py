"""Iteration 16 backend tests: /mlm/businesses/* + /admin/export/* CSV."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for backend .env (external URL). Read frontend/.env directly.
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

USER_EMAIL = "test1_1785761123@ex.com"
USER_USERNAME = "test1_1785761123"
USER_PASSWORD = "NewPass@123"
ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"
ADMIN_REFERRAL = "ADMIN001"


def _login(identifier, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"identifier": identifier, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _login_username(username, password):
    return _login(username, password)


def _login_email(email, password):
    return _login(email, password)


@pytest.fixture(scope="session")
def user_token():
    return _login_username(USER_USERNAME, USER_PASSWORD)


@pytest.fixture(scope="session")
def admin_token():
    try:
        return _login_email(ADMIN_EMAIL, ADMIN_PASSWORD)
    except Exception:
        pytest.skip("Admin login failed")


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- LIST ----------
class TestListBusinesses:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/mlm/businesses", timeout=15)
        assert r.status_code in (401, 403)

    def test_list_returns_primary(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/mlm/businesses", headers=user_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "businesses" in data
        assert len(data["businesses"]) >= 1
        primary = next((b for b in data["businesses"] if b.get("is_primary")), None)
        assert primary is not None
        # Field contract
        for k in ["total_members", "active_members", "inactive_members", "today_joins",
                  "week_joins", "month_joins", "total_earnings", "is_active",
                  "business_code", "referral_code"]:
            assert k in primary, f"missing key {k} in primary business"


# ---------- CREATE / DELETE ----------
class TestCreateBusiness:
    def test_create_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/mlm/businesses/create",
                          json={"name": "X", "referral_code": ADMIN_REFERRAL}, timeout=15)
        assert r.status_code in (401, 403)

    def test_create_reject_own_referral(self, user_headers):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=user_headers, timeout=15).json()
        own_code = me.get("referral_code")
        assert own_code
        r = requests.post(f"{BASE_URL}/api/mlm/businesses/create",
                          headers=user_headers,
                          json={"name": "SelfSponsor", "referral_code": own_code}, timeout=15)
        assert r.status_code == 400
        assert "cannot sponsor your own" in r.json().get("detail", "").lower()

    def test_create_bogus_referral(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/mlm/businesses/create",
                          headers=user_headers,
                          json={"name": "Bogus", "referral_code": "NOSUCHREF"}, timeout=15)
        assert r.status_code == 400
        assert "invalid sponsor" in r.json().get("detail", "").lower()

    def test_create_success_and_get_and_delete(self, user_headers):
        payload = {"name": "TEST_Delhi Team", "referral_code": ADMIN_REFERRAL}
        r = requests.post(f"{BASE_URL}/api/mlm/businesses/create",
                          headers=user_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "business" in data and "order_id" in data and "order_code" in data and "amount" in data
        b = data["business"]
        assert b["referral_code"] and b["referral_code"] != ADMIN_REFERRAL
        assert b["is_active"] is False
        biz_id = b["id"]
        # Order created and business_id set
        order_id = data["order_id"]
        # Fetch business by id
        rg = requests.get(f"{BASE_URL}/api/mlm/businesses/{biz_id}", headers=user_headers, timeout=15)
        assert rg.status_code == 200
        assert rg.json()["id"] == biz_id
        # Network for this business — no members yet
        rn = requests.get(f"{BASE_URL}/api/mlm/businesses/{biz_id}/network",
                          headers=user_headers, timeout=15)
        assert rn.status_code == 200
        assert isinstance(rn.json().get("members"), list)
        # Delete (still pending)
        rd = requests.delete(f"{BASE_URL}/api/mlm/businesses/{biz_id}", headers=user_headers, timeout=15)
        assert rd.status_code == 200
        assert rd.json().get("ok") is True

    def test_delete_active_business_forbidden(self, user_headers):
        # Create + pay via mock cashfree verify → business becomes active → then attempt delete
        payload = {"name": "TEST_Active", "referral_code": ADMIN_REFERRAL}
        r = requests.post(f"{BASE_URL}/api/mlm/businesses/create",
                          headers=user_headers, json=payload, timeout=15)
        assert r.status_code == 200
        biz_id = r.json()["business"]["id"]
        order_id = r.json()["order_id"]
        # Cashfree mock create + verify
        c = requests.post(f"{BASE_URL}/api/payments/cashfree/initiate",
                          headers=user_headers, json={"order_id": order_id}, timeout=20)
        assert c.status_code == 200, c.text
        v = requests.post(f"{BASE_URL}/api/payments/cashfree/verify",
                          headers=user_headers, json={"order_id": order_id}, timeout=20)
        assert v.status_code == 200, v.text
        assert v.json().get("paid") is True
        # Business should be active + notification created
        rg = requests.get(f"{BASE_URL}/api/mlm/businesses/{biz_id}", headers=user_headers, timeout=15)
        assert rg.status_code == 200
        gb = rg.json()
        assert gb.get("is_active") is True
        assert gb.get("is_joining_paid") is True
        assert gb.get("activated_at")
        # Delete should now fail
        rd = requests.delete(f"{BASE_URL}/api/mlm/businesses/{biz_id}", headers=user_headers, timeout=15)
        assert rd.status_code == 400
        assert "active" in rd.json().get("detail", "").lower()


# ---------- ADMIN CSV EXPORTS ----------
class TestAdminExports:
    def test_users_csv(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/export/users", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and cd.endswith('.csv"')
        first_line = r.text.splitlines()[0]
        for col in ["user_code", "name", "username", "email", "phone", "sponsor_id",
                    "referral_code", "is_joining_paid_str", "current_stage",
                    "direct_referrals_count", "team_size", "total_earnings",
                    "wallet_balance", "role", "created_at"]:
            assert col in first_line, f"users csv missing col: {col}"

    def test_orders_csv(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/export/orders", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        first_line = r.text.splitlines()[0]
        for col in ["order_code", "user_id", "total", "payment_status", "status", "created_at"]:
            assert col in first_line

    def test_withdrawals_csv(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/export/withdrawals", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        first_line = r.text.splitlines()[0]
        for col in ["id", "user_id", "amount", "status", "requested_at"]:
            assert col in first_line

    def test_exports_require_admin(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/export/users", headers=user_headers, timeout=15)
        assert r.status_code in (401, 403)


# ---------- CLEANUP ----------
class TestCleanup:
    def test_cleanup_pending_test_businesses(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/mlm/businesses", headers=user_headers, timeout=15)
        for b in r.json().get("businesses", []):
            if not b.get("is_primary") and b.get("name", "").startswith("TEST_") and not b.get("is_joining_paid"):
                requests.delete(f"{BASE_URL}/api/mlm/businesses/{b['id']}", headers=user_headers, timeout=15)
