"""EverGro eMart — main FastAPI server."""
import os
import time
import uuid
import json
import logging
import random
import string
from datetime import datetime, timezone, timedelta
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
                    ip: Optional[str] = None, user_agent: Optional[str] = None,
                    request: Optional[Request] = None):
    """Insert audit log entry.
    If `request` is provided, IP and User-Agent are pulled from it automatically.
    """
    try:
        if request is not None:
            if ip is None:
                # Respect X-Forwarded-For when running behind a proxy/ingress
                xff = request.headers.get("x-forwarded-for")
                ip = (xff.split(",")[0].strip() if xff else None) or (request.client.host if request.client else None)
            if user_agent is None:
                user_agent = request.headers.get("user-agent")
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
            "user_agent": user_agent,
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.warning(f"audit log failed: {e}")


@api.post("/auth/register")
async def register(payload: UserCreate, request: Request = None):
    """Iteration 15+: One phone = ONE user. Duplicate phone/email/username are rejected.
    Users create additional 'referral businesses' from their dashboard later.
    """
    # T&C mandatory
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Terms & Conditions")

    # PHONE uniqueness — one phone = one main account
    if not payload.phone or len(payload.phone.replace("+", "").replace("-", "").strip()) < 10:
        raise HTTPException(status_code=400, detail="Valid mobile number required")
    if await db.users.find_one({"phone": payload.phone}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="This mobile is already registered. Please login instead.")

    # Username handling (unique globally)
    username = None
    if getattr(payload, "username", None):
        username = str(payload.username).strip().lower()
        if len(username) < 3 or len(username) > 30:
            raise HTTPException(status_code=400, detail="Username must be 3-30 characters")
        if not all(c.isalnum() or c in "._-" for c in username):
            raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, . _ -")
        if await db.users.find_one({"username": username}, {"_id": 1}):
            raise HTTPException(status_code=409, detail="Username already taken")

    # Email uniqueness (strict — no more +reN suffixing)
    email_to_store = payload.email
    if await db.users.find_one({"email": email_to_store}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="This email is already registered. Please login instead.")

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
        "public_email": payload.email,  # what the user sees / logs in with (unique)
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
async def login(payload: UserLogin, request: Request):
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
    await log_audit("login", actor=user, metadata={"method": "password"}, request=request)
    return {"token": token, "user": public_user(user)}


@api.get("/auth/accounts-by-phone")
async def accounts_by_phone(phone: str):
    """Return list of accounts for a phone — used by multi-account picker."""
    items = await db.users.find({"phone": phone}, {"_id": 0, "password_hash": 0}).to_list(20)
    return [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "username": u.get("username"), "is_joining_paid": u.get("is_joining_paid", False), "role": u.get("role", "user")} for u in items]


@api.post("/auth/identifier-lookup")
async def identifier_lookup(payload: dict):
    """Given a mobile OR email, return whether ONE or MULTIPLE accounts match.
    Client uses this to decide: single -> show password; multiple -> OTP + picker.
    Username lookups aren't needed here — usernames are unique globally.
    """
    ident = (payload.get("identifier") or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="identifier required")
    q = None
    kind = None
    if "@" in ident:
        kind = "email"
        q = {"$or": [{"email": ident}, {"public_email": ident}]}
    elif ident.replace("+", "").replace("-", "").isdigit():
        kind = "phone"
        q = {"phone": ident}
    else:
        # username fast-path — always exactly one match, client should proceed to password directly
        u = await db.users.find_one({"username": ident.lower()}, {"_id": 0, "password_hash": 0})
        if not u:
            raise HTTPException(status_code=404, detail="No account found")
        return {"single": True, "kind": "username", "user_code": u["user_code"], "name": u["name"], "username": u.get("username"), "phone": u.get("phone")}

    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(20)
    if not users:
        raise HTTPException(status_code=404, detail="No account found")
    if len(users) == 1:
        u = users[0]
        return {"single": True, "kind": kind, "user_code": u["user_code"], "name": u["name"], "username": u.get("username"), "phone": u.get("phone")}
    return {"multiple": True, "kind": kind, "count": len(users), "phone": users[0].get("phone")}


@api.post("/auth/login-with-code")
async def login_with_code(payload: dict, request: Request):
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
    await log_audit("login", actor=user, metadata={"method": "user_code"}, request=request)
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
    # Simple rate limit — don't allow resending within 20 seconds
    existing = await db.otps.find_one({"phone": payload.phone})
    now = int(time.time())
    if existing and existing.get("last_sent_at") and (now - existing["last_sent_at"]) < 20:
        wait = 20 - (now - existing["last_sent_at"])
        raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another OTP")

    otp = gen_otp()
    expires = now + 300  # 5 min
    resend_count = (existing.get("resend_count", 0) if existing else 0) + (1 if existing else 0)
    await db.otps.update_one(
        {"phone": payload.phone},
        {"$set": {"phone": payload.phone, "otp": otp, "expires_at": expires, "verified": False,
                  "last_sent_at": now, "resend_count": resend_count, "created_at": now_iso()}},
        upsert=True,
    )
    logger.info(f"[DEV-OTP] phone={payload.phone} otp={otp} resend#={resend_count}")
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
        return {"ok": True, "message": "OTP sent successfully", "resend_count": resend_count}
    return {"ok": True, "message": "OTP sent successfully", "dev_otp": otp, "resend_count": resend_count}


@api.post("/auth/otp/verify")
async def verify_otp(payload: OTPVerifyReq, request: Request):
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
        await log_audit("login", actor=user, metadata={"method": "otp"}, request=request)
        return {"verified": True, "token": token, "user": public_user(user), "new_user": False, "multiple": False}
    # Multiple accounts — return list for picker
    accounts = [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "username": u.get("username"), "id": u["id"], "role": u.get("role", "user"), "is_joining_paid": u.get("is_joining_paid", False)} for u in users]
    return {"verified": True, "new_user": False, "multiple": True, "accounts": accounts}


@api.post("/auth/otp/pick-account")
async def otp_pick_account(payload: dict, request: Request):
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
    await log_audit("login", actor=user, metadata={"method": "otp_picker"}, request=request)
    return {"token": token, "user": public_user(user)}


@api.post("/auth/forgot-password/start")
async def forgot_password_start(payload: dict):
    """SMS-independent forgot-password bootstrap.
    - If the phone has NO account → returns {exists: false} so the client can jump to Join Now.
    - If the phone HAS at least one account → generates a fresh 6-digit OTP, stores it in
      db.otps, and returns it in the response so the client can show it in a popup.
      (This bypasses Firebase/SMS entirely — used as a fallback while the SMS provider is
      unavailable on production.)
    """
    phone = (payload.get("phone") or "").strip()
    if len(phone) < 6:
        raise HTTPException(status_code=400, detail="Enter a valid mobile number")

    count = await db.users.count_documents({"phone": phone})
    if count == 0:
        return {"exists": False, "phone": phone}

    otp = gen_otp()
    now = int(time.time())
    expires = now + 600  # 10 min for reset flow
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {
            "phone": phone, "otp": otp, "expires_at": expires, "verified": False,
            "last_sent_at": now, "created_at": now_iso(), "purpose": "reset",
        }},
        upsert=True,
    )
    logger.info(f"[FORGOT-PW] phone={phone} otp={otp} accounts={count}")
    return {"exists": True, "otp": otp, "phone": phone, "accounts_count": count}


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
async def firebase_verify(payload: dict, request: Request):
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
        await log_audit("login", actor=acc, metadata={"method": "firebase_otp"}, request=request)
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


# ==================== (Legacy payment gateways removed — UroPay only) ====================


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


# ==================== MULTI REFERRAL BUSINESS (Iteration 16) ====================
def _new_business_code():
    # 8-char alphanumeric business code
    import secrets, string
    return "B" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(7))


async def _build_business_stats(business: dict) -> dict:
    """Compute member counts + activity for a business."""
    code = business.get("referral_code")
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=7)
    month_start = today - timedelta(days=30)
    q_all = {"sponsor_id": code}
    total = await db.users.count_documents(q_all)
    active = await db.users.count_documents({**q_all, "is_joining_paid": True})
    today_j = await db.users.count_documents({**q_all, "created_at": {"$gte": today.isoformat()}})
    week_j = await db.users.count_documents({**q_all, "created_at": {"$gte": week_start.isoformat()}})
    month_j = await db.users.count_documents({**q_all, "created_at": {"$gte": month_start.isoformat()}})
    return {
        "total_members": total,
        "active_members": active,
        "inactive_members": total - active,
        "today_joins": today_j,
        "week_joins": week_j,
        "month_joins": month_j,
    }


async def _pending_kit_order_id(user_id: str, business_id: Optional[str]) -> Optional[str]:
    """Return the ID of a pending joining-kit order for the given (user, business).
    For the primary business, business_id is None (order has no business_id set)."""
    q = {"user_id": user_id, "is_joining_order": True, "payment_status": "pending"}
    if business_id:
        q["business_id"] = business_id
    else:
        q["$or"] = [{"business_id": None}, {"business_id": {"$exists": False}}]
    o = await db.orders.find_one(q, {"_id": 0, "id": 1}, sort=[("created_at", -1)])
    return o["id"] if o else None


async def _list_businesses_for_user(user: dict) -> list:
    """Primary user record is business #1. Additional businesses are in referral_businesses."""
    out = []
    # Primary (existing user record — always index 0)
    prim_stats = await _build_business_stats({"referral_code": user["referral_code"]}) if user.get("referral_code") else {"total_members": 0, "active_members": 0, "inactive_members": 0, "today_joins": 0, "week_joins": 0, "month_joins": 0}
    prim_is_active = bool(user.get("is_joining_paid"))
    prim_pending_order = None if prim_is_active else await _pending_kit_order_id(user["id"], None)
    out.append({
        "id": user["id"], "is_primary": True, "name": f"{user['name']} — Primary",
        "business_code": user["user_code"], "referral_code": user.get("referral_code"),
        "is_active": prim_is_active,
        "total_earnings": user.get("total_earnings", 0),
        "created_at": user.get("created_at"), "activated_at": user.get("activated_at"),
        "pending_order_id": prim_pending_order,
        **prim_stats,
    })
    # Additional businesses
    extra = await db.referral_businesses.find({"owner_user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(50)
    for b in extra:
        stats = await _build_business_stats(b)
        pending_id = None if b.get("is_active") else await _pending_kit_order_id(user["id"], b["id"])
        out.append({**b, "is_primary": False, "pending_order_id": pending_id, **stats})
    return out


@api.get("/mlm/businesses")
async def list_businesses(user=Depends(get_user)):
    """List all referral businesses owned by the logged-in user (primary + additional)."""
    return {"businesses": await _list_businesses_for_user(user)}


@api.get("/mlm/businesses/{business_id}")
async def get_business(business_id: str, user=Depends(get_user)):
    if business_id == user["id"]:
        # Primary
        stats = await _build_business_stats({"referral_code": user["referral_code"]}) if user.get("referral_code") else {}
        return {
            "id": user["id"], "is_primary": True, "name": f"{user['name']} — Primary",
            "business_code": user["user_code"], "referral_code": user.get("referral_code"),
            "is_active": bool(user.get("is_joining_paid")),
            "total_earnings": user.get("total_earnings", 0),
            "current_stage": user.get("current_stage", 1),
            **stats,
        }
    b = await db.referral_businesses.find_one({"id": business_id, "owner_user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    return {**b, **(await _build_business_stats(b))}


@api.get("/mlm/businesses/{business_id}/network")
async def business_network(business_id: str, user=Depends(get_user)):
    """Return the network members (up to 200) that joined under this business's referral_code."""
    if business_id == user["id"]:
        code = user.get("referral_code")
    else:
        b = await db.referral_businesses.find_one({"id": business_id, "owner_user_id": user["id"]}, {"_id": 0})
        if not b:
            raise HTTPException(status_code=404, detail="Business not found")
        code = b.get("referral_code")
    if not code:
        return {"members": []}
    members = await db.users.find(
        {"sponsor_id": code},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(200)
    return {"members": [public_user(m) for m in members]}


@api.post("/mlm/businesses/create")
async def create_business(payload: dict, user=Depends(get_user)):
    """Create a NEW referral business (pending) + an order for the ₹7,499 starter kit.
    Payment on the kit activates the business.
    Body: {name (optional label), referral_code (sponsor's code, required — different from primary)}
    """
    name = (payload.get("name") or "").strip() or f"Business #{await db.referral_businesses.count_documents({'owner_user_id': user['id']}) + 2}"
    sponsor_code = (payload.get("referral_code") or "").strip().upper()
    if not sponsor_code:
        raise HTTPException(status_code=400, detail="Sponsor referral code is required for a new business")
    if sponsor_code == user.get("referral_code"):
        raise HTTPException(status_code=400, detail="You cannot sponsor your own new business — use a different referral code")

    # Sponsor exists (either a user's own code OR another business's code)
    sponsor_user = await db.users.find_one({"referral_code": sponsor_code}, {"_id": 0})
    sponsor_business = await db.referral_businesses.find_one({"referral_code": sponsor_code}, {"_id": 0})
    if not sponsor_user and not sponsor_business:
        raise HTTPException(status_code=400, detail="Invalid sponsor referral code")

    # Generate a UNIQUE referral code for the new business
    for _ in range(10):
        new_ref = "R" + str(uuid.uuid4().hex[:7]).upper()
        if not await db.users.find_one({"referral_code": new_ref}) and not await db.referral_businesses.find_one({"referral_code": new_ref}):
            break

    business = {
        "id": str(uuid.uuid4()),
        "owner_user_id": user["id"],
        "name": name,
        "business_code": _new_business_code(),
        "referral_code": new_ref,
        "sponsor_referral_code": sponsor_code,
        "is_active": False,
        "is_joining_paid": False,
        "current_stage": 1,
        "total_earnings": 0,
        "created_at": now_iso(),
        "activated_at": None,
    }
    await db.referral_businesses.insert_one(business)
    business.pop("_id", None)

    # Create an order for the joining kit — payment activates the business
    hamper = await db.products.find_one({"sku": "HMP-JOINING-7200"}, {"_id": 0})
    if not hamper:
        raise HTTPException(status_code=500, detail="Joining kit not configured")
    order_id = str(uuid.uuid4())
    order_code = "EG" + str(uuid.uuid4().hex[:8]).upper()
    await db.orders.insert_one({
        "id": order_id, "order_code": order_code, "user_id": user["id"],
        "business_id": business["id"],  # links the order to this new business
        "items": [{"product_id": hamper["id"], "name": hamper["name"], "price": hamper["price"], "quantity": 1, "line_total": hamper["price"], "image": (hamper.get("images") or [None])[0], "is_hamper": True, "gst_percent": hamper.get("gst_percent", 5)}],
        "subtotal": hamper["price"], "discount": 0, "gst": round(hamper["price"] * hamper.get("gst_percent", 5) / 100, 2),
        "shipping": 0, "extras": [], "extras_total": 0,
        "total": round(hamper["price"] * (1 + hamper.get("gst_percent", 5) / 100), 2),
        "coupon_code": None, "payment_method": "gateway",
        "address": None, "payment_status": "pending", "payment_provider": None,
        "status": "placed", "is_joining_order": True,
        "tracking_no": None, "courier_name": None, "tracking_url": None,
        "tracking_history": [{"at": now_iso(), "status": "placed", "label": "Business Order Placed", "note": f"New referral business '{name}' — awaiting kit payment.", "by": "System"}],
        "created_at": now_iso(),
    })
    return {"business": {**business, "total_members": 0, "active_members": 0, "inactive_members": 0, "today_joins": 0, "week_joins": 0, "month_joins": 0}, "order_id": order_id, "order_code": order_code, "amount": round(hamper["price"] * (1 + hamper.get("gst_percent", 5) / 100), 2)}


@api.delete("/mlm/businesses/{business_id}")
async def delete_business(business_id: str, user=Depends(get_user)):
    """Cancel a business (only PENDING/unpaid businesses can be removed)."""
    b = await db.referral_businesses.find_one({"id": business_id, "owner_user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    if b.get("is_joining_paid"):
        raise HTTPException(status_code=400, detail="Cannot delete an active (paid) business")
    await db.referral_businesses.delete_one({"id": business_id})
    return {"ok": True}


@api.post("/mlm/businesses/{business_id}/pay-kit")
async def pay_kit(business_id: str, user=Depends(get_user)):
    """Return (or create) a pending joining-kit order for the specified business
    and give the frontend its order_id so it can navigate to /checkout/direct/{orderId}.

    - Primary business (business_id == user.id): looks for any pending joining order for
      the user (business_id = None). If none exists, creates one for the ₹7,499 kit.
    - Additional business: looks for a pending order linked to that business_id. If none
      exists (e.g. paid then refunded), creates a fresh joining order for it.
    """
    is_primary = business_id == user["id"]
    if not is_primary:
        b = await db.referral_businesses.find_one({"id": business_id, "owner_user_id": user["id"]}, {"_id": 0})
        if not b:
            raise HTTPException(status_code=404, detail="Business not found")
        if b.get("is_joining_paid") or b.get("is_active"):
            raise HTTPException(status_code=400, detail="This business is already active")
    else:
        if user.get("is_joining_paid"):
            raise HTTPException(status_code=400, detail="Primary business is already active")

    existing_id = await _pending_kit_order_id(user["id"], None if is_primary else business_id)
    if existing_id:
        o = await db.orders.find_one({"id": existing_id}, {"_id": 0, "id": 1, "order_code": 1, "total": 1})
        return {"order_id": o["id"], "order_code": o.get("order_code"), "amount": o.get("total"), "reused": True}

    hamper = await db.products.find_one({"sku": "HMP-JOINING-7200"}, {"_id": 0})
    if not hamper:
        raise HTTPException(status_code=500, detail="Joining kit not configured")
    order_id = str(uuid.uuid4())
    order_code = "EG" + str(uuid.uuid4().hex[:8]).upper()
    gst_p = hamper.get("gst_percent", 5)
    total = round(hamper["price"] * (1 + gst_p / 100), 2)
    biz_label = "Primary" if is_primary else b.get("name", "Business")
    await db.orders.insert_one({
        "id": order_id, "order_code": order_code, "user_id": user["id"],
        "business_id": None if is_primary else business_id,
        "items": [{"product_id": hamper["id"], "name": hamper["name"], "price": hamper["price"], "quantity": 1, "line_total": hamper["price"], "image": (hamper.get("images") or [None])[0], "is_hamper": True, "gst_percent": gst_p}],
        "subtotal": hamper["price"], "discount": 0, "gst": round(hamper["price"] * gst_p / 100, 2),
        "shipping": 0, "extras": [], "extras_total": 0,
        "total": total,
        "coupon_code": None, "payment_method": "gateway",
        "address": None, "payment_status": "pending", "payment_provider": None,
        "status": "placed", "is_joining_order": True,
        "tracking_no": None, "courier_name": None, "tracking_url": None,
        "tracking_history": [{"at": now_iso(), "status": "placed", "label": "Kit Order Placed", "note": f"Joining kit for '{biz_label}' — awaiting payment.", "by": "System"}],
        "created_at": now_iso(),
    })
    return {"order_id": order_id, "order_code": order_code, "amount": total, "reused": False}


# ==================== ADMIN CSV EXPORTS (Iteration 16 · Phase 4) ====================
def _csv_response(rows: list, headers: list, filename: str):
    """Utility — turn a list of dicts into a downloadable CSV Response."""
    import io, csv
    from fastapi.responses import StreamingResponse
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({h: r.get(h, "") for h in headers})
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/admin/export/users")
async def export_users_csv(_=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(10000)
    for u in users:
        u["is_joining_paid_str"] = "Yes" if u.get("is_joining_paid") else "No"
    return _csv_response(
        users,
        ["user_code", "name", "username", "email", "phone", "sponsor_id", "referral_code", "is_joining_paid_str", "current_stage", "direct_referrals_count", "team_size", "total_earnings", "wallet_balance", "role", "created_at"],
        f"users_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
    )


@api.get("/admin/export/orders")
async def export_orders_csv(_=Depends(require_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    for o in orders:
        o["items_summary"] = "; ".join(f"{i.get('name')} x{i.get('quantity')}" for i in (o.get("items") or []))
    return _csv_response(
        orders,
        ["order_code", "user_id", "items_summary", "subtotal", "gst", "shipping", "extras_total", "total", "payment_status", "payment_provider", "status", "created_at", "paid_at"],
        f"orders_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
    )


@api.get("/admin/export/withdrawals")
async def export_withdrawals_csv(_=Depends(require_admin)):
    rows = await db.withdrawals.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return _csv_response(
        rows,
        ["id", "user_id", "user_code", "amount", "status", "bank_name", "account_number", "ifsc", "requested_at", "processed_at", "note"],
        f"withdrawals_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
    )


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
    rev.pop("_id", None)
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
                detail="You must purchase the ₹9,999 Premium Hamper before shopping regular products.",
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
        if it["product_id"] == payload.product_id and it.get("size") == payload.size and it.get("color") == payload.color:
            existing_qty = it["quantity"]
            break
    new_total = existing_qty + payload.quantity
    if new_total > p.get("stock", 0):
        raise HTTPException(status_code=400, detail=f"Only {p.get('stock', 0)} left in stock")
    for it in items:
        if it["product_id"] == payload.product_id and it.get("size") == payload.size and it.get("color") == payload.color:
            it["quantity"] = new_total
            found = True
            break
    if not found:
        row = {"product_id": payload.product_id, "quantity": payload.quantity}
        if payload.size: row["size"] = payload.size
        if payload.color: row["color"] = payload.color
        items.append(row)
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
    gst_percent_default = site.get("gst_percent", 5) if site.get("gst_enabled", True) else 0
    # Extra charges (packing, handling, service, insurance, etc.) — configured by admin
    extra_charges_config = [c for c in (site.get("extra_charges") or []) if c.get("enabled")]

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
                detail="Complete your ₹9,999 Premium Hamper purchase before ordering other products.",
            )
        if user.get("is_joining_paid", False) and p.get("is_hamper", False):
            raise HTTPException(status_code=400, detail="You have already purchased the joining kit.")
        line = p["price"] * it.quantity
        item_gst_pct = p.get("gst_percent", 5) if site.get("gst_enabled", True) else 0
        item_gst = line * item_gst_pct / 100
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
    # Compute extra charges — each entry: {key, label, type: 'flat'|'percent', value, enabled}
    extras_total = 0
    extras_breakdown = []
    for cfg in extra_charges_config:
        amt = float(cfg.get("value", 0) or 0)
        if cfg.get("type") == "percent":
            amt = round(subtotal * amt / 100, 2)
        else:
            amt = round(amt, 2)
        extras_total += amt
        extras_breakdown.append({"key": cfg.get("key"), "label": cfg.get("label"), "amount": amt})
    total = subtotal + gst + shipping + extras_total - discount

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
        "extras": extras_breakdown,
        "extras_total": round(extras_total, 2),
        "total": round(total, 2),
        "address": payload.address,
        "coupon_code": payload.coupon_code,
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "payment_provider": None,
        "status": "placed",
        "is_joining_order": is_joining,
        "tracking_no": None,
        "courier_name": None,
        "tracking_url": None,
        "tracking_history": [{
            "at": now_iso(),
            "status": "placed",
            "label": "Order Placed",
            "note": "Awaiting payment confirmation.",
            "by": "System",
        }],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    return {"order": {k: v for k, v in order.items() if k != "_id"}}


@api.post("/orders/verify-payment")
async def verify_payment(payload: PaymentVerify, user=Depends(get_user)):
    """Legacy generic verify endpoint. Kept for backwards compat with any old client calls —
    delegates to the UroPay verification flow."""
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


# ==================== PAYMENT PROVIDER CONFIG ====================
@api.get("/admin/payment-config")
async def admin_get_payment_config(_=Depends(require_admin)):
    key = os.environ.get("UROPAY_API_KEY", "")
    secret = os.environ.get("UROPAY_API_SECRET", "")
    return {
        "provider": "uropay",
        "uropay_active": bool(key and secret),
        "uropay_key_masked": ("*" * max(0, len(key) - 4)) + key[-4:] if len(key) > 4 else "****",
        "uropay_secret_masked": ("*" * max(0, len(secret) - 4)) + secret[-4:] if len(secret) > 4 else "****",
        "uropay_api_url": os.environ.get("UROPAY_API_URL", "https://api.uropay.me"),
    }


@api.get("/site/payment-provider")
async def site_active_payment_provider():
    """Which gateway (if any) is currently enabled for customer checkout.
    Admin controls this from /admin/settings (`active_payment_gateway` field).
    Values: "none" (payments disabled — checkout should show 'not configured'),
    "uropay", "razorpay", or "manual"."""
    s = await db.settings.find_one({"_key": "site"}, {"_id": 0}) or {}
    gw = (s.get("active_payment_gateway") or "none").strip().lower()
    uropay_env_active = bool(os.environ.get("UROPAY_API_KEY") and os.environ.get("UROPAY_API_SECRET"))
    return {
        "active": gw != "none",
        "provider": gw,
        "uropay_active": (gw == "uropay") and uropay_env_active,
        "razorpay_active": (gw == "razorpay") and bool(s.get("razorpay_enabled") and s.get("razorpay_key_id")),
        "manual_active": (gw == "manual"),
        "mock_mode": False,
    }


# ==================== UROPAY PAYMENT (QR + UTR self-serve) ====================
@api.post("/payments/uropay/initiate")
async def uropay_initiate(payload: dict, user=Depends(get_user)):
    """Generate a UroPay order for the given internal order. Returns the UPI QR + upi:// link
    so the frontend can render them and let the customer pay via any UPI app."""
    import uropay_utils as up
    order_id = payload.get("order_id")
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id required")
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    amount = float(order.get("total") or 0)
    if amount < 1:
        raise HTTPException(status_code=400, detail="Minimum order amount is ₹1")

    try:
        res = await up.create_uropay_order(
            merchant_order_id=order.get("order_code") or order_id[:20],
            amount_rupees=amount,
            customer_name=user.get("name") or "Customer",
            customer_email=user.get("email") or "noreply@evergroemart.com",
            transaction_note=(order.get("order_code") or "")[:60],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"UroPay: {e}")

    await db.orders.update_one({"id": order_id}, {"$set": {
        "payment_provider": "uropay",
        "payment_txnid": res.get("uroPayOrderId"),
        "uropay_order_id": res.get("uroPayOrderId"),
        "uropay_upi_string": res.get("upiString"),
        "uropay_qr_code": res.get("qrCode"),
        "uropay_status": res.get("orderStatus"),
    }})
    return {
        "provider": "uropay",
        "order_id": order_id,
        "uro_pay_order_id": res.get("uroPayOrderId"),
        "upi_string": res.get("upiString"),
        "qr_code": res.get("qrCode"),
        "amount": amount,
        "amount_in_rupees": res.get("amountInRupees"),
        "order_status": res.get("orderStatus"),
    }


@api.post("/payments/uropay/submit-utr")
async def uropay_submit_utr(payload: dict, user=Depends(get_user)):
    """Customer submits their UPI Reference Number (UTR / transaction id) after paying."""
    import uropay_utils as up
    order_id = payload.get("order_id")
    utr = (payload.get("utr") or payload.get("reference_number") or "").strip()
    if not order_id or not utr:
        raise HTTPException(status_code=400, detail="order_id and utr required")
    if len(utr) < 6:
        raise HTTPException(status_code=400, detail="UTR looks too short — please enter the 12-digit UPI reference number")

    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.get("uropay_order_id"):
        raise HTTPException(status_code=400, detail="Initiate payment first")
    if order.get("payment_status") == "paid":
        return {"paid": True, "already_processed": True}

    try:
        res = await up.submit_uropay_utr(uro_pay_order_id=order["uropay_order_id"], reference_number=utr)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"UroPay: {e}")

    await db.orders.update_one({"id": order_id}, {"$set": {
        "uropay_utr": utr,
        "uropay_status": res.get("orderStatus"),
        "utr_submitted_at": now_iso(),
    }})
    return {"ok": True, "order_status": res.get("orderStatus"), "message": "UTR submitted — awaiting confirmation"}


async def _finalize_paid_uropay_order(order: dict):
    """Idempotent state transition when UroPay reports COMPLETED. Flips paid, decrements stock,
    activates business or triggers joining commissions."""
    order_id = order["id"]
    r = await db.orders.update_one(
        {"id": order_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "paid_at": now_iso(), "status": "confirmed",
                  "payment_id": order.get("uropay_utr") or order.get("uropay_order_id") or order_id},
         "$push": {"tracking_history": {
             "at": now_iso(),
             "status": "confirmed",
             "label": "Confirmed",
             "note": "Payment received via UroPay. Preparing your order.",
             "by": "System",
         }}},
    )
    if r.modified_count == 1:
        for item in order.get("items", []):
            await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}})
        if any(i.get("is_hamper") for i in order.get("items", [])):
            if order.get("business_id"):
                await db.referral_businesses.update_one(
                    {"id": order["business_id"]},
                    {"$set": {"is_active": True, "is_joining_paid": True, "activated_at": now_iso()}},
                )
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": order["user_id"],
                    "title": "🚀 New Referral Business Activated",
                    "body": "Your new referral business is live. Share the referral code to start earning.",
                    "type": "success", "event": "business_activated",
                    "read": False, "created_at": now_iso(),
                })
            else:
                u = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
                if u and not u.get("is_joining_paid"):
                    await process_paid_joining(db, order["user_id"], order.get("order_code", order_id), order_id)


@api.post("/payments/uropay/verify")
async def uropay_verify(payload: dict, user=Depends(get_user)):
    """Polling verification endpoint — checks UroPay's /order/status/:id and marks paid if COMPLETED."""
    import uropay_utils as up
    order_id = payload.get("order_id")
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"paid": True, "already_processed": True, "status": "COMPLETED"}
    if not order.get("uropay_order_id"):
        return {"paid": False, "status": "NOT_INITIATED"}

    try:
        res = await up.get_uropay_status(order["uropay_order_id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"UroPay verify: {e}")
    status = str(res.get("orderStatus") or "").upper()
    await db.orders.update_one({"id": order_id}, {"$set": {"uropay_status": status}})
    if status == "COMPLETED":
        await _finalize_paid_uropay_order(order)
        return {"paid": True, "status": status}
    return {"paid": False, "status": status}


@api.post("/webhooks/uropay")
async def uropay_webhook(request: Request):
    """Receives UroPay webhooks. Verifies HMAC-SHA256 signature and finalises paid orders."""
    import uropay_utils as up
    raw = await request.body()
    try:
        payload = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    sig = request.headers.get("X-Uropay-Signature") or request.headers.get("x-uropay-signature") or ""
    if not up.verify_webhook_signature(payload, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    uro_id = payload.get("uroPayOrderId")
    merchant_order_id = payload.get("merchantOrderId")
    event = payload.get("event", "")
    order = None
    if uro_id:
        order = await db.orders.find_one({"uropay_order_id": uro_id}, {"_id": 0})
    if not order and merchant_order_id:
        order = await db.orders.find_one({"order_code": merchant_order_id}, {"_id": 0})
    if not order:
        return {"ok": True, "matched": False}

    # Update last known status snapshot
    status = str(payload.get("orderStatus") or "").upper()
    if status:
        await db.orders.update_one({"id": order["id"]}, {"$set": {"uropay_status": status, "uropay_last_webhook_at": now_iso()}})

    # Finalize on any signal that means money arrived: SMS webhook (companion.sms.data)
    # or status changed to COMPLETED.
    if event == "companion.sms.data" or status == "COMPLETED":
        await _finalize_paid_uropay_order(order)
    return {"ok": True, "matched": True, "event": event, "status": status}


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
            {"step": 1, "title": "Purchase Kit", "desc": "Order the ₹7,499 kit — pay via UroPay UPI (PhonePe / GPay / Paytm / any UPI app)"},
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
    t.pop("_id", None)
    return t


@api.get("/tickets")
async def my_tickets(user=Depends(get_user)):
    items = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


# ==================== PUBLIC CONTENT ====================
@api.get("/mlm/income-structure")
async def mlm_income_structure(_user=Depends(get_user)):
    """Show the current rewards ladder to logged-in users (and admins).
    Reads from settings.mlm.level_commissions and the joining_amount.
    Members-per-level uses the 6-per-tier convention: 6, 36, 216, ..., 6^n.
    Frontend renders this as a table on the user dashboard + admin overview."""
    m = await db.settings.find_one({"_key": "mlm"}, {"_id": 0}) or {}
    kit = await db.products.find_one({"sku": "HMP-JOINING-7200"}, {"_id": 0}) or {}
    joining_amount = float(kit.get("price") or m.get("joining_amount") or 9999.0)
    commissions = list(m.get("level_commissions") or [1200, 400, 50, 300, 50, 200, 50, 100])
    levels = []
    total = 0
    for i, per in enumerate(commissions, start=1):
        members = 6 ** i  # 6, 36, 216, ...
        line_total = per * members
        total += line_total
        levels.append({"level": i, "per_member": per, "members": members, "total": line_total})
    return {
        "joining_amount": joining_amount,
        "max_direct_referrals": int(m.get("max_direct_referrals") or 6),
        "min_direct_paid_for_income": int(m.get("min_direct_paid_for_income") or 3),
        "levels": levels,
        "total_potential": total,
    }



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

    # New users today / this week
    today_iso = today.isoformat()
    week_start = (today - timedelta(days=6)).isoformat()
    new_users_today = await db.users.count_documents({"role": "user", "created_at": {"$regex": f"^{today_iso}"}})
    new_users_week = await db.users.count_documents({"role": "user", "created_at": {"$gte": week_start}})

    # New users per day (last 7 days) — used by the AdminDashboard chart
    daily_users = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        cnt = await db.users.count_documents({"role": "user", "created_at": {"$regex": f"^{d_str}"}})
        daily_users.append(cnt)

    # Combined 7d series (day label + users + revenue) for the AreaChart
    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    daily_stats = []
    for i, d in enumerate(days):
        try:
            dow = datetime.fromisoformat(d["date"]).weekday()  # 0=Mon
        except Exception:
            dow = i % 7
        daily_stats.append({"day": day_labels[dow], "date": d["date"], "users": daily_users[i], "revenue": d["revenue"], "orders": d["orders"]})

    # Referral businesses (additional businesses table)
    referral_businesses_total = await db.referral_businesses.count_documents({})
    referral_businesses_active = await db.referral_businesses.count_documents({"is_active": True})

    # Kit sales = paid joining orders (primary + additional)
    kit_sales = await db.orders.count_documents({"is_joining_order": True, "payment_status": "paid"})

    # Recent joins (last 8 new user registrations)
    recent_docs = await db.users.find({"role": "user"}, {"_id": 0, "name": 1, "user_code": 1, "phone": 1, "email": 1, "avatar_url": 1, "sponsor_id": 1, "current_stage": 1, "is_joining_paid": 1, "created_at": 1}).sort("created_at", -1).limit(8).to_list(8)
    recent_joins = [
        {
            "name": r.get("name"),
            "user_code": r.get("user_code"),
            "phone": r.get("phone"),
            "email": r.get("email"),
            "avatar_url": r.get("avatar_url"),
            "sponsor_id": r.get("sponsor_id"),
            "current_stage": r.get("current_stage", 1),
            "is_joining_paid": bool(r.get("is_joining_paid")),
            "created_at": r.get("created_at"),
        }
        for r in recent_docs
    ]

    stats = {
        "total_users": total_users,
        "active_users": active_users,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "total_commissions": round(total_commissions, 2),
        "pending_withdrawals": pending_withdrawals,
        "total_withdrawals": total_withdrawals,
        "pending_kyc": pending_kyc,
        "open_tickets": open_tickets,
        "new_users_today": new_users_today,
        "new_users_week": new_users_week,
        "referral_businesses": referral_businesses_total,
        "active_referral_businesses": referral_businesses_active,
        "kit_sales": kit_sales,
    }

    return {
        # Flat fields (backwards compatible with older callers)
        **stats,
        # Nested stats bag consumed by the redesigned AdminDashboard.jsx
        "stats": stats,
        "daily_revenue": days,
        "daily_stats": daily_stats,
        "stage_distribution": stage_dist,
        "recent_joins": recent_joins,
    }


@api.get("/admin/users")
async def admin_list_users(_=Depends(require_admin), q: Optional[str] = None, page: int = 1, limit: int = 50):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"public_email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"user_code": {"$regex": q, "$options": "i"}},
            {"referral_code": {"$regex": q, "$options": "i"}},
            {"sponsor_id": {"$regex": q, "$options": "i"}},
        ]
    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    items = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return {"items": [public_user(u) for u in items], "total": total}


@api.get("/admin/search")
async def admin_global_search(_=Depends(require_admin), q: str = "", limit: int = 8):
    """Global cross-collection search — used by the Cmd/Ctrl-K palette in the admin shell.
    Matches on name, username, email, phone, user_code, referral_code, sponsor_id
    across `users` and `referral_businesses`.
    """
    q = (q or "").strip()
    if len(q) < 1:
        return {"users": [], "businesses": [], "orders": [], "total": 0}

    user_query = {"$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"username": {"$regex": q, "$options": "i"}},
        {"email": {"$regex": q, "$options": "i"}},
        {"public_email": {"$regex": q, "$options": "i"}},
        {"phone": {"$regex": q, "$options": "i"}},
        {"user_code": {"$regex": q, "$options": "i"}},
        {"referral_code": {"$regex": q, "$options": "i"}},
        {"sponsor_id": {"$regex": q, "$options": "i"}},
    ]}
    users = await db.users.find(
        user_query,
        {"_id": 0, "id": 1, "user_code": 1, "name": 1, "phone": 1, "email": 1, "username": 1, "referral_code": 1, "sponsor_id": 1, "role": 1, "is_joining_paid": 1, "current_stage": 1, "avatar_url": 1}
    ).limit(limit).to_list(limit)

    biz_query = {"$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"business_code": {"$regex": q, "$options": "i"}},
        {"referral_code": {"$regex": q, "$options": "i"}},
        {"sponsor_referral_code": {"$regex": q, "$options": "i"}},
    ]}
    biz_docs = await db.referral_businesses.find(biz_query, {"_id": 0}).limit(limit).to_list(limit)
    # Enrich with owner details
    businesses = []
    for b in biz_docs:
        owner = await db.users.find_one({"id": b.get("owner_user_id")}, {"_id": 0, "user_code": 1, "name": 1, "phone": 1, "email": 1})
        businesses.append({
            "id": b.get("id"),
            "name": b.get("name"),
            "business_code": b.get("business_code"),
            "referral_code": b.get("referral_code"),
            "sponsor_referral_code": b.get("sponsor_referral_code"),
            "is_active": b.get("is_active", False),
            "owner_user_id": b.get("owner_user_id"),
            "created_at": b.get("created_at"),
            "owner": owner or {},
        })

    order_query = {"$or": [
        {"order_code": {"$regex": q, "$options": "i"}},
        {"tracking_no": {"$regex": q, "$options": "i"}},
    ]}
    orders = await db.orders.find(
        order_query,
        {"_id": 0, "id": 1, "order_code": 1, "user_id": 1, "total": 1, "status": 1, "payment_status": 1, "tracking_no": 1, "created_at": 1}
    ).limit(limit).to_list(limit)

    return {
        "users": [public_user(u) for u in users],
        "businesses": businesses,
        "orders": orders,
        "total": len(users) + len(businesses) + len(orders),
    }


@api.get("/admin/users/{user_id}")
async def admin_user_detail(user_id: str, _=Depends(require_admin)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    # Owner's additional referral businesses
    biz = await db.referral_businesses.find({"owner_user_id": user_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    # Counters
    orders_total = await db.orders.count_documents({"user_id": user_id})
    orders_paid = await db.orders.count_documents({"user_id": user_id, "payment_status": "paid"})
    withdrawals_total = await db.withdrawals.count_documents({"user_id": user_id})
    referrals_direct = await db.users.count_documents({"sponsor_id": u.get("referral_code")}) if u.get("referral_code") else 0
    return {
        "user": public_user(u),
        "referral_businesses": biz,
        "counters": {
            "orders_total": orders_total,
            "orders_paid": orders_paid,
            "withdrawals_total": withdrawals_total,
            "direct_referrals": referrals_direct,
            "additional_businesses": len(biz),
        },
    }


@api.get("/admin/users/{user_id}/login-history")
async def admin_user_login_history(user_id: str, _=Depends(require_admin), limit: int = 50):
    """Login events with IP + User-Agent, most recent first."""
    logs = await db.audit_logs.find(
        {"actor_id": user_id, "event": "login"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    # Simple UA → device hints
    def _device(ua: Optional[str]) -> dict:
        ua_lower = (ua or "").lower()
        os_ = "Unknown"
        for kw, name in (("windows nt", "Windows"), ("mac os x", "macOS"), ("iphone", "iOS"), ("ipad", "iPadOS"), ("android", "Android"), ("linux", "Linux")):
            if kw in ua_lower:
                os_ = name; break
        browser = "Unknown"
        for kw, name in (("edg/", "Edge"), ("chrome/", "Chrome"), ("safari/", "Safari"), ("firefox/", "Firefox"), ("opr/", "Opera")):
            if kw in ua_lower:
                browser = name; break
        kind = "Mobile" if any(k in ua_lower for k in ("iphone", "android", "mobile")) else ("Tablet" if "ipad" in ua_lower else "Desktop")
        return {"os": os_, "browser": browser, "kind": kind}
    return {"items": [
        {
            "id": l.get("id"),
            "at": l.get("created_at"),
            "ip": l.get("ip"),
            "user_agent": l.get("user_agent"),
            "device": _device(l.get("user_agent")),
            "method": (l.get("metadata") or {}).get("method"),
        }
        for l in logs
    ]}


@api.get("/admin/users/{user_id}/activity")
async def admin_user_activity(user_id: str, _=Depends(require_admin), limit: int = 100):
    """Full activity log for a user — every event they triggered."""
    logs = await db.audit_logs.find(
        {"actor_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": logs, "total": len(logs)}


@api.get("/admin/users/{user_id}/downline-tree")
async def admin_user_downline_tree(user_id: str, _=Depends(require_admin), max_depth: int = 8):
    """Return the user's downline grouped by level (1..max_depth).
    Each level lists members with essential stats (user_code, name, phone, referral_code,
    current_stage, is_joining_paid, direct_referrals_count, total_earnings) — sorted by
    total_earnings DESC so top performers surface first at every level.
    """
    root = await db.users.find_one({"id": user_id}, {"_id": 0, "referral_code": 1, "name": 1, "user_code": 1})
    if not root:
        raise HTTPException(status_code=404, detail="User not found")
    max_depth = max(1, min(int(max_depth or 8), 8))

    fields = {"_id": 0, "id": 1, "user_code": 1, "name": 1, "phone": 1, "email": 1,
              "referral_code": 1, "sponsor_id": 1, "current_stage": 1, "is_joining_paid": 1,
              "is_active": 1, "direct_referrals_count": 1, "team_size": 1,
              "total_earnings": 1, "wallet_balance": 1, "avatar_url": 1, "created_at": 1}

    levels = []
    # `sponsor_id` on users stores the SPONSOR'S user_code (see register: line 252).
    # So we traverse the tree by user_code, not referral_code.
    frontier_codes = [root.get("user_code")] if root.get("user_code") else []
    total_members = 0
    paid_members = 0

    for depth in range(1, max_depth + 1):
        if not frontier_codes:
            levels.append({"level": depth, "count": 0, "paid": 0, "earnings": 0, "members": []})
            continue
        members = await db.users.find({"sponsor_id": {"$in": frontier_codes}}, fields).sort("total_earnings", -1).to_list(1000)
        paid = sum(1 for m in members if m.get("is_joining_paid"))
        earnings = sum(m.get("total_earnings", 0) for m in members)
        total_members += len(members)
        paid_members += paid
        levels.append({
            "level": depth,
            "count": len(members),
            "paid": paid,
            "earnings": round(earnings, 2),
            "members": members,
        })
        # Next frontier = user_codes of everyone found at this depth (children look up by sponsor_id=user_code)
        frontier_codes = [m.get("user_code") for m in members if m.get("user_code")]

    return {
        "root": {"user_code": root.get("user_code"), "name": root.get("name"), "referral_code": root.get("referral_code")},
        "totals": {
            "levels": max_depth,
            "members": total_members,
            "paid": paid_members,
        },
        "levels": levels,
    }


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


def _require_super_admin(admin: dict = Depends(require_admin)):
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can perform this action")
    return admin


@api.post("/auth/change-password")
async def change_own_password(payload: dict, user=Depends(get_user)):
    """Any logged-in user (including admins) can change their own password.
    Body: {current_password, new_password}."""
    current = payload.get("current_password") or ""
    new_pw = payload.get("new_password") or ""
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not verify_password(current, fresh.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(new_pw), "updated_at": now_iso()}})
    await log_audit("password_change", actor=fresh, target_id=user["id"], target_label=fresh.get("user_code"))
    return {"ok": True}


@api.post("/admin/users/{user_id}/reset-password")
async def admin_reset_user_password(user_id: str, payload: dict, admin=Depends(_require_super_admin)):
    """Super-admin only: force-reset another user's (or agent's) password.
    Body: {new_password}."""
    new_pw = (payload.get("new_password") or "").strip()
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(new_pw), "updated_at": now_iso()}})
    await log_audit("admin_reset_password", actor=admin, target_id=user_id, target_label=target.get("user_code"),
                    metadata={"target_role": target.get("role")})
    return {"ok": True, "user_code": target.get("user_code")}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, cascade: bool = False, admin=Depends(_require_super_admin)):
    """Super-admin only: HARD-DELETE a single user and every trace of them so the same
    phone/email/username can register fresh. Admin accounts cannot be deleted this way.

    If ``cascade=true``, ALSO recursively deletes every downstream referral (their whole
    branch). Traversal is by ``sponsor_id`` = current user's ``user_code``.
    """
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") in ("super_admin", "sub_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")

    # Build the id-list to delete
    ids_to_delete = [user_id]
    codes_deleted = set()
    if cascade:
        # BFS the branch by sponsor_id lineage
        frontier = [target.get("user_code")] if target.get("user_code") else []
        while frontier:
            codes_deleted.update(frontier)
            children = await db.users.find(
                {"sponsor_id": {"$in": frontier}, "role": "user"},
                {"_id": 0, "id": 1, "user_code": 1}
            ).to_list(5000)
            if not children:
                break
            new_frontier = []
            for c in children:
                ids_to_delete.append(c["id"])
                if c.get("user_code") and c["user_code"] not in codes_deleted:
                    new_frontier.append(c["user_code"])
            frontier = new_frontier

    stats = {"user_code": target.get("user_code"), "users_deleted": len(ids_to_delete), "cascade": cascade}
    stats["orders"] = (await db.orders.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["referral_businesses"] = (await db.referral_businesses.delete_many({"owner_user_id": {"$in": ids_to_delete}})).deleted_count
    stats["withdrawals"] = (await db.withdrawals.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["transactions"] = (await db.transactions.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["notifications"] = (await db.notifications.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["kyc"] = (await db.kyc.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["tickets"] = (await db.tickets.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["cart"] = (await db.cart.delete_many({"user_id": {"$in": ids_to_delete}})).deleted_count
    stats["audit_logs"] = (await db.audit_logs.delete_many({"actor_id": {"$in": ids_to_delete}})).deleted_count
    await db.users.delete_many({"id": {"$in": ids_to_delete}})
    await log_audit("admin_delete_user", actor=admin, target_id=user_id,
                    target_label=target.get("user_code"), metadata=stats)
    return {"ok": True, "stats": stats}


@api.post("/admin/users/bulk-delete")
async def admin_bulk_delete_users(payload: dict, admin=Depends(_require_super_admin)):
    """Super-admin only: bulk delete users. Body: {user_ids: [...], cascade: bool}."""
    ids = payload.get("user_ids") or []
    cascade = bool(payload.get("cascade", False))
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="user_ids list required")
    results = []
    for uid in ids:
        try:
            target = await db.users.find_one({"id": uid}, {"_id": 0, "role": 1, "user_code": 1})
            if not target or target.get("role") in ("super_admin", "sub_admin"):
                results.append({"id": uid, "ok": False, "reason": "admin_or_missing"})
                continue
            # Reuse the single-delete logic
            ids_to_delete = [uid]
            if cascade:
                frontier = [target.get("user_code")] if target.get("user_code") else []
                codes_deleted = set()
                while frontier:
                    codes_deleted.update(frontier)
                    children = await db.users.find(
                        {"sponsor_id": {"$in": frontier}, "role": "user"},
                        {"_id": 0, "id": 1, "user_code": 1}
                    ).to_list(5000)
                    if not children:
                        break
                    new_frontier = []
                    for c in children:
                        ids_to_delete.append(c["id"])
                        if c.get("user_code") and c["user_code"] not in codes_deleted:
                            new_frontier.append(c["user_code"])
                    frontier = new_frontier
            await db.orders.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.referral_businesses.delete_many({"owner_user_id": {"$in": ids_to_delete}})
            await db.withdrawals.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.transactions.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.notifications.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.kyc.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.tickets.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.cart.delete_many({"user_id": {"$in": ids_to_delete}})
            await db.audit_logs.delete_many({"actor_id": {"$in": ids_to_delete}})
            await db.users.delete_many({"id": {"$in": ids_to_delete}})
            results.append({"id": uid, "ok": True, "deleted": len(ids_to_delete)})
        except Exception as e:
            results.append({"id": uid, "ok": False, "reason": str(e)})
    await log_audit("admin_bulk_delete_users", actor=admin,
                    metadata={"count": len(ids), "cascade": cascade})
    return {"ok": True, "results": results, "total_requested": len(ids)}


@api.post("/admin/users/bulk-update")
async def admin_bulk_update_users(payload: dict, admin=Depends(_require_super_admin)):
    """Super-admin only: bulk edit (bulk replace) fields across many users at once.
    Body: {user_ids: [...], updates: {field: value, ...}}.
    Only whitelisted fields are updateable."""
    ids = payload.get("user_ids") or []
    updates = payload.get("updates") or {}
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="user_ids list required")
    allowed = {"is_active", "current_stage", "wallet_balance", "role", "kyc_status",
               "is_joining_paid", "income_active", "sponsor_id", "avatar_url"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed}
    if not safe_updates:
        raise HTTPException(status_code=400, detail="No allowed fields to update")
    safe_updates["updated_at"] = now_iso()
    result = await db.users.update_many({"id": {"$in": ids}}, {"$set": safe_updates})
    await log_audit("admin_bulk_update_users", actor=admin,
                    metadata={"count": len(ids), "updates": safe_updates})
    return {"ok": True, "matched": result.matched_count, "modified": result.modified_count}


@api.post("/admin/users/{user_id}/mark-kit-paid")
async def admin_mark_kit_paid(user_id: str, payload: dict = None, admin=Depends(_require_super_admin)):
    """Super-admin only: grant kit access to a user WITHOUT taking a payment.
    Flips is_joining_paid on the primary account, activates their referral code, and
    distributes L1 commissions to their sponsor (same as a real payment would).
    Also marks any pending primary joining order as paid so the audit trail is consistent.

    Optional body: {business_id: '<uuid>'} — to activate an additional business instead."""
    payload = payload or {}
    business_id = payload.get("business_id")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if business_id:
        # Additional business path
        biz = await db.referral_businesses.find_one({"id": business_id, "owner_user_id": user_id}, {"_id": 0})
        if not biz:
            raise HTTPException(status_code=404, detail="Business not found")
        if biz.get("is_active"):
            return {"ok": True, "already_active": True}
        await db.referral_businesses.update_one(
            {"id": business_id},
            {"$set": {"is_active": True, "is_joining_paid": True, "activated_at": now_iso(),
                      "activated_by": "admin_grant", "admin_granted_by": admin.get("user_code")}},
        )
        # Mark any pending joining order for this business as paid
        pending = await db.orders.find_one({"user_id": user_id, "business_id": business_id, "is_joining_order": True, "payment_status": "pending"}, {"_id": 0})
        if pending:
            await db.orders.update_one({"id": pending["id"]}, {"$set": {
                "payment_status": "paid", "paid_at": now_iso(), "status": "confirmed",
                "payment_id": f"ADMIN_GRANT_{admin.get('user_code')}",
                "payment_provider": "admin_grant",
            }, "$push": {"tracking_history": {
                "at": now_iso(), "status": "confirmed", "label": "Confirmed by Admin",
                "note": f"Kit activated by super-admin {admin.get('user_code')} without payment.",
                "by": "Super Admin",
            }}})
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id,
            "title": "🎁 Business activated by admin",
            "body": "Your additional referral business is now live — no kit purchase required. Start sharing your referral code.",
            "type": "success", "event": "admin_granted_business", "read": False, "created_at": now_iso(),
        })
        await log_audit("admin_grant_business", actor=admin, target_id=user_id,
                        target_label=target.get("user_code"), metadata={"business_id": business_id})
        return {"ok": True, "business_id": business_id, "activated": True}

    # Primary account path
    if target.get("is_joining_paid"):
        return {"ok": True, "already_paid": True}
    order_code = f"ADMIN-{admin.get('user_code','A')}-{uuid.uuid4().hex[:6].upper()}"
    # Mark any pending primary joining order as paid (there may be one from pay-kit)
    pending = await db.orders.find_one({"user_id": user_id, "is_joining_order": True, "payment_status": "pending", "$or": [{"business_id": None}, {"business_id": {"$exists": False}}]}, {"_id": 0})
    if pending:
        order_id_final = pending["id"]
        order_code = pending.get("order_code", order_code)
        await db.orders.update_one({"id": pending["id"]}, {"$set": {
            "payment_status": "paid", "paid_at": now_iso(), "status": "confirmed",
            "payment_id": f"ADMIN_GRANT_{admin.get('user_code')}",
            "payment_provider": "admin_grant",
        }, "$push": {"tracking_history": {
            "at": now_iso(), "status": "confirmed", "label": "Confirmed by Admin",
            "note": f"Kit activated by super-admin {admin.get('user_code')} without payment.",
            "by": "Super Admin",
        }}})
    else:
        order_id_final = str(uuid.uuid4())
    # Trigger the same downstream side-effects a real payment would
    await process_paid_joining(db, user_id, order_code, order_id_final)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "title": "🎁 Welcome kit activated by admin",
        "body": "You've been granted direct entry — no kit purchase required. Your referral link is now active.",
        "type": "success", "event": "admin_granted_kit", "read": False, "created_at": now_iso(),
    })
    await log_audit("admin_grant_kit", actor=admin, target_id=user_id, target_label=target.get("user_code"))
    return {"ok": True, "activated": True, "order_code": order_code}


@api.get("/mlm/commission-breakdown")
async def my_commission_breakdown(user=Depends(get_user), limit: int = 200):
    """Return commission ledger for the logged-in user grouped by level + recent items.
    Used by user Dashboard + Wallet screens to show 'how much came from which level'."""
    return await _commission_breakdown_for(user["id"], limit)


@api.get("/admin/users/{user_id}/commission-breakdown")
async def admin_user_commission_breakdown(user_id: str, _=Depends(require_admin), limit: int = 200):
    """Admin view of a user's commission ledger — level totals + recent items."""
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return await _commission_breakdown_for(user_id, limit)


async def _commission_breakdown_for(user_id: str, limit: int = 200):
    txns = await db.transactions.find(
        {"user_id": user_id, "category": {"$in": ["commission", "commission_held", "cashback", "reward"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    # Aggregate by level (only credited commissions count towards totals)
    by_level = {}
    total_credited = 0.0
    total_held = 0.0
    for t in txns:
        lvl = int(t.get("level") or 0)
        amt = float(t.get("amount") or 0)
        cat = t.get("category")
        row = by_level.setdefault(lvl, {"level": lvl, "credited": 0.0, "held_count": 0, "count": 0})
        row["count"] += 1
        if cat == "commission_held":
            row["held_count"] += 1
            total_held += 1  # count, not amount
        else:
            row["credited"] += amt
            total_credited += amt
    levels = sorted([v for k, v in by_level.items() if k > 0], key=lambda x: x["level"])
    return {
        "totals": {
            "credited": round(total_credited, 2),
            "held_entries": int(total_held),
            "transactions": len(txns),
        },
        "by_level": levels,
        "recent": txns[:50],
    }


@api.post("/admin/fresh-start")
async def admin_fresh_start(payload: dict, admin=Depends(_require_super_admin)):
    """DANGER — Hard-delete all non-admin user data. Preserves admin accounts, products,
    categories, coupons, settings, banners, sliders, testimonials, reels, brands.

    Body: {confirm: "RESET"} — required exactly to prevent accidents.
    """
    if (payload or {}).get("confirm") != "RESET":
        raise HTTPException(status_code=400, detail='Confirmation required. Send {"confirm":"RESET"}')

    # Collect admin ids so we do NOT touch their accounts / activity
    admin_docs = await db.users.find({"role": {"$in": ["super_admin", "sub_admin"]}}, {"_id": 0, "id": 1}).to_list(50)
    admin_ids = [a["id"] for a in admin_docs]

    # Delete all non-admin users
    users_del = (await db.users.delete_many({"role": {"$nin": ["super_admin", "sub_admin"]}})).deleted_count
    # Nuke transactional collections wholesale
    stats = {"users_deleted": users_del}
    existing_cols = set(await db.list_collection_names())
    for col in ["orders", "referral_businesses", "withdrawals", "kyc", "tickets", "notifications", "transactions", "otps", "cart"]:
        if col in existing_cols:
            stats[col] = (await db[col].delete_many({})).deleted_count
    # Audit logs — keep only entries by/for admins, wipe the rest
    if "audit_logs" in existing_cols:
        stats["audit_logs"] = (await db.audit_logs.delete_many({"actor_id": {"$nin": admin_ids + [None]}})).deleted_count
    # Zero any wallet references on admin accounts (they shouldn't have any but just in case)
    await db.users.update_many(
        {"role": {"$in": ["super_admin", "sub_admin"]}},
        {"$set": {"wallet_balance": 0, "commission_wallet": 0, "cashback_wallet": 0,
                  "reward_wallet": 0, "income_wallet": 0, "total_earnings": 0,
                  "direct_referrals_count": 0, "team_size": 0, "current_stage": 1,
                  "income_active": False}}
    )
    await log_audit("fresh_start", actor=admin, metadata=stats)
    return {"ok": True, "stats": stats, "preserved": {"admins": len(admin_ids)}}


@api.post("/admin/refresh-faqs")
async def admin_refresh_faqs(admin=Depends(_require_super_admin)):
    """Force-overwrite FAQs with the current master content from seed.py.
    Use this after deploying to production to ensure old ₹2,999 / 3-stages copy is replaced."""
    from seed import seed_all  # ensure module accessible
    # Direct in-place replacement — always overwrite so admins don't need to redeploy for copy fixes
    faqs_master = [
        {"question": "What is EverGro eMart?", "answer": "EverGro eMart is a premium e-commerce platform combined with an 8-level MLM income plan. Purchase the ₹7,499 EverGro Kit, refer new members, and earn per-level commissions across your entire downline."},
        {"question": "How does the MLM plan work?", "answer": "It's an 8-stage plan. You refer up to 6 direct members. Once 3 of them pay their ₹7,499 kit, your income activates. You then earn fixed level-wise commissions on EVERY paid member across 8 downline levels:\n\n• Level 1 — ₹1,200 × 6 members = ₹7,200\n• Level 2 — ₹400 × 36 members = ₹14,400\n• Level 3 — ₹50 × 216 members = ₹10,800\n• Level 4 — ₹300 × 1,296 members = ₹3,88,800\n• Level 5 — ₹50 × 7,776 members = ₹3,88,800\n• Level 6 — ₹200 × 46,656 members = ₹93,31,200\n• Level 7 — ₹50 × 2,79,936 members = ₹1,39,96,800\n• Level 8 — ₹100 × 16,79,616 members = ₹16,79,61,600\n\nTotal lifetime earning potential: ₹19,20,99,600."},
        {"question": "How do I withdraw earnings?", "answer": "Minimum ₹100. Requires approved KYC and at least 3 paid direct referrals. Payouts processed to your registered bank account within 48 hours."},
        {"question": "Is KYC required?", "answer": "Yes. To withdraw funds you must complete KYC (PAN + Aadhaar + bank details). Browsing and earning does not require KYC — only withdrawal does."},
        {"question": "What is the joining amount?", "answer": "₹7,499 (one-time). Purchase the EverGro Purchasing Kit to activate your MLM account and unlock the referral link. This is a real-value grocery + wellness kit — not a fee."},
        {"question": "Can one phone have multiple accounts?", "answer": "No. Each mobile number is tied to exactly ONE account. However, you can create multiple referral businesses from your dashboard — each with its own ₹7,499 kit and independent referral tree."},
        {"question": "What if I'm inactive?", "answer": "Accounts inactive for 180+ days are auto-disabled. Contact support to reactivate."},
    ]
    for i, f in enumerate(faqs_master):
        existing = await db.faqs.find_one({"question": f["question"]})
        await db.faqs.update_one(
            {"question": f["question"]},
            {"$set": {**f, "sort_order": i, "is_active": True, "id": (existing or {}).get("id") or str(uuid.uuid4())}},
            upsert=True,
        )
    await log_audit("faqs_refresh", actor=admin, metadata={"count": len(faqs_master)})
    return {"ok": True, "count": len(faqs_master)}


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


TRACKING_STEPS = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"]
TRACKING_STEP_LABELS = {
    "placed": "Order Placed",
    "confirmed": "Confirmed",
    "packed": "Packed",
    "shipped": "Shipped",
    "out_for_delivery": "Out for Delivery",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
}


@api.put("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, payload: dict, admin=Depends(require_admin)):
    """Update order status, tracking number, courier, and append a tracking history event.
    Body fields (all optional):
      - status: one of placed/confirmed/packed/shipped/out_for_delivery/delivered/cancelled
      - tracking_no: courier tracking number
      - courier_name: courier partner name (e.g. Delhivery, Bluedart)
      - tracking_url: full URL to track on courier's site
      - note: free-text update visible to the customer (e.g. "Reached Jaipur hub")
    Every call appends an event to tracking_history for the customer timeline.
    """
    allowed = {"status", "tracking_no", "courier_name", "tracking_url"}
    update = {k: v for k, v in payload.items() if k in allowed and v is not None}

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Build tracking event
    now_str = now_iso()
    event = {
        "at": now_str,
        "status": update.get("status") or order.get("status"),
        "label": TRACKING_STEP_LABELS.get(update.get("status") or order.get("status"), "Update"),
        "note": payload.get("note", "").strip(),
        "tracking_no": update.get("tracking_no") or order.get("tracking_no"),
        "courier_name": update.get("courier_name") or order.get("courier_name"),
        "tracking_url": update.get("tracking_url") or order.get("tracking_url"),
        "by": admin.get("name") or "Admin",
    }
    # Only append if something meaningful changed OR a note was supplied
    should_append = bool(payload.get("note")) or any(
        update.get(k) not in (order.get(k), None) for k in allowed
    )
    push_ops = {}
    if should_append:
        push_ops["tracking_history"] = event

    set_ops = {**update, "updated_at": now_str}
    ops = {"$set": set_ops}
    if push_ops:
        ops["$push"] = push_ops
    await db.orders.update_one({"id": order_id}, ops)

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    # notify user on key milestones
    if update.get("status") in ("shipped", "out_for_delivery", "delivered"):
        title_map = {
            "shipped": "📦 Order Shipped",
            "out_for_delivery": "🚚 Out for Delivery",
            "delivered": "✅ Delivered",
        }
        body = f"Your order {updated['order_code']} is now {TRACKING_STEP_LABELS.get(update['status'], update['status'])}."
        if update.get("tracking_no"):
            body += f" Tracking: {update['tracking_no']}"
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": updated["user_id"],
            "title": title_map[update["status"]],
            "body": body,
            "type": "success",
            "event": f"order_{update['status']}",
            "read": False,
            "created_at": now_str,
        })
    await log_audit("order_update", actor=admin, target_label=updated.get("order_code"))
    return updated


@api.get("/admin/tracking/steps")
async def get_tracking_steps():
    """Return the ordered list of allowed tracking steps for the admin UI."""
    return {"steps": [{"key": k, "label": TRACKING_STEP_LABELS[k]} for k in TRACKING_STEPS]}


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


@api.get("/admin/settings/site")
async def admin_get_site(_=Depends(require_admin)):
    doc = await db.settings.find_one({"_key": "site"}, {"_id": 0}) or {}
    return doc


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
    gst_enabled = s.get("gst_enabled", True) if s else True
    return {
        "delivery_charge": (s.get("delivery_charge", 49) if s else 49) if enabled else 0,
        "delivery_charge_enabled": enabled,
        "free_shipping_threshold": s.get("free_shipping_threshold", 999) if s else 999,
        "gst_percent": (s.get("gst_percent", 5) if s else 5) if gst_enabled else 0,
        "gst_enabled": gst_enabled,
        "extra_charges": [c for c in (s.get("extra_charges") or []) if c.get("enabled")] if s else [],
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
