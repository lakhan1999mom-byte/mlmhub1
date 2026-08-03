"""EverGro eMart — main FastAPI server."""
import os
import time
import uuid
import logging
import random
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

import cloudinary
import cloudinary.utils
import cloudinary.uploader

from models import (
    UserCreate, UserLogin, OTPSendReq, OTPVerifyReq, ForgotPwReq,
    ProductCreate, OrderCreate, CartAdd, PaymentVerify, WithdrawalReq, KYCSubmit
)
from auth_utils import hash_password, verify_password, create_token, get_current_user
from mlm_engine import (
    process_paid_joining, get_downline_tree,
    MAX_LEVELS, MAX_DIRECT_REFERRALS, MIN_DIRECT_PAID_FOR_INCOME,
    LEVEL_COMMISSIONS, JOINING_AMOUNT,
)
from seed import seed_all

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----- Logging -----
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("evergro")

# ----- DB -----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ----- Cloudinary -----
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.environ.get("CLOUDINARY_API_KEY", ""),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET", ""),
    secure=True,
)

app = FastAPI(title="EverGro eMart API")
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_referral_code(name: str) -> str:
    base = "".join(c for c in name.upper() if c.isalnum())[:4] or "USER"
    return f"{base}{random.randint(1000, 9999)}"


def gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def gen_order_code() -> str:
    return f"ORD{int(time.time())}{random.randint(100, 999)}"


def gen_withdrawal_code() -> str:
    return f"WD{int(time.time())}{random.randint(100, 999)}"


def gen_ticket_code() -> str:
    return f"TKT{int(time.time())}{random.randint(100, 999)}"


def public_user(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "user_code": u.get("user_code"),
        "username": u.get("username"),
        "name": u.get("name"),
        "email": u.get("public_email") or u.get("email"),  # display the user-facing email
        "phone": u.get("phone"),
        "role": u.get("role"),
        "sponsor_id": u.get("sponsor_id"),
        "referral_code": u.get("referral_code"),
        "current_stage": u.get("current_stage", 1),
        "direct_referrals_count": u.get("direct_referrals_count", 0),
        "team_size": u.get("team_size", 0),
        "wallet_balance": u.get("wallet_balance", 0),
        "income_wallet": u.get("income_wallet", 0),
        "commission_wallet": u.get("commission_wallet", 0),
        "cashback_wallet": u.get("cashback_wallet", 0),
        "reward_wallet": u.get("reward_wallet", 0),
        "total_earnings": u.get("total_earnings", 0),
        "kyc_status": u.get("kyc_status", "pending"),
        "avatar_url": u.get("avatar_url"),
        "is_active": u.get("is_active", True),
        "permissions": u.get("permissions", []),
        "cycle_count": u.get("cycle_count", 0),
        "is_joining_paid": u.get("is_joining_paid", False),
        "income_active": u.get("income_active", False),
        "joining_paid_at": u.get("joining_paid_at"),
        "income_activated_at": u.get("income_activated_at"),
    }


async def get_user(payload=Depends(get_current_user)) -> dict:
    u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=401, detail="User not found")
    return u


async def require_admin(user=Depends(get_user)) -> dict:
    if user["role"] not in ("super_admin", "sub_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def require_super_admin(user=Depends(get_user)) -> dict:
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    return user


# ==================== AUTH ====================
MAX_REFERRALS_PER_LAYER = MAX_DIRECT_REFERRALS
INACTIVITY_DAYS = 180
MIN_REFERRALS_FOR_WITHDRAWAL = MIN_DIRECT_PAID_FOR_INCOME


async def log_audit(event: str, actor: Optional[dict] = None, target_id: Optional[str] = None,
                    target_label: Optional[str] = None, metadata: Optional[dict] = None,
                    ip: Optional[str] = None):
    """Insert audit log entry."""
    try:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "actor_id": actor.get("id") if actor else None,
            "actor_code": actor.get("user_code") if actor else None,
            "actor_role": actor.get("role") if actor else None,
            "event": event,
            "target_id": target_id,
            "target_label": target_label,
            "metadata": metadata or {},
            "ip": ip,
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.warning(f"audit log failed: {e}")


@api.post("/auth/register")
async def register(payload: UserCreate, request: Request = None):
    """Phase 2: Register creates a PENDING user. Account is fully activated only after
    the joining hamper payment (₹7,499) is verified. Until then:
    - is_joining_paid = False
    - referral counts on sponsor NOT incremented
    - no commissions distributed
    - user can login and see the "Pay to activate" screen only
    """
    # T&C mandatory
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Terms & Conditions")

    # Username handling (Instagram-style unique handle)
    username = None
    if getattr(payload, "username", None):
        username = str(payload.username).strip().lower()
        if len(username) < 3 or len(username) > 30:
            raise HTTPException(status_code=400, detail="Username must be 3-30 characters")
        if not all(c.isalnum() or c in "._-" for c in username):
            raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, . _ -")
        if await db.users.find_one({"username": username}, {"_id": 1}):
            raise HTTPException(status_code=400, detail="Username already taken")

    # Email — allow re-use of same email under new username by internal-suffixing
    original_email = payload.email
    email_to_store = original_email
    existing_email = await db.users.find_one({"email": email_to_store})
    if existing_email:
        # If no username provided, block (backwards-compatible for old flows).
        if not username:
            raise HTTPException(status_code=400, detail="Email already registered. Choose a username to create an additional account.")
        # Internal suffix keeps the login identifier unique in DB while user sees original email
        local, _, domain = original_email.partition("@")
        suffix_seq = 2
        while True:
            candidate = f"{local}+re{suffix_seq}@{domain}"
            if not await db.users.find_one({"email": candidate}, {"_id": 1}):
                email_to_store = candidate
                break
            suffix_seq += 1

    sponsor = None
    if payload.referral_code:
        sponsor = await db.users.find_one({"referral_code": payload.referral_code}, {"_id": 0})
        if not sponsor:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        if sponsor.get("direct_referrals_count", 0) >= MAX_REFERRALS_PER_LAYER:
            raise HTTPException(
                status_code=400,
                detail=f"This sponsor is full ({MAX_REFERRALS_PER_LAYER} direct referrals max). Try a different referral code.",
            )

    user_count = await db.users.count_documents({})
    # Use atomic counter to avoid duplicate user_code under concurrency or after deletions
    counter = await db.counters.find_one_and_update(
        {"_id": "user_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter.get("seq", user_count + 1)
    # ensure at least 'user_count+1' to keep monotonic if counter is new
    if seq < user_count + 1:
        counter = await db.counters.find_one_and_update(
            {"_id": "user_code"},
            {"$set": {"seq": user_count + 1}},
            return_document=True,
        )
        seq = counter["seq"]
    user_code = f"EG{str(seq).zfill(6)}"
    # Retry if collision (defensive)
    while await db.users.find_one({"user_code": user_code}):
        counter = await db.counters.find_one_and_update(
            {"_id": "user_code"}, {"$inc": {"seq": 1}}, return_document=True,
        )
        user_code = f"EG{str(counter['seq']).zfill(6)}"
    referral_code = gen_referral_code(payload.name)
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = gen_referral_code(payload.name)

    user_doc = {
        "id": str(uuid.uuid4()),
        "user_code": user_code,
        "username": username,
        "public_email": original_email,  # what the user sees / logs in with (unique in real usage)
        "name": payload.name,
        "email": email_to_store,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "user",
        "sponsor_id": sponsor["user_code"] if sponsor else None,
        "sponsor_user_id": sponsor["id"] if sponsor else None,
        "referral_code": referral_code,
        "current_stage": 1,
        # joined_at_stage stores the sponsor's CURRENT stage at the time of joining.
        # This drives stage progression in mlm_engine.process_stage_progression.
        "joined_at_stage": sponsor.get("current_stage", 1) if sponsor else 1,
        "direct_referrals_count": 0,
        "team_size": 0,
        "wallet_balance": 0,
        "income_wallet": 0,
        "commission_wallet": 0,
        "cashback_wallet": 0,
        "reward_wallet": 0,
        "total_earnings": 0,
        "kyc_status": "not_submitted",
        "avatar_url": None,
        "is_active": True,
        "is_joining_paid": False,
        "income_active": False,
        "permissions": [],
        "cycle_count": 0,
        "last_activity_at": now_iso(),
        "terms_accepted_at": now_iso(),
        "terms_ip": request.client.host if request and request.client else None,
        "terms_version": "1.0",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    await log_audit("register", actor=user_doc, target_id=user_doc["id"], target_label=user_doc["user_code"],
                    metadata={"sponsor_code": sponsor["user_code"] if sponsor else None, "paid": False})

    # NOTE: Sponsor's direct_referrals_count is NOT incremented on registration.
    # It is only incremented when the user's ₹7,499 joining payment is verified.

    # Welcome / activation notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_doc["id"],
        "title": "👋 Welcome — one step left!",
        "body": f"Your account {user_code} is created. Pay ₹{int(JOINING_AMOUNT)} for the EverGro Joining Kit to activate your MLM benefits.",
        "type": "info",
        "event": "registration",
        "read": False,
        "created_at": now_iso(),
    })

    token = create_token(user_doc["id"], user_doc["role"])
    return {"token": token, "user": public_user(user_doc)}


@api.post("/auth/login")
async def login(payload: UserLogin):
    """Login by email, phone, or username. All 3 accepted in `identifier` field."""
    ident = payload.identifier.strip()
    if "@" in ident:
        # Email — could be the user's original email OR the internal +reN suffixed value
        user = await db.users.find_one(
            {"$or": [{"email": ident}, {"public_email": ident}]},
            {"_id": 0},
        )
        # If phone has multiple users with same public_email, need password match
        if user and not verify_password(payload.password, user.get("password_hash", "")):
            # Try other candidates on that public_email
            candidates = await db.users.find({"public_email": ident}, {"_id": 0}).to_list(20)
            user = next((c for c in candidates if verify_password(payload.password, c.get("password_hash", ""))), None)
    elif ident.replace("+", "").replace("-", "").isdigit():
        # phone-based login — find an account whose password matches
        candidates = await db.users.find({"phone": ident}, {"_id": 0}).to_list(20)
        user = next((c for c in candidates if verify_password(payload.password, c.get("password_hash", ""))), None)
    else:
        # username-based login
        user = await db.users.find_one({"username": ident.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    # 180-day inactivity check
    last = user.get("last_activity_at") or user.get("created_at")
    if last:
        try:
            from datetime import timedelta
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - last_dt > timedelta(days=INACTIVITY_DAYS):
                await db.users.update_one({"id": user["id"]}, {"$set": {"is_active": False}})
                raise HTTPException(status_code=403, detail=f"Account inactive for {INACTIVITY_DAYS}+ days. Contact support.")
        except HTTPException:
            raise
        except Exception:
            pass
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity_at": now_iso()}})
    token = create_token(user["id"], user["role"])
    await log_audit("login", actor=user, metadata={"method": "password"})
    return {"token": token, "user": public_user(user)}


@api.get("/auth/accounts-by-phone")
async def accounts_by_phone(phone: str):
    """Return list of accounts for a phone — used by multi-account picker."""
    items = await db.users.find({"phone": phone}, {"_id": 0, "password_hash": 0}).to_list(20)
    return [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "role": u.get("role", "user")} for u in items]


@api.post("/auth/login-with-code")
async def login_with_code(payload: dict):
    user_code = payload.get("user_code")
    password = payload.get("password")
    if not user_code or not password:
        raise HTTPException(status_code=400, detail="user_code and password required")
    user = await db.users.find_one({"user_code": user_code}, {"_id": 0})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity_at": now_iso()}})
    token = create_token(user["id"], user["role"])
    await log_audit("login", actor=user, metadata={"method": "user_code"})
    return {"token": token, "user": public_user(user)}


@api.get("/auth/phone-status")
async def phone_status(phone: str):
    """Public endpoint — check if a phone already has account(s) on it.
    Used by Join Now to offer 'Login vs Re-entry' choice before sending OTP.
    Returns count only (no PII)."""
    if not phone or len(phone) < 6:
        return {"exists": False, "count": 0}
    n = await db.users.count_documents({"phone": phone})
    return {"exists": n > 0, "count": n}


@api.post("/auth/otp/send")
async def send_otp(payload: OTPSendReq, request: Request):
    otp = gen_otp()
    expires = int(time.time()) + 300  # 5 min
    await db.otps.update_one(
        {"phone": payload.phone},
        {"$set": {"phone": payload.phone, "otp": otp, "expires_at": expires, "verified": False, "created_at": now_iso()}},
        upsert=True,
    )
    logger.info(f"[DEV-OTP] phone={payload.phone} otp={otp}")
    # Only expose OTP in response on non-production hosts (preview / localhost).
    # On production, Firebase Phone Auth sends real SMS from the client. Backend fallback
    # keeps a record for verification but does NOT leak the OTP in the response.
    prod_hosts = (os.environ.get("PROD_HOSTS", "evergroemart.com,www.evergroemart.com")).split(",")
    host = (request.headers.get("host") or "").split(":")[0].lower()
    origin = (request.headers.get("origin") or "").lower()
    fwd_host = (request.headers.get("x-forwarded-host") or "").split(":")[0].lower()
    referer = (request.headers.get("referer") or "").lower()
    is_prod = any(
        ph.strip() and (ph.strip() in host or ph.strip() in origin or ph.strip() in fwd_host or ph.strip() in referer)
        for ph in prod_hosts
    )
    if is_prod:
        return {"ok": True, "message": "OTP sent successfully"}
    return {"ok": True, "message": "OTP sent successfully", "dev_otp": otp}


@api.post("/auth/otp/verify")
async def verify_otp(payload: OTPVerifyReq):
    rec = await db.otps.find_one({"phone": payload.phone})
    if not rec or rec.get("otp") != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if rec.get("expires_at", 0) < int(time.time()):
        raise HTTPException(status_code=400, detail="OTP expired")
    await db.otps.update_one({"phone": payload.phone}, {"$set": {"verified": True}})

    # Phone can have multiple accounts. Return list if >1.
    users = await db.users.find({"phone": payload.phone}, {"_id": 0}).to_list(20)
    if len(users) == 0:
        return {"verified": True, "new_user": True}
    if len(users) == 1:
        user = users[0]
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account disabled")
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity_at": now_iso()}})
        token = create_token(user["id"], user["role"])
        await log_audit("login", actor=user, metadata={"method": "otp"})
        return {"verified": True, "token": token, "user": public_user(user), "new_user": False, "multiple": False}
    # Multiple accounts — return list for picker
    accounts = [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "username": u.get("username"), "id": u["id"], "role": u.get("role", "user"), "is_joining_paid": u.get("is_joining_paid", False)} for u in users]
    return {"verified": True, "new_user": False, "multiple": True, "accounts": accounts}


@api.post("/auth/otp/pick-account")
async def otp_pick_account(payload: dict):
    """After OTP verify with multiple accounts, user picks one to log into."""
    phone = payload.get("phone")
    user_code = payload.get("user_code")
    rec = await db.otps.find_one({"phone": phone})
    if not rec or not rec.get("verified"):
        raise HTTPException(status_code=400, detail="OTP not verified")
    user = await db.users.find_one({"phone": phone, "user_code": user_code}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity_at": now_iso()}})
    token = create_token(user["id"], user["role"])
    await log_audit("login", actor=user, metadata={"method": "otp_picker"})
    return {"token": token, "user": public_user(user)}


@api.post("/auth/forgot-password/lookup")
async def forgot_password_lookup(payload: dict):
    """After OTP is verified, list all accounts on that phone so the user can pick
    which one to reset. Requires a verified OTP row for the phone."""
    phone = payload.get("phone")
    otp = payload.get("otp")
    rec = await db.otps.find_one({"phone": phone})
    if not rec or rec.get("otp") != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if rec.get("expires_at", 0) < int(time.time()):
        raise HTTPException(status_code=400, detail="OTP expired")
    users = await db.users.find({"phone": phone}, {"_id": 0}).to_list(20)
    if not users:
        raise HTTPException(status_code=404, detail="No account on this number")
    return {
        "accounts": [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "username": u.get("username")} for u in users],
        "single": len(users) == 1,
    }


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPwReq):
    rec = await db.otps.find_one({"phone": payload.phone})
    if not rec or rec.get("otp") != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    users = await db.users.find({"phone": payload.phone}, {"_id": 0}).to_list(20)
    if not users:
        raise HTTPException(status_code=404, detail="No account on this number")
    if len(users) > 1 and not payload.user_code:
        # Force the client to select which account to reset
        accounts = [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "username": u.get("username")} for u in users]
        return {"multiple": True, "accounts": accounts}
    target = users[0] if len(users) == 1 else next((u for u in users if u["user_code"] == payload.user_code), None)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found on this number")
    await db.users.update_one(
        {"id": target["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": now_iso()}}
    )
    # Invalidate OTP so it can't be reused to reset another account
    await db.otps.delete_one({"phone": payload.phone})
    return {"ok": True, "user_code": target["user_code"]}


# ==================== FIREBASE PHONE AUTH ====================
@api.post("/auth/firebase-verify")
async def firebase_verify(payload: dict):
    """Verify a Firebase ID token (from client-side signInWithPhoneNumber) and log the user in.
    Body: {"id_token": "...", "user_code": "EG000123" (optional — if phone has multiple accounts)}
    """
    from firebase_utils import verify_id_token as _verify_fb

    id_token = payload.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="id_token required")
    try:
        decoded = _verify_fb(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Firebase token verification failed: {e}")

    phone_number = decoded.get("phone_number")  # e.g. "+919999999999"
    if not phone_number:
        raise HTTPException(status_code=400, detail="Firebase token missing phone_number")
    # Strip leading '+' + country code (assume India +91)
    normalized = phone_number.lstrip("+")
    if normalized.startswith("91") and len(normalized) == 12:
        normalized = normalized[2:]
    # Find matching accounts on that phone
    accounts = await db.users.find({"phone": normalized}, {"_id": 0}).to_list(20)
    if not accounts:
        # No account — return "needs registration" flag with the verified phone
        return {"verified": True, "phone": normalized, "accounts": [], "needs_registration": True}
    if len(accounts) == 1 or payload.get("user_code"):
        acc = None
        if payload.get("user_code"):
            acc = next((a for a in accounts if a["user_code"] == payload["user_code"]), None)
            if not acc:
                raise HTTPException(status_code=404, detail="Account not found")
        else:
            acc = accounts[0]
        if not acc.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account disabled")
        await db.users.update_one({"id": acc["id"]}, {"$set": {"last_activity_at": now_iso()}})
        token = create_token(acc["id"], acc["role"])
        await log_audit("login", actor=acc, metadata={"method": "firebase_otp"})
        return {"verified": True, "phone": normalized, "token": token, "user": public_user(acc)}
    # Multiple accounts — return picker
    return {
        "verified": True,
        "phone": normalized,
        "multiple": True,
        "accounts": [
            {"user_code": a["user_code"], "name": a["name"], "email": a["email"], "username": a.get("username"), "id": a["id"], "role": a["role"], "is_joining_paid": a.get("is_joining_paid", False)}
            for a in accounts
        ],
    }


# ==================== (Easebuzz removed — Cashfree only) ====================


# ==================== MLM RE-ENTRY (Second Position) ====================
@api.post("/mlm/re-entry")
async def mlm_re_entry(payload: dict, user=Depends(get_user)):
    """Existing paid member creates a NEW MLM position (fresh referral code) under a DIFFERENT sponsor.
    Cannot use the same sponsor as any of their existing positions. Kit purchase (₹7,499) required next.
    Body: {"referral_code": "SPNSR001"}
    """
    if not user.get("is_joining_paid"):
        raise HTTPException(status_code=400, detail="Only paid members can create a re-entry position")

    referral_code = (payload.get("referral_code") or "").strip().upper()
    if not referral_code:
        raise HTTPException(status_code=400, detail="referral_code required")

    sponsor = await db.users.find_one({"referral_code": referral_code}, {"_id": 0})
    if not sponsor:
        raise HTTPException(status_code=400, detail="Invalid referral code")
    if sponsor.get("direct_referrals_count", 0) >= MAX_REFERRALS_PER_LAYER:
        raise HTTPException(status_code=400, detail=f"This sponsor is full ({MAX_REFERRALS_PER_LAYER} max direct refs).")
    if sponsor["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot sponsor your own re-entry position")

    # Check the user doesn't already have a position under this sponsor (by phone + sponsor)
    existing = await db.users.find_one({"phone": user["phone"], "sponsor_user_id": sponsor["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a position under this sponsor")

    # Allocate new user_code
    counter = await db.counters.find_one_and_update(
        {"_id": "user_code"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True,
    )
    seq = counter.get("seq") or ((await db.users.count_documents({})) + 1)
    new_user_code = f"EG{seq:06d}"
    new_ref_code = f"{new_user_code[-6:]}{str(uuid.uuid4())[:2].upper()}"
    new_id = str(uuid.uuid4())

    # Create the new re-entry account, linked to the same person
    new_doc = {
        "id": new_id,
        "user_code": new_user_code,
        "referral_code": new_ref_code,
        "name": user["name"] + " (Position 2)" if "Position" not in user.get("name", "") else user["name"],
        "email": f"{user['email'].split('@')[0]}+re{seq}@{user['email'].split('@')[1]}",
        "phone": user["phone"],
        "password_hash": user["password_hash"],  # same password as original
        "role": "user",
        "sponsor_user_id": sponsor["id"],
        "sponsor_referral_code": referral_code,
        "parent_user_id": sponsor["id"],
        "depth_from_root": 0,
        "current_stage": 1,
        "joined_at_stage": 1,
        "direct_referrals_count": 0,
        "wallet_balance": 0.0,
        "cashback_wallet": 0.0,
        "total_earnings": 0.0,
        "is_active": True,
        "is_joining_paid": False,
        "income_active": False,
        "accepted_tc": True,
        "is_re_entry": True,
        "original_user_id": user["id"],  # points to primary account
        "created_at": now_iso(),
        "last_activity_at": now_iso(),
    }
    await db.users.insert_one(new_doc)
    await log_audit("mlm_re_entry", actor=user, target_id=new_id,
                    metadata={"new_user_code": new_user_code, "sponsor_code": referral_code})
    # Return a login token for the new position so the frontend can immediately go pay
    token = create_token(new_id, "user")
    return {"ok": True, "new_position": public_user(new_doc), "token": token}


@api.get("/mlm/my-positions")
async def my_positions(user=Depends(get_user)):
    """Return all positions belonging to this phone number (primary + all re-entries)."""
    accts = await db.users.find(
        {"phone": user["phone"]},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", 1).to_list(50)
    return {"positions": [public_user(a) for a in accts]}


@api.get("/auth/me")
async def me(user=Depends(get_user)):
    # Track activity on every dashboard load
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity_at": now_iso()}})
    return public_user(user)


# ==================== USERS / DASHBOARD ====================
@api.get("/users/dashboard")
async def user_dashboard(user=Depends(get_user)):
    orders_count = await db.orders.count_documents({"user_id": user["id"]})
    pending_withdrawals = await db.withdrawals.count_documents({"user_id": user["id"], "status": "pending"})
    unread_notifications = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    # commissions at current stage
    cur_stage = user.get("current_stage", 1)
    direct_at_stage = await db.users.count_documents({"sponsor_user_id": user["id"], "joined_at_stage": cur_stage})
    # Correct stage commission from plan: LEVEL_COMMISSIONS is L1..L8 → stage N pays L{N}
    stage_commission = LEVEL_COMMISSIONS[cur_stage - 1] if 1 <= cur_stage <= len(LEVEL_COMMISSIONS) else 0
    return {
        "user": public_user(user),
        "stats": {
            "orders_count": orders_count,
            "pending_withdrawals": pending_withdrawals,
            "unread_notifications": unread_notifications,
            "stage_progress": direct_at_stage,
            "stage_required": 3,
            "current_stage_commission": stage_commission,
            "level_commissions": LEVEL_COMMISSIONS,
        },
    }


@api.get("/users/network-tree")
async def network_tree(user=Depends(get_user), depth: int = 5):
    tree = await get_downline_tree(db, user["id"], max_depth=depth)
    return tree


@api.get("/users/downline")
async def downline_list(user=Depends(get_user), page: int = 1, limit: int = 50):
    skip = (page - 1) * limit
    cursor = db.users.find({"sponsor_user_id": user["id"]}, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit)
    items = [public_user(u) async for u in cursor]
    total = await db.users.count_documents({"sponsor_user_id": user["id"]})
    return {"items": items, "total": total}


@api.put("/users/profile")
async def update_profile(payload: dict, user=Depends(get_user)):
    allowed = {"name", "avatar_url"}
    update = {k: v for k, v in payload.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    new_u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(new_u)


# ==================== PRODUCTS ====================
@api.get("/products")
async def list_products(category: Optional[str] = None, is_hamper: Optional[bool] = None, q: Optional[str] = None):
    query = {"is_active": True}
    if category:
        query["category"] = category
    if is_hamper is not None:
        query["is_hamper"] = is_hamper
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    items = await db.products.find(query, {"_id": 0}).to_list(500)
    return items


@api.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(50)
    p["reviews"] = reviews
    return p


@api.post("/products/{product_id}/reviews")
async def add_review(product_id: str, payload: dict, user=Depends(get_user)):
    rev = {
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "rating": int(payload.get("rating", 5)),
        "comment": payload.get("comment", ""),
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(rev)
    # update avg
    all_revs = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(1000)
    avg = sum(r["rating"] for r in all_revs) / len(all_revs)
    await db.products.update_one({"id": product_id}, {"$set": {"rating": round(avg, 1), "review_count": len(all_revs)}})
    return rev


# ==================== CART ====================
@api.get("/cart")
async def get_cart(user=Depends(get_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        return {"items": [], "subtotal": 0}
    detailed = []
    subtotal = 0
    for it in cart.get("items", []):
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if p:
            line = p["price"] * it["quantity"]
            subtotal += line
            detailed.append({"product": p, "quantity": it["quantity"], "line_total": line})
    return {"items": detailed, "subtotal": subtotal}


@api.post("/cart/add")
async def add_to_cart(payload: CartAdd, user=Depends(get_user)):
    # Validate product
    p = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not p or not p.get("is_active", True) or p.get("is_locked", False):
        raise HTTPException(status_code=400, detail="Product is not available")
    # Phase 2 join-gating rules
    is_hamper = p.get("is_hamper", False)
    if not user.get("is_joining_paid", False):
        # Non-joined users can ONLY add the active joining hamper
        if not is_hamper:
            raise HTTPException(
                status_code=403,
                detail="You must purchase the ₹7,499 Joining Kit before shopping regular products.",
            )
    else:
        # Already-joined users cannot re-purchase a joining hamper
        if is_hamper:
            raise HTTPException(
                status_code=400,
                detail="You have already purchased the joining kit.",
            )
    # Stock check (aggregate qty across existing cart + new addition)
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
    items = cart.get("items", [])
    existing_qty = 0
    found = False
    for it in items:
        if it["product_id"] == payload.product_id:
            existing_qty = it["quantity"]
            break
    new_total = existing_qty + payload.quantity
    if new_total > p.get("stock", 0):
        raise HTTPException(status_code=400, detail=f"Only {p.get('stock', 0)} left in stock")
    for it in items:
        if it["product_id"] == payload.product_id:
            it["quantity"] = new_total
            found = True
            break
    if not found:
        items.append({"product_id": payload.product_id, "quantity": payload.quantity})
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "items": items, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "items": items}


@api.post("/cart/update")
async def update_cart_item(payload: dict, user=Depends(get_user)):
    pid = payload.get("product_id")
    qty = int(payload.get("quantity", 1))
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    items = cart.get("items", []) if cart else []
    if qty <= 0:
        items = [i for i in items if i["product_id"] != pid]
    else:
        # Enforce stock ceiling
        p = await db.products.find_one({"id": pid}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Product not found")
        if qty > p.get("stock", 0):
            raise HTTPException(status_code=400, detail=f"Only {p.get('stock', 0)} left in stock")
        found = False
        for it in items:
            if it["product_id"] == pid:
                it["quantity"] = qty
                found = True
                break
        if not found:
            # upsert new item — behave like /cart/add
            items.append({"product_id": pid, "quantity": qty})
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True, "items": items}


@api.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user=Depends(get_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    items = [i for i in cart.get("items", []) if i["product_id"] != product_id] if cart else []
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True}


@api.delete("/cart")
async def clear_cart(user=Depends(get_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}}, upsert=True)
    return {"ok": True}


@api.get("/coupons/validate/{code}")
async def validate_coupon(code: str):
    c = await db.coupons.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Invalid coupon")
    # Expiry check
    if c.get("expires_at"):
        try:
            from datetime import datetime as _dt
            exp = _dt.fromisoformat(c["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Coupon expired")
        except (ValueError, TypeError):
            pass
    # Usage limit check
    if c.get("usage_limit") and c.get("used_count", 0) >= c["usage_limit"]:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    return c


# ==================== ORDERS ====================
@api.post("/orders/create")
async def create_order(payload: OrderCreate, user=Depends(get_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart empty")

    # Fetch delivery config once
    site = await db.settings.find_one({"_key": "site"}, {"_id": 0}) or {}
    delivery_enabled = site.get("delivery_charge_enabled", True)
    delivery_charge = site.get("delivery_charge", 49) if delivery_enabled else 0
    free_threshold = site.get("free_shipping_threshold", 999)
    gst_percent_default = site.get("gst_percent", 5)

    order_items = []
    subtotal = 0
    gst = 0
    is_joining = False
    for it in payload.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {it.product_id} not found")
        if not p.get("is_active", True) or p.get("is_locked", False):
            raise HTTPException(status_code=400, detail=f"{p.get('name','Product')} is not available")
        if it.quantity > p.get("stock", 0):
            raise HTTPException(status_code=400, detail=f"{p['name']} — only {p.get('stock',0)} in stock")
        # Join-gating for order creation as well
        if not user.get("is_joining_paid", False) and not p.get("is_hamper", False):
            raise HTTPException(
                status_code=403,
                detail="Complete your ₹7,499 Joining Kit purchase before ordering other products.",
            )
        if user.get("is_joining_paid", False) and p.get("is_hamper", False):
            raise HTTPException(status_code=400, detail="You have already purchased the joining kit.")
        line = p["price"] * it.quantity
        item_gst = line * p.get("gst_percent", gst_percent_default) / 100
        subtotal += line
        gst += item_gst
        order_items.append({
            "product_id": p["id"],
            "name": p["name"],
            "price": p["price"],
            "quantity": it.quantity,
            "image": (p.get("images") or [None])[0],
            "line_total": line,
            "is_hamper": p.get("is_hamper", False),
        })
        if p.get("is_hamper") and not user.get("is_joining_paid"):
            is_joining = True

    discount = 0
    if payload.coupon_code:
        c = await db.coupons.find_one({"code": payload.coupon_code, "is_active": True}, {"_id": 0})
        if c and subtotal >= c.get("min_order", 0):
            if c.get("discount_percent"):
                discount = subtotal * c["discount_percent"] / 100
                if c.get("max_discount"):
                    discount = min(discount, c["max_discount"])
            elif c.get("discount_amount"):
                discount = c["discount_amount"]

    shipping = 0 if subtotal >= free_threshold else delivery_charge
    total = subtotal + gst + shipping - discount

    order = {
        "id": str(uuid.uuid4()),
        "order_code": gen_order_code(),
        "user_id": user["id"],
        "user_code": user["user_code"],
        "user_name": user["name"],
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "gst": round(gst, 2),
        "shipping": shipping,
        "total": round(total, 2),
        "address": payload.address,
        "coupon_code": payload.coupon_code,
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "payment_provider": None,
        "status": "placed",
        "is_joining_order": is_joining,
        "tracking_no": None,
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    return {"order": {k: v for k, v in order.items() if k != "_id"}}


@api.post("/orders/verify-payment")
async def verify_payment(payload: PaymentVerify, user=Depends(get_user)):
    """Legacy generic verify endpoint. Kept for backwards compat with any old client calls —
    delegates to the Cashfree mock/live flow via /payments/cashfree/verify."""
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"ok": True, "already_processed": True}
    # Mark paid (mock behaviour preserved)
    await db.orders.update_one(
        {"id": payload.order_id},
        {"$set": {
            "payment_status": "paid",
            "payment_id": payload.razorpay_payment_id or f"legacy_{uuid.uuid4().hex[:10]}",
            "status": "confirmed",
            "paid_at": now_iso(),
        }}
    )

    # decrement stock
    for it in order["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})

    # if joining order — activate user & distribute level commissions
    if order.get("is_joining_order") and not user.get("is_joining_paid"):
        await process_paid_joining(db, user["id"], order["order_code"], order["id"])

    # cashback 2% (only credited on paid orders, and only if joining is paid — regular purchases only)
    cashback = 0
    if user.get("is_joining_paid") or order.get("is_joining_order"):
        cashback = round(order["total"] * 0.02, 2)
        if cashback > 0:
            await db.users.update_one(
                {"id": user["id"]},
                {"$inc": {"cashback_wallet": cashback, "wallet_balance": cashback}}
            )
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "user_code": user["user_code"],
                "type": "credit",
                "category": "cashback",
                "amount": cashback,
                "wallet": "cashback",
                "description": f"Cashback for order {order['order_code']}",
                "reference_id": order["id"],
                "created_at": now_iso(),
            })

    # notify
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": "✅ Order Confirmed",
        "body": f"Order {order['order_code']} confirmed. Cashback ₹{cashback} credited.",
        "type": "success",
        "event": "order_confirmed",
        "read": False,
        "created_at": now_iso(),
    })

    # clear cart
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})

    await log_audit("payment", actor=user, target_id=order["id"], target_label=order["order_code"],
                    metadata={"amount": order["total"], "is_joining": order.get("is_joining_order", False)})
    return {"ok": True, "cashback": cashback}


@api.get("/orders")
async def list_orders(user=Depends(get_user)):
    items = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_user)):
    o = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return o


# ==================== WALLET / TRANSACTIONS ====================
@api.get("/wallet")
async def wallet_info(user=Depends(get_user)):
    return {
        "wallet_balance": user.get("wallet_balance", 0),
        "income_wallet": user.get("income_wallet", 0),
        "commission_wallet": user.get("commission_wallet", 0),
        "cashback_wallet": user.get("cashback_wallet", 0),
        "reward_wallet": user.get("reward_wallet", 0),
        "total_earnings": user.get("total_earnings", 0),
    }


@api.get("/wallet/transactions")
async def list_transactions(user=Depends(get_user), limit: int = 100):
    items = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items


# ==================== WITHDRAWALS ====================
@api.post("/withdrawals/request")
async def request_withdrawal(payload: WithdrawalReq, user=Depends(get_user)):
    if user.get("kyc_status") != "approved":
        raise HTTPException(status_code=400, detail="KYC not approved. Please complete KYC first.")
    # Min-referral rule for withdrawals
    if user.get("direct_referrals_count", 0) < MIN_REFERRALS_FOR_WITHDRAWAL:
        raise HTTPException(
            status_code=400,
            detail=f"You need at least {MIN_REFERRALS_FOR_WITHDRAWAL} direct referrals to start earning withdrawals. Share your referral link!",
        )
    if payload.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is ₹100")
    if user.get("wallet_balance", 0) < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    w = {
        "id": str(uuid.uuid4()),
        "withdrawal_code": gen_withdrawal_code(),
        "user_id": user["id"],
        "user_code": user["user_code"],
        "user_name": user["name"],
        "amount": payload.amount,
        "method": payload.method,
        "upi_id": payload.upi_id,
        "bank_name": payload.bank_name,
        "account_number": payload.account_number,
        "ifsc": payload.ifsc,
        "account_holder": payload.account_holder,
        "status": "pending",
        "created_at": now_iso(),
        "processed_at": None,
    }
    await db.withdrawals.insert_one(w)
    await log_audit("withdrawal_request", actor=user, target_id=w["id"], target_label=w["withdrawal_code"], metadata={"amount": payload.amount, "method": payload.method})
    # Hold the amount
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"wallet_balance": -payload.amount}}
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_code": user["user_code"],
        "type": "debit",
        "category": "withdrawal",
        "amount": payload.amount,
        "wallet": "income",
        "description": f"Withdrawal request {w['withdrawal_code']}",
        "reference_id": w["id"],
        "created_at": now_iso(),
    })
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": "💸 Withdrawal Requested",
        "body": f"Your withdrawal request of ₹{payload.amount} is pending approval.",
        "type": "info",
        "event": "withdrawal_requested",
        "read": False,
        "created_at": now_iso(),
    })
    return {k: v for k, v in w.items() if k != "_id"}


@api.get("/withdrawals")
async def list_withdrawals(user=Depends(get_user)):
    items = await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ==================== KYC ====================
@api.post("/kyc/submit")
async def submit_kyc(payload: KYCSubmit, user=Depends(get_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_code": user["user_code"],
        "user_name": user["name"],
        **payload.model_dump(),
        "status": "pending",
        "admin_note": None,
        "submitted_at": now_iso(),
        "reviewed_at": None,
    }
    await db.kyc.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc_status": "pending", "updated_at": now_iso()}})
    await log_audit("kyc_submit", actor=user, target_id=user["id"], target_label=user["user_code"])
    return {"ok": True, "status": "pending"}


@api.get("/kyc/me")
async def my_kyc(user=Depends(get_user)):
    k = await db.kyc.find_one({"user_id": user["id"]}, {"_id": 0})
    return k or {"status": user.get("kyc_status", "not_submitted")}


# ==================== CLOUDINARY ====================
@api.get("/cloudinary/signature")
def cloudinary_sig(resource_type: str = Query("image"), folder: str = "users/general"):
    allowed = ("users/", "products/", "kyc/", "banners/", "uploads/")
    if not folder.startswith(allowed):
        raise HTTPException(status_code=400, detail="Invalid folder")
    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params, os.environ.get("CLOUDINARY_API_SECRET", ""))
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type,
    }


@api.post("/cloudinary/upload")
async def cloudinary_direct_upload(file: UploadFile = File(...), folder: str = "uploads/general", user=Depends(get_user)):
    try:
        content = await file.read()
        res = cloudinary.uploader.upload(
            content,
            folder=folder,
            resource_type="auto",
            public_id=f"{user['id']}_{int(time.time())}",
        )
        return {
            "url": res.get("secure_url"),
            "public_id": res.get("public_id"),
            "resource_type": res.get("resource_type"),
        }
    except Exception as e:
        logger.exception("cloudinary upload failed")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== NOTIFICATIONS ====================
@api.get("/notifications")
async def list_notifications(user=Depends(get_user), limit: int = 100):
    items = await db.notifications.find(
        {"$or": [{"user_id": user["id"]}, {"user_id": "*"}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return items


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ==================== MLM CONFIG / LEADERBOARD ====================
@api.get("/mlm/config")
async def mlm_config():
    cfg = await db.settings.find_one({"_key": "mlm"}, {"_id": 0, "_key": 0})
    return cfg or {
        "levels_total": MAX_LEVELS,
        "max_direct_referrals": MAX_DIRECT_REFERRALS,
        "min_direct_paid_for_income": MIN_DIRECT_PAID_FOR_INCOME,
        "joining_amount": JOINING_AMOUNT,
        "level_commissions": LEVEL_COMMISSIONS,
    }


@api.get("/mlm/leaderboard")
async def leaderboard():
    """Public leaderboard. Returns fake but stable Indian names + lakh/crore incomes.
    Refreshes every 7 days (ISO-week deterministic hash) so the same list persists
    across page refreshes within a week and changes automatically the next week.
    Also mixes in the real top-3 earners from DB (if they have >0 earnings) so real
    milestones aren't hidden.
    """
    import hashlib
    from datetime import date

    year, week, _ = date.today().isocalendar()
    seed = f"evergro-topearners-{year}-{week}"

    # Fake Indian roster (pool of 30 → we pick 8 deterministic each week)
    pool = [
        ("Rajesh Kumar", "Ahmedabad"), ("Priya Sharma", "Mumbai"),
        ("Amit Patel", "Surat"), ("Neha Gupta", "Delhi"),
        ("Vikram Singh", "Jaipur"), ("Kavita Rao", "Bangalore"),
        ("Sanjay Verma", "Lucknow"), ("Anjali Mehta", "Pune"),
        ("Rohit Choudhary", "Indore"), ("Pooja Nair", "Kochi"),
        ("Arjun Reddy", "Hyderabad"), ("Sunita Yadav", "Kanpur"),
        ("Deepak Iyer", "Chennai"), ("Meena Joshi", "Nagpur"),
        ("Karan Malhotra", "Ludhiana"), ("Ritu Bansal", "Chandigarh"),
        ("Naveen Krishna", "Coimbatore"), ("Divya Prasad", "Vizag"),
        ("Suresh Menon", "Trivandrum"), ("Anita Desai", "Bhopal"),
        ("Manoj Tiwari", "Patna"), ("Sneha Kapoor", "Gurugram"),
        ("Ravi Shankar", "Nashik"), ("Lakshmi Iyer", "Madurai"),
        ("Vinod Aggarwal", "Ghaziabad"), ("Shweta Rana", "Dehradun"),
        ("Bhavesh Shah", "Rajkot"), ("Aarti Naidu", "Vijayawada"),
        ("Pankaj Rathi", "Udaipur"), ("Kiran Bala", "Amritsar"),
    ]

    def h(s: str) -> int:
        return int.from_bytes(hashlib.sha256(s.encode()).digest()[:4], "big")

    # Shuffle deterministic by week
    indices = sorted(range(len(pool)), key=lambda i: h(f"{seed}-{i}"))
    selected = indices[:8]

    fake = []
    for rank, idx in enumerate(selected, start=1):
        name, city = pool[idx]
        # Income: top ranks earn crore, mid earn lakhs
        seed_income = h(f"{seed}-income-{idx}")
        if rank == 1:
            earnings = 12_00_000 + (seed_income % 800_000)   # ₹12–20 lakh
        elif rank == 2:
            earnings = 8_00_000 + (seed_income % 400_000)    # ₹8–12 lakh
        elif rank == 3:
            earnings = 5_00_000 + (seed_income % 300_000)    # ₹5–8 lakh
        elif rank <= 5:
            earnings = 2_00_000 + (seed_income % 300_000)    # ₹2–5 lakh
        else:
            earnings = 50_000 + (seed_income % 150_000)      # ₹50k–2 lakh
        team = 20 + (seed_income % 480)  # 20-500 team
        avatar_seed = (seed_income % 70) + 1  # pravatar image
        fake.append({
            "user_code": f"EG{100000 + idx * 137:06d}",
            "name": name,
            "city": city,
            "stage": min(8, 3 + (seed_income % 6)),
            "team_size": team,
            "total_earnings": earnings,
            "avatar_url": f"https://i.pravatar.cc/100?img={avatar_seed}",
            "is_verified": True,
        })

    # Real top 3 earners (only if they've earned > 0) — keep the real names too
    real = await db.users.find(
        {"role": "user", "total_earnings": {"$gt": 0}}, {"_id": 0, "password_hash": 0}
    ).sort("total_earnings", -1).limit(3).to_list(3)
    real_entries = [{
        "user_code": u["user_code"], "name": u["name"], "city": None,
        "stage": u.get("current_stage", 1),
        "team_size": u.get("team_size", 0),
        "total_earnings": u.get("total_earnings", 0),
        "avatar_url": u.get("avatar_url"),
        "is_verified": False,
    } for u in real]

    combined = real_entries + fake
    # Sort by earnings desc, cap 10
    combined.sort(key=lambda x: -x["total_earnings"])
    return combined[:10]


# ==================== PAYMENT PROVIDER CONFIG (Admin editable) ====================
@api.get("/admin/payment-config")
async def admin_get_payment_config(_=Depends(require_admin)):
    doc = await db.settings.find_one({"_key": "payment_config"}, {"_id": 0}) or {"_key": "payment_config"}
    # Never send the secret in full — mask it for the admin UI
    if doc.get("cashfree_secret_key"):
        s = doc["cashfree_secret_key"]
        doc["cashfree_secret_masked"] = ("*" * (len(s) - 4)) + s[-4:] if len(s) > 4 else "****"
    # Strip any legacy easebuzz fields from the response
    for k in list(doc.keys()):
        if k.startswith("easebuzz"):
            doc.pop(k, None)
    doc["provider"] = "cashfree"
    return doc


@api.post("/admin/payment-config")
async def admin_set_payment_config(payload: dict, admin=Depends(require_admin)):
    """Set Cashfree credentials. Takes effect immediately (no redeploy).
    If cashfree_active is False OR credentials are missing, the checkout runs in MOCK mode
    (auto-succeeds so demos + testing work end-to-end).
    """
    update = {"_key": "payment_config", "provider": "cashfree"}
    for k in ("cashfree_app_id", "cashfree_secret_key", "cashfree_env", "cashfree_active"):
        if k in payload and payload[k] != "" and payload[k] is not None:
            update[k] = payload[k]
    await db.settings.update_one(
        {"_key": "payment_config"},
        {"$set": {**update, "updated_at": now_iso()}, "$unset": {"easebuzz_key": "", "easebuzz_salt": "", "easebuzz_env": "", "easebuzz_active": ""}},
        upsert=True,
    )
    await log_audit("payment_config_update", actor=admin, metadata={"provider": "cashfree"})
    safe_update = {k: v for k, v in update.items() if "secret" not in k.lower()}
    return {"ok": True, "config": safe_update}


@api.get("/site/payment-provider")
async def site_active_payment_provider():
    """Public endpoint — frontend needs to know if Cashfree is live or should use mock."""
    doc = await db.settings.find_one({"_key": "payment_config"}, {"_id": 0}) or {}
    is_live = bool(doc.get("cashfree_active") and doc.get("cashfree_app_id") and doc.get("cashfree_secret_key"))
    return {
        "provider": "cashfree",
        "cashfree_active": is_live,
        "cashfree_env": doc.get("cashfree_env", "sandbox"),
        "cashfree_app_id": doc.get("cashfree_app_id") if is_live else None,
        "mock_mode": not is_live,  # frontend uses this to auto-approve payment on the client side
    }



# ==================== CASHFREE PAYMENT ====================
@api.post("/payments/cashfree/initiate")
async def cashfree_initiate(payload: dict, user=Depends(get_user)):
    import cashfree_utils as cf
    order_id = payload.get("order_id")
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id required")
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")

    # MOCK MODE — no real Cashfree keys configured OR active=false.
    # Return a synthetic session_id and let the client call /verify to mark paid.
    cfg = await db.settings.find_one({"_key": "payment_config"}, {"_id": 0}) or {}
    is_live = bool(cfg.get("cashfree_active") and cfg.get("cashfree_app_id") and cfg.get("cashfree_secret_key"))
    if not is_live:
        mock_session = f"mock_session_{uuid.uuid4().hex[:16]}"
        await db.orders.update_one({"id": order_id}, {"$set": {
            "payment_provider": "cashfree",
            "payment_session_id": mock_session,
            "payment_mock": True,
        }})
        return {
            "mock": True,
            "payment_session_id": mock_session,
            "cf_order_id": order_id,
            "env": cfg.get("cashfree_env", "sandbox"),
            "app_id": None,
            "message": "Mock mode — client should call /payments/cashfree/verify to auto-succeed.",
        }

    frontend_base = os.environ.get("PUBLIC_FRONTEND_URL", "").rstrip("/") or "https://evergroemart.com"
    return_url = f"{frontend_base}/orders/{order_id}?cf_order_id={order_id}"
    try:
        cf_order = await cf.create_cashfree_order(
            db, order_id=order_id, amount=order["total"],
            customer={"id": user["id"], "name": user["name"], "email": user.get("email"), "phone": user.get("phone")},
            return_url=return_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cashfree init failed: {e}")
    await db.orders.update_one({"id": order_id}, {"$set": {
        "payment_provider": "cashfree",
        "payment_txnid": cf_order["cf_order_id"],
        "payment_session_id": cf_order["payment_session_id"],
        "payment_mock": False,
    }})
    return {**cf_order, "mock": False}


@api.post("/payments/cashfree/verify")
async def cashfree_verify(payload: dict, user=Depends(get_user)):
    import cashfree_utils as cf
    order_id = payload.get("order_id")
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"paid": True, "already_processed": True}

    # MOCK MODE — auto succeed (payment_mock flag on order OR settings say inactive)
    cfg = await db.settings.find_one({"_key": "payment_config"}, {"_id": 0}) or {}
    is_live_cfg = bool(cfg.get("cashfree_active") and cfg.get("cashfree_app_id") and cfg.get("cashfree_secret_key"))
    if order.get("payment_mock") or not is_live_cfg:
        paid = True
    else:
        try:
            res = await cf.verify_cashfree_order(db, order_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cashfree verify failed: {e}")
        paid = res["paid"]
        if not paid:
            return {"paid": False, "order_status": res.get("order_status")}

    # Atomic paid-flag flip
    r = await db.orders.update_one(
        {"id": order_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "paid_at": now_iso(), "status": "confirmed",
                  "payment_id": order.get("payment_session_id") or f"mock_{uuid.uuid4().hex[:10]}"}},
    )
    if r.modified_count == 1:
        for item in order.get("items", []):
            await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}})
        if any(i.get("is_hamper") for i in order.get("items", [])):
            u = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
            if not u.get("is_joining_paid"):
                await process_paid_joining(db, order["user_id"], order.get("order_code", order_id), order_id)
    return {"paid": True, "order_id": order_id, "mock": bool(order.get("payment_mock"))}


# ==================== PURCHASE KIT CONTENT (admin editable) ====================
@api.get("/site/purchase-kit-content")
async def get_purchase_kit_content():
    doc = await db.settings.find_one({"_key": "purchase_kit_content"}, {"_id": 0}) or {}
    return doc.get("content") or _default_purchase_kit_content()


@api.post("/admin/purchase-kit-content")
async def set_purchase_kit_content(payload: dict, admin=Depends(require_admin)):
    await db.settings.update_one(
        {"_key": "purchase_kit_content"},
        {"$set": {"content": payload, "updated_at": now_iso()}},
        upsert=True,
    )
    await log_audit("purchase_kit_content_update", actor=admin)
    return {"ok": True}


def _default_purchase_kit_content() -> dict:
    return {
        "hero_title": "The EverGro Purchasing Kit",
        "hero_subtitle": "One-time ₹7,499 · Premium groceries + wellness + 8-Level income unlock",
        "hero_image": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80",
        "highlight_stat": "₹19.2 Cr Lifetime Potential",
        "features": [
            {"icon": "🌾", "title": "Premium Basmati Rice 5kg", "desc": "Aged extra-long grain from Punjab farms"},
            {"icon": "🍲", "title": "Mixed Dals & Pulses 3kg", "desc": "Toor · Moong · Chana · Urad · Masoor"},
            {"icon": "🫒", "title": "Cold-pressed Oil 2L", "desc": "Zero refining, extra-virgin quality"},
            {"icon": "🌶️", "title": "Assorted Spice Box", "desc": "20+ hand-ground everyday spices"},
            {"icon": "☕", "title": "Premium Tea & Coffee", "desc": "Assam tea + Coorg coffee blend"},
            {"icon": "🍯", "title": "Wellness Pack", "desc": "Ayurvedic honey · Kashmir saffron · Almonds"},
            {"icon": "🛍️", "title": "Reusable Basket", "desc": "Eco-friendly cotton shopping basket"},
            {"icon": "💰", "title": "₹500 Store Credit", "desc": "Instant credit for your next purchase"},
        ],
        "how_it_works": [
            {"step": 1, "title": "Purchase Kit", "desc": "Order the ₹7,499 kit — pay via Cashfree/UPI/Card"},
            {"step": 2, "title": "Get Referral Code", "desc": "Unique code unlocks after payment confirms"},
            {"step": 3, "title": "Refer 6 Direct", "desc": "Share your code, hit 3 refs to activate income"},
            {"step": 4, "title": "Earn From 8 Levels", "desc": "Every downline purchase pays you L1–L8 commissions"},
        ],
        "cta_text": "Order Kit Now →",
    }



# ==================== USERNAME AVAILABILITY ====================
@api.get("/auth/check-username")
async def check_username(username: str):
    """Instagram-style live availability check."""
    u = username.strip().lower()
    if len(u) < 3:
        return {"available": False, "reason": "Username must be at least 3 characters"}
    if len(u) > 30:
        return {"available": False, "reason": "Username too long (max 30)"}
    if not all(c.isalnum() or c in "._-" for c in u):
        return {"available": False, "reason": "Only letters, numbers, . _ - allowed"}
    if u.startswith(".") or u.endswith(".") or ".." in u:
        return {"available": False, "reason": "Invalid dot placement"}
    reserved = {"admin", "root", "support", "help", "system", "evergro", "emart"}
    if u in reserved:
        return {"available": False, "reason": "This username is reserved"}
    existing = await db.users.find_one({"username": u}, {"_id": 1})
    return {"available": not existing, "reason": "Already taken" if existing else "Available"}


# ==================== SUPPORT TICKETS ====================
@api.post("/tickets")
async def create_ticket(payload: dict, user=Depends(get_user)):
    t = {
        "id": str(uuid.uuid4()),
        "ticket_code": gen_ticket_code(),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_code": user["user_code"],
        "subject": payload.get("subject", ""),
        "message": payload.get("message", ""),
        "status": "open",
        "admin_reply": None,
        "created_at": now_iso(),
    }
    await db.tickets.insert_one(t)
    return t


@api.get("/tickets")
async def my_tickets(user=Depends(get_user)):
    items = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


# ==================== PUBLIC CONTENT ====================
@api.get("/site/settings")
async def site_settings():
    s = await db.settings.find_one({"_key": "site"}, {"_id": 0, "_key": 0,
                                                      "cloudinary_api_secret": 0})
    return s or {}


@api.get("/site/banners")
async def site_banners():
    items = await db.banners.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    return items


@api.get("/site/testimonials")
async def site_testimonials():
    items = await db.testimonials.find({"is_active": True}, {"_id": 0}).to_list(50)
    return items


@api.get("/site/faqs")
async def site_faqs():
    items = await db.faqs.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return items


@api.get("/site/blogs")
async def site_blogs():
    items = await db.blogs.find({"is_published": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@api.get("/site/blogs/{slug}")
async def get_blog(slug: str):
    b = await db.blogs.find_one({"slug": slug}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Blog not found")
    return b


# ==================== ADMIN ====================
@api.get("/admin/dashboard")
async def admin_dashboard(_=Depends(require_admin)):
    total_users = await db.users.count_documents({"role": "user"})
    active_users = await db.users.count_documents({"role": "user", "is_active": True})
    total_orders = await db.orders.count_documents({})
    paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "total": 1}).to_list(10000)
    total_revenue = sum(o.get("total", 0) for o in paid_orders)
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    total_withdrawals = await db.withdrawals.count_documents({})
    pending_kyc = await db.kyc.count_documents({"status": "pending"})
    open_tickets = await db.tickets.count_documents({"status": "open"})

    # last 7 days revenue
    from datetime import timedelta
    days = []
    today = datetime.now(timezone.utc).date()
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        # filter by date prefix
        all_orders = await db.orders.find({"payment_status": "paid", "created_at": {"$regex": f"^{d_str}"}}, {"_id": 0, "total": 1}).to_list(1000)
        days.append({"date": d_str, "revenue": sum(o.get("total", 0) for o in all_orders), "orders": len(all_orders)})

    # stage distribution
    stage_dist = []
    for s in range(1, 9):
        c = await db.users.count_documents({"role": "user", "current_stage": s})
        stage_dist.append({"stage": s, "users": c})

    total_commissions = sum(u.get("total_earnings", 0) for u in await db.users.find({"role": "user"}, {"_id": 0, "total_earnings": 1}).to_list(10000))

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "total_commissions": round(total_commissions, 2),
        "pending_withdrawals": pending_withdrawals,
        "total_withdrawals": total_withdrawals,
        "pending_kyc": pending_kyc,
        "open_tickets": open_tickets,
        "daily_revenue": days,
        "stage_distribution": stage_dist,
    }


@api.get("/admin/users")
async def admin_list_users(_=Depends(require_admin), q: Optional[str] = None, page: int = 1, limit: int = 50):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"user_code": {"$regex": q, "$options": "i"}},
        ]
    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    items = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return {"items": [public_user(u) for u in items], "total": total}


@api.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, payload: dict, admin=Depends(require_admin)):
    allowed = {"is_active", "current_stage", "wallet_balance", "permissions", "role", "kyc_status"}
    update = {k: v for k, v in payload.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": update})
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if "is_active" in update:
        await log_audit("status_change", actor=admin, target_id=user_id, target_label=u.get("user_code"),
                        metadata={"new_status": update["is_active"]})
    if "role" in update:
        await log_audit("role_change", actor=admin, target_id=user_id, target_label=u.get("user_code"),
                        metadata={"new_role": update["role"]})
    return public_user(u)


@api.post("/admin/products")
async def admin_create_product(payload: ProductCreate, _=Depends(require_admin)):
    p = payload.model_dump()
    p["id"] = str(uuid.uuid4())
    p["rating"] = 4.5
    p["review_count"] = 0
    p["created_at"] = now_iso()
    if not p.get("sku"):
        p["sku"] = f"PRD-{uuid.uuid4().hex[:6].upper()}"
    await db.products.insert_one(p)
    p.pop("_id", None)
    return p


@api.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: dict, _=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    await db.products.update_one({"id": product_id}, {"$set": payload})
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return p


@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, _=Depends(require_admin)):
    await db.products.update_one({"id": product_id}, {"$set": {"is_active": False}})
    return {"ok": True}


# ==================== CATEGORIES ====================
@api.get("/categories")
async def list_categories():
    items = await db.categories.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return items


@api.get("/admin/categories")
async def admin_list_categories(_=Depends(require_admin)):
    items = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return items


@api.post("/admin/categories")
async def admin_create_category(payload: dict, admin=Depends(require_admin)):
    if not payload.get("name"):
        raise HTTPException(status_code=400, detail="name required")
    slug = payload.get("slug") or payload["name"].lower().replace(" ", "-").replace("&", "and")
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload["name"],
        "slug": slug,
        "description": payload.get("description", ""),
        "image_url": payload.get("image_url", ""),
        "sort_order": payload.get("sort_order", 0),
        "is_active": payload.get("is_active", True),
        "created_at": now_iso(),
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    await log_audit("category_create", actor=admin, target_label=doc["name"])
    return doc


@api.put("/admin/categories/{category_id}")
async def admin_update_category(category_id: str, payload: dict, admin=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    await db.categories.update_one({"id": category_id}, {"$set": payload})
    c = await db.categories.find_one({"id": category_id}, {"_id": 0})
    await log_audit("category_update", actor=admin, target_label=c.get("name") if c else category_id)
    return c


@api.delete("/admin/categories/{category_id}")
async def admin_delete_category(category_id: str, admin=Depends(require_admin)):
    c = await db.categories.find_one({"id": category_id}, {"_id": 0})
    await db.categories.delete_one({"id": category_id})
    await log_audit("category_delete", actor=admin, target_label=c.get("name") if c else category_id)
    return {"ok": True}


# ==================== COUPONS / PROMO CODES ====================
@api.get("/admin/coupons")
async def admin_list_coupons(_=Depends(require_admin)):
    items = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/admin/coupons")
async def admin_create_coupon(payload: dict, admin=Depends(require_admin)):
    if not payload.get("code"):
        raise HTTPException(status_code=400, detail="code required")
    code = payload["code"].upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Code already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "description": payload.get("description", ""),
        "discount_percent": int(payload.get("discount_percent", 0) or 0),
        "discount_amount": int(payload.get("discount_amount", 0) or 0),
        "min_order": int(payload.get("min_order", 0) or 0),
        "max_discount": int(payload.get("max_discount", 0) or 0),
        "usage_limit": int(payload.get("usage_limit", 0) or 0),  # 0 = unlimited
        "used_count": 0,
        "expires_at": payload.get("expires_at"),  # ISO string or null
        "is_active": bool(payload.get("is_active", True)),
        "created_at": now_iso(),
    }
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    await log_audit("coupon_create", actor=admin, target_label=code)
    return doc


@api.put("/admin/coupons/{coupon_id}")
async def admin_update_coupon(coupon_id: str, payload: dict, admin=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    payload.pop("used_count", None)
    if "code" in payload:
        payload["code"] = payload["code"].upper().strip()
    await db.coupons.update_one({"id": coupon_id}, {"$set": payload})
    c = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    await log_audit("coupon_update", actor=admin, target_label=c.get("code") if c else coupon_id)
    return c


@api.delete("/admin/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, admin=Depends(require_admin)):
    c = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    await db.coupons.delete_one({"id": coupon_id})
    await log_audit("coupon_delete", actor=admin, target_label=c.get("code") if c else coupon_id)
    return {"ok": True}


@api.get("/admin/orders")
async def admin_list_orders(_=Depends(require_admin), status: Optional[str] = None, page: int = 1, limit: int = 50):
    query = {}
    if status:
        query["status"] = status
    total = await db.orders.count_documents(query)
    skip = (page - 1) * limit
    items = await db.orders.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return {"items": items, "total": total}


@api.put("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, payload: dict, _=Depends(require_admin)):
    allowed = {"status", "tracking_no"}
    update = {k: v for k, v in payload.items() if k in allowed}
    await db.orders.update_one({"id": order_id}, {"$set": update})
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    # notify user
    if update.get("status") in ("shipped", "delivered"):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": o["user_id"],
            "title": f"📦 Order {update['status'].title()}",
            "body": f"Your order {o['order_code']} is now {update['status']}." + (f" Tracking: {update.get('tracking_no')}" if update.get('tracking_no') else ""),
            "type": "success",
            "event": f"order_{update['status']}",
            "read": False,
            "created_at": now_iso(),
        })
    return o


@api.get("/admin/withdrawals")
async def admin_list_withdrawals(_=Depends(require_admin), status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    items = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.put("/admin/withdrawals/{wid}")
async def admin_update_withdrawal(wid: str, payload: dict, admin=Depends(require_admin)):
    w = await db.withdrawals.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    new_status = payload.get("status")
    note = payload.get("admin_note")
    if new_status not in ("approved", "rejected", "paid", "hold", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")

    update = {"status": new_status, "admin_note": note, "processed_at": now_iso()}
    await db.withdrawals.update_one({"id": wid}, {"$set": update})

    # If rejected — refund the amount
    if new_status == "rejected" and w["status"] != "rejected":
        await db.users.update_one({"id": w["user_id"]}, {"$inc": {"wallet_balance": w["amount"]}})
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": w["user_id"],
            "user_code": w["user_code"],
            "type": "credit",
            "category": "refund",
            "amount": w["amount"],
            "wallet": "income",
            "description": f"Withdrawal rejected refund {w['withdrawal_code']}",
            "reference_id": wid,
            "created_at": now_iso(),
        })

    # Notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": w["user_id"],
        "title": f"Withdrawal {new_status.title()}",
        "body": f"Your withdrawal {w['withdrawal_code']} of ₹{w['amount']} is now {new_status}." + (f" Note: {note}" if note else ""),
        "type": "success" if new_status in ("approved", "paid") else "warning",
        "event": f"withdrawal_{new_status}",
        "read": False,
        "created_at": now_iso(),
    })
    out = await db.withdrawals.find_one({"id": wid}, {"_id": 0})
    await log_audit("withdrawal_decision", actor=admin, target_id=wid, target_label=w["withdrawal_code"],
                    metadata={"new_status": new_status, "note": note, "amount": w["amount"]})
    return out


@api.get("/admin/kyc")
async def admin_list_kyc(_=Depends(require_admin), status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    items = await db.kyc.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return items


@api.put("/admin/kyc/{kyc_id}")
async def admin_update_kyc(kyc_id: str, payload: dict, admin=Depends(require_admin)):
    k = await db.kyc.find_one({"id": kyc_id}, {"_id": 0})
    if not k:
        raise HTTPException(status_code=404, detail="KYC not found")
    new_status = payload.get("status", "pending")
    note = payload.get("admin_note")
    await db.kyc.update_one({"id": kyc_id}, {"$set": {"status": new_status, "admin_note": note, "reviewed_at": now_iso()}})
    await db.users.update_one({"id": k["user_id"]}, {"$set": {"kyc_status": new_status, "updated_at": now_iso()}})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": k["user_id"],
        "title": f"KYC {new_status.title()}",
        "body": f"Your KYC submission has been {new_status}." + (f" Note: {note}" if note else ""),
        "type": "success" if new_status == "approved" else "warning",
        "event": f"kyc_{new_status}",
        "read": False,
        "created_at": now_iso(),
    })
    out = await db.kyc.find_one({"id": kyc_id}, {"_id": 0})
    await log_audit("kyc_decision", actor=admin, target_id=kyc_id, target_label=k.get("user_code"),
                    metadata={"new_status": new_status, "note": note})
    return out


@api.get("/admin/tickets")
async def admin_list_tickets(_=Depends(require_admin)):
    items = await db.tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.put("/admin/tickets/{tid}")
async def admin_update_ticket(tid: str, payload: dict, _=Depends(require_admin)):
    await db.tickets.update_one({"id": tid}, {"$set": {"status": payload.get("status", "in_progress"), "admin_reply": payload.get("admin_reply")}})
    t = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if payload.get("admin_reply"):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": t["user_id"],
            "title": "💬 Support replied to your ticket",
            "body": payload["admin_reply"][:140],
            "type": "info", "event": "ticket_reply", "read": False, "created_at": now_iso(),
        })
    return t


@api.get("/admin/settings")
async def admin_get_settings(_=Depends(require_admin)):
    site = await db.settings.find_one({"_key": "site"}, {"_id": 0})
    mlm = await db.settings.find_one({"_key": "mlm"}, {"_id": 0})
    return {"site": site or {}, "mlm": mlm or {}}


@api.put("/admin/settings/site")
async def admin_update_site(payload: dict, admin=Depends(require_super_admin)):
    payload.pop("_key", None)
    payload.pop("_id", None)
    await db.settings.update_one({"_key": "site"}, {"$set": payload}, upsert=True)
    await log_audit("settings_update", actor=admin, target_label="site")
    return {"ok": True}


@api.put("/admin/settings/mlm")
async def admin_update_mlm(payload: dict, admin=Depends(require_super_admin)):
    payload.pop("_key", None)
    payload.pop("_id", None)
    await db.settings.update_one({"_key": "mlm"}, {"$set": payload}, upsert=True)
    await log_audit("settings_update", actor=admin, target_label="mlm")
    return {"ok": True}


@api.post("/admin/banners")
async def admin_create_banner(payload: dict, _=Depends(require_admin)):
    payload["id"] = str(uuid.uuid4())
    payload["is_active"] = payload.get("is_active", True)
    payload["created_at"] = now_iso()
    await db.banners.insert_one(payload)
    payload.pop("_id", None)
    return payload


@api.delete("/admin/banners/{bid}")
async def admin_delete_banner(bid: str, _=Depends(require_admin)):
    await db.banners.delete_one({"id": bid})
    return {"ok": True}


@api.post("/admin/notifications/broadcast")
async def admin_broadcast(payload: dict, _=Depends(require_admin)):
    n = {
        "id": str(uuid.uuid4()),
        "user_id": "*",
        "title": payload.get("title", "Announcement"),
        "body": payload.get("body", ""),
        "type": payload.get("type", "info"),
        "event": "broadcast",
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(n)
    return {k: v for k, v in n.items() if k != "_id"}


# ==================== SLIDERS (PUBLIC + ADMIN) ====================
@api.get("/sliders")
async def list_sliders(location: Optional[str] = None):
    query = {"is_active": True}
    if location:
        query["location"] = location
    items = await db.sliders.find(query, {"_id": 0}).sort("sort_order", 1).to_list(50)
    return items


@api.post("/admin/sliders")
async def admin_create_slider(payload: dict, admin=Depends(require_admin)):
    payload["id"] = str(uuid.uuid4())
    payload["is_active"] = payload.get("is_active", True)
    payload["created_at"] = now_iso()
    await db.sliders.insert_one(payload)
    payload.pop("_id", None)
    await log_audit("slider_create", actor=admin, target_id=payload["id"], target_label=payload.get("title", ""))
    return payload


@api.put("/admin/sliders/{sid}")
async def admin_update_slider(sid: str, payload: dict, admin=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    await db.sliders.update_one({"id": sid}, {"$set": payload})
    await log_audit("slider_update", actor=admin, target_id=sid)
    s = await db.sliders.find_one({"id": sid}, {"_id": 0})
    return s


@api.delete("/admin/sliders/{sid}")
async def admin_delete_slider(sid: str, admin=Depends(require_admin)):
    await db.sliders.delete_one({"id": sid})
    await log_audit("slider_delete", actor=admin, target_id=sid)
    return {"ok": True}


# ==================== BRAND LOGOS (Partner Brand Slider) ====================
@api.get("/site/brands")
async def list_brands():
    items = await db.brands.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return items


@api.post("/admin/brands")
async def admin_create_brand(payload: dict, admin=Depends(require_admin)):
    payload["id"] = str(uuid.uuid4())
    payload["is_active"] = payload.get("is_active", True)
    payload["sort_order"] = payload.get("sort_order", 0)
    payload["created_at"] = now_iso()
    payload.pop("_id", None)
    await db.brands.insert_one(payload)
    payload.pop("_id", None)
    await log_audit("brand_create", actor=admin, target_id=payload["id"], target_label=payload.get("name", ""))
    return payload


@api.put("/admin/brands/{bid}")
async def admin_update_brand(bid: str, payload: dict, admin=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    await db.brands.update_one({"id": bid}, {"$set": payload})
    await log_audit("brand_update", actor=admin, target_id=bid)
    return await db.brands.find_one({"id": bid}, {"_id": 0})


@api.delete("/admin/brands/{bid}")
async def admin_delete_brand(bid: str, admin=Depends(require_admin)):
    await db.brands.delete_one({"id": bid})
    await log_audit("brand_delete", actor=admin, target_id=bid)
    return {"ok": True}


# ==================== TESTIMONIALS ADMIN ====================
@api.post("/admin/testimonials")
async def admin_create_testimonial(payload: dict, admin=Depends(require_admin)):
    payload["id"] = str(uuid.uuid4())
    payload["is_active"] = payload.get("is_active", True)
    payload["created_at"] = now_iso()
    payload.pop("_id", None)
    await db.testimonials.insert_one(payload)
    payload.pop("_id", None)
    await log_audit("testimonial_create", actor=admin, target_id=payload["id"], target_label=payload.get("name", ""))
    return payload


@api.put("/admin/testimonials/{tid}")
async def admin_update_testimonial(tid: str, payload: dict, admin=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    await db.testimonials.update_one({"id": tid}, {"$set": payload})
    await log_audit("testimonial_update", actor=admin, target_id=tid)
    return await db.testimonials.find_one({"id": tid}, {"_id": 0})


@api.delete("/admin/testimonials/{tid}")
async def admin_delete_testimonial(tid: str, admin=Depends(require_admin)):
    await db.testimonials.delete_one({"id": tid})
    await log_audit("testimonial_delete", actor=admin, target_id=tid)
    return {"ok": True}


@api.get("/admin/testimonials")
async def admin_list_testimonials(_=Depends(require_admin)):
    return await db.testimonials.find({}, {"_id": 0}).to_list(500)


@api.get("/admin/brands")
async def admin_list_brands(_=Depends(require_admin)):
    return await db.brands.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)


# ==================== REELS / VERTICAL VIDEOS ====================
@api.get("/reels")
async def list_reels(location: Optional[str] = None):
    query = {"is_active": True}
    if location:
        query["location"] = {"$in": [location, "both"]}
    items = await db.reels.find(query, {"_id": 0}).sort("sort_order", 1).to_list(50)
    return items


@api.post("/admin/reels")
async def admin_create_reel(payload: dict, admin=Depends(require_admin)):
    payload["id"] = str(uuid.uuid4())
    payload["is_active"] = payload.get("is_active", True)
    payload["created_at"] = now_iso()
    await db.reels.insert_one(payload)
    payload.pop("_id", None)
    await log_audit("reel_create", actor=admin, target_id=payload["id"], target_label=payload.get("title", ""))
    return payload


@api.put("/admin/reels/{rid}")
async def admin_update_reel(rid: str, payload: dict, admin=Depends(require_admin)):
    payload.pop("_id", None)
    payload.pop("id", None)
    await db.reels.update_one({"id": rid}, {"$set": payload})
    await log_audit("reel_update", actor=admin, target_id=rid)
    r = await db.reels.find_one({"id": rid}, {"_id": 0})
    return r


@api.delete("/admin/reels/{rid}")
async def admin_delete_reel(rid: str, admin=Depends(require_admin)):
    await db.reels.delete_one({"id": rid})
    await log_audit("reel_delete", actor=admin, target_id=rid)
    return {"ok": True}


# ==================== AUDIT LOGS (ADMIN) ====================
@api.get("/admin/audit-logs")
async def admin_list_audit_logs(_=Depends(require_admin), event: Optional[str] = None,
                                 actor_code: Optional[str] = None, page: int = 1, limit: int = 50):
    query = {}
    if event:
        query["event"] = event
    if actor_code:
        query["actor_code"] = actor_code
    total = await db.audit_logs.count_documents(query)
    skip = (page - 1) * limit
    items = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"items": items, "total": total}


# ==================== ADMIN INVENTORY / ACCOUNTS / DELIVERY ====================
@api.get("/admin/inventory")
async def admin_inventory(_=Depends(require_admin)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    inv = []
    for p in products:
        sold = await db.orders.aggregate([
            {"$match": {"payment_status": "paid"}},
            {"$unwind": "$items"},
            {"$match": {"items.product_id": p["id"]}},
            {"$group": {"_id": None, "qty": {"$sum": "$items.quantity"}}},
        ]).to_list(1)
        sold_qty = sold[0]["qty"] if sold else 0
        inv.append({
            "id": p["id"], "name": p["name"], "sku": p.get("sku"),
            "stock": p.get("stock", 0), "sold": sold_qty,
            "remaining": max(0, p.get("stock", 0)),
            "price": p.get("price", 0), "mrp": p.get("mrp", 0),
            "is_hamper": p.get("is_hamper", False), "is_active": p.get("is_active", True),
            "is_locked": p.get("is_locked", False),
            "low_stock": p.get("stock", 0) < 20,
        })
    return {"items": inv, "total": len(inv), "low_stock_count": sum(1 for i in inv if i["low_stock"])}


@api.get("/admin/accounts")
async def admin_accounts(_=Depends(require_admin)):
    from datetime import timedelta
    today = datetime.now(timezone.utc).date().isoformat()
    month_prefix = today[:7]

    all_paid = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "total": 1, "created_at": 1}).to_list(20000)
    total_sales = sum(o.get("total", 0) for o in all_paid)
    today_sales = sum(o.get("total", 0) for o in all_paid if o.get("created_at", "").startswith(today))
    month_sales = sum(o.get("total", 0) for o in all_paid if o.get("created_at", "").startswith(month_prefix))

    pending_payments = await db.orders.count_documents({"payment_status": "pending"})
    completed_payments = await db.orders.count_documents({"payment_status": "paid"})

    # total commissions paid out
    users_pipe = await db.users.aggregate([
        {"$group": {"_id": None, "commissions": {"$sum": "$total_earnings"}, "wallet_balance": {"$sum": "$wallet_balance"}}}
    ]).to_list(1)
    commissions = users_pipe[0]["commissions"] if users_pipe else 0
    outstanding_wallet = users_pipe[0]["wallet_balance"] if users_pipe else 0

    withdrawn = await db.withdrawals.aggregate([
        {"$match": {"status": {"$in": ["paid", "approved"]}}},
        {"$group": {"_id": None, "amt": {"$sum": "$amount"}}},
    ]).to_list(1)
    withdrawn_total = withdrawn[0]["amt"] if withdrawn else 0

    orders_by_status = {}
    for st in ("placed", "confirmed", "shipped", "delivered", "cancelled"):
        orders_by_status[st] = await db.orders.count_documents({"status": st})

    return {
        "total_sales": round(total_sales, 2),
        "today_sales": round(today_sales, 2),
        "month_sales": round(month_sales, 2),
        "pending_payments": pending_payments,
        "completed_payments": completed_payments,
        "total_commissions_credited": round(commissions, 2),
        "outstanding_wallet_liability": round(outstanding_wallet, 2),
        "withdrawn_total": round(withdrawn_total, 2),
        "orders_by_status": orders_by_status,
    }


@api.get("/site/terms")
async def get_terms():
    s = await db.settings.find_one({"_key": "site"}, {"_id": 0})
    return {"version": s.get("terms_version", "1.0") if s else "1.0",
            "content": s.get("terms_content", "") if s else ""}


@api.get("/site/delivery-config")
async def get_delivery_config():
    s = await db.settings.find_one({"_key": "site"}, {"_id": 0})
    enabled = s.get("delivery_charge_enabled", True) if s else True
    return {
        "delivery_charge": (s.get("delivery_charge", 49) if s else 49) if enabled else 0,
        "delivery_charge_enabled": enabled,
        "free_shipping_threshold": s.get("free_shipping_threshold", 999) if s else 999,
        "gst_percent": s.get("gst_percent", 5) if s else 5,
    }


# ==================== ROUTES MOUNT ====================
@api.get("/")
async def root():
    return {"message": "EverGro eMart API", "status": "healthy"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed_all(db)
    # ensure index
    try:
        await db.users.create_index("user_code", unique=True)
        await db.users.create_index("referral_code", unique=True)
        await db.users.create_index("email")
        await db.users.create_index("phone")
        await db.users.create_index("last_activity_at")
        await db.audit_logs.create_index([("created_at", -1)])
        await db.audit_logs.create_index("event")
    except Exception as e:
        logger.warning(f"index creation: {e}")
    logger.info("EverGro eMart API ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
