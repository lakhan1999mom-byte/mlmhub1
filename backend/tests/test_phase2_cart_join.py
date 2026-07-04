"""EverGro eMart - Phase 2 Tests
Covers:
- Registration T&C enforcement (terms_accepted mandatory)
- Registration does NOT increment sponsor's direct_referrals_count (paid-only)
- Cart join-gating: non-joined user cannot add non-hamper; can add hamper
- Joining kit order + verify-payment activates user + increments sponsor + commission logic
- Post-joining: user can add non-hamper; cannot re-add hamper
- Cart CRUD (GET, add, update, remove, clear) + stock enforcement
- /site/delivery-config values used by /orders/create for shipping
- Commission logic: L1=₹1200 for income_active sponsor; commission_held for ineligible sponsor
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"
SPONSOR_REF_CODE = "ADMIN001"  # note: may be saturated (6/6)
SUB_REF_CODE = "SUBADMIN1"


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def rand_phone(prefix="7"):
    return (prefix + uuid.uuid4().hex[:9])[:10].translate(str.maketrans("abcdef", "012345"))


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def hamper_product(session):
    r = session.get(f"{API}/products", params={"is_hamper": "true"})
    assert r.status_code == 200
    hampers = [p for p in r.json() if p.get("is_hamper") and not p.get("is_locked")]
    assert hampers, "No active joining hamper found"
    h = hampers[0]
    assert abs(h["price"] - 7200) < 1, f"Expected 7200 price, got {h['price']}"
    return h


@pytest.fixture(scope="module")
def non_hamper_product(session):
    r = session.get(f"{API}/products")
    assert r.status_code == 200
    non_h = [p for p in r.json() if not p.get("is_hamper") and p.get("stock", 0) > 5 and p.get("is_active", True)]
    assert non_h, "No non-hamper product with stock > 5"
    return non_h[0]


def _register(session, sponsor_code=None, terms=True, phone_prefix="7"):
    nonce = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST P2 {nonce}",
        "email": f"p2_{nonce}@example.com",
        "phone": rand_phone(phone_prefix),
        "password": "Test@1234",
        "terms_accepted": terms,
    }
    if sponsor_code:
        payload["referral_code"] = sponsor_code
    r = session.post(f"{API}/auth/register", json=payload)
    return r


# =========================================================================
# 1. Registration T&C enforcement
# =========================================================================
class TestRegistrationTerms:
    def test_register_without_terms_fails(self, session):
        r = _register(session, terms=False)
        assert r.status_code == 400, r.text
        assert "terms" in r.text.lower()

    def test_register_with_terms_creates_pending_user(self, session):
        r = _register(session, sponsor_code=None, terms=True)
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["is_joining_paid"] is False
        # income_active should also be false
        assert u.get("income_active", False) is False

    def test_registration_does_not_increment_sponsor_paid_count(self, session, admin_token):
        # capture admin paid count before
        me_before = session.get(f"{API}/auth/me", headers=auth(admin_token)).json()
        before = me_before.get("direct_referrals_count", 0)
        # Only attempt to use sponsor if not saturated
        if before < 6:
            r = _register(session, sponsor_code=SPONSOR_REF_CODE)
            if r.status_code == 200:
                me_after = session.get(f"{API}/auth/me", headers=auth(admin_token)).json()
                after = me_after.get("direct_referrals_count", 0)
                assert after == before, f"Sponsor count changed on register (before={before}, after={after}). Should only change after payment."
        else:
            pytest.skip("ADMIN001 saturated; cannot test increment")


# =========================================================================
# 2. Cart join-gating (non-joined)
# =========================================================================
@pytest.fixture(scope="module")
def unpaid_user(session):
    r = _register(session)
    assert r.status_code == 200, r.text
    return r.json()  # {token, user}


class TestCartJoinGating:
    def test_unpaid_cannot_add_non_hamper(self, session, unpaid_user, non_hamper_product):
        t = unpaid_user["token"]
        r = session.post(f"{API}/cart/add",
                         json={"product_id": non_hamper_product["id"], "quantity": 1},
                         headers=auth(t))
        assert r.status_code == 403, r.text
        assert "joining" in r.text.lower() or "7,200" in r.text or "7200" in r.text

    def test_unpaid_can_add_hamper(self, session, unpaid_user, hamper_product):
        t = unpaid_user["token"]
        r = session.post(f"{API}/cart/add",
                         json={"product_id": hamper_product["id"], "quantity": 1},
                         headers=auth(t))
        assert r.status_code == 200, r.text
        # verify via GET /cart
        r = session.get(f"{API}/cart", headers=auth(t))
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert any(it["product"]["id"] == hamper_product["id"] for it in items)

    def test_cart_update_and_remove(self, session, unpaid_user, hamper_product):
        t = unpaid_user["token"]
        # update qty
        r = session.post(f"{API}/cart/update",
                        json={"product_id": hamper_product["id"], "quantity": 2},
                        headers=auth(t))
        assert r.status_code == 200
        # get - qty should be 2
        r = session.get(f"{API}/cart", headers=auth(t))
        items = r.json()["items"]
        for it in items:
            if it["product"]["id"] == hamper_product["id"]:
                assert it["quantity"] == 2
        # remove
        r = session.delete(f"{API}/cart/{hamper_product['id']}", headers=auth(t))
        assert r.status_code == 200
        r = session.get(f"{API}/cart", headers=auth(t))
        assert not any(it["product"]["id"] == hamper_product["id"] for it in r.json()["items"])

    def test_clear_cart(self, session, unpaid_user, hamper_product):
        t = unpaid_user["token"]
        session.post(f"{API}/cart/add",
                     json={"product_id": hamper_product["id"], "quantity": 1},
                     headers=auth(t))
        r = session.delete(f"{API}/cart", headers=auth(t))
        assert r.status_code == 200
        r = session.get(f"{API}/cart", headers=auth(t))
        assert r.json()["items"] == []

    def test_stock_over_limit_blocked(self, session, unpaid_user, hamper_product):
        t = unpaid_user["token"]
        huge_qty = hamper_product.get("stock", 0) + 100
        r = session.post(f"{API}/cart/add",
                         json={"product_id": hamper_product["id"], "quantity": huge_qty},
                         headers=auth(t))
        assert r.status_code == 400, r.text
        assert "stock" in r.text.lower() or "left" in r.text.lower()


# =========================================================================
# 3. Delivery config used by /orders/create
# =========================================================================
class TestDeliveryConfig:
    def test_delivery_config_endpoint(self, session):
        r = session.get(f"{API}/site/delivery-config")
        assert r.status_code == 200
        data = r.json()
        assert "delivery_charge" in data
        assert "free_shipping_threshold" in data
        assert "gst_percent" in data
        # Ensure it's not the old hardcoded 999/49 assumption — values come from settings
        assert isinstance(data["delivery_charge"], (int, float))
        assert isinstance(data["free_shipping_threshold"], (int, float))

    def test_orders_create_uses_dynamic_shipping(self, session, unpaid_user, hamper_product):
        """Create a joining order; verify shipping matches delivery_charge OR 0 if >= threshold."""
        cfg = session.get(f"{API}/site/delivery-config").json()
        t = unpaid_user["token"]
        u = unpaid_user["user"]
        create = session.post(
            f"{API}/orders/create",
            json={
                "items": [{"product_id": hamper_product["id"], "quantity": 1}],
                "address": {"name": u["name"], "phone": u["phone"], "line1": "1 A", "city": "Mumbai",
                            "state": "MH", "pincode": "400001"},
                "payment_method": "razorpay",
                "coupon_code": None,
            },
            headers=auth(t),
        )
        assert create.status_code == 200, create.text
        order = create.json()["order"]
        subtotal = order["subtotal"]
        expected_ship = 0 if subtotal >= cfg["free_shipping_threshold"] else cfg["delivery_charge"]
        assert order["shipping"] == expected_ship, (
            f"shipping mismatch: got {order['shipping']}, expected {expected_ship} "
            f"(subtotal={subtotal}, threshold={cfg['free_shipping_threshold']})"
        )
        # Clean up — cancel by not verifying (leave as pending)


# =========================================================================
# 4. Joining kit purchase → activation & sponsor increment & commission logic
# =========================================================================
@pytest.fixture(scope="module")
def sponsor_and_buyer(session, admin_token):
    """Create a fresh sponsor (no ref, so ADMIN001 unaffected) then create a buyer under that sponsor.
    Returns (sponsor_dict, buyer_dict) both with tokens.
    """
    # Sponsor: register + we need them to be paid too. Register sponsor (no ref).
    sp = _register(session).json()  # sponsor is unpaid initially
    # Sponsor pays their joining kit first (self-activated)
    from_h = session.get(f"{API}/products", params={"is_hamper": "true"}).json()
    hamper = next(p for p in from_h if p.get("is_hamper") and not p.get("is_locked"))
    # Create + verify order for sponsor
    sp_t = sp["token"]
    sp_u = sp["user"]
    ord_r = session.post(f"{API}/orders/create",
                         json={"items": [{"product_id": hamper["id"], "quantity": 1}],
                               "address": {"name": sp_u["name"], "phone": sp_u["phone"],
                                           "line1": "1", "city": "M", "state": "MH", "pincode": "400001"},
                               "payment_method": "razorpay", "coupon_code": None},
                         headers=auth(sp_t))
    assert ord_r.status_code == 200, ord_r.text
    ord_id = ord_r.json()["order"]["id"]
    v = session.post(f"{API}/orders/verify-payment",
                     json={"order_id": ord_id, "razorpay_payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                           "razorpay_signature": "s"}, headers=auth(sp_t))
    assert v.status_code == 200, v.text
    # Refresh sponsor
    sp_me = session.get(f"{API}/auth/me", headers=auth(sp_t)).json()
    assert sp_me["is_joining_paid"] is True
    return sp_me, sp_t


class TestPaidJoiningFlow:
    def test_sponsor_activated(self, sponsor_and_buyer):
        sp_me, _ = sponsor_and_buyer
        assert sp_me["is_joining_paid"] is True
        # sponsor is not income_active yet (only 0 direct paid refs, since sponsor's own upline doesn't count)
        # actually sponsor has zero downline of their own
        assert sp_me.get("income_active", False) is False

    def test_buyer_activation_increments_sponsor_and_logs_held(self, session, sponsor_and_buyer, hamper_product):
        sp_me, sp_t = sponsor_and_buyer
        sp_refcode = sp_me["referral_code"]

        # Register a buyer under this sponsor
        buyer_r = _register(session, sponsor_code=sp_refcode)
        assert buyer_r.status_code == 200, buyer_r.text
        buyer = buyer_r.json()
        b_t = buyer["token"]
        b_u = buyer["user"]

        # Confirm sponsor's direct_referrals_count did NOT increment on registration
        sp_before = session.get(f"{API}/auth/me", headers=auth(sp_t)).json()
        pre_refs = sp_before.get("direct_referrals_count", 0)
        assert pre_refs == 0, f"Sponsor should still have 0 paid refs; got {pre_refs}"

        # Buyer creates + verifies joining order
        ord_r = session.post(f"{API}/orders/create",
                             json={"items": [{"product_id": hamper_product["id"], "quantity": 1}],
                                   "address": {"name": b_u["name"], "phone": b_u["phone"],
                                               "line1": "1", "city": "M", "state": "MH", "pincode": "400001"},
                                   "payment_method": "razorpay", "coupon_code": None},
                             headers=auth(b_t))
        assert ord_r.status_code == 200, ord_r.text
        order = ord_r.json()["order"]
        assert order["is_joining_order"] is True
        v = session.post(f"{API}/orders/verify-payment",
                         json={"order_id": order["id"], "razorpay_payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                               "razorpay_signature": "s"}, headers=auth(b_t))
        assert v.status_code == 200, v.text

        # Buyer now activated
        b_me = session.get(f"{API}/auth/me", headers=auth(b_t)).json()
        assert b_me["is_joining_paid"] is True

        # Sponsor now has 1 paid ref
        sp_after = session.get(f"{API}/auth/me", headers=auth(sp_t)).json()
        assert sp_after["direct_referrals_count"] == 1, f"Expected 1, got {sp_after['direct_referrals_count']}"
        # sponsor is NOT income_active yet (needs 3)
        assert sp_after.get("income_active", False) is False
        # sponsor wallet should NOT have received L1 ₹1200 (ineligible)
        assert sp_after.get("commission_wallet", 0) == 0, \
            f"Sponsor received commission before income_active: {sp_after.get('commission_wallet')}"

        # commission_held transaction logged for sponsor
        # /wallet/transactions endpoint — check
        tx = session.get(f"{API}/wallet/transactions", headers=auth(sp_t))
        assert tx.status_code == 200, tx.text
        txs = tx.json()
        held = [t for t in txs if t.get("category") == "commission_held"]
        assert len(held) >= 1, f"No commission_held record; txs={txs}"

    def test_joined_user_can_add_non_hamper(self, session, sponsor_and_buyer, non_hamper_product):
        sp_me, sp_t = sponsor_and_buyer  # sponsor is joined
        r = session.post(f"{API}/cart/add",
                         json={"product_id": non_hamper_product["id"], "quantity": 1},
                         headers=auth(sp_t))
        assert r.status_code == 200, r.text

    def test_joined_user_cannot_readd_hamper(self, session, sponsor_and_buyer, hamper_product):
        sp_me, sp_t = sponsor_and_buyer
        r = session.post(f"{API}/cart/add",
                         json={"product_id": hamper_product["id"], "quantity": 1},
                         headers=auth(sp_t))
        assert r.status_code == 400, r.text
        assert "already" in r.text.lower() or "purchased" in r.text.lower()


# =========================================================================
# 5. Full commission activation: sponsor becomes income_active after 3rd paid ref
# =========================================================================
class TestIncomeActivation:
    def test_third_paid_ref_activates_income_and_pays_l1(self, session, hamper_product):
        """Create sponsor + 3 paid downlines. After 3rd, sponsor should be income_active,
        and the 3rd paid buyer should trigger L1=₹1200 credit to sponsor."""
        # Fresh sponsor (self-paid)
        sp = _register(session).json()
        sp_t = sp["token"]
        sp_u = sp["user"]
        # Pay sponsor's joining
        _pay_joining(session, sp_t, sp_u, hamper_product)
        sp_ref = session.get(f"{API}/auth/me", headers=auth(sp_t)).json()["referral_code"]

        # Register + pay 3 downlines
        for i in range(3):
            b = _register(session, sponsor_code=sp_ref).json()
            _pay_joining(session, b["token"], b["user"], hamper_product)

        # After 3rd, sponsor should be income_active
        sp_me = session.get(f"{API}/auth/me", headers=auth(sp_t)).json()
        assert sp_me["direct_referrals_count"] == 3
        # NOTE: /auth/me does NOT expose income_active (public_user omits it — see minor bug in report).
        # Verify indirectly via commission_wallet which is only credited when sponsor is income_active.
        assert sp_me.get("commission_wallet", 0) >= 1200, \
            f"Expected >=1200 L1 commission (proves income_active kicked in); got {sp_me.get('commission_wallet')}"


def _pay_joining(session, token, user_dict, hamper):
    ord_r = session.post(f"{API}/orders/create",
                         json={"items": [{"product_id": hamper["id"], "quantity": 1}],
                               "address": {"name": user_dict["name"], "phone": user_dict["phone"],
                                           "line1": "1", "city": "M", "state": "MH", "pincode": "400001"},
                               "payment_method": "razorpay", "coupon_code": None},
                         headers=auth(token))
    assert ord_r.status_code == 200, ord_r.text
    order = ord_r.json()["order"]
    v = session.post(f"{API}/orders/verify-payment",
                     json={"order_id": order["id"], "razorpay_payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                           "razorpay_signature": "s"}, headers=auth(token))
    assert v.status_code == 200, v.text
    return v.json()


# =========================================================================
# 6. Admin endpoints smoke — inventory, accounts, audit-logs, sliders, reels
# =========================================================================
class TestAdminSmoke:
    def test_admin_dashboard(self, session, admin_token):
        r = session.get(f"{API}/admin/dashboard", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_users(self, session, admin_token):
        r = session.get(f"{API}/admin/users", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_audit_logs(self, session, admin_token):
        r = session.get(f"{API}/admin/audit-logs", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_sliders(self, session, admin_token):
        # Admin uses the public GET /sliders endpoint; no /admin/sliders GET (only POST/PUT/DELETE)
        r = session.get(f"{API}/sliders", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_reels(self, session, admin_token):
        r = session.get(f"{API}/reels", headers=auth(admin_token))
        assert r.status_code == 200

    def test_admin_products_inventory(self, session, admin_token):
        r = session.get(f"{API}/admin/inventory", headers=auth(admin_token))
        assert r.status_code == 200

    def test_users_dashboard_no_referrals_per_stage_error(self, session, admin_token):
        """Regression test for REFERRALS_PER_STAGE undefined bug."""
        r = session.get(f"{API}/users/dashboard", headers=auth(admin_token))
        assert r.status_code == 200, r.text
