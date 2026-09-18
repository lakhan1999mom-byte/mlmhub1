"""Lightweight transactional SMS utility.

Right now this is a **MOCK** — it does NOT hit a real SMS gateway. Every message
is logged to the backend log AND persisted to the ``sms_log`` MongoDB collection
so the admin can inspect exactly what would have been sent.

To turn this into a real SMS pipeline later, plug in Twilio / MSG91 / TextLocal
credentials from environment variables and replace the ``_deliver`` function.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("evergro.sms")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _deliver(phone: str, message: str) -> dict:
    """Placeholder delivery. Returns the provider response dict.
    If ``SMS_PROVIDER=twilio`` env is set and creds are present, this would
    dispatch a real SMS; today it just logs and marks the record as MOCKED."""
    provider = (os.environ.get("SMS_PROVIDER") or "mock").strip().lower()
    # Real provider hook goes here (Twilio / MSG91 / TextLocal).
    logger.info("[SMS/%s → %s] %s", provider, phone, message)
    return {"provider": provider, "status": "mocked", "sent_at": _now_iso()}


async def send_sms(db, phone: str, message: str, *, purpose: str = "generic",
                   metadata: Optional[dict] = None) -> dict:
    """Send an SMS and persist a log row. Never raises — SMS failures should not
    break the flow that triggered them. Returns the log row (with ``id``)."""
    phone = (phone or "").strip()
    if not phone or not message:
        return {"ok": False, "reason": "missing_phone_or_message"}
    try:
        provider_resp = await _deliver(phone, message)
    except Exception as e:
        logger.exception("SMS delivery failed for %s: %s", phone, e)
        provider_resp = {"provider": "mock", "status": "error", "error": str(e)}
    row = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "message": message,
        "purpose": purpose,
        "metadata": metadata or {},
        "provider": provider_resp,
        "created_at": _now_iso(),
    }
    try:
        await db.sms_log.insert_one(dict(row))
    except Exception as e:
        logger.exception("Failed to log SMS: %s", e)
    row.pop("_id", None)
    return {"ok": provider_resp.get("status") != "error", **row}


def build_guest_order_sms(*, name: str, order_id: str, total: float,
                          product_name: str, eta_days: int = 5) -> str:
    """Compose the friendly SMS shown to a guest buyer.
    Format is deliberately short so it fits into a single SMS segment (160 chars)."""
    short = (order_id or "")[:8].upper()
    return (
        f"Hi {name.split()[0] if name else 'friend'}! Your EverGro eMart order #{short} "
        f"for {product_name[:24]} (₹{int(total)}) is confirmed. "
        f"Delivery in {eta_days} business days. Thank you!"
    )
