"""Easebuzz Payment Gateway helper — hash generation + initiate-link API."""
import hashlib
import os
import httpx

EASEBUZZ_KEY = os.environ.get("EASEBUZZ_MERCHANT_KEY", "")
EASEBUZZ_SALT = os.environ.get("EASEBUZZ_SALT", "")
EASEBUZZ_ENV = os.environ.get("EASEBUZZ_ENV", "prod")  # 'prod' or 'test'
BASE_URL = "https://pay.easebuzz.in" if EASEBUZZ_ENV == "prod" else "https://testpay.easebuzz.in"


def _sha512_lower(s: str) -> str:
    return hashlib.sha512(s.encode("utf-8")).hexdigest().lower()


def build_request_hash(txnid: str, amount: float, productinfo: str, firstname: str, email: str,
                       udf1: str = "", udf2: str = "", udf3: str = "", udf4: str = "", udf5: str = "") -> str:
    """Hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    NOTE: `amount` must already be formatted as `.2f` string.
    """
    amount_str = f"{amount:.2f}"
    seq = f"{EASEBUZZ_KEY}|{txnid}|{amount_str}|{productinfo}|{firstname}|{email}|{udf1}|{udf2}|{udf3}|{udf4}|{udf5}||||||{EASEBUZZ_SALT}"
    return _sha512_lower(seq)


def build_reverse_hash(status: str, txnid: str, amount: str, productinfo: str, firstname: str, email: str,
                       udf1: str = "", udf2: str = "", udf3: str = "", udf4: str = "", udf5: str = "") -> str:
    """Reverse hash sequence: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key"""
    seq = f"{EASEBUZZ_SALT}|{status}||||||{udf5}|{udf4}|{udf3}|{udf2}|{udf1}|{email}|{firstname}|{productinfo}|{amount}|{txnid}|{EASEBUZZ_KEY}"
    return _sha512_lower(seq)


async def initiate_payment(txnid: str, amount: float, productinfo: str, firstname: str, email: str,
                           phone: str, surl: str, furl: str,
                           udf1: str = "") -> dict:
    """Call Easebuzz `initiateLink` and return the response JSON (contains `access_key` on success)."""
    if not EASEBUZZ_KEY or not EASEBUZZ_SALT:
        raise RuntimeError("Easebuzz credentials not configured")
    amount_str = f"{amount:.2f}"
    payload = {
        "key": EASEBUZZ_KEY,
        "txnid": txnid,
        "amount": amount_str,
        "productinfo": productinfo,
        "firstname": firstname,
        "phone": phone,
        "email": email,
        "surl": surl,
        "furl": furl,
        "hash": build_request_hash(txnid, amount, productinfo, firstname, email, udf1),
        "udf1": udf1, "udf2": "", "udf3": "", "udf4": "", "udf5": "",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{BASE_URL}/payment/initiateLink", data=payload,
                              headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        return r.json()
    except Exception:
        return {"status": 0, "data": r.text}
