"""Seed initial admin, single joining hamper, settings, T&C, delivery config."""
import os
import uuid
from datetime import datetime, timezone
from auth_utils import hash_password


def now_iso():
    return datetime.now(timezone.utc).isoformat()


TERMS_CONTENT = """<h2>EverGro eMart — Terms & Conditions (v1.0)</h2>
<p><em>Please read these Terms & Conditions carefully before registering. By checking "I agree" during registration, you accept these terms in full.</em></p>

<h3>1. Application-Based Referral Policy</h3>
<p>This business is completely application-based. A customer/member shall be linked under a sponsor only when the customer uses that sponsor's referral code during registration. If the customer does not use the referral code or uses another person's referral code, the customer shall be linked accordingly, and <b>Evergro LLP</b> shall bear no responsibility or liability for such disputes. Any dispute regarding the selection or use of a referral code shall be considered a personal matter between the concerned parties.</p>

<h3>2. Joining & Activation</h3>
<ul>
<li>A one-time purchase of the EverGro Joining Kit at <b>₹7,200</b> is required to activate your MLM account.</li>
<li>Until the joining amount is successfully paid: (a) your MLM account remains inactive, (b) your referral link does not generate commissions, (c) no cashback or income is credited.</li>
<li>Registration alone does <b>NOT</b> create any earning entitlement. Payment is mandatory.</li>
</ul>

<h3>3. 8-Level Income Structure</h3>
<p>Each active member can add a maximum of <b>6 direct referrals</b>. Income accrues across 8 levels according to the published plan (Level 1 ₹1,200 / member; Level 2 ₹400; Level 3 ₹50; Level 4 ₹300; Level 5 ₹50; Level 6 ₹200; Level 7 ₹50; Level 8 ₹100).</p>
<p>Your income begins only when <b>3 of your direct referrals</b> have completed their ₹7,200 joining purchase.</p>

<h3>4. Withdrawals</h3>
<ul>
<li>Minimum 3 paid direct referrals required.</li>
<li>KYC (Aadhaar + PAN + selfie) must be approved.</li>
<li>Minimum withdrawal ₹100. Processed within 24-48 business hours.</li>
</ul>

<h3>5. Product Quality & Delivery</h3>
<p>All hampers and products are sourced and quality-checked by EverGro. Delivery charges are billed separately at checkout (not included in product price). Free shipping applies over the threshold set by admin.</p>

<h3>6. Account Inactivity</h3>
<p>Accounts inactive for <b>180 consecutive days</b> may be automatically disabled. Contact support to re-activate.</p>

<h3>7. Refund Policy</h3>
<p>Joining hamper purchases that have triggered MLM activation and commission distribution are non-refundable. Non-joining regular purchases may be returned within 7 days in original packaging.</p>

<h3>8. Prohibited Conduct</h3>
<ul>
<li>Fake accounts, self-referrals, and multi-account abuse.</li>
<li>Misrepresentation of the plan or product to prospective members.</li>
<li>Illegal activity or violations of local law.</li>
</ul>

<h3>9. Modification</h3>
<p>EverGro reserves the right to modify these Terms with prior notice. Continued use of the platform indicates acceptance of the modified terms.</p>

<h3>10. Governing Law</h3>
<p>These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts at the registered office of Evergro LLP.</p>

<p><b>By checking "I agree" during registration, you confirm that you have read, understood, and agree to be bound by these Terms & Conditions.</b></p>"""


async def seed_all(db):
    # ============ Site Settings ============
    existing = await db.settings.find_one({"_key": "site"})
    if not existing:
        await db.settings.insert_one({
            "_key": "site",
            "logo_url": os.environ.get("APP_LOGO_URL", ""),
            "favicon_url": os.environ.get("APP_LOGO_URL", ""),
            "site_name": "EverGro eMart",
            "tagline": "Shop • Save • Share • Earn — Smart Shopping, Limitless Earning",
            "phone": "+91-9876543210",
            "email": "support@evergroemart.com",
            "address": "Evergro LLP, India",
            "whatsapp": "+919876543210",
            "facebook": "https://facebook.com/evergroemart",
            "instagram": "https://instagram.com/evergroemart",
            "twitter": "https://twitter.com/evergroemart",
            "youtube": "https://youtube.com/@evergroemart",
            "notification_bar_text": "🎉 EverGro eMart — 8-Level Income Plan · Purchasing Kit ₹7,200",
            "notification_bar_enabled": True,
            "razorpay_key_id": "",
            "razorpay_key_secret": "",
            "razorpay_enabled": False,
            "cloudinary_cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
            "cloudinary_api_key": os.environ.get("CLOUDINARY_API_KEY", ""),
            "cloudinary_api_secret": os.environ.get("CLOUDINARY_API_SECRET", ""),
            # Delivery config
            "delivery_charge": 49,
            "free_shipping_threshold": 999,
            "gst_percent": 5,
            # Terms
            "terms_version": "1.0",
            "terms_content": TERMS_CONTENT,
        })
    else:
        # Ensure new keys present
        updates = {}
        if "delivery_charge" not in existing:
            updates["delivery_charge"] = 49
        if "free_shipping_threshold" not in existing:
            updates["free_shipping_threshold"] = 999
        if "gst_percent" not in existing:
            updates["gst_percent"] = 5
        if "terms_content" not in existing:
            updates["terms_content"] = TERMS_CONTENT
            updates["terms_version"] = "1.0"
        if "notification_bar_text" in existing and ("Joining Kit" in existing.get("notification_bar_text", "") or "8-Level" not in existing.get("notification_bar_text", "")):
            updates["notification_bar_text"] = "🎉 EverGro eMart — 8-Level Income Plan · Purchasing Kit ₹7,200"
        if updates:
            await db.settings.update_one({"_key": "site"}, {"$set": updates})

    # ============ MLM Settings (Phase 2) ============
    await db.settings.update_one(
        {"_key": "mlm"},
        {"$set": {
            "levels_total": 8,
            "max_direct_referrals": 6,
            "min_direct_paid_for_income": 3,
            "joining_amount": 7200.0,
            "level_commissions": [1200, 400, 50, 300, 50, 200, 50, 100],
        }},
        upsert=True,
    )

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
            "sponsor_id": None, "sponsor_user_id": None,
            "referral_code": "ADMIN001",
            "current_stage": 1,
            "direct_referrals_count": 0,
            "team_size": 0,
            "wallet_balance": 0, "income_wallet": 0, "commission_wallet": 0,
            "cashback_wallet": 0, "reward_wallet": 0, "total_earnings": 0,
            "kyc_status": "approved", "is_active": True,
            "is_joining_paid": True, "income_active": True,
            "permissions": ["*"], "cycle_count": 0,
            "created_at": now_iso(), "updated_at": now_iso(),
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
            "sponsor_id": None, "sponsor_user_id": None,
            "referral_code": "SUBADMIN1",
            "current_stage": 1,
            "direct_referrals_count": 0, "team_size": 0,
            "wallet_balance": 0, "income_wallet": 0, "commission_wallet": 0,
            "cashback_wallet": 0, "reward_wallet": 0, "total_earnings": 0,
            "kyc_status": "approved", "is_active": True,
            "is_joining_paid": True, "income_active": True,
            "permissions": ["orders", "users", "products", "kyc", "withdrawals", "tickets", "notifications"],
            "cycle_count": 0,
            "created_at": now_iso(), "updated_at": now_iso(),
        })

    # Ensure admin/sub_admin are always pre-activated (Phase 2 migration for older docs)
    await db.users.update_many(
        {"role": {"$in": ["super_admin", "sub_admin"]}},
        {"$set": {"is_joining_paid": True, "income_active": True, "is_active": True}},
    )

    # ============ SINGLE ACTIVE PURCHASING KIT (₹7,200) ============
    joining = await db.products.find_one({"sku": "HMP-JOINING-7200"})
    if not joining:
        # Lock all existing hampers
        await db.products.update_many({"is_hamper": True}, {"$set": {"is_locked": True, "is_active": False}})
        # Create the single active purchasing kit
        await db.products.insert_one({
            "id": str(uuid.uuid4()),
            "name": "EverGro Purchasing Kit",
            "description": "The official EverGro purchasing kit — includes premium groceries, wellness essentials, and unlocks your 8-level MLM income structure. One-time ₹7,200 purchase activates your account and referral link.",
            "price": 7200.0, "mrp": 8999.0,
            "sku": "HMP-JOINING-7200",
            "category": "hamper", "brand": "EverGro",
            "gst_percent": 5, "stock": 5000,
            "images": [
                "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80",
                "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80",
            ],
            "videos": [], "pdfs": [],
            "badges": ["featured", "bestseller"],
            "is_hamper": True, "hamper_tier": "Purchasing",
            "contents": [
                "Premium Basmati Rice 5 kg",
                "Mixed Dals & Pulses 3 kg",
                "Cold-pressed Cooking Oil 2 L",
                "Assorted Spice Box",
                "Premium Tea & Coffee Pack",
                "Wellness Products (Ayurvedic honey, Almonds, Saffron)",
                "EverGro Reusable Shopping Basket",
                "Free ₹500 Store Credit",
            ],
            "is_active": True, "is_locked": False,
            "rating": 4.9, "review_count": 250,
            "created_at": now_iso(),
        })
    else:
        # Rename old "EverGro Joining Kit" → "EverGro Purchasing Kit" (idempotent)
        if joining.get("name") == "EverGro Joining Kit":
            await db.products.update_one(
                {"sku": "HMP-JOINING-7200"},
                {"$set": {"name": "EverGro Purchasing Kit", "hamper_tier": "Purchasing"}},
            )

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
                "is_active": True, "is_locked": False, "rating": 4.5, "review_count": 50,
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)

    # Banners, testimonials, faqs, sliders, reels — only seed if empty
    if await db.banners.count_documents({}) == 0:
        await db.banners.insert_one({"id": str(uuid.uuid4()), "title": "Build Wealth, One Kit at a Time", "subtitle": "Join 50,000+ members", "image_url": "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?w=1600", "position": "hero", "sort_order": 1, "is_active": True, "link": "/hampers", "created_at": now_iso()})

    if await db.testimonials.count_documents({}) < 15:
        ts = [
            {"name": "Rajesh Kumar", "role": "Level 5 Member", "rating": 5, "message": "EverGro's 8-level plan is genuine. I got my ₹1,200 first commission within 10 days!", "avatar": "https://i.pravatar.cc/100?img=12"},
            {"name": "Priya Sharma", "role": "Level 3 Member", "rating": 5, "message": "The purchasing kit is amazing quality. My family loves it and the income is a bonus.", "avatar": "https://i.pravatar.cc/100?img=47"},
            {"name": "Amit Patel", "role": "Level 6 Member", "rating": 5, "message": "8 months in, crossed Level 6. The math actually works — transparent and legal.", "avatar": "https://i.pravatar.cc/100?img=33"},
            {"name": "Neha Gupta", "role": "Level 4 Member", "rating": 5, "message": "Finally an MLM that pays on time. My wallet is credited within seconds of a downline joining.", "avatar": "https://i.pravatar.cc/100?img=48"},
            {"name": "Vikram Singh", "role": "Level 7 Member", "rating": 5, "message": "Made ₹3.2 lakh in 4 months. I've quit my day job. EverGro is my full-time income now.", "avatar": "https://i.pravatar.cc/100?img=15"},
            {"name": "Kavita Rao", "role": "Level 2 Member", "rating": 4, "message": "Started small, first ₹1,200 commission gave me confidence. Building my team steadily.", "avatar": "https://i.pravatar.cc/100?img=44"},
            {"name": "Sanjay Verma", "role": "Level 5 Member", "rating": 5, "message": "KYC took 2 hours, withdrawal took 24 hours. Fastest payout system I've used.", "avatar": "https://i.pravatar.cc/100?img=17"},
            {"name": "Anjali Mehta", "role": "Level 3 Member", "rating": 5, "message": "Product quality is A+. My mother uses the wellness pack daily. Very happy.", "avatar": "https://i.pravatar.cc/100?img=45"},
            {"name": "Rohit Choudhary", "role": "Level 6 Member", "rating": 5, "message": "Referral QR code is genius. I share it in WhatsApp groups and members join daily.", "avatar": "https://i.pravatar.cc/100?img=13"},
            {"name": "Pooja Nair", "role": "Level 4 Member", "rating": 5, "message": "My husband was skeptical. After seeing ₹45,000 credited last month, he joined too!", "avatar": "https://i.pravatar.cc/100?img=49"},
            {"name": "Arjun Reddy", "role": "Level 5 Member", "rating": 5, "message": "Cashback on regular products is a nice touch. Everyone in my team loves shopping here.", "avatar": "https://i.pravatar.cc/100?img=11"},
            {"name": "Sunita Yadav", "role": "Level 2 Member", "rating": 4, "message": "Just crossed my 3rd direct referral. Income is officially LIVE. Excited!", "avatar": "https://i.pravatar.cc/100?img=46"},
            {"name": "Deepak Iyer", "role": "Level 7 Member", "rating": 5, "message": "The genealogy tree view is beautiful. I can see my entire 8-level downline in real time.", "avatar": "https://i.pravatar.cc/100?img=14"},
            {"name": "Meena Joshi", "role": "Level 4 Member", "rating": 5, "message": "Support team responded within 15 mins on WhatsApp. Great service.", "avatar": "https://i.pravatar.cc/100?img=41"},
            {"name": "Karan Malhotra", "role": "Level 6 Member", "rating": 5, "message": "L2 to L8 commissions add up fast. Passive income is real with EverGro.", "avatar": "https://i.pravatar.cc/100?img=18"},
            {"name": "Ritu Bansal", "role": "Level 3 Member", "rating": 5, "message": "Notification pings whenever I earn — feels rewarding. Motivates me to refer more.", "avatar": "https://i.pravatar.cc/100?img=42"},
            {"name": "Naveen Krishna", "role": "Level 5 Member", "rating": 5, "message": "T&C is crystal clear. No hidden fees, no monthly deductions. Trust built.", "avatar": "https://i.pravatar.cc/100?img=19"},
            {"name": "Divya Prasad", "role": "Level 4 Member", "rating": 5, "message": "The video reels showing member stories inspired me to join. Glad I did.", "avatar": "https://i.pravatar.cc/100?img=43"},
            {"name": "Suresh Menon", "role": "Level 6 Member", "rating": 5, "message": "6 direct refs cap is fair. Encourages you to help each downline succeed instead of hoarding.", "avatar": "https://i.pravatar.cc/100?img=16"},
            {"name": "Anita Desai", "role": "Level 5 Member", "rating": 5, "message": "Best decision of 2026. Retired my mom from her 9-5 last month with EverGro income.", "avatar": "https://i.pravatar.cc/100?img=40"},
        ]
        for t in ts:
            t["id"] = str(uuid.uuid4()); t["is_active"] = True
            await db.testimonials.insert_one(t)

    # ============ Brand Logos (Partner brand slider) ============
    if await db.brands.count_documents({}) == 0:
        from urllib.parse import quote
        _brand_names = ["Tata", "Amul", "ITC", "Britannia", "Parle", "Nestle", "Dabur", "Patanjali", "Fortune", "MDH"]
        brands = [
            {"name": n, "logo_url": f"https://dummyimage.com/400x200/ECFCCB/064E3B.png&text={quote(n)}"}
            for n in _brand_names
        ]
        for i, b in enumerate(brands):
            await db.brands.insert_one({
                "id": str(uuid.uuid4()),
                "name": b["name"],
                "logo_url": b["logo_url"],
                "link": None,
                "sort_order": i,
                "is_active": True,
                "created_at": now_iso(),
            })

    if await db.faqs.count_documents({}) == 0:
        faqs = [
            {"question": "How does the plan work?", "answer": "Level 1: ₹1,200/member × 6 = ₹7,200 · Level 2: ₹400 × 36 = ₹14,400 · Level 3: ₹50 × 216 = ₹10,800 · Level 4: ₹300 × 1,296 = ₹3,88,800 · Level 5: ₹50 × 7,776 = ₹3,88,800 · Level 6: ₹200 × 46,656 = ₹93,31,200 · Level 7: ₹50 × 2,79,936 = ₹1,39,96,800 · Level 8: ₹100 × 16,79,616 = ₹16,79,61,600. Total potential ₹20,36,99,600."},
            {"question": "When does income start?", "answer": "As soon as 3 of your direct referrals complete their ₹7,200 joining purchase."},
            {"question": "How do I withdraw?", "answer": "You need 3 paid direct referrals AND approved KYC. Min ₹100. Processed within 48h."},
            {"question": "What's the max team per layer?", "answer": "6 direct referrals per member. Beyond that, new refs must be under a different sponsor."},
            {"question": "Can one phone have multiple accounts?", "answer": "Yes. Each account gets a unique random user code. On OTP login, pick which account to open."},
            {"question": "What if I'm inactive?", "answer": "Accounts inactive for 180+ days are auto-disabled. Contact support to reactivate."},
        ]
        for i, f in enumerate(faqs):
            f["id"] = str(uuid.uuid4()); f["sort_order"] = i; f["is_active"] = True
            await db.faqs.insert_one(f)

    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_one({
            "id": str(uuid.uuid4()), "code": "WELCOME10",
            "discount_percent": 10, "discount_amount": 0,
            "min_order": 999, "max_discount": 500,
            "is_active": True, "expires_at": None,
        })

    if await db.sliders.count_documents({}) == 0:
        sliders = [
            {"title": "8-Level Income Plan", "subtitle": "Earn up to ₹20.36 Cr from a single ₹7,200 kit", "image_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80", "link": "/business-plan", "cta_label": "View Plan", "location": "landing_top", "sort_order": 1},
            {"title": "Refer 3 — Start Earning", "subtitle": "Income activates on your 3rd direct paid referral", "image_url": "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?w=1600&q=80", "link": "/register", "cta_label": "Join Now", "location": "landing_top", "sort_order": 2},
            {"title": "Premium Groceries, Genuine Income", "subtitle": "100% legal, transparent, no monthly fees", "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80", "link": "/hampers", "cta_label": "Get the Kit", "location": "landing_top", "sort_order": 3},
            {"title": "Build Wealth With Your Network", "subtitle": "8 levels, 6 refs per layer, lifetime income", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1600&q=80", "link": "/business-plan", "cta_label": "Learn More", "location": "landing_mid", "sort_order": 1},
            {"title": "Share & Earn ₹1,200 per Referral", "subtitle": "Level 1 pays instantly on each paid direct", "image_url": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80", "link": "/referral", "cta_label": "Get Referral Link", "location": "user_dashboard", "sort_order": 1},
            {"title": "Complete KYC to Unlock Withdrawals", "subtitle": "Aadhaar + PAN + Selfie — 2 minutes", "image_url": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&q=80", "link": "/kyc", "cta_label": "Verify Now", "location": "user_dashboard", "sort_order": 2},
        ]
        for s in sliders:
            s["id"] = str(uuid.uuid4()); s["is_active"] = True; s["created_at"] = now_iso()
            await db.sliders.insert_one(s)

    if await db.reels.count_documents({}) == 0:
        reels = [
            {"title": "Unboxing the ₹7,200 Joining Kit", "video_url": "https://cdn.pixabay.com/video/2024/05/02/210073-941264636_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80", "description": "See what's inside", "location": "both", "sort_order": 1},
            {"title": "How I Earned ₹50K in 30 Days", "video_url": "https://cdn.pixabay.com/video/2023/10/19/185393-877329524_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80", "description": "Real member story", "location": "both", "sort_order": 2},
            {"title": "Sharing Your Referral Link", "video_url": "https://cdn.pixabay.com/video/2024/04/05/207386_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80", "description": "60-second demo", "location": "both", "sort_order": 3},
            {"title": "Inside Our Warehouse", "video_url": "https://cdn.pixabay.com/video/2020/02/28/32847-394089014_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80", "description": "Quality hand-packed", "location": "both", "sort_order": 4},
        ]
        for r in reels:
            r["id"] = str(uuid.uuid4()); r["is_active"] = True; r["created_at"] = now_iso()
            await db.reels.insert_one(r)
