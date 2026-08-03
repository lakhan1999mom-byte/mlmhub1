"""Iteration 10 backend tests: username, registration collision, login by any identifier,
leaderboard fake Indian names, admin payment-config, /site/payment-provider, purchase-kit content."""
import os
import time
import pytest
import requests

def _load_env():
    if not os.environ.get("REACT_APP_BACKEND_URL"):
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
_load_env()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"

ADMIN_EMAIL = "admin@evergroemart.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- 1. Check-Username ----------
class TestCheckUsername:
    def test_reserved_admin(self):
        r = requests.get(f"{BASE}/auth/check-username", params={"username": "admin"})
        assert r.status_code == 200
        d = r.json()
        assert d["available"] is False
        assert "reserved" in d["reason"].lower()

    def test_too_short(self):
        r = requests.get(f"{BASE}/auth/check-username", params={"username": "ab"})
        assert r.status_code == 200
        assert r.json()["available"] is False

    def test_valid_available(self):
        u = f"valid_user_{int(time.time())}"
        r = requests.get(f"{BASE}/auth/check-username", params={"username": u})
        assert r.status_code == 200
        assert r.json()["available"] is True


# ---------- 2. Registration + username collisions + email reuse ----------
@pytest.fixture(scope="module")
def registered_user():
    ts = int(time.time())
    email = f"TEST_iter10_{ts}@example.com"
    phone = f"9{str(ts)[-9:]}"
    username = f"iter10user{ts}"
    payload = {
        "name": "Iter10 Tester",
        "email": email,
        "phone": phone,
        "password": "TestPass@123",
        "username": username,
        "terms_accepted": True,
    }
    r = requests.post(f"{BASE}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    return {"email": email, "phone": phone, "username": username, "password": "TestPass@123",
            "user": r.json()["user"], "token": r.json()["token"]}


class TestRegistration:
    def test_username_collision(self, registered_user):
        payload = {
            "name": "Dup",
            "email": f"TEST_dup_{int(time.time())}@x.com",
            "phone": f"8{int(time.time()) % 1000000000:09d}",
            "password": "P@ssw0rd1",
            "username": registered_user["username"],
            "terms_accepted": True,
        }
        r = requests.post(f"{BASE}/auth/register", json=payload)
        assert r.status_code == 400
        assert "username" in r.text.lower()

    def test_same_email_without_username_rejected(self, registered_user):
        payload = {
            "name": "Dup2",
            "email": registered_user["email"],
            "phone": f"7{int(time.time()) % 1000000000:09d}",
            "password": "P@ssw0rd1",
            "terms_accepted": True,
        }
        r = requests.post(f"{BASE}/auth/register", json=payload)
        assert r.status_code == 400

    def test_same_email_diff_username_succeeds(self, registered_user):
        ts = int(time.time() * 1000)
        new_uname = f"iter10alt{ts}"
        payload = {
            "name": "Dup3",
            "email": registered_user["email"],
            "phone": f"6{ts % 1000000000:09d}",
            "password": "P@ssw0rd1",
            "username": new_uname,
            "terms_accepted": True,
        }
        r = requests.post(f"{BASE}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        # Public-facing email should be original
        assert body["user"]["email"] == registered_user["email"], f"expected original email surfaced: {body['user']}"
        assert body["user"].get("username") == new_uname


# ---------- 3. Login by any identifier ----------
class TestLoginIdentifier:
    def test_login_by_email(self, registered_user):
        r = requests.post(f"{BASE}/auth/login", json={"identifier": registered_user["email"], "password": registered_user["password"]})
        assert r.status_code == 200

    def test_login_by_phone(self, registered_user):
        r = requests.post(f"{BASE}/auth/login", json={"identifier": registered_user["phone"], "password": registered_user["password"]})
        assert r.status_code == 200

    def test_login_by_username(self, registered_user):
        r = requests.post(f"{BASE}/auth/login", json={"identifier": registered_user["username"], "password": registered_user["password"]})
        assert r.status_code == 200


# ---------- 4. Leaderboard ----------
class TestLeaderboard:
    def test_returns_list_with_fake_indian(self):
        r = requests.get(f"{BASE}/mlm/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 8 and len(data) <= 10
        # At least one entry should be from the fake Indian roster (has city)
        cities = [e.get("city") for e in data if e.get("city")]
        assert len(cities) >= 5
        # Top earnings must reach lakh range
        top = data[0]["total_earnings"]
        assert top >= 500_000

    def test_deterministic_within_week(self):
        r1 = requests.get(f"{BASE}/mlm/leaderboard").json()
        r2 = requests.get(f"{BASE}/mlm/leaderboard").json()
        # Compare fake names ordering
        n1 = [e["name"] for e in r1]
        n2 = [e["name"] for e in r2]
        assert n1 == n2


# ---------- 5. Admin payment-config ----------
class TestPaymentConfig:
    def test_get_admin_config(self, admin_headers):
        r = requests.get(f"{BASE}/admin/payment-config", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_non_admin_forbidden(self, registered_user):
        r = requests.get(f"{BASE}/admin/payment-config",
                         headers={"Authorization": f"Bearer {registered_user['token']}"})
        assert r.status_code == 403

    def test_save_and_mask_secret(self, admin_headers):
        payload = {
            "provider": "cashfree",
            "cashfree_app_id": "TEST_APP_ID_iter10",
            "cashfree_secret_key": "TEST_SECRET_KEY_iter10_ABCDEFG",
            "cashfree_env": "sandbox",
            "cashfree_active": True,
        }
        r = requests.post(f"{BASE}/admin/payment-config", json=payload, headers=admin_headers)
        assert r.status_code == 200
        # Get back
        g = requests.get(f"{BASE}/admin/payment-config", headers=admin_headers).json()
        assert g.get("cashfree_app_id") == "TEST_APP_ID_iter10"
        assert "cashfree_secret_masked" in g
        assert g["cashfree_secret_masked"].endswith("EFG")
        # Empty secret_key should NOT clobber
        r2 = requests.post(f"{BASE}/admin/payment-config",
                           json={"cashfree_secret_key": "", "cashfree_env": "sandbox"},
                           headers=admin_headers)
        assert r2.status_code == 200
        g2 = requests.get(f"{BASE}/admin/payment-config", headers=admin_headers).json()
        assert g2.get("cashfree_secret_masked", "").endswith("EFG"), "empty secret_key should not clobber previous value"


# ---------- 6. Public payment-provider ----------
class TestPublicProvider:
    def test_provider_shape(self):
        r = requests.get(f"{BASE}/site/payment-provider")
        assert r.status_code == 200
        d = r.json()
        for k in ("provider", "cashfree_active", "cashfree_env"):
            assert k in d


# ---------- 7. Purchase kit content ----------
class TestPurchaseKit:
    def test_default_content(self):
        r = requests.get(f"{BASE}/site/purchase-kit-content")
        assert r.status_code == 200
        d = r.json()
        assert "hero_title" in d
        assert "hero_subtitle" in d
        assert "hero_image" in d
        assert isinstance(d.get("features"), list) and len(d["features"]) == 8
        assert isinstance(d.get("how_it_works"), list) and len(d["how_it_works"]) == 4

    def test_save_and_load(self, admin_headers):
        # Get current
        current = requests.get(f"{BASE}/site/purchase-kit-content").json()
        # Modify
        new = dict(current)
        new["hero_title"] = "ITER10 TEST TITLE"
        r = requests.post(f"{BASE}/admin/purchase-kit-content", json=new, headers=admin_headers)
        assert r.status_code == 200
        g = requests.get(f"{BASE}/site/purchase-kit-content").json()
        assert g["hero_title"] == "ITER10 TEST TITLE"
        # restore
        current_restore = dict(current)
        requests.post(f"{BASE}/admin/purchase-kit-content", json=current_restore, headers=admin_headers)
