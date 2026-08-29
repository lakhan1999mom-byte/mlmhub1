"""UroPay UPI Payment Gateway helper.

Docs: https://www.uropay.me/documentation

Auth:
  X-API-KEY: <key>
  Authorization: Bearer <sha512(secret)>
  Content-Type: application/json

Flow (self-serve QR + UTR):
  1. POST /order/generate      → { uroPayOrderId, qrCode (data URL), upiString, orderStatus }
  2. Customer pays via any UPI app (scans QR or opens the upi:// link)
  3. Customer enters the UTR (UPI reference number) on our checkout screen
  4. PATCH /order/update       → submits UTR → order moves to UTR_SUBMITTED
  5. UroPay companion app sees payment SMS → webhook + status becomes COMPLETED
  6. GET /order/status/:id      → polling fallback

Environment (TEST/LIVE) is controlled from the merchant's UroPay dashboard, NOT via API URL.
There is exactly one base URL.
"""
import os
import hashlib
from typing import Optional
import httpx

UROPAY_API_URL = os.environ.get("UROPAY_API_URL", "https://api.uropay.me").rstrip("/")


def _keys() -> tuple[str, str]:
    key = os.environ.get("UROPAY_API_KEY", "")
    secret = os.environ.get("UROPAY_API_SECRET", "")
    if not key or not secret:
        raise RuntimeError("UROPAY_API_KEY / UROPAY_API_SECRET not configured on server")
    return key, secret


def _headers(include_auth: bool = True) -> dict:
    key, secret = _keys()
    h = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": key,
    }
    if include_auth:
        h["Authorization"] = "Bearer " + hashlib.sha512(secret.encode("utf-8")).hexdigest()
    return h


def _unwrap(data: dict) -> dict:
    """UroPay wraps responses as {code, status, message, data:{...}}."""
    if not isinstance(data, dict):
        raise RuntimeError(f"UroPay: unexpected response: {data}")
    if str(data.get("status", "")).lower() != "success":
        msg = data.get("message") or data
        raise RuntimeError(f"UroPay: {msg}")
    return data.get("data") or {}


async def create_uropay_order(
    *,
    merchant_order_id: str,
    amount_rupees: float,
    customer_name: str,
    customer_email: str,
    transaction_note: Optional[str] = None,
) -> dict:
    """Create a UroPay order. `amount_rupees` in ₹ — will be converted to paise per docs.

    Returns: { uroPayOrderId, orderStatus, upiString, qrCode (data URL PNG), amountInRupees }.
    """
    amount_paise = int(round(float(amount_rupees) * 100))
    if amount_paise < 1:
        raise RuntimeError("Amount must be at least ₹0.01")
    body = {
        "amount": amount_paise,
        "merchantOrderId": merchant_order_id,
        "customerName": (customer_name or "Customer")[:80],
        "customerEmail": (customer_email or "noreply@evergroemart.com")[:120],
    }
    if transaction_note:
        body["transactionNote"] = transaction_note[:80]

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{UROPAY_API_URL}/order/generate", json=body, headers=_headers())
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f"UroPay: non-JSON response ({r.status_code}): {r.text[:200]}")
    return _unwrap(data)


async def submit_uropay_utr(*, uro_pay_order_id: str, reference_number: str) -> dict:
    """Submit the UPI reference number (UTR) provided by the paying customer.
    Returns: { uroPayOrderId, orderStatus }.
    """
    body = {"uroPayOrderId": uro_pay_order_id, "referenceNumber": reference_number.strip()}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.patch(f"{UROPAY_API_URL}/order/update", json=body, headers=_headers())
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f"UroPay: non-JSON response ({r.status_code}): {r.text[:200]}")
    return _unwrap(data)


async def get_uropay_status(uro_pay_order_id: str) -> dict:
    """Poll order status. Public endpoint — no Authorization header needed per docs.
    Returns: { uroPayOrderId, orderStatus }.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{UROPAY_API_URL}/order/status/{uro_pay_order_id}",
            headers=_headers(include_auth=False),
        )
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f"UroPay: non-JSON response ({r.status_code}): {r.text[:200]}")
    return _unwrap(data)


def verify_webhook_signature(payload: dict, signature: str) -> bool:
    """Validate the X-Uropay-Signature header per UroPay's spec.
    Payload key order matters — reconstruct per event type.
    """
    import hmac
    import json

    key, secret = _keys()
    del key
    hashed_secret = hashlib.sha512(secret.encode("utf-8")).hexdigest()

    event = (payload or {}).get("event", "")

    if event == "order.status.utrsubmitted":
        ordered = {
            "event": payload["event"],
            "uroPayOrderId": payload["uroPayOrderId"],
            "merchantOrderId": payload["merchantOrderId"],
            "orderStatus": payload["orderStatus"],
            "submittedUTR": payload.get("submittedUTR"),
            "amount": payload["amount"],
            "customerName": payload["customerName"],
            "customerEmail": payload["customerEmail"],
            "customerVPA": payload.get("customerVPA"),
            "environment": payload["environment"],
            "utrSubmittedAt": payload.get("utrSubmittedAt"),
        }
    elif "orderStatus" in (payload or {}):
        ordered = {
            "event": payload["event"],
            "uroPayOrderId": payload["uroPayOrderId"],
            "merchantOrderId": payload["merchantOrderId"],
            "orderStatus": payload["orderStatus"],
            "submittedUTR": payload.get("submittedUTR"),
            "environment": payload["environment"],
        }
    else:
        # Transaction/sms payload
        FIXED_TAIL = ["uroPayOrderId", "merchantOrderId", "detectedAt", "environment"]
        fixed_set = set(FIXED_TAIL + ["event"])
        ordered = {}
        if "event" in payload:
            ordered["event"] = payload["event"]
        middle = sorted(k for k in payload if k not in fixed_set)
        for k in middle:
            ordered[k] = payload[k]
        for k in FIXED_TAIL:
            ordered[k] = payload.get(k)

    body = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    computed = hmac.new(hashed_secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature or "")
