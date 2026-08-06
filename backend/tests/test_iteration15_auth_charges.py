"""Iteration 15 backend tests:
- Registration uniqueness (phone/email/username, validation)
- Admin GET/PUT /admin/settings/site with gst_enabled, delivery_charge_enabled, extra_charges
- /site/delivery-config reflects admin toggles
- /orders/create computes extras/gst correctly and persists extras + extras_total
"""
import os
import time
import random
import string
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://hamper-mlm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASS = "Admin@123"


def _rand(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ==================== REGISTRATION ====================

class TestRegisterUniqueness:
    def _payload(self, **over):
        suffix = _rand(6)
        p = {
            "name": f"TEST User {suffix}",
            "email": f"test_{suffix}@ex.com",
            "phone": f"98{random.randint(10000000, 99999999)}",
            "password": "Pass@1234",
            "username": f"test_{suffix}",
            "terms_accepted": True,
        }
        p.update(over)
        return p

    def test_register_new_user_success(self):
        p = self._payload()
        r = requests.post(f"{API}/auth/register", json=p)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["phone"] == p["phone"]
        assert data["user"]["email"] == p["email"]

    def test_duplicate_phone_returns_409(self):
        p = self._payload()
        r1 = requests.post(f"{API}/auth/register", json=p)
        assert r1.status_code == 200, r1.text
        # Reuse the phone with new email/username
        p2 = self._payload(phone=p["phone"])
        r2 = requests.post(f"{API}/auth/register", json=p2)
        assert r2.status_code == 409, r2.text
        assert "mobile is already registered" in r2.json()["detail"].lower()

    def test_duplicate_username_returns_409(self):
        p = self._payload()
        r1 = requests.post(f"{API}/auth/register", json=p)
        assert r1.status_code == 200
        p2 = self._payload(username=p["username"])
        r2 = requests.post(f"{API}/auth/register", json=p2)
        assert r2.status_code == 409
        assert "username" in r2.json()["detail"].lower()

    def test_duplicate_email_returns_409(self):
        p = self._payload()
        r1 = requests.post(f"{API}/auth/register", json=p)
        assert r1.status_code == 200
        p2 = self._payload(email=p["email"])
        r2 = requests.post(f"{API}/auth/register", json=p2)
        assert r2.status_code == 409
        assert "email is already registered" in r2.json()["detail"].lower()

    def test_short_phone_returns_400(self):
        p = self._payload(phone="12345")
        r = requests.post(f"{API}/auth/register", json=p)
        assert r.status_code == 400
        assert "valid mobile" in r.json()["detail"].lower()

    def test_admin_phone_9999999999_conflict(self):
        # Admin uses phone 9999999999 — must be rejected
        p = self._payload(phone="9999999999")
        r = requests.post(f"{API}/auth/register", json=p)
        assert r.status_code == 409
        assert "mobile is already registered" in r.json()["detail"].lower()


# ==================== ADMIN SETTINGS: SITE ====================

class TestAdminSiteSettings:
    def test_get_site_settings_has_new_fields(self, admin_headers):
        r = requests.get(f"{API}/admin/settings/site", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # New fields must exist
        assert "gst_enabled" in data
        assert isinstance(data["gst_enabled"], bool)
        assert "delivery_charge_enabled" in data
        assert isinstance(data["delivery_charge_enabled"], bool)
        assert "extra_charges" in data
        assert isinstance(data["extra_charges"], list)

    def test_put_site_settings_persists(self, admin_headers):
        payload = {
            "gst_enabled": False,
            "delivery_charge_enabled": True,
            "delivery_charge": 49,
            "free_shipping_threshold": 999,
            "gst_percent": 5,
            "extra_charges": [
                {"key": "packing", "label": "Packing Fee", "type": "flat", "value": 25, "enabled": True},
                {"key": "handling", "label": "Handling %", "type": "percent", "value": 2, "enabled": True},
                {"key": "donation", "label": "Donation", "type": "flat", "value": 10, "enabled": False},
            ],
        }
        r = requests.put(f"{API}/admin/settings/site", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text

        # Verify GET reflects it
        g = requests.get(f"{API}/admin/settings/site", headers=admin_headers)
        assert g.status_code == 200
        d = g.json()
        assert d["gst_enabled"] is False
        assert d["delivery_charge_enabled"] is True
        assert len(d["extra_charges"]) == 3
        keys = {c["key"] for c in d["extra_charges"]}
        assert keys == {"packing", "handling", "donation"}


# ==================== PUBLIC DELIVERY CONFIG ====================

class TestDeliveryConfigPublic:
    def test_delivery_config_reflects_admin(self, admin_headers):
        # Ensure admin state as set in prior test
        payload = {
            "gst_enabled": False,
            "delivery_charge_enabled": True,
            "delivery_charge": 49,
            "free_shipping_threshold": 999,
            "gst_percent": 5,
            "extra_charges": [
                {"key": "packing", "label": "Packing Fee", "type": "flat", "value": 25, "enabled": True},
                {"key": "handling", "label": "Handling %", "type": "percent", "value": 2, "enabled": True},
                {"key": "donation", "label": "Donation", "type": "flat", "value": 10, "enabled": False},
            ],
        }
        requests.put(f"{API}/admin/settings/site", headers=admin_headers, json=payload)

        r = requests.get(f"{API}/site/delivery-config")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["gst_enabled"] is False
        assert d["gst_percent"] == 0
        assert d["delivery_charge_enabled"] is True
        # only enabled=true extras included
        assert len(d["extra_charges"]) == 2
        keys = {c["key"] for c in d["extra_charges"]}
        assert keys == {"packing", "handling"}

    def test_delivery_disabled_zeroes_delivery_charge(self, admin_headers):
        payload = {
            "gst_enabled": False,
            "delivery_charge_enabled": False,
            "delivery_charge": 49,
            "free_shipping_threshold": 999,
            "gst_percent": 5,
            "extra_charges": [
                {"key": "packing", "label": "Packing Fee", "type": "flat", "value": 25, "enabled": True},
                {"key": "handling", "label": "Handling %", "type": "percent", "value": 2, "enabled": True},
                {"key": "donation", "label": "Donation", "type": "flat", "value": 10, "enabled": False},
            ],
        }
        requests.put(f"{API}/admin/settings/site", headers=admin_headers, json=payload)
        r = requests.get(f"{API}/site/delivery-config")
        assert r.status_code == 200
        d = r.json()
        assert d["delivery_charge"] == 0
        assert d["delivery_charge_enabled"] is False


# ==================== ORDER CREATION WITH EXTRAS ====================

class TestOrderCreateExtras:
    def test_joining_order_has_extras_breakdown(self, admin_headers):
        # Set config: gst off, delivery on, packing flat 25 + handling percent 2%
        cfg = {
            "gst_enabled": False,
            "delivery_charge_enabled": True,
            "delivery_charge": 49,
            "free_shipping_threshold": 999,
            "gst_percent": 5,
            "extra_charges": [
                {"key": "packing", "label": "Packing Fee", "type": "flat", "value": 25, "enabled": True},
                {"key": "handling", "label": "Handling %", "type": "percent", "value": 2, "enabled": True},
                {"key": "donation", "label": "Donation", "type": "flat", "value": 10, "enabled": False},
            ],
        }
        assert requests.put(f"{API}/admin/settings/site", headers=admin_headers, json=cfg).status_code == 200

        # Register a fresh user
        suffix = _rand(6)
        reg_payload = {
            "name": f"TEST Order {suffix}",
            "email": f"testorder_{suffix}@ex.com",
            "phone": f"98{random.randint(10000000, 99999999)}",
            "password": "Pass@1234",
            "username": f"testorder_{suffix}",
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/auth/register", json=reg_payload)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Find joining kit product (hamper)
        pr = requests.get(f"{API}/products").json()
        products = pr if isinstance(pr, list) else pr.get("products", [])
        hamper = next((p for p in products if p.get("is_hamper")), None)
        assert hamper is not None, "Joining kit hamper product not found"

        order_payload = {
            "items": [{"product_id": hamper["id"], "quantity": 1}],
            "address": {"name": "T", "phone": reg_payload["phone"], "line1": "L1", "city": "X", "state": "Y", "pincode": "123456"},
            "payment_method": "cashfree",
        }
        r = requests.post(f"{API}/orders/create", headers=headers, json=order_payload)
        assert r.status_code == 200, r.text
        body = r.json()
        order = body.get("order", body)

        subtotal = order["subtotal"]
        assert order["gst"] == 0, f"GST should be 0 when gst_enabled=false, got {order['gst']}"
        assert "extras" in order and isinstance(order["extras"], list)
        assert len(order["extras"]) == 2, f"Expected 2 extras, got {order['extras']}"

        # Verify extras values
        by_key = {e["key"]: e for e in order["extras"]}
        assert by_key["packing"]["amount"] == 25
        expected_handling = round(subtotal * 0.02, 2)
        assert abs(by_key["handling"]["amount"] - expected_handling) < 0.01

        assert "extras_total" in order
        expected_total_extras = round(25 + expected_handling, 2)
        assert abs(order["extras_total"] - expected_total_extras) < 0.01

        # Total = subtotal + shipping + extras_total - discount (gst=0)
        expected_total = subtotal + order["shipping"] + order["extras_total"] - order["discount"]
        assert abs(order["total"] - round(expected_total, 2)) < 0.01


# ==================== CLEANUP ====================

class TestCleanup:
    def test_reset_site_to_defaults(self, admin_headers):
        """Reset gst_enabled=true, extra_charges=[] to leave preview clean."""
        payload = {
            "gst_enabled": True,
            "delivery_charge_enabled": True,
            "delivery_charge": 49,
            "free_shipping_threshold": 999,
            "gst_percent": 5,
            "extra_charges": [],
        }
        r = requests.put(f"{API}/admin/settings/site", headers=admin_headers, json=payload)
        assert r.status_code == 200
        g = requests.get(f"{API}/admin/settings/site", headers=admin_headers).json()
        assert g["gst_enabled"] is True
        assert g["extra_charges"] == []
