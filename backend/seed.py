"""Seed initial admin, products, hampers, settings."""
import os
import uuid
from datetime import datetime, timezone
from auth_utils import hash_password


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def gen_user_code(n: int) -> str:
    return f"EG{str(n).zfill(6)}"


async def seed_all(db):
    # ============ Settings ============
    existing = await db.settings.find_one({"_key": "site"})
    if not existing:
        await db.settings.insert_one({
            "_key": "site",
            "logo_url": os.environ.get("APP_LOGO_URL", ""),
            "favicon_url": os.environ.get("APP_LOGO_URL", ""),
            "site_name": "EverGro eMart",
            "tagline": "Grow your network, grow your wealth",
            "phone": "+91-9876543210",
            "email": "support@evergroemart.com",
            "address": "Mumbai, India",
            "whatsapp": "+919876543210",
            "facebook": "https://facebook.com/evergroemart",
            "instagram": "https://instagram.com/evergroemart",
            "twitter": "https://twitter.com/evergroemart",
            "youtube": "https://youtube.com/@evergroemart",
            "notification_bar_text": "🎉 Welcome to EverGro eMart — Free shipping on orders above ₹999!",
            "notification_bar_enabled": True,
            "razorpay_key_id": "",
            "razorpay_key_secret": "",
            "razorpay_enabled": False,
            "cloudinary_cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
            "cloudinary_api_key": os.environ.get("CLOUDINARY_API_KEY", ""),
            "cloudinary_api_secret": os.environ.get("CLOUDINARY_API_SECRET", ""),
        })

    existing_mlm = await db.settings.find_one({"_key": "mlm"})
    if not existing_mlm:
        await db.settings.insert_one({
            "_key": "mlm",
            "stages_total": 8,
            "referrals_per_stage": 3,
            "joining_amount": 2999.0,
            "stage_commissions": [500, 0, 1500, 0, 5000, 0, 15000, 50000],
            "commission_stages": [1, 3, 5, 7, 8],
        })

    # ============ Super Admin ============
    admin = await db.users.find_one({"role": "super_admin"})
    if not admin:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "user_code": "EG000001",
            "name": "Super Admin",
            "email": "admin@evergroemart.com",
            "phone": "9999999999",
            "password_hash": hash_password("Admin@123"),
            "role": "super_admin",
            "sponsor_id": None,
            "sponsor_user_id": None,
            "referral_code": "ADMIN001",
            "current_stage": 1,
            "direct_referrals_count": 0,
            "team_size": 0,
            "wallet_balance": 0,
            "income_wallet": 0,
            "commission_wallet": 0,
            "cashback_wallet": 0,
            "reward_wallet": 0,
            "total_earnings": 0,
            "kyc_status": "approved",
            "avatar_url": None,
            "is_active": True,
            "permissions": ["*"],
            "cycle_count": 0,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.users.insert_one(admin_doc)

    # Sub admin
    subadmin = await db.users.find_one({"role": "sub_admin"})
    if not subadmin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "user_code": "EG000002",
            "name": "Sub Admin",
            "email": "subadmin@evergroemart.com",
            "phone": "9999999998",
            "password_hash": hash_password("SubAdmin@123"),
            "role": "sub_admin",
            "sponsor_id": None,
            "sponsor_user_id": None,
            "referral_code": "SUBADMIN1",
            "current_stage": 1,
            "direct_referrals_count": 0,
            "team_size": 0,
            "wallet_balance": 0, "income_wallet": 0, "commission_wallet": 0,
            "cashback_wallet": 0, "reward_wallet": 0, "total_earnings": 0,
            "kyc_status": "approved", "is_active": True,
            "permissions": ["orders", "users", "products", "kyc", "withdrawals", "tickets", "notifications"],
            "cycle_count": 0,
            "created_at": now_iso(), "updated_at": now_iso(),
        })

    # ============ Hamper Products ============
    if await db.products.count_documents({"is_hamper": True}) == 0:
        hampers = [
            {
                "name": "Bronze Starter Hamper",
                "description": "Perfect starter pack with daily essentials — rice, pulses, spices, oil and more. Includes joining benefits.",
                "price": 2999, "mrp": 3999, "sku": "HMP-BRZ", "category": "hamper",
                "is_hamper": True, "hamper_tier": "Bronze",
                "stock": 500, "gst_percent": 5,
                "images": ["https://images.unsplash.com/photo-1508899203029-1c9eb493c9bd?w=800"],
                "badges": ["bestseller", "new"],
                "contents": ["Basmati Rice 5kg", "Toor Dal 2kg", "Sunflower Oil 1L", "Spice Box", "Tea & Coffee Pack"],
            },
            {
                "name": "Silver Family Hamper",
                "description": "Mid-tier hamper for families — premium groceries, healthy snacks, and household essentials.",
                "price": 5999, "mrp": 7999, "sku": "HMP-SLV", "category": "hamper",
                "is_hamper": True, "hamper_tier": "Silver",
                "stock": 300, "gst_percent": 5,
                "images": ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=800"],
                "badges": ["featured", "trending"],
                "contents": ["Premium Rice 10kg", "Mixed Dals 5kg", "Premium Oil 2L", "Dry Fruits Pack", "Tea & Coffee Premium", "Snacks Pack"],
            },
            {
                "name": "Gold Premium Hamper",
                "description": "Top-tier hamper with imported and organic products. Premium quality for premium families.",
                "price": 9999, "mrp": 12999, "sku": "HMP-GLD", "category": "hamper",
                "is_hamper": True, "hamper_tier": "Gold",
                "stock": 150, "gst_percent": 5,
                "images": ["https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800"],
                "badges": ["featured", "limited"],
                "contents": ["Organic Rice Variety", "Premium Spices Set", "Olive Oil & Ghee", "Imported Dry Fruits 2kg", "Premium Chocolates", "Wellness Pack"],
            },
            {
                "name": "Platinum Royal Hamper",
                "description": "The ultimate hamper — exclusive imported items, luxury packaging, and premium accessories.",
                "price": 19999, "mrp": 24999, "sku": "HMP-PLT", "category": "hamper",
                "is_hamper": True, "hamper_tier": "Platinum",
                "stock": 50, "gst_percent": 5,
                "images": ["https://images.unsplash.com/photo-1513708927688-890fe41c2e99?w=800"],
                "badges": ["limited", "featured"],
                "contents": ["Royal Basmati 15kg", "Saffron & Premium Spices", "Imported Olive Oil", "Dry Fruits Royal Box", "Luxury Hamper Basket", "Free Gift Items"],
            },
        ]
        for h in hampers:
            h["id"] = str(uuid.uuid4())
            h["is_active"] = True
            h["videos"] = []
            h["pdfs"] = []
            h["rating"] = 4.7
            h["review_count"] = 120
            h["brand"] = "EverGro"
            h["created_at"] = now_iso()
            await db.products.insert_one(h)

    # ============ Regular Products ============
    if await db.products.count_documents({"is_hamper": False}) == 0:
        products = [
            {"name": "Premium Basmati Rice 5kg", "description": "Aromatic long-grain basmati rice", "price": 599, "mrp": 799, "category": "groceries",
             "images": ["https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600"], "badges": ["bestseller"]},
            {"name": "Organic Toor Dal 2kg", "description": "Premium organic toor dal", "price": 299, "mrp": 399, "category": "groceries",
             "images": ["https://images.unsplash.com/photo-1599909533730-2c10e76b0a07?w=600"], "badges": ["trending"]},
            {"name": "Cold Pressed Sunflower Oil 5L", "description": "Healthy cold pressed oil", "price": 899, "mrp": 1199, "category": "groceries",
             "images": ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600"], "badges": ["featured"]},
            {"name": "Mixed Dry Fruits Box", "description": "Premium dry fruits assortment 500g", "price": 1299, "mrp": 1599, "category": "snacks",
             "images": ["https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600"], "badges": ["new", "featured"]},
            {"name": "Premium Spice Box", "description": "10 essential spices in one box", "price": 799, "mrp": 999, "category": "groceries",
             "images": ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600"], "badges": ["bestseller"]},
            {"name": "Assam Tea Premium 500g", "description": "Strong & aromatic Assam tea", "price": 399, "mrp": 499, "category": "beverages",
             "images": ["https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600"], "badges": ["trending"]},
            {"name": "Wellness Pack — Honey, Almonds & Saffron", "description": "Premium wellness combo", "price": 1799, "mrp": 2299, "category": "wellness",
             "images": ["https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600"], "badges": ["limited", "new"]},
            {"name": "Chocolate Gift Box", "description": "Imported chocolate assortment", "price": 999, "mrp": 1299, "category": "snacks",
             "images": ["https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600"], "badges": ["featured"]},
        ]
        for p in products:
            doc = {
                "id": str(uuid.uuid4()),
                "name": p["name"], "description": p["description"],
                "price": p["price"], "mrp": p["mrp"],
                "sku": f"PRD-{uuid.uuid4().hex[:6].upper()}",
                "category": p["category"], "brand": "EverGro",
                "gst_percent": 5, "stock": 200,
                "images": p["images"], "videos": [], "pdfs": [],
                "badges": p["badges"],
                "is_hamper": False, "hamper_tier": None, "contents": [],
                "is_active": True, "rating": 4.5, "review_count": 50,
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)

    # ============ Banners ============
    if await db.banners.count_documents({}) == 0:
        banners = [
            {"title": "Build Wealth, One Hamper at a Time", "subtitle": "Join 50,000+ members earning monthly", "image_url": "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?w=1600", "position": "hero", "sort_order": 1},
            {"title": "Up to 50% Off Premium Hampers", "subtitle": "Limited time launch offer", "image_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600", "position": "promo", "sort_order": 2},
        ]
        for b in banners:
            b["id"] = str(uuid.uuid4())
            b["is_active"] = True
            b["link"] = "/hampers"
            b["created_at"] = now_iso()
            await db.banners.insert_one(b)

    # ============ Testimonials ============
    if await db.testimonials.count_documents({}) == 0:
        ts = [
            {"name": "Rajesh Kumar", "role": "Gold Member", "rating": 5, "message": "EverGro changed my life. I earned ₹2L in 6 months while my family enjoys premium hampers!", "avatar": "https://i.pravatar.cc/100?img=12"},
            {"name": "Priya Sharma", "role": "Silver Member", "rating": 5, "message": "The hampers are amazing quality. The MLM plan is transparent and pays on time.", "avatar": "https://i.pravatar.cc/100?img=47"},
            {"name": "Amit Patel", "role": "Platinum Member", "rating": 5, "message": "Best decision ever. Within 8 months I crossed Stage 7 and earning consistently.", "avatar": "https://i.pravatar.cc/100?img=33"},
        ]
        for t in ts:
            t["id"] = str(uuid.uuid4())
            t["is_active"] = True
            await db.testimonials.insert_one(t)

    if await db.faqs.count_documents({}) == 0:
        faqs = [
            {"question": "What is EverGro eMart?", "answer": "EverGro eMart is an MLM-based hamper-selling platform where you buy premium hampers, refer others, and earn commissions across 8 stages."},
            {"question": "How does the MLM plan work?", "answer": "There are 8 stages. You need 3 referrals to complete each stage. Stages 1, 3, 5, 7 and 8 pay commissions."},
            {"question": "How do I withdraw earnings?", "answer": "You need at least 3 direct referrals AND approved KYC to request withdrawals. Visit your Wallet, click Withdraw, choose UPI or Bank."},
            {"question": "Can one phone have multiple accounts?", "answer": "Yes! You can create unlimited accounts using the same mobile number — each gets a unique random username. When logging in via OTP, you can pick which account to access."},
            {"question": "What's the maximum team size per layer?", "answer": "Each user can directly refer up to 6 members in their first layer. Beyond that, new referrals must be placed under different sponsors."},
            {"question": "Is KYC required?", "answer": "Yes, to withdraw earnings you must complete KYC with Aadhaar/PAN/Selfie."},
            {"question": "What is the joining amount?", "answer": "₹2,999 — purchase the Bronze Starter Hamper to activate your account."},
            {"question": "What happens if I'm inactive?", "answer": "Accounts inactive for 180+ consecutive days will be auto-disabled. Contact support to re-activate."},
        ]
        for i, f in enumerate(faqs):
            f["id"] = str(uuid.uuid4())
            f["sort_order"] = i
            f["is_active"] = True
            await db.faqs.insert_one(f)

    # ============ Sliders ============
    if await db.sliders.count_documents({}) == 0:
        sliders_top = [
            {"title": "Festive Mega Sale", "subtitle": "Up to 50% off on all hampers — limited time!", "image_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80", "link": "/hampers", "cta_label": "Shop Hampers", "location": "landing_top", "sort_order": 1},
            {"title": "Refer 3 Friends — Earn ₹500 Instantly", "subtitle": "Start your MLM journey today", "image_url": "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?w=1600&q=80", "link": "/register", "cta_label": "Join Now", "location": "landing_top", "sort_order": 2},
            {"title": "Premium Quality Guaranteed", "subtitle": "Hand-picked groceries delivered to your door", "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80", "link": "/products", "cta_label": "Browse Products", "location": "landing_top", "sort_order": 3},
        ]
        sliders_mid = [
            {"title": "Build Your Wealth Network", "subtitle": "8 stages of earnings, transparent rules, daily payouts", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1600&q=80", "link": "/business-plan", "cta_label": "Learn the Plan", "location": "landing_mid", "sort_order": 1},
            {"title": "Become a Top Earner", "subtitle": "Join our leaderboard of ₹1L+ monthly earners", "image_url": "https://images.unsplash.com/photo-1605792657660-596af9009e82?w=1600&q=80", "link": "/calculator", "cta_label": "Calculate Earnings", "location": "landing_mid", "sort_order": 2},
        ]
        sliders_user = [
            {"title": "Share & Earn ₹500", "subtitle": "Every referral counts toward your next stage", "image_url": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80", "link": "/referral", "cta_label": "Get Referral Link", "location": "user_dashboard", "sort_order": 1},
            {"title": "Complete KYC Today", "subtitle": "Unlock withdrawals — takes just 2 minutes", "image_url": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&q=80", "link": "/kyc", "cta_label": "Verify KYC", "location": "user_dashboard", "sort_order": 2},
            {"title": "New Hampers Just In", "subtitle": "Refresh your monthly purchase to advance stages", "image_url": "https://images.unsplash.com/photo-1513708927688-890fe41c2e99?w=1600&q=80", "link": "/hampers", "cta_label": "Shop Now", "location": "user_dashboard", "sort_order": 3},
        ]
        for s in sliders_top + sliders_mid + sliders_user:
            s["id"] = str(uuid.uuid4())
            s["is_active"] = True
            s["created_at"] = now_iso()
            await db.sliders.insert_one(s)

    # ============ Reels (Vertical Videos) ============
    if await db.reels.count_documents({}) == 0:
        # Pixabay free CDN samples — vertical / portrait
        reels = [
            {"title": "Unboxing the Gold Hamper", "video_url": "https://cdn.pixabay.com/video/2024/05/02/210073-941264636_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80", "description": "See what's inside our premium Gold hamper", "location": "both", "sort_order": 1},
            {"title": "How I Earned ₹50K in 30 Days", "video_url": "https://cdn.pixabay.com/video/2023/10/19/185393-877329524_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80", "description": "Real member success story", "location": "both", "sort_order": 2},
            {"title": "Sharing Your Referral Link", "video_url": "https://cdn.pixabay.com/video/2024/04/05/207386_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80", "description": "Quick demo: how to share & earn", "location": "both", "sort_order": 3},
            {"title": "Inside Our Warehouse", "video_url": "https://cdn.pixabay.com/video/2020/02/28/32847-394089014_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80", "description": "Premium quality, hand-packed with love", "location": "both", "sort_order": 4},
        ]
        for r in reels:
            r["id"] = str(uuid.uuid4())
            r["is_active"] = True
            r["created_at"] = now_iso()
            await db.reels.insert_one(r)

    # ============ Coupons ============
    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_one({
            "id": str(uuid.uuid4()),
            "code": "WELCOME10",
            "discount_percent": 10,
            "discount_amount": 0,
            "min_order": 999,
            "max_discount": 500,
            "is_active": True,
            "expires_at": None,
        })

    # ============ Blogs ============
    if await db.blogs.count_documents({}) == 0:
        blogs = [
            {"title": "5 Reasons EverGro is Different from Other MLMs", "excerpt": "We focus on quality products, transparent rules, and timely payouts.", "content": "<p>EverGro stands apart because of its premium hamper quality, 8-stage transparent structure, and on-time commission payouts...</p>"},
            {"title": "How to Build Your First Team of 10 in 30 Days", "excerpt": "A practical guide for new members to grow their network.", "content": "<p>Start with friends and family. Share your referral link on WhatsApp. Host a small demo session...</p>"},
        ]
        for b in blogs:
            doc = {
                "id": str(uuid.uuid4()),
                "title": b["title"],
                "slug": b["title"].lower().replace(" ", "-").replace(",", "")[:60],
                "excerpt": b["excerpt"],
                "content": b["content"],
                "cover_image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
                "author": "EverGro Team",
                "is_published": True,
                "created_at": now_iso(),
            }
            await db.blogs.insert_one(doc)
