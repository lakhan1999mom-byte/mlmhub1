"""Iteration 13 backend tests — new auth flow (identifier-lookup / login-with-code /
accounts-by-phone) and order tracking timeline (tracking/steps, tracking_history,
admin PUT append-events, delivery notification)."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://hamper-mlm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"
USER_USERNAME = "test1_1785761123"
USER_PASSWORD = "NewPass@123"
MULTI_PHONE = "9876500099"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": USER_USERNAME, "password": USER_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- /auth/identifier-lookup ----------
class TestIdentifierLookup:
    def test_username_single(self):
        r = requests.post(f"{API}/auth/identifier-lookup", json={"identifier": USER_USERNAME})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("single") is True
        assert data.get("kind") == "username"
        assert data.get("user_code") == "EG000043"

    def test_phone_multiple(self):
        r = requests.post(f"{API}/auth/identifier-lookup", json={"identifier": MULTI_PHONE})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("multiple") is True
        assert d.get("count") == 2
        assert d.get("kind") == "phone"

    def test_email_single(self):
        r = requests.post(f"{API}/auth/identifier-lookup", json={"identifier": ADMIN_EMAIL})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("single") is True
        assert d.get("kind") == "email"

    def test_not_found(self):
        r = requests.post(f"{API}/auth/identifier-lookup", json={"identifier": "garbage_xyz_ITER13"})
        assert r.status_code == 404


# ---------- /auth/login-with-code ----------
class TestLoginWithCode:
    def test_correct_pw(self):
        r = requests.post(f"{API}/auth/login-with-code", json={"user_code": "EG000043", "password": USER_PASSWORD})
        assert r.status_code == 200, r.text
        assert "token" in r.json()

    def test_wrong_pw(self):
        r = requests.post(f"{API}/auth/login-with-code", json={"user_code": "EG000043", "password": "WrongPwITER13!"})
        assert r.status_code == 401


# ---------- /auth/accounts-by-phone ----------
class TestAccountsByPhone:
    def test_accounts_have_username_and_paid(self):
        r = requests.get(f"{API}/auth/accounts-by-phone", params={"phone": MULTI_PHONE})
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 2
        for a in arr:
            assert "username" in a
            assert "is_joining_paid" in a
            assert "user_code" in a


# ---------- /admin/tracking/steps ----------
class TestTrackingSteps:
    def test_steps(self, admin_token):
        r = requests.get(f"{API}/admin/tracking/steps", headers=h(admin_token))
        assert r.status_code == 200
        steps = r.json().get("steps")
        assert isinstance(steps, list)
        keys = [s["key"] for s in steps]
        assert keys == ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"]
        for s in steps:
            assert s["label"]


# ---------- Order create + payment verify tracking events ----------
@pytest.fixture(scope="module")
def created_order(user_token):
    # Fetch a product
    # Use the hamper joining kit — user (test1) is EG000043 which is unactivated → non-hamper orders are blocked
    prods = requests.get(f"{API}/products?is_hamper=true").json()
    assert prods and len(prods) > 0
    prod = prods[0]
    payload = {
        "items": [{"product_id": prod["id"], "quantity": 1}],
        "address": {
            "name": "ITER13 Test", "phone": "9999999999",
            "line1": "ITER13 Addr", "city": "Jaipur", "state": "RJ", "pincode": "302001",
        },
        "payment_method": "cashfree",
        "coupon_code": None,
    }
    r = requests.post(f"{API}/orders/create", headers=h(user_token), json=payload)
    assert r.status_code == 200, r.text
    order = r.json()["order"]
    # force mock mode regardless of cashfree activation
    return order


class TestOrderTracking:
    def test_create_has_placed_event(self, created_order):
        assert "tracking_history" in created_order
        assert len(created_order["tracking_history"]) == 1
        ev = created_order["tracking_history"][0]
        assert ev["status"] == "placed"
        assert ev["label"] == "Order Placed"
        assert "courier_name" in created_order
        assert "tracking_url" in created_order
        assert created_order["courier_name"] is None
        assert created_order["tracking_url"] is None

    def test_payment_verify_appends_confirmed(self, user_token, created_order, admin_token):
        # Force mock: patch order to payment_mock=true via admin? use verify endpoint. It auto-mocks if cashfree not active.
        r = requests.post(f"{API}/payments/cashfree/verify", headers=h(user_token), json={"order_id": created_order["id"]})
        assert r.status_code == 200, r.text
        assert r.json().get("paid") is True
        # Fetch order
        g = requests.get(f"{API}/orders/{created_order['id']}", headers=h(user_token))
        assert g.status_code == 200
        od = g.json()
        statuses = [e["status"] for e in od["tracking_history"]]
        assert "confirmed" in statuses
        confirmed = [e for e in od["tracking_history"] if e["status"] == "confirmed"][0]
        assert "Payment received" in confirmed["note"]

    def test_admin_update_packed(self, admin_token, user_token, created_order):
        r = requests.put(f"{API}/admin/orders/{created_order['id']}", headers=h(admin_token),
                         json={"status": "packed", "note": "Packed in warehouse ITER13"})
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/orders/{created_order['id']}", headers=h(user_token)).json()
        packed = [e for e in g["tracking_history"] if e["status"] == "packed"]
        assert len(packed) >= 1
        assert packed[-1]["note"] == "Packed in warehouse ITER13"
        assert packed[-1].get("by")
        assert packed[-1].get("label")

    def test_admin_update_shipped(self, admin_token, user_token, created_order):
        r = requests.put(f"{API}/admin/orders/{created_order['id']}", headers=h(admin_token),
                         json={"status": "shipped", "courier_name": "Delhivery",
                               "tracking_no": "AWB123ITER13", "tracking_url": "https://track.example.com/AWB123",
                               "note": "Handed to courier"})
        assert r.status_code == 200
        od = r.json()
        assert od["courier_name"] == "Delhivery"
        assert od["tracking_no"] == "AWB123ITER13"
        assert od["tracking_url"] == "https://track.example.com/AWB123"
        g = requests.get(f"{API}/orders/{created_order['id']}", headers=h(user_token)).json()
        shipped = [e for e in g["tracking_history"] if e["status"] == "shipped"]
        assert len(shipped) >= 1

    def test_admin_update_delivered_creates_notification(self, admin_token, user_token, created_order):
        r = requests.put(f"{API}/admin/orders/{created_order['id']}", headers=h(admin_token),
                         json={"status": "delivered", "note": "Delivered"})
        assert r.status_code == 200
        # Check notifications endpoint
        n = requests.get(f"{API}/notifications", headers=h(user_token))
        assert n.status_code == 200
        notifs = n.json() if isinstance(n.json(), list) else n.json().get("items", [])
        delivered_notifs = [x for x in notifs if x.get("event") == "order_delivered"]
        assert len(delivered_notifs) >= 1

    def test_get_order_full_history(self, user_token, created_order):
        g = requests.get(f"{API}/orders/{created_order['id']}", headers=h(user_token))
        assert g.status_code == 200
        od = g.json()
        statuses = [e["status"] for e in od["tracking_history"]]
        # Should have placed, confirmed, packed, shipped, delivered at minimum
        for expected in ["placed", "confirmed", "packed", "shipped", "delivered"]:
            assert expected in statuses, f"Missing {expected} in {statuses}"
