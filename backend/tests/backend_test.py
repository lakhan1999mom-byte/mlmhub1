"""EverGro eMart - Backend API Tests
Covers: auth (password+OTP), site public endpoints, user dashboard, products,
cart, orders (mock razorpay), MLM commission engine end-to-end, KYC, withdrawals,
admin endpoints, MLM config, cloudinary signature, notifications broadcast.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hamper-mlm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"
ADMIN_PHONE = "9999999999"
SUBADMIN_EMAIL = "subadmin@evergroemart.com"
SUBADMIN_PASSWORD = "SubAdmin@123"
SPONSOR_REF_CODE = "ADMIN001"
TEST_COUPON = "WELCOME10"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["role"] == "super_admin"
    return data["token"]


@pytest.fixture(scope="session")
def subadmin_token(session):
    r = session.post(f"{API}/auth/login", json={"identifier": SUBADMIN_EMAIL, "password": SUBADMIN_PASSWORD})
    assert r.status_code == 200, f"Subadmin login failed: {r.text}"
    return r.json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Public/Site Endpoints ----------------
class TestPublicSite:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"

    def test_site_settings(self, session):
        r = session.get(f"{API}/site/settings")
        assert r.status_code == 200
        assert "site_name" in r.json()

    def test_site_banners(self, session):
        r = session.get(f"{API}/site/banners")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_site_testimonials(self, session):
        r = session.get(f"{API}/site/testimonials")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_site_faqs(self, session):
        r = session.get(f"{API}/site/faqs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_site_blogs(self, session):
        r = session.get(f"{API}/site/blogs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_mlm_config(self, session):
        r = session.get(f"{API}/mlm/config")
        assert r.status_code == 200
        data = r.json()
        assert data.get("stages_total") == 8
        assert data.get("referrals_per_stage") == 3
        assert isinstance(data.get("stage_commissions"), list)

    def test_products_list(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0

    def test_hampers_list(self, session):
        r = session.get(f"{API}/products?is_hamper=true")
        assert r.status_code == 200
        # We accept all products returned; check that at least some hampers exist
        hampers = [p for p in r.json() if p.get("is_hamper")]
        assert len(hampers) >= 1


# ---------------- Auth ----------------
class TestAuth:
    def test_password_login_admin(self, admin_token):
        assert admin_token

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_otp_send_returns_dev_otp(self, session):
        r = session.post(f"{API}/auth/otp/send", json={"phone": ADMIN_PHONE})
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "dev_otp" in data and len(str(data["dev_otp"])) >= 4

    def test_otp_verify_admin(self, session):
        r = session.post(f"{API}/auth/otp/send", json={"phone": ADMIN_PHONE})
        otp = r.json()["dev_otp"]
        r2 = session.post(f"{API}/auth/otp/verify", json={"phone": ADMIN_PHONE, "otp": otp})
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("verified") is True
        assert data.get("new_user") is False
        assert data["user"]["role"] == "super_admin"

    def test_me_endpoint(self, session, admin_token):
        r = session.get(f"{API}/auth/me", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------------- Registration + MLM End-to-End ----------------
@pytest.fixture(scope="session")
def admin_state_before(session, admin_token):
    """Capture admin direct_referrals_count + wallet before MLM e2e."""
    r = session.get(f"{API}/auth/me", headers=auth(admin_token))
    return r.json()


@pytest.fixture(scope="session")
def three_new_users(session, admin_state_before):
    """Register 3 fresh users sponsored by ADMIN001."""
    users = []
    nonce = uuid.uuid4().hex[:6]
    for i in range(3):
        payload = {
            "name": f"TEST User {nonce}{i}",
            "email": f"test_{nonce}{i}@example.com",
            "phone": f"7{nonce}{i}".ljust(10, "0")[:10],
            "password": "Test@1234",
            "referral_code": SPONSOR_REF_CODE,
        }
        r = session.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, f"Register failed: {r.text}"
        body = r.json()
        assert body["user"]["user_code"].startswith("EG")
        # sponsor_id stores sponsor's user_code (EG000001 for admin), not referral_code
        assert body["user"]["sponsor_id"] == "EG000001"
        users.append({"token": body["token"], "user": body["user"]})
    return users


class TestRegistrationAndMLM:
    def test_register_invalid_referral(self, session):
        nonce = uuid.uuid4().hex[:6]
        r = session.post(f"{API}/auth/register", json={
            "name": "TEST Bad",
            "email": f"bad_{nonce}@example.com",
            "phone": f"6{nonce}".ljust(10, "0")[:10],
            "password": "Test@1234",
            "referral_code": "NOPE_INVALID",
        })
        assert r.status_code == 400

    def test_three_users_registered(self, three_new_users):
        assert len(three_new_users) == 3

    def test_direct_referrals_incremented(self, session, admin_token, admin_state_before, three_new_users):
        r = session.get(f"{API}/auth/me", headers=auth(admin_token))
        admin_after = r.json()
        before = admin_state_before.get("direct_referrals_count", 0)
        after = admin_after.get("direct_referrals_count", 0)
        assert after >= before + 3, f"Expected +3 referrals, got before={before}, after={after}"

    def test_mlm_commission_engine_e2e(self, session, admin_token, admin_state_before, three_new_users):
        """Each new user buys a hamper -> verify-payment. After 3rd, admin advances stage and earns ₹500."""
        # Get a hamper product
        products = session.get(f"{API}/products").json()
        hamper = next((p for p in products if p.get("is_hamper")), None)
        assert hamper, "No hamper product found"

        wallet_before = admin_state_before.get("wallet_balance", 0)
        stage_before = admin_state_before.get("current_stage", 1)

        for u in three_new_users:
            t = u["token"]
            create = session.post(
                f"{API}/orders/create",
                json={
                    "items": [{"product_id": hamper["id"], "quantity": 1}],
                    "address": {"name": u["user"]["name"], "phone": u["user"]["phone"],
                                "line1": "123 Main St", "city": "Mumbai", "state": "MH", "pincode": "400001"},
                    "payment_method": "razorpay",
                    "coupon_code": None,
                },
                headers=auth(t),
            )
            assert create.status_code == 200, f"Order create failed: {create.text}"
            order = create.json()["order"]
            assert order["is_joining_order"] is True

            verify = session.post(
                f"{API}/orders/verify-payment",
                json={"order_id": order["id"], "razorpay_payment_id": f"pay_mock_{uuid.uuid4().hex[:12]}",
                      "razorpay_signature": "mock_sig"},
                headers=auth(t),
            )
            assert verify.status_code == 200, f"Verify failed: {verify.text}"

        # tiny wait for any async settle
        time.sleep(0.5)
        r = session.get(f"{API}/auth/me", headers=auth(admin_token))
        admin_after = r.json()
        assert admin_after["current_stage"] > stage_before, (
            f"Stage did not advance: before={stage_before}, after={admin_after['current_stage']}"
        )
        # Stage 1 commission = 500
        assert admin_after["wallet_balance"] >= wallet_before + 500, (
            f"Wallet did not get +500: before={wallet_before}, after={admin_after['wallet_balance']}"
        )


# ---------------- User Flows ----------------
@pytest.fixture(scope="session")
def fresh_user(session):
    nonce = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST Cart {nonce}",
        "email": f"cart_{nonce}@example.com",
        "phone": f"5{nonce}".ljust(10, "0")[:10],
        "password": "Test@1234",
        "referral_code": SPONSOR_REF_CODE,
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200
    return r.json()


class TestUserFlows:
    def test_dashboard(self, session, admin_token):
        r = session.get(f"{API}/users/dashboard", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        # dashboard may have wallet_balance OR nested user
        assert isinstance(data, dict)

    def test_network_tree(self, session, admin_token):
        r = session.get(f"{API}/users/network-tree", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "user_code" in data or "id" in data
        # Should have children (from previous tests' registrations)
        assert isinstance(data.get("children", []), list)

    def test_cart_flow(self, session, fresh_user):
        token = fresh_user["token"]
        products = session.get(f"{API}/products").json()
        non_hamper = next((p for p in products if not p.get("is_hamper")), products[0])
        # Add
        r = session.post(f"{API}/cart/add", json={"product_id": non_hamper["id"], "quantity": 2},
                         headers=auth(token))
        assert r.status_code == 200
        # View
        r = session.get(f"{API}/cart", headers=auth(token))
        assert r.status_code == 200
        cart = r.json()
        assert len(cart.get("items", [])) >= 1
        # Update
        r = session.post(f"{API}/cart/update", json={"product_id": non_hamper["id"], "quantity": 3},
                        headers=auth(token))
        assert r.status_code == 200
        # Remove
        r = session.delete(f"{API}/cart/{non_hamper['id']}", headers=auth(token))
        assert r.status_code == 200

    def test_coupon_validate(self, session, admin_token):
        r = session.get(f"{API}/coupons/validate/{TEST_COUPON}", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data.get("code") == TEST_COUPON or "discount_percent" in data

    def test_checkout_with_coupon_and_cashback(self, session, fresh_user):
        token = fresh_user["token"]
        # Pick a non-hamper item with price>=999 to trigger free shipping & coupon usability
        products = session.get(f"{API}/products").json()
        # Try to find a product with price >= 999, else use the most expensive non-hamper
        non_hampers = [p for p in products if not p.get("is_hamper")]
        target = max(non_hampers, key=lambda p: p["price"])
        qty = max(1, (999 // max(target["price"], 1)) + 1)

        wallet_before_r = session.get(f"{API}/auth/me", headers=auth(token)).json()
        wallet_before = wallet_before_r.get("wallet_balance", 0)

        create = session.post(
            f"{API}/orders/create",
            json={
                "items": [{"product_id": target["id"], "quantity": qty}],
                "address": {"name": "TEST", "phone": fresh_user["user"]["phone"],
                            "line1": "Street", "city": "Mumbai", "state": "MH", "pincode": "400001"},
                "payment_method": "razorpay",
                "coupon_code": TEST_COUPON,
            },
            headers=auth(token),
        )
        assert create.status_code == 200, create.text
        order = create.json()["order"]
        assert order["discount"] > 0, "Coupon discount should apply"

        verify = session.post(
            f"{API}/orders/verify-payment",
            json={"order_id": order["id"], "razorpay_payment_id": "pay_mock_x",
                  "razorpay_signature": "sig"},
            headers=auth(token),
        )
        assert verify.status_code == 200
        cashback = verify.json().get("cashback", 0)
        assert cashback > 0

        me_after = session.get(f"{API}/auth/me", headers=auth(token)).json()
        assert me_after.get("wallet_balance", 0) >= wallet_before + cashback - 0.5

        # Orders list contains the order
        r = session.get(f"{API}/orders", headers=auth(token))
        assert r.status_code == 200
        assert any(o["id"] == order["id"] for o in r.json())

    def test_withdrawal_blocked_without_kyc(self, session, fresh_user):
        token = fresh_user["token"]
        r = session.post(f"{API}/withdrawals/request",
                         json={"amount": 100, "method": "bank",
                               "bank_details": {"account": "1234", "ifsc": "HDFC0001"}},
                         headers=auth(token))
        assert r.status_code == 400
        assert "KYC" in r.text or "kyc" in r.text.lower()


# ---------------- KYC flow ----------------
class TestKyc:
    def test_kyc_submit_then_admin_approve(self, session, admin_token):
        # New user submits KYC
        nonce = uuid.uuid4().hex[:6]
        reg = session.post(f"{API}/auth/register", json={
            "name": f"TEST KYC {nonce}",
            "email": f"kyc_{nonce}@example.com",
            "phone": f"4{nonce}".ljust(10, "0")[:10],
            "password": "Test@1234",
            "referral_code": SPONSOR_REF_CODE,
        })
        assert reg.status_code == 200
        user = reg.json()
        token = user["token"]

        r = session.post(f"{API}/kyc/submit", json={
            "full_name": user["user"]["name"],
            "pan": "ABCDE1234F",
            "aadhaar": "1234-5678-9012",
            "bank_account": "1234567890",
            "ifsc": "HDFC0000123",
        }, headers=auth(token))
        assert r.status_code == 200, r.text

        # Admin lists KYC
        r = session.get(f"{API}/admin/kyc", headers=auth(admin_token))
        assert r.status_code == 200
        kyc_list = r.json()
        kyc_rec = next((k for k in kyc_list if k.get("user_id") == user["user"]["id"]), None)
        assert kyc_rec, "Submitted KYC not present in admin list"

        # Approve
        r = session.put(f"{API}/admin/kyc/{kyc_rec['id']}",
                        json={"status": "approved"}, headers=auth(admin_token))
        assert r.status_code == 200

        # Verify user kyc_status
        me = session.get(f"{API}/auth/me", headers=auth(token)).json()
        assert me["kyc_status"] == "approved"


# ---------------- Admin endpoints ----------------
class TestAdmin:
    def test_admin_dashboard(self, session, admin_token):
        r = session.get(f"{API}/admin/dashboard", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        # Expect KPI keys
        assert any(k in data for k in ["total_users", "total_orders", "users_total"])

    def test_admin_users_list(self, session, admin_token):
        r = session.get(f"{API}/admin/users", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        # paginated response: {items: [...], total: N}
        assert "items" in data and isinstance(data["items"], list)
        assert "total" in data

    def test_admin_products_create(self, session, admin_token):
        payload = {
            "name": f"TEST Product {uuid.uuid4().hex[:6]}",
            "description": "Test product",
            "price": 199,
            "category": "test",
            "stock": 100,
            "is_hamper": False,
            "gst_percent": 5,
            "images": [],
        }
        r = session.post(f"{API}/admin/products", json=payload, headers=auth(admin_token))
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["name"] == payload["name"]
        # Update
        r = session.put(f"{API}/admin/products/{prod['id']}",
                        json={"price": 299}, headers=auth(admin_token))
        assert r.status_code == 200
        # Delete
        r = session.delete(f"{API}/admin/products/{prod['id']}", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_orders_list(self, session, admin_token):
        r = session.get(f"{API}/admin/orders", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)

    def test_admin_withdrawals_list(self, session, admin_token):
        r = session.get(f"{API}/admin/withdrawals", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_broadcast(self, session, admin_token):
        r = session.post(f"{API}/admin/notifications/broadcast",
                         json={"title": "TEST Broadcast", "body": "Hello all", "type": "info"},
                         headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data.get("user_id") == "*"

    def test_admin_settings_get(self, session, admin_token):
        r = session.get(f"{API}/admin/settings", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_settings_update_super(self, session, admin_token):
        r = session.put(f"{API}/admin/settings/site",
                        json={"site_name": "EverGro eMart"},
                        headers=auth(admin_token))
        assert r.status_code == 200

    def test_subadmin_cannot_update_settings(self, session, subadmin_token):
        r = session.put(f"{API}/admin/settings/site",
                        json={"site_name": "Hack"},
                        headers=auth(subadmin_token))
        assert r.status_code == 403, f"Sub-admin should be forbidden, got {r.status_code}: {r.text}"


# ---------------- Cloudinary ----------------
class TestCloudinary:
    def test_signature(self, session, admin_token):
        r = session.get(f"{API}/cloudinary/signature", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        for k in ["signature", "cloud_name", "api_key", "timestamp"]:
            assert k in data and data[k], f"Missing {k} in cloudinary signature"


# ---------------- Notifications ----------------
class TestNotifications:
    def test_list_notifications(self, session, admin_token):
        r = session.get(f"{API}/notifications", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
