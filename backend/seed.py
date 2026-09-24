"""Seed initial admin, single joining hamper, settings, T&C, delivery config."""
import os
import uuid
from datetime import datetime, timezone
from auth_utils import hash_password


def now_iso():
    return datetime.now(timezone.utc).isoformat()


TERMS_CONTENT = """<h2>EverGro eMart — Terms & Conditions (v2.0)</h2>
<p><em>Please read these Terms & Conditions carefully before registering. By checking "I agree" during registration, you accept these terms in full.</em></p>

<h3>1. Acceptance of Terms</h3>
<p>By creating an account or placing an order on EverGro eMart (operated by <b>Evergro LLP</b>), you agree to these Terms and to comply with all applicable Indian laws. If you do not agree, please do not use the platform.</p>

<h3>2. Account & Registration</h3>
<ul>
<li>You must provide accurate and current information during registration.</li>
<li>Each mobile number can be linked to one account only.</li>
<li>You are responsible for keeping your login credentials secure and for all activity under your account.</li>
</ul>

<h3>3. Referral & Rewards Program</h3>
<p>When a friend registers using your unique referral code and completes an eligible purchase, both parties may receive cashback rewards credited to their in-app rewards wallet, subject to the current program terms. Rewards are promotional in nature, are not a wage, salary or income, and can be modified or discontinued by EverGro at any time.</p>

<h3>4. Rewards Wallet & Withdrawals</h3>
<ul>
<li>KYC (Aadhaar + PAN + selfie) must be approved before withdrawal.</li>
<li>Minimum withdrawal amount ₹100. Payouts to the linked bank account are processed within 24–72 business hours.</li>
<li>EverGro reserves the right to reverse rewards credited due to fraud, chargebacks, cancelled orders, or violation of these Terms.</li>
</ul>

<h3>5. Product Quality & Delivery</h3>
<p>All hampers and products are sourced and quality-checked by EverGro. Delivery charges (if any) are billed separately at checkout and vary by order value. Delivery timelines are estimates and depend on courier availability and location.</p>

<h3>6. Cancellation, Returns & Refunds</h3>
<ul>
<li>Orders may be cancelled from the "My Orders" page before dispatch.</li>
<li>Damaged, wrong or missing items must be reported within 48 hours of delivery with photo proof.</li>
<li>Once dispatched, non-defective items may be returned within 7 days in original packaging. Perishable goods are non-returnable.</li>
</ul>

<h3>7. Account Inactivity</h3>
<p>Accounts inactive for <b>180 consecutive days</b> may be automatically disabled. Contact support to re-activate.</p>

<h3>8. Prohibited Conduct</h3>
<ul>
<li>Fake accounts, self-referrals, and multi-account abuse.</li>
<li>Misrepresentation of the platform, offers, or the rewards program.</li>
<li>Illegal activity, chargeback abuse, or violations of local law.</li>
</ul>

<h3>9. Intellectual Property</h3>
<p>All content, trademarks, product photography and brand marks on the platform are the property of EverGro or their respective owners and may not be reproduced without written permission.</p>

<h3>10. Limitation of Liability</h3>
<p>EverGro is not liable for indirect, incidental or consequential losses arising out of the use of the platform. Our maximum liability shall not exceed the amount actually paid by you for the specific order in question.</p>

<h3>11. Modification</h3>
<p>EverGro reserves the right to modify these Terms with prior notice on the site. Continued use of the platform after such modification indicates acceptance of the updated terms.</p>

<h3>12. Governing Law</h3>
<p>These Terms are governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of courts at the registered office of Evergro LLP.</p>

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
            "tagline": "Premium products, delivered with care",
            "phone": "+91-9928525889",
            "email": "support@evergroemart.com",
            "address": "Evergro LLP, India",
            "whatsapp": "+919928525889",
            "facebook": "https://facebook.com/evergroemart",
            "instagram": "https://instagram.com/evergroemart",
            "twitter": "https://twitter.com/evergroemart",
            "youtube": "https://youtube.com/@evergroemart",
            "notification_bar_text": "🎉 Free shipping on orders above ₹999 · Shop premium hampers now!",
            "notification_bar_enabled": True,
            "razorpay_key_id": "",
            "razorpay_key_secret": "",
            "razorpay_enabled": False,
            "cloudinary_cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
            "cloudinary_api_key": os.environ.get("CLOUDINARY_API_KEY", ""),
            "cloudinary_api_secret": os.environ.get("CLOUDINARY_API_SECRET", ""),
        # Delivery config
        "delivery_charge": 49,
        "delivery_charge_enabled": True,
        "free_shipping_threshold": 999,
        "gst_percent": 5,
        "gst_enabled": True,
        # Flexible extra charges — admin can add/remove/toggle these
        "extra_charges": [],
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
        if "terms_content" not in existing or "EverGro Joining Kit" in (existing.get("terms_content", "") or "") or "7,200" in (existing.get("terms_content", "") or "") or "MLM" in (existing.get("terms_content", "") or "") or "8-Level" in (existing.get("terms_content", "") or "") or "8-level" in (existing.get("terms_content", "") or "") or "downline" in (existing.get("terms_content", "") or "").lower():
            updates["terms_content"] = TERMS_CONTENT
            updates["terms_version"] = "2.0"
        # Force-refresh notification bar text away from any legacy MLM/income copy
        cur_notif = existing.get("notification_bar_text", "") or ""
        if "7,200" in cur_notif or "Joining Kit" in cur_notif or "8-Level" in cur_notif or "8-level" in cur_notif or "Income Plan" in cur_notif:
            updates["notification_bar_text"] = "🎉 Free shipping on orders above ₹999 · Shop premium hampers now!"
        # Migrate tagline off any MLM-style phrasing
        cur_tag = existing.get("tagline", "") or ""
        if ("Earning" in cur_tag) or ("Earn" in cur_tag) or ("network" in cur_tag.lower()) or ("share • earn" in cur_tag.lower()):
            updates["tagline"] = "Premium products, delivered with care"
        # Delivery charge toggle (admin-controlled)
        if "delivery_charge_enabled" not in existing:
            updates["delivery_charge_enabled"] = True
        if "gst_enabled" not in existing:
            updates["gst_enabled"] = True
        if "extra_charges" not in existing:
            updates["extra_charges"] = []
        # Scrub legacy MLM copy from terms content (public T&C)
        cur_terms = existing.get("terms_content", "") or ""
        if ("8-Level" in cur_terms or "8-level" in cur_terms or "MLM" in cur_terms
                or "Downline" in cur_terms or "downline" in cur_terms or "pyramid" in cur_terms.lower()):
            updates["terms_content"] = TERMS_CONTENT
        # Contact-info scrub — clear all contact fields so the site shows no phone/email/address/socials.
        # Admin can re-populate from /admin/settings when they want to show them again.
        contact_updates = {}
        for k in ("phone", "email", "address", "whatsapp", "facebook", "instagram", "twitter", "youtube"):
            if existing.get(k):
                contact_updates[k] = ""
        if contact_updates:
            updates.update(contact_updates)

        if updates:
            await db.settings.update_one({"_key": "site"}, {"$set": updates})

    # ============ Content-scrub migration (legacy MLM copy → e-commerce friendly) ============
    _forbidden_phrases = ("MLM", "mlm", "8-Level", "8-level", "8 Level", "8 level",
                          "Downline", "downline", "Pyramid", "pyramid",
                          "Calculate Earnings", "calculate earnings",
                          "Start Earning Today", "start earning today",
                          "Income Plan", "income plan",
                          "8 stages of earnings", "become a top earner",
                          "Business Plan", "Compensation Plan",
                          # broader earnings / MLM-style claim phrases:
                          "earned ₹", "earning ₹", "earn ₹",
                          "I earned", "i earned",
                          "commission", "Commission",
                          "Stage 5", "Stage 6", "Stage 7", "Stage 8",
                          "crossed Stage", "reached Stage",
                          "joining kit", "Joining Kit",
                          "referral link generates", "purchase kit is amazing quality",
                          "purchasing kit is amazing", "changed my life")

    def _has_forbidden(text: str) -> bool:
        if not text:
            return False
        low = text.lower()
        return any(p.lower() in low for p in _forbidden_phrases)

    def _has_forbidden_link(link: str) -> bool:
        if not link:
            return False
        low = link.lower()
        return ("/business-plan" in low) or ("/compensation-plan" in low) or ("/calculator" in low)

    # ---- Sliders: fix per-row (preserve id, just rewrite forbidden text/link) ----
    _safe_slider_templates = [
        ("Premium Hampers", "Hand-picked bundles for every occasion", "/hampers", "Explore Hampers"),
        ("Fresh Arrivals", "New drops every week", "/products", "Shop Now"),
        ("Curated Gift Bundles", "Perfect for every celebration", "/hampers", "Learn More"),
        ("Free Shipping", "On orders above ₹999", "/products", "Shop Now"),
    ]
    all_sliders = await db.sliders.find({}, {"_id": 0}).to_list(500)
    tpl_i = 0
    for sl in all_sliders:
        if (_has_forbidden(sl.get("title") or "") or _has_forbidden(sl.get("subtitle") or "")
                or _has_forbidden(sl.get("cta_label") or "") or _has_forbidden_link(sl.get("link") or "")):
            tpl = _safe_slider_templates[tpl_i % len(_safe_slider_templates)]
            tpl_i += 1
            await db.sliders.update_one(
                {"id": sl["id"]},
                {"$set": {"title": tpl[0], "subtitle": tpl[1], "link": tpl[2], "cta_label": tpl[3]}},
            )

    # ---- Testimonials: nuke + reseed if ANY forbidden phrase found ----
    all_testimonials = await db.testimonials.find({}, {"_id": 0}).to_list(500)
    if any(_has_forbidden((t.get("message") or "") + " " + (t.get("role") or "")) for t in all_testimonials):
        _safe_testimonial_seed = [
            ("Ritu Sharma", "Verified Customer", "The hampers are beautifully packed — quality is top-notch and delivery was on time.", 5, "https://i.pravatar.cc/100?img=25"),
            ("Karan Mehta", "Verified Customer", "Best online shopping experience I've had. Great value for money and premium brands.", 5, "https://i.pravatar.cc/100?img=13"),
            ("Anjali Verma", "Verified Customer", "I bought a gift hamper for Diwali and my family loved it. Will order again for sure.", 5, "https://i.pravatar.cc/100?img=32"),
            ("Vikas Patel", "Verified Customer", "Every product I've received felt hand-picked. Fresh, well-packaged and shipped quickly.", 5, "https://i.pravatar.cc/100?img=51"),
            ("Neha Rao", "Verified Customer", "Customer support is fantastic — they resolved my query in minutes. Highly recommend!", 5, "https://i.pravatar.cc/100?img=44"),
            ("Rohit Singh", "Verified Customer", "Genuine products, on-time delivery, and beautiful packaging. Very impressed with the service.", 5, "https://i.pravatar.cc/100?img=15"),
            ("Meera Iyer", "Verified Customer", "Bought the festive hamper for my parents — they loved it. Definitely worth every rupee.", 5, "https://i.pravatar.cc/100?img=48"),
            ("Amit Kumar", "Verified Customer", "Smooth checkout, quick delivery, and excellent quality. Shopping here is a delight.", 5, "https://i.pravatar.cc/100?img=8"),
        ]
        await db.testimonials.delete_many({})
        for i, (nm, role, msg, rating, av) in enumerate(_safe_testimonial_seed):
            await db.testimonials.insert_one({
                "id": str(uuid.uuid4()),
                "name": nm, "role": role, "message": msg, "rating": rating,
                "avatar": av, "is_active": True, "sort_order": i,
                "created_at": now_iso(),
            })

    # ---- FAQs: nuke + reseed if ANY forbidden phrase found ----
    _safe_faqs = [
        ("What is EverGro eMart?",
         "EverGro eMart is a premium online store offering hand-picked grocery hampers, gifting bundles, and daily essentials from India's most loved brands, delivered pan-India."),
        ("How do I place an order?",
         "Browse our products, add items to your cart, and check out securely. You can pay online via UPI, card or wallet. You'll receive an SMS/email confirmation once the order is placed."),
        ("What is your delivery policy?",
         "We ship pan-India within 3–7 business days. Delivery is free on orders above ₹999. Live tracking is available from the 'My Orders' page once shipped."),
        ("What is your refund policy?",
         "You can request a refund or replacement for damaged, wrong or missing items within 48 hours of delivery. Please share a photo of the item — our team will assist you right away."),
        ("How do referral rewards work?",
         "Share your unique referral code with friends. When they place their first eligible purchase, you both receive cashback rewards credited to your rewards wallet, subject to program terms."),
        ("How do I withdraw my rewards balance?",
         "Complete KYC (Aadhaar + PAN + selfie) from the KYC page. Minimum withdrawal is ₹100. Payouts are processed to your linked bank account within 24–72 hours."),
        ("Is my payment secure?",
         "Yes — all payments are processed over 256-bit SSL through our trusted payment partner. We never store your card or UPI PIN."),
    ]
    all_faqs = await db.faqs.find({}, {"_id": 0}).to_list(500)
    if any(_has_forbidden((f.get("question") or "") + " " + (f.get("answer") or "")) for f in all_faqs) or len(all_faqs) == 0:
        await db.faqs.delete_many({})
        for i, (q, a) in enumerate(_safe_faqs):
            await db.faqs.insert_one({
                "id": str(uuid.uuid4()),
                "question": q, "answer": a,
                "is_active": True, "sort_order": i,
                "created_at": now_iso(),
            })

    # ---- Blogs: hard-delete any legacy MLM/downline/8-level posts ----
    all_blogs = await db.blogs.find({}, {"_id": 0, "id": 1, "title": 1, "content": 1}).to_list(500)
    to_wipe = [
        b["id"] for b in all_blogs
        if _has_forbidden((b.get("title") or "") + " " + (b.get("content") or ""))
    ]
    if to_wipe:
        await db.blogs.delete_many({"id": {"$in": to_wipe}})

    # ============ MLM Settings (Phase 2) ============
    await db.settings.update_one(
        {"_key": "mlm"},
        {"$set": {
            "levels_total": 8,
            "max_direct_referrals": 6,
            "min_direct_paid_for_income": 3,
            "joining_amount": 9999.0,
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

    # ============ SINGLE ACTIVE PURCHASING KIT (₹9,999) ============
    joining = await db.products.find_one({"sku": "HMP-JOINING-7200"})
    if not joining:
        # Lock all existing hampers
        await db.products.update_many({"is_hamper": True}, {"$set": {"is_locked": True, "is_active": False}})
        # Create the single active purchasing kit
        await db.products.insert_one({
            "id": str(uuid.uuid4()),
            "name": "EverGro Premium Hamper",
            "description": "The official EverGro premium hamper — hand-picked groceries, wellness essentials, and gifting bundle worth every rupee.",
            "price": 9999.0, "mrp": 11999.0,
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
        # Force update price to ₹9,999 + clean description on every startup (idempotent)
        cur_desc = joining.get("description", "") or ""
        upd = {"name": "EverGro Premium Hamper", "hamper_tier": "Purchasing", "price": 9999.0, "mrp": 11999.0}
        if ("MLM" in cur_desc or "8-level" in cur_desc or "8-Level" in cur_desc or "activates your account" in cur_desc):
            upd["description"] = "The official EverGro premium hamper — hand-picked groceries, wellness essentials, and gifting bundle worth every rupee."
        await db.products.update_one({"sku": "HMP-JOINING-7200"}, {"$set": upd})

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
        await db.banners.insert_one({"id": str(uuid.uuid4()), "title": "Premium Hampers, Delivered To Your Door", "subtitle": "Shop hand-picked bundles today", "image_url": "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?w=1600", "position": "hero", "sort_order": 1, "is_active": True, "link": "/hampers", "created_at": now_iso()})

    if await db.testimonials.count_documents({}) < 8:
        ts = [
            {"name": "Ritu Sharma", "role": "Verified Customer", "rating": 5, "message": "The hampers are beautifully packed — quality is top-notch and delivery was on time.", "avatar": "https://i.pravatar.cc/100?img=25"},
            {"name": "Karan Mehta", "role": "Verified Customer", "rating": 5, "message": "Best online shopping experience I've had. Great value for money and premium brands.", "avatar": "https://i.pravatar.cc/100?img=13"},
            {"name": "Anjali Verma", "role": "Verified Customer", "rating": 5, "message": "I bought a gift hamper for Diwali and my family loved it. Will order again for sure.", "avatar": "https://i.pravatar.cc/100?img=32"},
            {"name": "Vikas Patel", "role": "Verified Customer", "rating": 5, "message": "Every product I've received felt hand-picked. Fresh, well-packaged and shipped quickly.", "avatar": "https://i.pravatar.cc/100?img=51"},
            {"name": "Neha Rao", "role": "Verified Customer", "rating": 5, "message": "Customer support is fantastic — they resolved my query in minutes. Highly recommend!", "avatar": "https://i.pravatar.cc/100?img=44"},
            {"name": "Rohit Singh", "role": "Verified Customer", "rating": 5, "message": "Genuine products, on-time delivery, and beautiful packaging. Very impressed with the service.", "avatar": "https://i.pravatar.cc/100?img=15"},
            {"name": "Meera Iyer", "role": "Verified Customer", "rating": 5, "message": "Bought the festive hamper for my parents — they loved it. Definitely worth every rupee.", "avatar": "https://i.pravatar.cc/100?img=48"},
            {"name": "Amit Kumar", "role": "Verified Customer", "rating": 5, "message": "Smooth checkout, quick delivery, and excellent quality. Shopping here is a delight.", "avatar": "https://i.pravatar.cc/100?img=8"},
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

    # FAQ master content — public-facing, e-commerce friendly.
    faqs_master = [
        {"question": "What is EverGro eMart?", "answer": "EverGro eMart is a premium online store offering hand-picked grocery hampers, gifting bundles, and daily essentials from India's most loved brands, delivered pan-India."},
        {"question": "How do I place an order?", "answer": "Browse our products, add items to your cart, and check out securely. You can pay online via UPI, card or wallet. You'll receive an SMS/email confirmation once the order is placed."},
        {"question": "What is your delivery policy?", "answer": "We ship pan-India within 3–7 business days. Delivery is free on orders above ₹999. Live tracking is available from the 'My Orders' page once shipped."},
        {"question": "What is your refund policy?", "answer": "You can request a refund or replacement for damaged, wrong or missing items within 48 hours of delivery. Please share a photo of the item — our team will assist you right away."},
        {"question": "How do referral rewards work?", "answer": "Share your unique referral code with friends. When they place their first eligible purchase, you both receive cashback rewards credited to your rewards wallet, subject to the current program terms."},
        {"question": "How do I withdraw my rewards balance?", "answer": "Complete KYC (Aadhaar + PAN + selfie) from the KYC page. Minimum withdrawal is ₹100. Payouts are processed to your linked bank account within 24–72 hours."},
        {"question": "Is my payment secure?", "answer": "Yes — all payments are processed over 256-bit SSL through our trusted payment partner. We never store your card or UPI PIN."},
    ]
    for i, f in enumerate(faqs_master):
        existing_faq = await db.faqs.find_one({"question": f["question"]})
        if not existing_faq:
            await db.faqs.update_one(
                {"question": f["question"]},
                {"$set": {**f, "sort_order": i, "is_active": True, "id": str(uuid.uuid4())}},
                upsert=True,
            )

    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_one({
            "id": str(uuid.uuid4()), "code": "WELCOME10",
            "discount_percent": 10, "discount_amount": 0,
            "min_order": 999, "max_discount": 500,
            "is_active": True, "expires_at": None,
        })

    if await db.sliders.count_documents({}) == 0:
        sliders = [
            {"title": "Premium Hampers", "subtitle": "Hand-picked bundles for every occasion", "image_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80", "link": "/hampers", "cta_label": "Explore Hampers", "location": "landing_top", "sort_order": 1},
            {"title": "Fresh Arrivals", "subtitle": "New drops every week", "image_url": "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?w=1600&q=80", "link": "/products", "cta_label": "Shop Now", "location": "landing_top", "sort_order": 2},
            {"title": "Premium Groceries", "subtitle": "Quality you can taste, value you can feel", "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80", "link": "/hampers", "cta_label": "Browse", "location": "landing_top", "sort_order": 3},
            {"title": "Curated Gift Bundles", "subtitle": "Perfect for every celebration", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1600&q=80", "link": "/hampers", "cta_label": "Learn More", "location": "landing_mid", "sort_order": 1},
            {"title": "Invite a Friend", "subtitle": "Share your referral code and earn rewards", "image_url": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80", "link": "/referral", "cta_label": "Get Referral Link", "location": "user_dashboard", "sort_order": 1},
            {"title": "Complete KYC to Unlock Withdrawals", "subtitle": "Aadhaar + PAN + Selfie — 2 minutes", "image_url": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&q=80", "link": "/kyc", "cta_label": "Verify Now", "location": "user_dashboard", "sort_order": 2},
        ]
        for s in sliders:
            s["id"] = str(uuid.uuid4()); s["is_active"] = True; s["created_at"] = now_iso()
            await db.sliders.insert_one(s)

    if await db.reels.count_documents({}) == 0:
        reels = [
            {"title": "Unboxing the ₹9,999 Joining Kit", "video_url": "https://cdn.pixabay.com/video/2024/05/02/210073-941264636_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80", "description": "See what's inside", "location": "both", "sort_order": 1},
            {"title": "How I Earned ₹50K in 30 Days", "video_url": "https://cdn.pixabay.com/video/2023/10/19/185393-877329524_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80", "description": "Real member story", "location": "both", "sort_order": 2},
            {"title": "Sharing Your Referral Link", "video_url": "https://cdn.pixabay.com/video/2024/04/05/207386_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80", "description": "60-second demo", "location": "both", "sort_order": 3},
            {"title": "Inside Our Warehouse", "video_url": "https://cdn.pixabay.com/video/2020/02/28/32847-394089014_tiny.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80", "description": "Quality hand-packed", "location": "both", "sort_order": 4},
        ]
        for r in reels:
            r["id"] = str(uuid.uuid4()); r["is_active"] = True; r["created_at"] = now_iso()
            await db.reels.insert_one(r)
