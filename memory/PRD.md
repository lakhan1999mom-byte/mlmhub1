# EverGro eMart — Product Requirements

## Original Problem
Build a production-ready MLM E-Commerce Platform "EverGro eMart" with Landing Website, User Panel, Sub Admin Panel, and Super Admin Panel. Users buy the ₹7,200 Joining Kit, get a referral link, build a downline across 8 levels, earn per-level commissions, and withdraw earnings.

## Tech Stack
- React (CRA + craco) + Tailwind + Shadcn UI + framer-motion
- FastAPI + Motor (async MongoDB)
- Cloudinary uploads (live)
- **Cashfree Payments** (only provider) with legit mock mode (auto-succeeds when inactive)
- JWT auth + Firebase Phone OTP (production only) + Dev OTP fallback (preview)

## Phase 2 (Implemented 2026-02)
- **8-Level MLM Engine** (mlm_engine.py) with fixed commissions L1=₹1200 · L2=₹400 · L3=₹50 · L4=₹300 · L5=₹50 · L6=₹200 · L7=₹50 · L8=₹100
- Max 6 direct referrals per member; income unlocks at 3 paid direct refs
- **Pay-to-register flow**: registration creates PENDING user (`is_joining_paid=false`); MLM tree placement + commissions only trigger after `/orders/verify-payment` on the joining hamper
- **Terms & Conditions** mandatory at registration (server enforces `terms_accepted`)
- **Single active hamper**: ₹7,200 EverGro Joining Kit (all other hampers `is_locked=True`, `is_active=False`)
- **Separate delivery config**: `GET /site/delivery-config` returns `delivery_charge`, `free_shipping_threshold`, `gst_percent` from admin settings; used by cart, checkout, and `/orders/create`
- **Admin Panels**: Inventory (stock/low-stock), Accounts (all users overview), Sliders, Reels, Audit Logs
- Larger transparent logo, mobile responsive

## Phase 2 Cart System (Implemented 2026-02, this session)
- **Cart join-gate** (backend `/cart/add` + `/orders/create`): non-joined users can ONLY add the ₹7,200 joining hamper; joined users cannot re-purchase the joining hamper
- **Stock enforcement** on `/cart/add` and `/cart/update` (400 if qty > stock)
- **DELETE /api/cart** to clear the cart
- **CartProvider** (`lib/cart.jsx`) exposes `cart`, `delivery` (config), `itemCount`, `addItem` (returns `{ok}`), `updateItem`, `removeItem`, `clearCart`
- **Cart.jsx** rewrite: join-gate banner, empty state, quantity ± controls, low-stock warnings, sticky order summary using dynamic delivery config, clear-cart, continue-shopping link
- **ProductDetail** blocks non-hamper add-to-cart for non-joined users (redirects to `/hampers`)
- **ProductsPage** shows a join-gate banner for non-joined users
- **Checkout** uses shared `useCart().delivery` (single source of truth)

## Bug Fixes (2026-02, this session)
- Fixed `REFERRALS_PER_STAGE` NameError in `/users/dashboard` (Phase 1 legacy const removed) → hardcoded 3
- Removed unused `day_orders` in `/admin/stats`
- Added `income_active`, `joining_paid_at`, `income_activated_at` to `public_user()` output
- Made `/cart/update` idempotent (upsert if product not in cart yet)
- Migration in seed: force `is_joining_paid=True` + `income_active=True` on admin/sub_admin every startup

## Test Report
- `/app/test_reports/iteration_4.json` — 22/22 backend Phase 2 pytest PASS, full frontend Phase 2 flows verified (register T&C, cart, product-detail redirect, checkout, admin smoke)
- `/app/backend/tests/test_phase2_cart_join.py` — pytest suite

## Key Rules (encoded)
- Max direct refs per member: **6**
- Income activation threshold: **3** paid direct refs
- Joining amount: **₹7,200**
- Level commissions: `[1200, 400, 50, 300, 50, 200, 50, 100]`
- Inactivity auto-disable: 180 days
- Withdrawal: KYC approved + ≥3 paid direct refs + ≥₹100

## Backlog (P1/P2)
- **P1**: Full UI polish audit (mobile spacing, broken button hunt across Admin panels) — mostly complete but not exhaustively swept
- **P1**: Extract cart/join-gate + stock rules into a shared helper (currently duplicated in `/cart/add` and `/orders/create`)
- **P1**: Split `server.py` (>1500 lines) into router modules (`cart_router`, `orders_router`, `admin_router`, etc.)
- **P1**: Idempotency guard on `/orders/verify-payment` (currently a concurrent double-verify could double-credit commissions)
- **P2**: Stock reservation on order create (race between two buyers on last unit)
- **P2**: Real Razorpay signature verification (currently MOCKED)
- **P2**: Firebase Push Notifications + WhatsApp/SMS delivery (currently in-DB only)
- **P2**: PDF/Excel/CSV admin reports
- **P2**: Live chat, advanced leaderboard

## Integrations
- **Cashfree**: Only payment provider. Mock mode auto-succeeds when `cashfree_active=false` (default). Live keys settable via `/admin/payments`.
- **Firebase Phone Auth**: Gated to `evergroemart.com` host only (via `REACT_APP_FIREBASE_HOSTS`). Preview/localhost falls back to dev-OTP path automatically.
- **Cloudinary**: LIVE (uploads working)
- **OTP**: Dev mode fallback (returned in API response as `dev_otp`)

## Iteration 12 (Feb 2026) — Categories · Promo Codes · ₹7,499 · Delivery Toggle · Prod-gated OTP
- **Price change**: Joining kit ₹7,200 → **₹7,499** across seed, hamper price, FAQs, JoinNow, Register, Cart, ProductDetail, Compensation Plan, Dashboard.
- **Contact update**: Footer + Contact + WhatsApp FAB now use **+91-9928525889**. App Store & Google Play buttons removed from footer.
- **FAQ overhaul**: Force-refreshed 7 FAQs (only replaces stale answers). "How does the MLM plan work?" now shows the full 8-level commission table (L1 ₹1,200 × 6 = ₹7,200 … L8 ₹100 × 16,79,616 = ₹16,79,61,600 · total ₹19.2 Cr).
- **Categories admin** (NEW): CRUD at `/admin/categories`. Product upload UI now uses a Category dropdown instead of freeform text.
- **Promo codes admin** (NEW): CRUD at `/admin/coupons` with percent OR flat discount, min-order, max-discount, usage limit, expiry. `/coupons/validate/{code}` enforces expiry + limit.
- **Delivery toggle**: Admin can flip `delivery_charge_enabled` at `/admin/settings`. When OFF → `/site/delivery-config` returns 0 and orders skip shipping fee.
- **JoinNow flow**: New `/auth/phone-status` endpoint queried BEFORE send-OTP. If phone has existing accounts → shows choice ("Login to existing" vs "Create NEW re-entry"). Fresh phone → straight to OTP. After signup lands on `/dashboard` (not `/hampers`).
- **Dashboard Stage Commission fix**: previously showed hardcoded ₹500. Now pulls `stats.current_stage_commission` from backend which returns the correct L-value for the user's current stage (₹1,200 for Stage 1).
- **Production OTP gate**: `/auth/otp/send` no longer returns `dev_otp` when the request Host/Origin/Referer/X-Forwarded-Host matches `evergroemart.com`. Firebase sends real SMS from the client on prod.
- **Test report**: `/app/test_reports/iteration_12.json` — **12/12 backend + 10/10 frontend PASS** (one Dashboard.jsx variable-rename typo fixed by testing agent).
- **Follow-up open**: Firebase Authorized Domains must include `evergroemart.com` (admin dashboard step) for real SMS delivery on production.

## Iteration 11 (Feb 2026) — Cashfree-only + Multi-Account Login
- Ripped out all Easebuzz code + endpoints (`easebuzz_utils.py` deleted; `/payments/easebuzz/*` removed). All Razorpay mock fields on order docs removed.
- `/payments/cashfree/initiate` + `/verify` support MOCK mode (auto-succeed) when admin has Cashfree inactive.
- Admin `/admin/payments` UI is Cashfree-only with a prominent Mock/Live indicator.
- **Fixed Join Now OTP UI hidden bug** — Firebase Phone Auth was rendering a visible reCAPTCHA on the preview host (not in Firebase authorized domains). `sendFirebaseOtp` now short-circuits on non-prod hosts → dev-OTP fallback runs and step-2 (`join-otp-input`) shows.
- **Multi-Account Selector** across Login (mobile-OTP tab) and new `/forgot-password` page. Each account card shows @username, name, user_code, and activation status. Single account auto-logs in.
- **New endpoint** `/auth/forgot-password/lookup` — lists accounts after OTP verify. `/auth/forgot-password` requires `user_code` when phone has multiple accounts (returns `{multiple: true, accounts: [...]}` when omitted). OTP is invalidated after successful reset (no replay).
- Polish: framer-motion animations on JoinNow (step transitions), Login (multi-account cards), ForgotPassword, Checkout. ProductCard now shows discount % badge, quick-view overlay on hover, and lifts 2px on hover.
- Test report: `/app/test_reports/iteration_11.json` — **15/15 backend + 5/5 frontend PASS**.
