"""IMBPay v2 Payment Gateway helper.

Docs: https://developer.imb.org.in/Docs/index (also at gosmartpay/npayseva — same schema).

Auth: single API token passed as `user_token` in the form body.
Base URL: https://api.imbpay.in (production only — no sandbox exposed on this endpoint).

Endpoints used:
  POST /v2/create-order         → returns { status, order_id, payment_url, ...intent links }
  POST /v2/check-order-status   → returns { status, result: { status: 'SUCCESS'|'PENDING'|'FAILED', ... } }
"""
import os
import httpx
from typing import Optional

IMBPAY_BASE_URL = os.environ.get("IMBPAY_BASE_URL", "https://api.imbpay.in").rstrip("/")
IMBPAY_TOKEN = os.environ.get("IMBPAY_TOKEN", "")


def _token() -> str:
    if not IMBPAY_TOKEN:
        raise RuntimeError("IMBPAY_TOKEN not configured on server")
    return IMBPAY_TOKEN


async def create_imbpay_order(
    *,
    order_id: str,
    amount: float,
    customer_mobile: str,
    redirect_url: str,
    remark1: Optional[str] = None,
    remark2: Optional[str] = None,
) -> dict:
    """Create an IMBPay v2 order. Returns the raw response so caller can persist the
    payment_url + intent deep-links.

    Amount is rounded to 2 decimals; IMBPay's minimum is ₹1.
    """
    if float(amount) < 1:
        raise RuntimeError("IMBPay minimum order amount is ₹1")

    form = {
        "customer_mobile": (customer_mobile or "9999999999")[-10:],
        "user_token": _token(),
        "amount": f"{float(amount):.2f}",
        "order_id": order_id,
        "redirect_url": redirect_url,
    }
    if remark1:
        form["remark1"] = remark1[:120]
    if remark2:
        form["remark2"] = remark2[:120]

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{IMBPAY_BASE_URL}/v2/create-order",
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f"IMBPay: non-JSON response ({r.status_code}): {r.text[:200]}")

    ok = (data.get("status") in (True, "success", "SUCCESS", 1)) and (data.get("payment_url") or (data.get("result") or {}).get("payment_url"))
    if not ok:
        msg = data.get("message") or data.get("msg") or data
        raise RuntimeError(f"IMBPay create-order failed: {msg}")

    result = data.get("result") or data
    return {
        "payment_url": result.get("payment_url"),
        "order_id": result.get("order_id") or result.get("orderId") or order_id,
        "paytm_link": result.get("paytm_link"),
        "phonepe_link": result.get("phonepe_link"),
        "bhim_link": result.get("bhim_link"),
        "raw": data,
    }


async def check_imbpay_order_status(order_id: str) -> dict:
    """Verify order payment status. Returns dict with `paid: bool`, `status: str`, `raw`."""
    form = {"user_token": _token(), "order_id": order_id}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{IMBPAY_BASE_URL}/v2/check-order-status",
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f"IMBPay: non-JSON response ({r.status_code}): {r.text[:200]}")

    result = data.get("result") or data
    # Different gateways expose status under different keys — normalise
    status_raw = (
        result.get("txnStatus")
        or result.get("status")
        or data.get("status")
        or ""
    )
    status = str(status_raw).upper()
    paid = status in ("SUCCESS", "PAID", "COMPLETED", "TXN_SUCCESS")
    return {"paid": paid, "status": status, "raw": data}
