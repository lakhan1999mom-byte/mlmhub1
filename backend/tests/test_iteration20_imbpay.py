"""Iteration 20 — IMBPay v2 integration backend tests.

Verifies:
  * Cashfree endpoints and helper module fully removed.
  * Public /site/payment-provider announces imbpay, mock_mode=false.
  * Admin /admin/payment-config (admin-only) returns masked token ending in 73b7.
  * /payments/imbpay/initiate validation + real IMBPay upstream call (transaction
    limit error is expected — surfaced as HTTP 400 detail 'IMBPay: ...').
  * /payments/imbpay/verify validation + idempotent behaviour.
  * Regression: /api/orders/* and /api/mlm/businesses/{id}/pay-kit still work.
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"identifier": "admin@evergroemart.com", "password": "Admin@123"}
USER = {"identifier": "test1_1785761123", "password": "NewPass@123"}


# ----- fixtures -----
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(f"{API}/auth/login", json=USER, timeout=30)
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ============================================================
# 1. Public payment provider
# ============================================================
class TestPublicProvider:
    def test_site_payment_provider(self):
        r = requests.get(f"{API}/site/payment-provider", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("provider") == "imbpay"
        assert data.get("imbpay_active") is True
        assert data.get("mock_mode") is False


# ============================================================
# 2. Admin payment-config
# ============================================================
class TestAdminPaymentConfig:
    def test_admin_returns_masked_token(self, admin_token):
        r = requests.get(f"{API}/admin/payment-config", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("provider") == "imbpay"
        assert data.get("imbpay_active") is True
        masked = data.get("imbpay_token_masked", "")
        assert masked.endswith("73b7"), f"token mask should end in 73b7 — got {masked}"
        assert "*" in masked, "token must be masked"
        assert data.get("imbpay_base_url", "").startswith("https://api.imbpay.in")

    def test_unauthenticated_rejected(self):
        r = requests.get(f"{API}/admin/payment-config", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_non_admin_rejected(self, user_token):
        r = requests.get(f"{API}/admin/payment-config", headers=_auth(user_token), timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 for non-admin, got {r.status_code} {r.text}"


# ============================================================
# 3. Legacy cashfree endpoints must be gone
# ============================================================
class TestCashfreeRemoved:
    def test_initiate_gone(self, user_token):
        r = requests.post(
            f"{API}/payments/cashfree/initiate",
            headers=_auth(user_token),
            json={"order_id": "anything"},
            timeout=15,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_verify_gone(self, user_token):
        r = requests.post(
            f"{API}/payments/cashfree/verify",
            headers=_auth(user_token),
            json={"order_id": "anything"},
            timeout=15,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_cashfree_utils_file_deleted(self):
        assert not os.path.exists("/app/backend/cashfree_utils.py")


# ============================================================
# 4. Regression — orders/pay-kit path so we can feed initiate/verify
# ============================================================
@pytest.fixture(scope="module")
def pending_order_id(user_token):
    """Use pay-kit for primary business — reuses existing pending joining order."""
    # get profile → primary business id = user id
    r = requests.get(f"{API}/auth/me", headers=_auth(user_token), timeout=15)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    r2 = requests.post(f"{API}/mlm/businesses/{uid}/pay-kit", headers=_auth(user_token), timeout=30)
    assert r2.status_code == 200, f"pay-kit failed: {r2.status_code} {r2.text}"
    data = r2.json()
    assert data.get("order_id")
    return data["order_id"]


class TestRegressionOrders:
    def test_pay_kit_produced_order(self, pending_order_id, user_token):
        r = requests.get(f"{API}/orders/{pending_order_id}", headers=_auth(user_token), timeout=15)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["id"] == pending_order_id
        assert o.get("payment_status") != "paid"
        assert float(o.get("total", 0)) >= 1


# ============================================================
# 5. IMBPay initiate — validation + real upstream call
# ============================================================
class TestImbpayInitiate:
    def test_missing_order_id(self, user_token):
        r = requests.post(f"{API}/payments/imbpay/initiate", headers=_auth(user_token), json={}, timeout=15)
        assert r.status_code == 400, r.text
        assert "order_id" in (r.json().get("detail") or "").lower()

    def test_unknown_order_returns_404(self, user_token):
        r = requests.post(
            f"{API}/payments/imbpay/initiate",
            headers=_auth(user_token),
            json={"order_id": "does-not-exist-xyz-123"},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_unauthenticated_rejected(self, pending_order_id):
        r = requests.post(
            f"{API}/payments/imbpay/initiate",
            json={"order_id": pending_order_id},
            timeout=15,
        )
        assert r.status_code in (401, 403), r.status_code

    def test_real_imbpay_call(self, pending_order_id, user_token):
        """Real IMBPay upstream. Either payment_url (success) or 400 with 'IMBPay:'."""
        r = requests.post(
            f"{API}/payments/imbpay/initiate",
            headers=_auth(user_token),
            json={"order_id": pending_order_id},
            timeout=40,
        )
        # Success path
        if r.status_code == 200:
            data = r.json()
            assert data.get("provider") == "imbpay"
            assert data.get("order_id") == pending_order_id
            assert isinstance(data.get("payment_url"), str) and data["payment_url"].startswith("http")
            return
        # Expected: transaction-limit / merchant rejection — must be 400, NOT 5xx.
        assert r.status_code == 400, f"Expected 200 or 400 (not 5xx). got {r.status_code} {r.text}"
        detail = (r.json().get("detail") or "")
        assert "IMBPay" in detail, f"400 detail must contain 'IMBPay: ...'; got: {detail}"

    def test_paid_order_rejected(self, user_token):
        """If we have any already-paid order, initiate should 400. Best-effort."""
        r = requests.get(f"{API}/orders", headers=_auth(user_token), timeout=15)
        if r.status_code != 200:
            pytest.skip("orders list unavailable")
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        paid = next((o for o in orders if o.get("payment_status") == "paid"), None)
        if not paid:
            pytest.skip("no paid orders to test 'already paid' branch")
        r2 = requests.post(
            f"{API}/payments/imbpay/initiate",
            headers=_auth(user_token),
            json={"order_id": paid["id"]},
            timeout=15,
        )
        assert r2.status_code == 400
        assert "already paid" in (r2.json().get("detail") or "").lower()


# ============================================================
# 6. IMBPay verify
# ============================================================
class TestImbpayVerify:
    def test_unknown_order_404(self, user_token):
        r = requests.post(
            f"{API}/payments/imbpay/verify",
            headers=_auth(user_token),
            json={"order_id": "does-not-exist-xyz-123"},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_unauthenticated(self):
        r = requests.post(f"{API}/payments/imbpay/verify", json={"order_id": "x"}, timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_unpaid_order_returns_paid_false_or_400(self, pending_order_id, user_token):
        """Not paid — should return {paid:false,status:...} (200) OR 400 with IMBPay error.
        Must NOT be 5xx (Cloudflare will intercept)."""
        r = requests.post(
            f"{API}/payments/imbpay/verify",
            headers=_auth(user_token),
            json={"order_id": pending_order_id},
            timeout=40,
        )
        assert r.status_code < 500, f"5xx from verify is unacceptable — got {r.status_code} {r.text}"
        assert r.status_code in (200, 400), r.status_code
        if r.status_code == 200:
            data = r.json()
            assert data.get("paid") is False
            assert "status" in data
        else:
            assert "IMBPay" in (r.json().get("detail") or "")

    def test_idempotent_when_paid(self, user_token):
        """If a paid order exists, verify returns already_processed=True without calling upstream."""
        r = requests.get(f"{API}/orders", headers=_auth(user_token), timeout=15)
        if r.status_code != 200:
            pytest.skip("orders list unavailable")
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        paid = next((o for o in orders if o.get("payment_status") == "paid"), None)
        if not paid:
            pytest.skip("no paid order — idempotency branch untested")
        r2 = requests.post(
            f"{API}/payments/imbpay/verify",
            headers=_auth(user_token),
            json={"order_id": paid["id"]},
            timeout=15,
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("paid") is True
        assert data.get("already_processed") is True
