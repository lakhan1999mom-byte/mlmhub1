"""Cashfree Payment Gateway helper. Reads config from MongoDB `settings` collection so admin
can activate the gateway without a redeploy.

Setting doc shape (in db.settings, _key='payment_config'):
{
  "provider": "cashfree" | "easebuzz",
  "cashfree_app_id": "...",
  "cashfree_secret_key": "...",
  "cashfree_env": "prod" | "sandbox",
  "cashfree_active": true
}
"""
import httpx
from datetime import datetime, timezone


def cashfree_base(env: str) -> str:
    return "https://api.cashfree.com/pg" if env == "prod" else "https://sandbox.cashfree.com/pg"


async def get_payment_config(db) -> dict:
    doc = await db.settings.find_one({"_key": "payment_config"}, {"_id": 0}) or {}
    return doc


async def create_cashfree_order(db, order_id: str, amount: float, customer: dict, return_url: str) -> dict:
    """Create a Cashfree order and return the payment_session_id (used by client SDK)."""
    cfg = await get_payment_config(db)
    if cfg.get("provider") != "cashfree" or not cfg.get("cashfree_active"):
        raise RuntimeError("Cashfree is not the active payment provider")
    app_id = cfg.get("cashfree_app_id")
    secret = cfg.get("cashfree_secret_key")
    env = cfg.get("cashfree_env", "sandbox")
    if not app_id or not secret:
        raise RuntimeError("Cashfree credentials missing")

    payload = {
        "order_id": order_id,
        "order_amount": round(float(amount), 2),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": customer.get("id", "guest"),
            "customer_name": customer.get("name") or "Customer",
            "customer_email": customer.get("email") or "noreply@evergroemart.com",
            "customer_phone": (customer.get("phone") or "9999999999")[-10:],
        },
        "order_meta": {
            "return_url": return_url,
        },
        "order_note": "EverGro eMart order",
    }
    headers = {
        "x-api-version": "2023-08-01",
        "x-client-id": app_id,
        "x-client-secret": secret,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{cashfree_base(env)}/orders", json=payload, headers=headers)
    data = r.json()
    if r.status_code >= 400 or "payment_session_id" not in data:
        raise RuntimeError(f"Cashfree order create failed: {data}")
    return {
        "payment_session_id": data["payment_session_id"],
        "cf_order_id": data.get("cf_order_id"),
        "order_status": data.get("order_status"),
        "env": env,
        "app_id": app_id,
    }


async def verify_cashfree_order(db, order_id: str) -> dict:
    """Query Cashfree to verify order status. Returns dict with `paid: bool`."""
    cfg = await get_payment_config(db)
    if cfg.get("provider") != "cashfree":
        raise RuntimeError("Cashfree not active")
    app_id = cfg.get("cashfree_app_id")
    secret = cfg.get("cashfree_secret_key")
    env = cfg.get("cashfree_env", "sandbox")
    headers = {
        "x-api-version": "2023-08-01",
        "x-client-id": app_id,
        "x-client-secret": secret,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{cashfree_base(env)}/orders/{order_id}", headers=headers)
    data = r.json()
    status = data.get("order_status", "").upper()
    return {"paid": status == "PAID", "order_status": status, "raw": data}
