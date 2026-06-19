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

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File
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
    process_new_referral, process_stage_progression, get_downline_tree,
    TOTAL_STAGES, REFERRALS_PER_STAGE, STAGE_COMMISSIONS, COMMISSION_STAGES,
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
        "name": u.get("name"),
        "email": u.get("email"),
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
MAX_REFERRALS_PER_LAYER = 6
INACTIVITY_DAYS = 180
MIN_REFERRALS_FOR_WITHDRAWAL = 3


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
async def register(payload: UserCreate):
    # Email must remain unique. Phone can repeat (user can have multiple accounts).
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    sponsor = None
    if payload.referral_code:
        sponsor = await db.users.find_one({"referral_code": payload.referral_code}, {"_id": 0})
        if not sponsor:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        # 6-per-layer rule: block if sponsor already has 6 direct referrals
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
        "name": payload.name,
        "email": payload.email,
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
        "permissions": [],
        "cycle_count": 0,
        "last_activity_at": now_iso(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    await log_audit("register", actor=user_doc, target_id=user_doc["id"], target_label=user_doc["user_code"],
                    metadata={"sponsor_code": sponsor["user_code"] if sponsor else None})

    # process referral
    if sponsor:
        await process_new_referral(db, user_doc)

    # welcome notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_doc["id"],
        "title": "👋 Welcome to EverGro eMart!",
        "body": f"Your account {user_code} is ready. Purchase a hamper to activate your MLM journey.",
        "type": "success",
        "event": "registration",
        "read": False,
        "created_at": now_iso(),
    })

    token = create_token(user_doc["id"], user_doc["role"])
    return {"token": token, "user": public_user(user_doc)}


@api.post("/auth/login")
async def login(payload: UserLogin):
    # Email: still unique → direct lookup. Phone: may have multiple accounts.
    if "@" in payload.identifier:
        user = await db.users.find_one({"email": payload.identifier}, {"_id": 0})
    else:
        # phone-based login — find an account whose password matches
        candidates = await db.users.find({"phone": payload.identifier}, {"_id": 0}).to_list(20)
        user = None
        for c in candidates:
            if verify_password(payload.password, c.get("password_hash", "")):
                user = c
                break
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


@api.post("/auth/otp/send")
async def send_otp(payload: OTPSendReq):
    otp = gen_otp()
    expires = int(time.time()) + 300  # 5 min
    await db.otps.update_one(
        {"phone": payload.phone},
        {"$set": {"phone": payload.phone, "otp": otp, "expires_at": expires, "verified": False, "created_at": now_iso()}},
        upsert=True,
    )
    logger.info(f"[DEV-OTP] phone={payload.phone} otp={otp}")
    # In dev mode we expose OTP in response so user can test easily
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
    accounts = [{"user_code": u["user_code"], "name": u["name"], "email": u["email"], "id": u["id"], "role": u.get("role", "user")} for u in users]
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


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPwReq):
    rec = await db.otps.find_one({"phone": payload.phone})
    if not rec or rec.get("otp") != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    await db.users.update_one(
        {"phone": payload.phone},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": now_iso()}}
    )
    return {"ok": True}


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
    direct_at_stage = await db.users.count_documents({"sponsor_user_id": user["id"], "joined_at_stage": user.get("current_stage", 1)})
    return {
        "user": public_user(user),
        "stats": {
            "orders_count": orders_count,
            "pending_withdrawals": pending_withdrawals,
            "unread_notifications": unread_notifications,
            "stage_progress": direct_at_stage,
            "stage_required": REFERRALS_PER_STAGE,
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
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
    items = cart.get("items", [])
    found = False
    for it in items:
        if it["product_id"] == payload.product_id:
            it["quantity"] += payload.quantity
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
        for it in items:
            if it["product_id"] == pid:
                it["quantity"] = qty
                break
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True, "items": items}


@api.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user=Depends(get_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    items = [i for i in cart.get("items", []) if i["product_id"] != product_id] if cart else []
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True}


@api.get("/coupons/validate/{code}")
async def validate_coupon(code: str):
    c = await db.coupons.find_one({"code": code, "is_active": True}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Invalid coupon")
    return c


# ==================== ORDERS ====================
@api.post("/orders/create")
async def create_order(payload: OrderCreate, user=Depends(get_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart empty")

    order_items = []
    subtotal = 0
    gst = 0
    is_joining = False
    for it in payload.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {it.product_id} not found")
        line = p["price"] * it.quantity
        item_gst = line * p.get("gst_percent", 5) / 100
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

    shipping = 0 if subtotal >= 999 else 49
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
        "razorpay_order_id": f"order_mock_{uuid.uuid4().hex[:14]}",
        "razorpay_payment_id": None,
        "status": "placed",
        "is_joining_order": is_joining,
        "tracking_no": None,
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    return {"order": {k: v for k, v in order.items() if k != "_id"}, "razorpay_mock": True}


@api.post("/orders/verify-payment")
async def verify_payment(payload: PaymentVerify, user=Depends(get_user)):
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # MOCK mode: auto-success
    await db.orders.update_one(
        {"id": payload.order_id},
        {"$set": {
            "payment_status": "paid",
            "razorpay_payment_id": payload.razorpay_payment_id,
            "status": "confirmed",
        }}
    )

    # decrement stock
    for it in order["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})

    # if joining order — activate user & start stage progression
    if order.get("is_joining_order") and not user.get("is_joining_paid"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"is_joining_paid": True, "updated_at": now_iso()}}
        )
        # for the SPONSOR: this user now counts toward stage completion
        if user.get("sponsor_user_id"):
            await process_stage_progression(db, user["sponsor_user_id"])

    # cashback 2%
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
        "stages_total": TOTAL_STAGES,
        "referrals_per_stage": REFERRALS_PER_STAGE,
        "stage_commissions": STAGE_COMMISSIONS,
        "commission_stages": COMMISSION_STAGES,
        "joining_amount": 2999,
    }


@api.get("/mlm/leaderboard")
async def leaderboard():
    items = await db.users.find(
        {"role": "user"}, {"_id": 0, "password_hash": 0}
    ).sort("total_earnings", -1).limit(20).to_list(20)
    return [{"user_code": u["user_code"], "name": u["name"], "stage": u.get("current_stage", 1),
             "team_size": u.get("team_size", 0), "total_earnings": u.get("total_earnings", 0),
             "avatar_url": u.get("avatar_url")} for u in items]


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
                                                      "razorpay_key_secret": 0,
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
        day_orders = [o for o in paid_orders if o.get("total") and True]
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
