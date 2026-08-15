"""MLM 8-LEVEL commission engine (Phase 2 spec)."""
from datetime import datetime, timezone
import uuid

# Level-based structure (per infographic)
MAX_LEVELS = 8
MAX_DIRECT_REFERRALS = 6  # 6-per-layer rule
MIN_DIRECT_PAID_FOR_INCOME = 3  # income starts when 3 direct members purchase
JOINING_AMOUNT = 7499.0

# Per-member commission at each level (index 0 = Level 1)
LEVEL_COMMISSIONS = [1200, 400, 50, 300, 50, 200, 50, 100]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def process_paid_joining(db, buyer_user_id: str, order_code: str, order_id: str):
    """Called when a user's JOINING order is verified paid.

    Steps:
    1. Activate buyer (is_joining_paid=True).
    2. Increment sponsor.direct_referrals_count (only paid refs count).
    3. If sponsor now has >=3 direct paid refs — mark sponsor income_active=True.
    4. Distribute per-level commission up to 8 levels (only to sponsors who are income_active).
    5. Give buyer welcome cashback (2% or fixed).
    6. Notify.
    """
    buyer = await db.users.find_one({"id": buyer_user_id}, {"_id": 0})
    if not buyer:
        return

    # Step 1 — activate buyer
    await db.users.update_one(
        {"id": buyer_user_id},
        {"$set": {"is_joining_paid": True, "is_active": True, "joining_paid_at": now_iso(),
                  "updated_at": now_iso()}},
    )
    buyer["is_joining_paid"] = True

    # Step 2 — increment sponsor's paid direct referrals
    sponsor_id = buyer.get("sponsor_user_id")
    if sponsor_id:
        await db.users.update_one(
            {"id": sponsor_id},
            {"$inc": {"direct_referrals_count": 1}, "$set": {"updated_at": now_iso()}},
        )
        # Bubble team_size up the chain
        await _bubble_team_size(db, sponsor_id)
        # If sponsor now qualifies for income, mark it
        sponsor = await db.users.find_one({"id": sponsor_id}, {"_id": 0})
        if sponsor and sponsor.get("direct_referrals_count", 0) >= MIN_DIRECT_PAID_FOR_INCOME and not sponsor.get("income_active"):
            await db.users.update_one({"id": sponsor_id}, {"$set": {"income_active": True, "income_activated_at": now_iso()}})
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": sponsor_id,
                "title": "🎉 Income Activated!",
                "body": "You've reached 3 direct paid referrals. Your MLM income is now LIVE across 8 levels!",
                "type": "success",
                "event": "income_activated",
                "read": False,
                "created_at": now_iso(),
            })

    # Step 4 — distribute level commissions
    await _distribute_level_commissions(db, buyer_user_id, order_code, order_id)


async def _bubble_team_size(db, starting_id: str):
    """Increment team_size for every upline node."""
    current = await db.users.find_one({"id": starting_id}, {"_id": 0})
    seen = set()
    while current and current["id"] not in seen:
        seen.add(current["id"])
        await db.users.update_one({"id": current["id"]}, {"$inc": {"team_size": 1}})
        if not current.get("sponsor_user_id"):
            break
        current = await db.users.find_one({"id": current["sponsor_user_id"]}, {"_id": 0})


async def _distribute_level_commissions(db, buyer_id: str, order_code: str, order_id: str):
    """Walk up 8 levels of sponsors and credit each per LEVEL_COMMISSIONS."""
    buyer = await db.users.find_one({"id": buyer_id}, {"_id": 0})
    if not buyer:
        return
    current_sponsor_id = buyer.get("sponsor_user_id")
    for level in range(1, MAX_LEVELS + 1):
        if not current_sponsor_id:
            break
        sponsor = await db.users.find_one({"id": current_sponsor_id}, {"_id": 0})
        if not sponsor:
            break

        # Only pay if sponsor is income_active (has 3+ direct paid referrals)
        eligible = (sponsor.get("direct_referrals_count", 0) >= MIN_DIRECT_PAID_FOR_INCOME)
        amount = LEVEL_COMMISSIONS[level - 1]

        if eligible and amount > 0:
            await db.users.update_one(
                {"id": sponsor["id"]},
                {"$inc": {
                    "commission_wallet": amount,
                    "wallet_balance": amount,
                    "total_earnings": amount,
                }, "$set": {"updated_at": now_iso()}},
            )
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": sponsor["id"],
                "user_code": sponsor.get("user_code", ""),
                "type": "credit",
                "category": "commission",
                "amount": amount,
                "wallet": "commission",
                "description": f"Level-{level} commission from {buyer.get('user_code','')} ({order_code})",
                "reference_id": order_id,
                "level": level,
                "created_at": now_iso(),
            })
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": sponsor["id"],
                "title": f"💰 Level-{level} Commission",
                "body": f"₹{amount} credited from {buyer.get('name','a new member')} at Level {level}.",
                "type": "success",
                "event": "commission_earned",
                "read": False,
                "created_at": now_iso(),
            })
            # Withdrawal nudge — fire once when wallet balance crosses ₹500 for the first time
            new_balance = float(sponsor.get("wallet_balance", 0)) + amount
            already_nudged = bool(sponsor.get("withdraw_nudge_sent"))
            if new_balance >= 500 and not already_nudged:
                await db.users.update_one({"id": sponsor["id"]}, {"$set": {"withdraw_nudge_sent": True}})
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": sponsor["id"],
                    "title": "🎉 Your wallet has crossed ₹500!",
                    "body": f"You have ₹{round(new_balance)} ready to withdraw. Complete KYC (if pending) and cash out — payouts hit your bank in 48 hours.",
                    "type": "success",
                    "event": "withdraw_nudge",
                    "action_url": "/wallet",
                    "read": False,
                    "created_at": now_iso(),
                })
        else:
            # Held/skipped: log for admin visibility
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": sponsor["id"],
                "user_code": sponsor.get("user_code", ""),
                "type": "credit",
                "category": "commission_held",
                "amount": 0,
                "wallet": "commission",
                "description": f"HELD Level-{level} commission (need 3 direct paid refs). From {buyer.get('user_code','')}",
                "reference_id": order_id,
                "level": level,
                "created_at": now_iso(),
            })

        current_sponsor_id = sponsor.get("sponsor_user_id")


async def get_downline_tree(db, user_id: str, max_depth: int = 8) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return {}
    return await _build_node(db, user, depth=0, max_depth=max_depth)


async def _build_node(db, user: dict, depth: int, max_depth: int) -> dict:
    node = {
        "id": user["id"],
        "user_code": user.get("user_code", ""),
        "name": user.get("name", ""),
        "current_stage": user.get("current_stage", 1),
        "direct_referrals_count": user.get("direct_referrals_count", 0),
        "team_size": user.get("team_size", 0),
        "avatar_url": user.get("avatar_url"),
        "is_joining_paid": user.get("is_joining_paid", False),
        "income_active": user.get("income_active", False),
        "children": [],
    }
    if depth >= max_depth:
        return node
    async for ch in db.users.find({"sponsor_user_id": user["id"]}, {"_id": 0, "password_hash": 0}).limit(50):
        node["children"].append(await _build_node(db, ch, depth + 1, max_depth))
    return node
