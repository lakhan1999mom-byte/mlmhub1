"""MLM stage progression & commission engine."""
from datetime import datetime, timezone
import uuid

# Stage rules
TOTAL_STAGES = 8
REFERRALS_PER_STAGE = 3
# Stage commissions (index 0 = stage 1)
STAGE_COMMISSIONS = [500, 0, 1500, 0, 5000, 0, 15000, 50000]
# Stages that pay commission to sponsor when their downline completes them
COMMISSION_STAGES = [1, 3, 5, 7, 8]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def process_new_referral(db, new_user: dict):
    """Called when a new user registers under a sponsor. Increments sponsor's stage progress."""
    sponsor_user_id = new_user.get("sponsor_user_id")
    if not sponsor_user_id:
        return

    sponsor = await db.users.find_one({"id": sponsor_user_id}, {"_id": 0})
    if not sponsor:
        return

    new_dr_count = sponsor.get("direct_referrals_count", 0) + 1
    update = {
        "direct_referrals_count": new_dr_count,
        "updated_at": now_iso(),
    }

    # Notify sponsor
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": sponsor_user_id,
        "title": "🎉 New Referral Joined",
        "body": f"{new_user['name']} ({new_user['user_code']}) just joined your team!",
        "type": "success",
        "event": "referral_joined",
        "read": False,
        "created_at": now_iso(),
    })

    await db.users.update_one({"id": sponsor_user_id}, {"$set": update})

    # bubble up team size
    await _increment_upline_team_size(db, sponsor)


async def _increment_upline_team_size(db, starting_user: dict):
    current = starting_user
    visited = set()
    while current and current.get("sponsor_user_id") and current["sponsor_user_id"] not in visited:
        visited.add(current["sponsor_user_id"])
        await db.users.update_one(
            {"id": current["sponsor_user_id"]},
            {"$inc": {"team_size": 1}, "$set": {"updated_at": now_iso()}}
        )
        current = await db.users.find_one({"id": current["sponsor_user_id"]}, {"_id": 0})


async def process_stage_progression(db, user_id: str):
    """After a joining-order completion, check if user should advance stages.
    Logic: count active referrals at user's current stage. When 3 reached, advance.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    current_stage = user.get("current_stage", 1)
    if current_stage > TOTAL_STAGES:
        return

    # Count direct referrals that joined while this user was at current_stage
    count = await db.users.count_documents({
        "sponsor_user_id": user_id,
        "joined_at_stage": current_stage,
    })

    if count >= REFERRALS_PER_STAGE:
        # Pay commission for completing this stage
        commission = STAGE_COMMISSIONS[current_stage - 1] if current_stage <= len(STAGE_COMMISSIONS) else 0
        if commission > 0:
            await _credit_commission(db, user, current_stage, commission)

        new_stage = current_stage + 1
        update = {"current_stage": new_stage, "updated_at": now_iso()}

        if new_stage > TOTAL_STAGES:
            # Cycle completed - reset
            update["current_stage"] = 1
            update["cycle_count"] = user.get("cycle_count", 0) + 1
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": "🏆 Cycle Completed!",
                "body": "Congratulations! You've completed a full MLM cycle. A new cycle has started.",
                "type": "success",
                "event": "cycle_completed",
                "read": False,
                "created_at": now_iso(),
            })
        else:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": f"🚀 Stage {current_stage} Completed",
                "body": f"You've advanced to Stage {new_stage}!" + (f" Commission of ₹{commission:.0f} credited." if commission else ""),
                "type": "success",
                "event": "stage_completed",
                "read": False,
                "created_at": now_iso(),
            })

        await db.users.update_one({"id": user_id}, {"$set": update})


async def _credit_commission(db, user: dict, stage: int, amount: float):
    new_commission = user.get("commission_wallet", 0) + amount
    new_total = user.get("total_earnings", 0) + amount
    new_wallet = user.get("wallet_balance", 0) + amount
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "commission_wallet": new_commission,
            "wallet_balance": new_wallet,
            "total_earnings": new_total,
            "updated_at": now_iso(),
        }}
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_code": user.get("user_code", ""),
        "type": "credit",
        "category": "commission",
        "amount": amount,
        "wallet": "commission",
        "description": f"Stage {stage} completion commission",
        "reference_id": None,
        "created_at": now_iso(),
    })


async def get_downline_tree(db, user_id: str, max_depth: int = 6) -> dict:
    """Returns nested tree of downline."""
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
        "children": [],
    }
    if depth >= max_depth:
        return node
    children_cursor = db.users.find(
        {"sponsor_user_id": user["id"]},
        {"_id": 0, "password_hash": 0}
    ).limit(50)
    async for ch in children_cursor:
        node["children"].append(await _build_node(db, ch, depth + 1, max_depth))
    return node
