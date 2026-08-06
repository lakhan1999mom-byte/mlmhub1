# EverGro eMart — Product Requirements

## Original Problem
Build a production-ready MLM E-Commerce Platform "EverGro eMart" with Landing Website, User Panel, Sub Admin Panel, and Super Admin Panel. Users buy the ₹7,499 Starter Kit, get a referral link, build a downline across 8 levels, earn per-level commissions, and withdraw earnings.

## Tech Stack
- React (CRA + craco) + Tailwind + Shadcn UI + framer-motion + Recharts
- FastAPI + Motor (async MongoDB)
- Cloudinary uploads (live)
- **Cashfree Payments** (only provider) with legit mock mode (auto-succeeds when inactive)
- JWT auth + Firebase Phone OTP (production only) + Dev OTP fallback (preview)

## Iteration 17 (Feb 2026) — P0 Bug Fixes + Global Admin Search + Advanced User Reports
- **P0 Fix — AdminDashboard Recent Joins was blank**: `/admin/dashboard` now returns a `stats` bag (backwards-compatible flat fields kept) + a proper `daily_stats` array `[{day,date,users,revenue,orders}]` + a `recent_joins` array (up to 8 latest members with `is_joining_paid` badge and time-since). AdminDashboard.jsx replaced the "Top-level counters" empty box with a live "Recent Joins" list (avatars, code, phone, Active/Pending pill, "just now / 40m ago").
- **P0 Fix — Primary business missing Pay CTA**: `/mlm/businesses` now returns `pending_order_id` on every inactive business (primary + additional). New endpoint `POST /mlm/businesses/{business_id}/pay-kit` returns (or creates on-the-fly) a pending joining order for that specific business — supports BOTH the primary (business_id == user.id, order.business_id=None) and additional business paths. Businesses.jsx + BusinessDetail.jsx render an amber "Activation required · Pay Now" CTA on every inactive card.
- **Global Admin Search** (Cmd/Ctrl-K palette): New `GET /admin/search?q=...` searches across `users` (name, username, email, phone, user_code, referral_code, sponsor_id) + `referral_businesses` (name, business_code, referral_code, sponsor_referral_code) + `orders` (order_code, tracking_no). AdminShell.jsx exposes a sidebar search widget + Cmd/Ctrl-K keyboard shortcut opening `AdminSearchPalette` with grouped Users/Businesses/Orders sections, live-search debounced (180ms), keyboard nav (Esc closes).
- **Advanced Admin User Reports**: New page `/admin/users/:userId` (AdminUserDetail.jsx) with 3 tabs:
  - **Overview** — profile hero, kit/active status toggle, counters strip (Orders, Direct Refs, Businesses, Withdrawals, Wallet), all additional referral businesses cards.
  - **Login History** — table of the user's `login` events with parsed `IP` (respects `X-Forwarded-For`) + `Device` (Desktop/Mobile/Tablet) + `Browser · OS` (Chrome/Safari/Firefox/Edge · Windows/macOS/iOS/Android/Linux) inferred from the User-Agent header.
  - **Activity Log** — full audit trail (login/register/payment/withdrawal_request/kyc_submit/role_change etc) with target + IP + JSON metadata.
- **Login now records IP + User-Agent**: `log_audit` extended with `request: Request` shortcut. All 5 login endpoints (`/auth/login`, `/auth/login-with-code`, `/auth/otp/verify`, `/auth/otp/pick-account`, `/auth/firebase/verify`) now pass the request so IP + User-Agent land in `audit_logs`.
- **Users list `q` search widened**: `/admin/users?q=` now matches on name, username, email/public_email, phone, user_code, referral_code, sponsor_id. AdminUsers.jsx adds a "Ref" column and a "View" button linking to the detail page.
- **Test report**: `/app/test_reports/iteration_17.json` — **19/19 backend PASS on first run** (test file `/app/backend/tests/test_iteration17_admin_search_history.py`). Frontend verified via screenshots (palette, user detail, login history).

## Iteration 16 (Feb 2026) — Massive Redesign Phases 1–4
- **Phase 1** — Auth Redesign: strict 1 phone/email/username = 1 account. Multi-account paths removed.
- **Phase 2** — Multiple Referral Businesses: single user account, multiple positions. Each additional business is gated by its own ₹7,499 kit order. `/mlm/businesses` CRUD + `/checkout/direct/{orderId}` flow.
- **Phase 3** — User Dashboard: Recharts area/pie charts, referral-card, notifications, growth-mix.
- **Phase 4** — Admin Panel Dark Theme: slate control-room aesthetic, CSV exports (`/admin/export/users|orders|withdrawals`), signup+revenue chart, system health strip.
- Iteration 16 report: `/app/test_reports/iteration_16.json` — 12/12 backend + 100% frontend PASS.

## Iteration 13 (Feb 2026) — Auth 3-Tab · Order Tracking · T&C Modal
- New backend endpoints: `POST /auth/identifier-lookup`, `GET /admin/tracking/steps`. `/auth/accounts-by-phone` now returns `username` + `is_joining_paid`.
- **Full order tracking system**: `orders.tracking_history[]` seeded on create ("Order Placed") + auto-appended on `cashfree/verify` ("Confirmed · Payment received"). Admin `PUT /admin/orders/{id}` extended with `courier_name`, `tracking_url`, `note` — every meaningful change appends an event and creates a customer notification on shipped/out_for_delivery/delivered.
- **New pages**: `/orders/:id` (customer timeline with 6-step progress + full event log + copy-tracking + track-online button). `AdminOrders` fully rebuilt with per-order tracking modal (status buttons, courier, tracking no, tracking URL, free-text note, history preview).
- **Terms & Conditions modal**: `/join-now` T&C link now opens a modal with the live terms HTML from `/site/settings`. "I Accept" auto-ticks the required checkbox. Reusable `TermsModal` component created for future use elsewhere.

## Backlog / Upcoming
- **P2 — Refactor server.py** (now ~2947 lines): split into `backend/routes/{auth,mlm,orders,admin,site}.py` modules for maintainability. Testing subagent flagged this again in Iteration 17.
- **P2 — Admin CSV export filters**: current exports stream the entire collection in one chunk (no `?since=YYYY-MM-DD` filter). For scale, chunk row-by-row.
- **P2 — MongoDB perf**: AdminDashboard uses N+1 count queries; consider aggregation pipeline. Add indexes on `orders (user_id, business_id, is_joining_order, payment_status)`.
- **P3 — Business kit joining flow parity**: business-order creation bypasses `_compute_order_totals` (no delivery fee / extras). Route both through the same helper.
- **P3 — Real-time updates**: recent joins list is polled on page load only; consider a lightweight websocket or SSE for live pushes.

## Iteration 12 (Feb 2026) — Categories · Promo Codes · ₹7,499 · Delivery Toggle · Prod-gated OTP

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

## Iteration 15 (Feb 2026) — Phase 1: Simplified 2-Tab Auth + Admin Charges Control
- **Login redesigned**: premium gradient card, 2 tabs only (Mobile + Email · both with password). Removed Username tab and all OTP-based login (OTP is only for /forgot-password + /join-now). Remember Me stores identifier in localStorage. Show/Hide password.
- **Registration is strict**: One mobile = one account. Duplicate phone/email/username are all rejected with clear 409 messages. Old "email +reN suffix" hack removed.
- **Admin Charges page** (`/admin/charges`): dedicated screen for GST toggle + delivery toggle + unlimited custom extra charges (packing, handling, service, insurance…). Each charge has type (flat ₹ / percent %), value, and ON/OFF toggle.
- **Order calc now respects toggles**: When GST off → gst=0 on all line items. When delivery off → shipping=0. Every enabled extra charge appears in order.extras breakdown + adds to order.extras_total.
- **Checkout UI**: displays each extra as a separate line on the summary (dynamic from admin config).
- **Test report**: `/app/test_reports/iteration_15.json` — **12/12 backend + 100% frontend PASS**.
- **Phase 2 next**: Multi Referral Business data model + switcher UI. Existing duplicate-phone users will be migrated (first account = main user, others become referral businesses).

## Iteration 13 (Feb 2026) — 3-Tab Login · Order Tracking · T&C Modal
- **New Login flow (3 tabs)**: Mobile / Email / Username. Username tab is instant fast-path. Mobile+Email tabs go through identifier-lookup → single account = direct password prompt; multiple accounts = OTP → picker → password. **Password ALWAYS required.**
- New backend endpoints: `POST /auth/identifier-lookup`, `GET /admin/tracking/steps`. `/auth/accounts-by-phone` now returns `username` + `is_joining_paid`.
- **Full order tracking system**: `orders.tracking_history[]` seeded on create ("Order Placed") + auto-appended on `cashfree/verify` ("Confirmed · Payment received"). Admin `PUT /admin/orders/{id}` extended with `courier_name`, `tracking_url`, `note` — every meaningful change appends an event and creates a customer notification on shipped/out_for_delivery/delivered.
- **New pages**: `/orders/:id` (customer timeline with 6-step progress + full event log + copy-tracking + track-online button). `AdminOrders` fully rebuilt with per-order tracking modal (status buttons, courier, tracking no, tracking URL, free-text note, history preview).
- **Terms & Conditions modal**: `/join-now` T&C link now opens a modal with the live terms HTML from `/site/settings`. "I Accept" auto-ticks the required checkbox. Reusable `TermsModal` component created for future use elsewhere.
- **Test report**: `/app/test_reports/iteration_13.json` — **14/14 backend + 100% frontend PASS**. One low-priority typo (address.full_name) already fixed post-report.

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
