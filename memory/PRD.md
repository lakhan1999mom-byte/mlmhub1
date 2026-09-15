# EverGro eMart — Product Requirements (v2)

## Original Problem
Build a production-ready E-Commerce Platform "EverGro eMart" with Landing Website, User Panel, Sub Admin Panel, and Super Admin Panel. Public frontend must look and read like a **pure e-commerce store** with **strict Red + White branding**. Full referral/rewards engine (previously "MLM") remains fully functional in the backend, DB and admin panel — never surfaced in public-facing copy. Kit price is **₹9,999**.

## Tech Stack
- React (CRA + craco) + Tailwind + Shadcn UI + framer-motion + Recharts
- FastAPI + Motor (async MongoDB)
- Cloudinary uploads (live)
- Payment gateway — **Master switch in Admin Settings** (`active_payment_gateway` = none / uropay / razorpay / manual). Default = **none** (payments disabled). No gateway is auto-active without admin action.
- JWT auth + Firebase Phone OTP (prod) + Dev OTP fallback (preview)

## Iteration 23–24 (Feb 2026) — Red/White Rebrand + Legal Scrub + Admin Superpowers

### Public UI (Legal-friendly e-commerce, no MLM copy)
- **Global theme swap**: greens/lime/amber → red/white palette (`#DC2626`, `#B91C1C`, `#7F1D1D`, `#FEE2E2`, `#FEF2F2`). Admin panel is now light red/white (was slate-950 dark).
- **Landing.jsx** rewritten — hero says "Shop Premium Hampers, Delivered To Your Door" · "Shop Now" / "Explore Hampers". Removed: MLM badge, 8-level income table, ₹19.2 Cr potential, "Start Earning Today", "Calculate Earnings".
- **Navbar**: Home · Shop · Hampers · Blog · About. Removed: Contact, Plan, Calculator.
- **Footer**: Removed all contact fields (phone/email/address/socials only shown if admin re-populates). Added line: **"EverGro eMart is controlled by PK and Son LLP"**.
- **Removed pages/routes**: `/business-plan`, `/compensation-plan`, `/calculator` (files deleted).
- **Removed WhatsApp FAB** from public site.
- **HampersPage** rewritten — no joining/8-level/referral wording; adds a **"Become a Sales Agent"** optional block with explicit `No income guarantee` disclaimer.
- **Kit price** changed everywhere `7,499 → 9,999` (frontend + seed + admin + product description). Product name: `EverGro Purchasing Kit → EverGro Premium Hamper`.

### DB migrations (idempotent, run on every startup in seed.py)
- **Site settings**: `tagline`, `notification_bar_text`, `terms_content` scrubbed of MLM copy; phone/email/address/socials cleared to empty.
- **Sliders**: any slider with forbidden phrasing (MLM / 8-level / Business Plan / Calculator link) auto-rewritten to a safe e-commerce template.
- **Testimonials**: nuke-and-reseed with 8 verified-customer style testimonials if any legacy MLM copy present.
- **FAQs**: nuke-and-reseed with 7 safe e-commerce FAQs if any legacy copy present. Old `/admin/refresh-faqs` still exists (legacy).
- **Product (kit)**: description force-refreshed from legacy MLM copy to "The official EverGro premium hamper — hand-picked groceries…".

### Admin (Full A-to-Z control)
- **Change admin password**: `SelfPasswordCard` in `/admin/settings` (already existed).
- **Delete user (single OR with entire referral BRANCH)**: `DELETE /api/admin/users/{id}?cascade=true` — BFS the tree by `sponsor_id = user_code` and hard-deletes every downstream row. UI: cascade toggle on `AdminUserDetail` delete modal + dedicated "Delete + Branch" button on `AdminUsers` row.
- **Bulk delete**: `POST /api/admin/users/bulk-delete {user_ids, cascade}`. UI: row checkboxes + bulk bar with `Bulk Delete` and `Bulk Delete + Whole Branch`.
- **Bulk replace/edit**: `POST /api/admin/users/bulk-update {user_ids, updates}` — whitelisted fields only (is_active, current_stage, wallet_balance, role, kyc_status, is_joining_paid, income_active, sponsor_id, avatar_url). UI: `Bulk Replace` modal with per-field editor.
- **Global admin search (Cmd/Ctrl-K)** — unchanged.
- **Meta Pixel (Facebook)** — new card in `/admin/settings`: `meta_pixel_id` + `meta_pixel_code` (raw script) with **Delete Old Code** button. Auto-injected into `<head>` on every public page load via `PublicLayout` in App.js. Removes previously-injected tags on change.
- **Payment gateway master switch** — new card in `/admin/settings`: `active_payment_gateway` ∈ {none, uropay, razorpay, manual}. Default `none`. `GET /site/payment-provider` returns `{active: false}` when unset. `DirectCheckout` (kit purchase) now shows a "Payment gateway not configured" screen when disabled.

### User Panel
- **Sidebar labels renamed**: Dashboard → Overview · Network → My Referrals · Referral → Invite & Earn · Wallet → Rewards Wallet.
- **UserFooter** added — live earnings **ticker** ("<Name> just earned ₹X lakh via EverGro") that rotates **every 10 minutes**, plus a "controlled by PK and Son LLP" line.

## Backlog / Requested but not yet implemented (P1)
- **Multi-account per phone** — reversal of the strict 1-mobile-1-account rule to allow one user to have multiple accounts (each new account gated by a kit purchase). Currently the multi-*referral-business* system already exists; the exact intent (multi-user-accounts vs multi-businesses under one user) needs one more clarification.
- **Fashion category → size + color option** at product level.
- **Income Structure display** on user Dashboard and Admin Overview (from mlm settings `level_commissions`) — needs UI card.
- **Admin edit hamper items (contents list)** — dedicated per-hamper edit UI in `/admin/products` for the `contents[]` array.

## Backend endpoints (new/changed this iteration)
- `DELETE /api/admin/users/{id}?cascade=true|false`
- `POST /api/admin/users/bulk-delete {user_ids, cascade}`
- `POST /api/admin/users/bulk-update {user_ids, updates}`
- `GET /api/site/payment-provider` — now honors `active_payment_gateway`
- `PUT /api/admin/settings/site` — accepts `meta_pixel_id`, `meta_pixel_code`, `active_payment_gateway`

## Test Reports
- `/app/test_reports/iteration_23.json` — backend 15/15 pytest PASS. Frontend flagged DB-seeded legacy MLM copy in sliders/testimonials/FAQs → fixed via new migration block in seed.py.

## Credentials
- `/app/memory/test_credentials.md` — unchanged. `admin@evergroemart.com / Admin@123`.

## Key Rules (encoded)
- Kit price: **₹9,999** (was ₹7,499 → ₹7,200)
- Max direct refs per member: 6 (backend unchanged)
- Level commissions (backend): `[1200, 400, 50, 300, 50, 200, 50, 100]`
- Withdrawal: KYC approved + ≥3 paid direct refs + ≥₹100
- Payment gateway master switch: `none` by default
