"""Iteration 19 tests: admin downline-tree endpoint + wallet withdrawal nudge.

Covers:
- GET /api/admin/users/{user_id}/downline-tree (auth guard, 404, clamp, correctness)
- MLM engine _distribute_level_commissions withdraw_nudge idempotency
- Regression of previously-live admin endpoints.
"""
import os
import sys
import asyncio
import uuid
import pytest
import requests
from pathlib import Path

# Backend path for direct imports (motor + mlm_engine)
sys.path.insert(0, "/app/backend")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from mlm_engine import _distribute_level_commissions  # noqa: E402

# Load backend .env for MONGO_URL/DB_NAME
from dotenv import load_dotenv  # noqa: E402
load_dotenv("/app/backend/.env")

# Base URL from frontend .env
def _read_base_url():
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL missing")

BASE_URL = _read_base_url()
API = f"{BASE_URL}/api"

SUPER = {"identifier": "admin@evergroemart.com", "password": "Admin@123"}
SUB   = {"identifier": "subadmin@evergroemart.com", "password": "SubAdmin@123"}
USER  = {"identifier": "test1_1785761123", "password": "NewPass@123"}


# ---------- Auth helpers ----------
def _login(session: requests.Session, creds: dict) -> str:
    r = session.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['identifier']}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def super_token():
    s = requests.Session()
    return _login(s, SUPER)


@pytest.fixture(scope="module")
def sub_token():
    s = requests.Session()
    return _login(s, SUB)


@pytest.fixture(scope="module")
def user_token():
    s = requests.Session()
    return _login(s, USER)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Feature: Downline tree ----------
class TestDownlineTree:
    def _admin_id(self, tok):
        r = requests.get(f"{API}/admin/users?limit=200", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        for u in r.json().get("items", r.json() if isinstance(r.json(), list) else []):
            if u.get("user_code") == "EG000001":
                return u["id"]
        pytest.skip("Super admin (EG000001) not found via admin/users listing")

    def test_downline_super_admin_has_l1(self, super_token):
        uid = self._admin_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree", headers=_h(super_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["root"]["user_code"] == "EG000001"
        assert data["totals"]["levels"] == 8
        # L1 must be non-empty (>=1) — problem statement claims 15+ seeded
        l1 = next(l for l in data["levels"] if l["level"] == 1)
        assert l1["count"] >= 1, f"expected L1 members for EG000001, got {l1}"
        # members sorted by total_earnings DESC
        earnings = [m.get("total_earnings", 0) for m in l1["members"]]
        assert earnings == sorted(earnings, reverse=True), f"L1 not sorted DESC by earnings: {earnings}"
        # sponsor_id of each L1 member equals root.user_code
        for m in l1["members"]:
            # not returned in fields; skip — but ensure required member fields present
            assert "user_code" in m and "name" in m

    def test_downline_max_depth_clamped(self, super_token):
        uid = self._admin_id(super_token)
        # 1 -> only level 1
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree?max_depth=1", headers=_h(super_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["totals"]["levels"] == 1
        assert len(r.json()["levels"]) == 1
        # negative -> clamp to 1
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree?max_depth=-3", headers=_h(super_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["totals"]["levels"] == 1
        # 99 -> clamp to 8
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree?max_depth=99", headers=_h(super_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["totals"]["levels"] == 8
        assert len(r.json()["levels"]) == 8

    def test_downline_404_unknown_user(self, super_token):
        r = requests.get(f"{API}/admin/users/{uuid.uuid4()}/downline-tree", headers=_h(super_token), timeout=15)
        assert r.status_code == 404

    def test_downline_non_admin_forbidden(self, user_token, super_token):
        uid = TestDownlineTree()._admin_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree", headers=_h(user_token), timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 for non-admin, got {r.status_code}"

    def test_downline_no_auth_forbidden(self, super_token):
        uid = TestDownlineTree()._admin_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree", timeout=15)
        assert r.status_code in (401, 403)

    def test_downline_sub_admin_allowed(self, sub_token, super_token):
        # sub admin should also access (require_admin)
        uid = TestDownlineTree()._admin_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/downline-tree?max_depth=2", headers=_h(sub_token), timeout=20)
        assert r.status_code == 200


# ---------- Feature: Wallet withdraw nudge ----------
@pytest.mark.asyncio
async def test_withdraw_nudge_fires_once():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    assert mongo_url and db_name, "MONGO_URL / DB_NAME not set"
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Pick super admin as sponsor (has income eligibility since direct_referrals_count>=3)
    sponsor = await db.users.find_one({"user_code": "EG000001"})
    assert sponsor, "super admin missing"
    sponsor_id = sponsor["id"]
    original_balance = sponsor.get("wallet_balance", 0)
    original_nudge_flag = sponsor.get("withdraw_nudge_sent", False)
    original_direct_refs = sponsor.get("direct_referrals_count", 0)
    original_commission_wallet = sponsor.get("commission_wallet", 0)
    original_total_earnings = sponsor.get("total_earnings", 0)

    # Ensure sponsor is income_eligible (direct_referrals_count >= 3) and reset nudge state
    await db.users.update_one(
        {"id": sponsor_id},
        {"$set": {
            "wallet_balance": 495.0,
            "withdraw_nudge_sent": False,
            "direct_referrals_count": max(original_direct_refs, 3),
        }},
    )

    # Create a synthetic buyer whose sponsor_user_id = super admin
    buyer_id = f"TESTBUYER-{uuid.uuid4()}"
    buyer_doc = {
        "id": buyer_id,
        "user_code": "TESTBUYERC",
        "name": "Test Nudge Buyer",
        "sponsor_user_id": sponsor_id,
        "sponsor_id": sponsor.get("user_code"),
        "is_joining_paid": True,
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    await db.users.insert_one(buyer_doc)

    # Clean any previous nudge notifications for this admin from prior runs
    await db.notifications.delete_many({"user_id": sponsor_id, "event": "withdraw_nudge"})

    try:
        # First commission credit — level 1 = ₹1200, so wallet 495 -> 1695, crosses 500
        await _distribute_level_commissions(db, buyer_id, "TEST-ORDER-1", "test-order-id-1")

        # Assert nudge notification created ONCE
        nudges = await db.notifications.count_documents({"user_id": sponsor_id, "event": "withdraw_nudge"})
        assert nudges == 1, f"expected exactly 1 nudge after first credit, got {nudges}"

        nudge = await db.notifications.find_one({"user_id": sponsor_id, "event": "withdraw_nudge"})
        assert "500" in (nudge.get("title", "") + nudge.get("body", "")), f"nudge title/body missing ₹500: {nudge}"
        assert nudge.get("action_url") == "/wallet", f"action_url expected /wallet, got {nudge.get('action_url')}"

        # withdraw_nudge_sent flag flipped
        updated = await db.users.find_one({"id": sponsor_id})
        assert updated.get("withdraw_nudge_sent") is True

        # Trigger a SECOND commission credit — nudge must NOT be inserted again
        await _distribute_level_commissions(db, buyer_id, "TEST-ORDER-2", "test-order-id-2")
        nudges2 = await db.notifications.count_documents({"user_id": sponsor_id, "event": "withdraw_nudge"})
        assert nudges2 == 1, f"nudge is NOT idempotent — expected 1, got {nudges2}"
    finally:
        # Cleanup: delete synthetic buyer, nudge notifications, extra transactions, restore admin
        await db.users.delete_one({"id": buyer_id})
        await db.notifications.delete_many({"user_id": sponsor_id, "event": "withdraw_nudge"})
        await db.transactions.delete_many({"reference_id": {"$in": ["test-order-id-1", "test-order-id-2"]}})
        await db.notifications.delete_many({"user_id": sponsor_id, "event": "commission_earned",
                                             "body": {"$regex": "Test Nudge Buyer"}})
        await db.users.update_one(
            {"id": sponsor_id},
            {"$set": {
                "wallet_balance": original_balance,
                "withdraw_nudge_sent": original_nudge_flag,
                "direct_referrals_count": original_direct_refs,
                "commission_wallet": original_commission_wallet,
                "total_earnings": original_total_earnings,
            }},
        )
        client.close()


# ---------- Regression: previously-live endpoints still fine ----------
class TestRegression:
    def _first_user_id(self, tok):
        r = requests.get(f"{API}/admin/users?limit=5", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", r.json() if isinstance(r.json(), list) else [])
        assert items, "no users returned"
        return items[0]["id"]

    def test_admin_users_list(self, super_token):
        r = requests.get(f"{API}/admin/users?limit=10", headers=_h(super_token), timeout=15)
        assert r.status_code == 200

    def test_admin_user_detail(self, super_token):
        uid = self._first_user_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}", headers=_h(super_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        # endpoint returns wrapped shape {user:{...}, counters:{...}, referral_businesses:[...]}
        user_obj = body.get("user", body)
        assert user_obj.get("id") == uid

    def test_admin_commission_breakdown(self, super_token):
        uid = self._first_user_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/commission-breakdown", headers=_h(super_token), timeout=15)
        assert r.status_code == 200

    def test_mlm_commission_breakdown_self(self, user_token):
        r = requests.get(f"{API}/mlm/commission-breakdown", headers=_h(user_token), timeout=15)
        assert r.status_code == 200

    def test_admin_login_history(self, super_token):
        uid = self._first_user_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/login-history", headers=_h(super_token), timeout=15)
        assert r.status_code == 200

    def test_admin_activity(self, super_token):
        uid = self._first_user_id(super_token)
        r = requests.get(f"{API}/admin/users/{uid}/activity", headers=_h(super_token), timeout=15)
        assert r.status_code == 200

    def test_admin_search(self, super_token):
        r = requests.get(f"{API}/admin/search?q=admin", headers=_h(super_token), timeout=15)
        assert r.status_code == 200

    def test_change_password_wrong_current(self, user_token):
        r = requests.post(f"{API}/auth/change-password",
                          headers=_h(user_token),
                          json={"current_password": "WRONG_PASS_xyz", "new_password": "AnyNew@123"},
                          timeout=15)
        assert r.status_code in (400, 401, 403), f"expected reject on wrong current, got {r.status_code}"

    def test_admin_reset_password_requires_super(self, sub_token, super_token):
        # sub_admin should NOT be able to reset another user's password
        uid = TestRegression()._first_user_id(super_token)
        r = requests.post(f"{API}/admin/users/{uid}/reset-password",
                          headers=_h(sub_token),
                          json={"new_password": "SomeNew@123"},
                          timeout=15)
        assert r.status_code == 403, f"sub_admin must be 403 on reset, got {r.status_code}"

    def test_admin_fresh_start_rejects_without_confirm(self, super_token):
        r = requests.post(f"{API}/admin/fresh-start",
                          headers=_h(super_token),
                          json={},
                          timeout=15)
        assert r.status_code in (400, 422), f"fresh-start must reject w/o confirm, got {r.status_code}"
