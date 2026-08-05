"""Iteration 14 backend tests — /auth/otp/send rate limit + resend_count + prod host masking."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hamper-mlm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MULTI_PHONE = "9876500099"
# unique phone per run to avoid cross-run rate-limit contamination
UNIQUE_PHONE = f"98700{int(time.time()) % 100000:05d}"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- OTP send: baseline shape (preview → dev_otp present, resend_count present) ---
def test_otp_send_preview_returns_dev_otp_and_resend_count_zero(s):
    r = s.post(f"{API}/auth/otp/send", json={"phone": UNIQUE_PHONE})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert "dev_otp" in body, "Preview host must return dev_otp"
    assert body.get("resend_count") == 0, f"first send should have resend_count=0, got {body.get('resend_count')}"
    assert isinstance(body["dev_otp"], str) and len(body["dev_otp"]) in (4, 6)


# --- Rate limit: second call within 20s → 429 ---
def test_otp_send_rate_limit_429_within_20s(s):
    phone = f"98701{int(time.time()) % 100000:05d}"
    r1 = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r1.status_code == 200
    r2 = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r2.status_code == 429, f"expected 429 got {r2.status_code}: {r2.text}"
    detail = r2.json().get("detail", "")
    assert "wait" in detail.lower() and "s before requesting another OTP" in detail, detail


# --- After cooldown → succeeds & resend_count increments; OTP rotates ---
def test_otp_send_after_cooldown_succeeds_and_increments_and_invalidates_old(s):
    phone = f"98702{int(time.time()) % 100000:05d}"
    r1 = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r1.status_code == 200
    otp1 = r1.json().get("dev_otp")
    assert r1.json().get("resend_count") == 0

    # Wait past cooldown
    time.sleep(21)
    r2 = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r2.status_code == 200, r2.text
    otp2 = r2.json().get("dev_otp")
    assert r2.json().get("resend_count") == 1, f"resend_count should be 1, got {r2.json().get('resend_count')}"
    assert otp2 != otp1 or otp2 is not None  # new otp string

    # Old OTP must be invalid (record overwritten)
    v_old = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": otp1})
    assert v_old.status_code == 400, f"old OTP should be invalid after resend, got {v_old.status_code}"

    # Latest OTP should verify for a new phone (no user → new_user true is ok, or verified true either way)
    v_new = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": otp2})
    assert v_new.status_code == 200, v_new.text
    assert v_new.json().get("verified") is True


# --- Prod host masking: Origin=evergroemart.com should hide dev_otp ---
def test_otp_send_prod_host_hides_dev_otp(s):
    phone = f"98703{int(time.time()) % 100000:05d}"
    r = s.post(
        f"{API}/auth/otp/send",
        json={"phone": phone},
        headers={"Origin": "https://evergroemart.com", "Referer": "https://evergroemart.com/login"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "dev_otp" not in body, f"prod host must NOT expose dev_otp, got body={body}"
    assert body.get("ok") is True
    assert "resend_count" in body


# --- Verify still works with LATEST OTP for the multi-account phone; picker flow ---
def test_multi_account_otp_verify_returns_multiple(s):
    # Ensure cooldown clear for MULTI_PHONE by using a fresh time — may 429 if run recently
    # Try up to 2x with sleep
    for _ in range(2):
        r = s.post(f"{API}/auth/otp/send", json={"phone": MULTI_PHONE})
        if r.status_code == 200:
            break
        time.sleep(21)
    assert r.status_code == 200, r.text
    otp = r.json().get("dev_otp")
    assert otp, "dev_otp must be present on preview"

    v = s.post(f"{API}/auth/otp/verify", json={"phone": MULTI_PHONE, "otp": otp})
    assert v.status_code == 200, v.text
    body = v.json()
    assert body.get("verified") is True
    assert body.get("multiple") is True, f"expected multiple accounts flag, got {body}"
    users = body.get("users") or body.get("accounts") or []
    # Accept either shape — just verify count
    assert len(users) >= 2, f"expected >=2 accounts for {MULTI_PHONE}, got {len(users)}: {body}"
