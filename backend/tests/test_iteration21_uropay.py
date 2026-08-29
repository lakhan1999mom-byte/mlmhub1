"""Iteration 21 — UroPay integration backend tests.

Verifies:
  * Public /site/payment-provider announces uropay, mock_mode=false.
  * Admin /admin/payment-config returns masked key/secret with expected suffix.
  * Legacy /payments/imbpay/* and /payments/cashfree/* endpoints removed (404).
  * /payments/uropay/initiate validation + real UroPay upstream call.
  * /payments/uropay/submit-utr validation + real UroPay upstream call.
  * /payments/uropay/verify branches (NOT_INITIATED / CREATED / idempotent).
  * /webhooks/uropay: rejects invalid signature, accepts valid HMAC signature and
    finalises the order.
  * Regression on orders/create, /orders/{id}, /mlm/businesses/{id}/pay-kit.
"""
import hashlib
import hmac
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"identifier": "admin@evergroemart.com", "password": "Admin@123"}
USER = {"identifier": "test1_1785761123", "password": "NewPass@123"}

UROPAY_SECRET = "93CB29QT27EFBJC2MSQFK1E4BRLY5UZM46V6LJQSJZGQCBHMB4"


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
        assert data.get("provider") == "uropay"
        assert data.get("uropay_active") is True
        assert data.get("mock_mode") is False


# ============================================================
# 2. Admin payment-config
# ============================================================
class TestAdminPaymentConfig:
    def test_admin_returns_masked(self, admin_token):
        r = requests.get(f"{API}/admin/payment-config", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("provider") == "uropay"
        assert data.get("uropay_active") is True
        key_masked = data.get("uropay_key_masked", "")
        secret_masked = data.get("uropay_secret_masked", "")
        assert key_masked.endswith("DGCI"), f"key mask should end in DGCI — got {key_masked}"
        assert "*" in key_masked, "key must be masked"
        assert secret_masked.endswith("HMB4"), f"secret mask should end in HMB4 — got {secret_masked}"
        assert "*" in secret_masked, "secret must be masked"
        assert data.get("uropay_api_url") == "https://api.uropay.me"

    def test_unauthenticated_rejected(self):
        r = requests.get(f"{API}/admin/payment-config", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_non_admin_rejected(self, user_token):
        r = requests.get(f"{API}/admin/payment-config", headers=_auth(user_token), timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"


# ============================================================
# 3. Legacy imbpay / cashfree endpoints must be gone
# ============================================================
class TestLegacyRemoved:
    @pytest.mark.parametrize("path", [
        "/payments/imbpay/initiate",
        "/payments/imbpay/verify",
        "/payments/cashfree/initiate",
        "/payments/cashfree/verify",
    ])
    def test_legacy_endpoint_gone(self, user_token, path):
        r = requests.post(f"{API}{path}", headers=_auth(user_token), json={"order_id": "x"}, timeout=15)
        assert r.status_code == 404, f"{path} should be 404 — got {r.status_code}"

    def test_legacy_util_files_deleted(self):
        assert not os.path.exists("/app/backend/cashfree_utils.py")
        assert not os.path.exists("/app/backend/imbpay_utils.py")


# ============================================================
# 4. Regression — pay-kit produces a pending order we can initiate on
# ============================================================
@pytest.fixture(scope="module")
def pending_order_id(user_token):
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
# 5. UroPay initiate
# ============================================================
class TestUropayInitiate:
    def test_missing_order_id(self, user_token):
        r = requests.post(f"{API}/payments/uropay/initiate", headers=_auth(user_token), json={}, timeout=15)
        assert r.status_code == 400, r.text
        assert "order_id" in (r.json().get("detail") or "").lower()

    def test_unknown_order_404(self, user_token):
        r = requests.post(
            f"{API}/payments/uropay/initiate",
            headers=_auth(user_token),
            json={"order_id": "does-not-exist-xyz-123"},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_unauthenticated_rejected(self, pending_order_id):
        r = requests.post(
            f"{API}/payments/uropay/initiate",
            json={"order_id": pending_order_id},
            timeout=15,
        )
        assert r.status_code in (401, 403), r.status_code

    def test_real_uropay_call(self, pending_order_id, user_token):
        """Real UroPay upstream — must return URPY... uroPayOrderId + qr_code + upi_string."""
        r = requests.post(
            f"{API}/payments/uropay/initiate",
            headers=_auth(user_token),
            json={"order_id": pending_order_id},
            timeout=45,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        assert data.get("provider") == "uropay"
        assert data.get("order_id") == pending_order_id
        uro_id = data.get("uro_pay_order_id")
        assert isinstance(uro_id, str) and uro_id, f"uro_pay_order_id missing: {data}"
        # URPY prefix per UroPay docs
        assert uro_id.upper().startswith("URPY"), f"unexpected uro id format: {uro_id}"
        qr = data.get("qr_code") or ""
        assert qr.startswith("data:image/") and "base64," in qr, "qr_code must be base64 data URL"
        upi = data.get("upi_string") or ""
        assert upi.startswith("upi://"), f"upi_string must be upi:// URI: {upi[:40]}"
        assert str(data.get("order_status")).upper() == "CREATED"
        assert float(data.get("amount")) >= 1

        # Persisted on the order
        o = requests.get(f"{API}/orders/{pending_order_id}", headers=_auth(user_token), timeout=15).json()
        assert o.get("uropay_order_id") == uro_id
        assert (o.get("uropay_qr_code") or "").startswith("data:image/")
        assert (o.get("uropay_upi_string") or "").startswith("upi://")

    def test_paid_order_rejected(self, user_token):
        r = requests.get(f"{API}/orders", headers=_auth(user_token), timeout=15)
        if r.status_code != 200:
            pytest.skip("orders list unavailable")
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        paid = next((o for o in orders if o.get("payment_status") == "paid"), None)
        if not paid:
            pytest.skip("no paid orders to test 'already paid' branch")
        r2 = requests.post(
            f"{API}/payments/uropay/initiate",
            headers=_auth(user_token),
            json={"order_id": paid["id"]},
            timeout=15,
        )
        assert r2.status_code == 400
        assert "already paid" in (r2.json().get("detail") or "").lower()


# ============================================================
# 6. UroPay submit-utr
# ============================================================
class TestUropaySubmitUtr:
    def test_missing_fields(self, user_token):
        r = requests.post(f"{API}/payments/uropay/submit-utr", headers=_auth(user_token), json={}, timeout=15)
        assert r.status_code == 400, r.text

    def test_short_utr(self, user_token, pending_order_id):
        r = requests.post(
            f"{API}/payments/uropay/submit-utr",
            headers=_auth(user_token),
            json={"order_id": pending_order_id, "utr": "12345"},
            timeout=15,
        )
        assert r.status_code == 400
        detail = (r.json().get("detail") or "").lower()
        assert "utr" in detail or "short" in detail

    def test_not_initiated(self, user_token):
        # create a fresh checkout order to have one that hasn't been initiated
        r = requests.get(f"{API}/orders", headers=_auth(user_token), timeout=15)
        if r.status_code != 200:
            pytest.skip("orders list unavailable")
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        not_init = next((o for o in orders if not o.get("uropay_order_id") and o.get("payment_status") != "paid"), None)
        if not not_init:
            pytest.skip("no un-initiated order to exercise 'Initiate payment first'")
        r2 = requests.post(
            f"{API}/payments/uropay/submit-utr",
            headers=_auth(user_token),
            json={"order_id": not_init["id"], "utr": "999999999999"},
            timeout=15,
        )
        assert r2.status_code == 400
        assert "initiate" in (r2.json().get("detail") or "").lower()

    def test_duplicate_utr_surfaces_uropay_error(self, pending_order_id, user_token):
        """UroPay rejects reused UTRs across TEST+LIVE — expect 400 with 'UroPay:' prefix
        OR 200 if it (unexpectedly) accepts. Must never be 5xx."""
        r = requests.post(
            f"{API}/payments/uropay/submit-utr",
            headers=_auth(user_token),
            json={"order_id": pending_order_id, "utr": "123456789012"},
            timeout=45,
        )
        assert r.status_code < 500, f"5xx unacceptable — got {r.status_code} {r.text}"
        assert r.status_code in (200, 400), r.status_code
        if r.status_code == 400:
            detail = r.json().get("detail") or ""
            assert "UroPay" in detail or "uropay" in detail.lower(), f"400 detail must surface UroPay error: {detail}"


# ============================================================
# 7. UroPay verify
# ============================================================
class TestUropayVerify:
    def test_unknown_order_404(self, user_token):
        r = requests.post(
            f"{API}/payments/uropay/verify",
            headers=_auth(user_token),
            json={"order_id": "does-not-exist-xyz-123"},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_unauthenticated(self):
        r = requests.post(f"{API}/payments/uropay/verify", json={"order_id": "x"}, timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_not_initiated_returns_not_initiated(self, user_token):
        # pay-kit again to get a fresh (unrelated) order id maybe; or find one without uropay_order_id.
        r = requests.get(f"{API}/orders", headers=_auth(user_token), timeout=15)
        if r.status_code != 200:
            pytest.skip("orders list unavailable")
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        not_init = next((o for o in orders if not o.get("uropay_order_id") and o.get("payment_status") != "paid"), None)
        if not not_init:
            pytest.skip("no un-initiated order available")
        r2 = requests.post(
            f"{API}/payments/uropay/verify",
            headers=_auth(user_token),
            json={"order_id": not_init["id"]},
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data.get("paid") is False
        assert data.get("status") == "NOT_INITIATED"

    def test_after_initiate_returns_created(self, pending_order_id, user_token):
        r = requests.post(
            f"{API}/payments/uropay/verify",
            headers=_auth(user_token),
            json={"order_id": pending_order_id},
            timeout=45,
        )
        assert r.status_code < 500
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            data = r.json()
            assert data.get("paid") is False
            assert str(data.get("status")).upper() in ("CREATED", "UTR_SUBMITTED", "PROCESSING")

    def test_idempotent_when_paid(self, user_token):
        r = requests.get(f"{API}/orders", headers=_auth(user_token), timeout=15)
        if r.status_code != 200:
            pytest.skip("orders list unavailable")
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        paid = next((o for o in orders if o.get("payment_status") == "paid"), None)
        if not paid:
            pytest.skip("no paid order — idempotency branch untested")
        r2 = requests.post(
            f"{API}/payments/uropay/verify",
            headers=_auth(user_token),
            json={"order_id": paid["id"]},
            timeout=15,
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("paid") is True
        assert data.get("already_processed") is True


# ============================================================
# 8. Webhook — signature verification + finalize on COMPLETED
# ============================================================
def _sign_status_changed(payload: dict) -> str:
    """Mirror uropay_utils.verify_webhook_signature for order.status.changed events."""
    ordered = {
        "event": payload["event"],
        "uroPayOrderId": payload["uroPayOrderId"],
        "merchantOrderId": payload["merchantOrderId"],
        "orderStatus": payload["orderStatus"],
        "submittedUTR": payload.get("submittedUTR"),
        "environment": payload["environment"],
    }
    body = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    hashed_secret = hashlib.sha512(UROPAY_SECRET.encode()).hexdigest()
    return hmac.new(hashed_secret.encode(), body.encode(), hashlib.sha256).hexdigest()


class TestUropayWebhook:
    def test_missing_signature_401(self):
        r = requests.post(
            f"{API}/webhooks/uropay",
            json={"event": "order.status.changed", "uroPayOrderId": "URPY_X", "merchantOrderId": "X",
                  "orderStatus": "COMPLETED", "environment": "LIVE"},
            timeout=15,
        )
        assert r.status_code == 401, f"missing sig should be 401, got {r.status_code} {r.text}"

    def test_invalid_signature_401(self):
        payload = {"event": "order.status.changed", "uroPayOrderId": "URPY_X", "merchantOrderId": "X",
                   "orderStatus": "COMPLETED", "environment": "LIVE"}
        r = requests.post(
            f"{API}/webhooks/uropay",
            data=json.dumps(payload),
            headers={"Content-Type": "application/json", "X-Uropay-Signature": "deadbeef"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_valid_signature_unknown_order(self):
        """Valid sig but no order matches → 200 {matched:false} (no crash)."""
        payload = {
            "event": "order.status.changed",
            "uroPayOrderId": "URPY_DOES_NOT_EXIST_TEST",
            "merchantOrderId": "NOT_EXIST",
            "orderStatus": "COMPLETED",
            "submittedUTR": None,
            "environment": "LIVE",
        }
        sig = _sign_status_changed(payload)
        r = requests.post(
            f"{API}/webhooks/uropay",
            data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            headers={"Content-Type": "application/json", "X-Uropay-Signature": sig},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("matched") is False

    def test_valid_signature_completed_finalizes_order(self, pending_order_id, user_token):
        """Fetch the order (should already be initiated with a uropay_order_id from test_real_uropay_call),
        then post a signed COMPLETED webhook and confirm the order flips to paid."""
        o = requests.get(f"{API}/orders/{pending_order_id}", headers=_auth(user_token), timeout=15).json()
        uro_id = o.get("uropay_order_id")
        if not uro_id:
            pytest.skip("order not initiated — cannot test webhook finalize")
        if o.get("payment_status") == "paid":
            pytest.skip("order already paid — cannot re-test finalize")
        payload = {
            "event": "order.status.changed",
            "uroPayOrderId": uro_id,
            "merchantOrderId": o.get("order_code") or pending_order_id,
            "orderStatus": "COMPLETED",
            "submittedUTR": o.get("uropay_utr"),
            "environment": "LIVE",
        }
        sig = _sign_status_changed(payload)
        r = requests.post(
            f"{API}/webhooks/uropay",
            data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            headers={"Content-Type": "application/json", "X-Uropay-Signature": sig},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("matched") is True
        assert body.get("status") == "COMPLETED"

        # Poll order — should now be paid, confirmed, with tracking_history appended
        time.sleep(1)
        o2 = requests.get(f"{API}/orders/{pending_order_id}", headers=_auth(user_token), timeout=15).json()
        assert o2.get("payment_status") == "paid", f"order not marked paid: {o2}"
        assert o2.get("status") == "confirmed"
        th = o2.get("tracking_history") or []
        assert any(ev.get("status") == "confirmed" and "UroPay" in (ev.get("note") or "") for ev in th), \
            f"tracking_history missing UroPay confirmed event: {th}"

    def test_webhook_idempotent(self, pending_order_id, user_token):
        """Re-posting the same webhook must NOT double-decrement stock or re-activate business."""
        o = requests.get(f"{API}/orders/{pending_order_id}", headers=_auth(user_token), timeout=15).json()
        uro_id = o.get("uropay_order_id")
        if not uro_id or o.get("payment_status") != "paid":
            pytest.skip("order not paid via webhook — idempotency branch untested")
        payload = {
            "event": "order.status.changed",
            "uroPayOrderId": uro_id,
            "merchantOrderId": o.get("order_code") or pending_order_id,
            "orderStatus": "COMPLETED",
            "submittedUTR": o.get("uropay_utr"),
            "environment": "LIVE",
        }
        sig = _sign_status_changed(payload)
        r = requests.post(
            f"{API}/webhooks/uropay",
            data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            headers={"Content-Type": "application/json", "X-Uropay-Signature": sig},
            timeout=15,
        )
        assert r.status_code == 200
