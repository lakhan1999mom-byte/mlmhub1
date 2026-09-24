# EverGro eMart — Product Requirements (v2)

## Original Problem
Build a production-ready E-Commerce Platform "EverGro eMart" with Landing Website, User Panel, Sub Admin Panel, and Super Admin Panel. Public frontend must look and read like a **pure e-commerce store** with **strict Red + White branding**. Full referral/rewards engine (previously "MLM") remains fully functional in the backend, DB and admin panel — never surfaced in public-facing copy. Kit price is **₹9,999**.

## Tech Stack
- React (CRA + craco) + Tailwind + Shadcn UI + framer-motion + Recharts
- FastAPI + Motor (async MongoDB)
- Cloudinary uploads (live)
- Payment gateway — **Master switch in Admin Settings** (`active_payment_gateway` = none / uropay / razorpay / manual). Default = **none** (payments disabled). No gateway is auto-active without admin action.
- JWT auth + Firebase Phone OTP (prod) + Dev OTP fallback (preview)

## Iteration 28 (Feb 2026) — Sales Agent Program, Lead Capture, Commission Settings

### Public frontend
- **Removed** the "Unlock the full store" locked-cart banner from `/products`. Any shopper can browse and add products to cart without the ₹9,999 gate.
- **Removed** the "Become a Sales Agent" block from the Hampers page (was inline with disclaimer). Now lives on its own dedicated page.
- **New page `/sales-agent`** (`/app/frontend/src/pages/SalesAgent.jsx`): hero with legal disclaimer ("Commission is **totally dependent on your sales**. We are **NOT committing any type of fixed income**"), right-column lead form (name / phone / city / notes), and a hamper CTA at the bottom. Zero mention of 8-level income or fixed rewards.
- **Navbar** now has a top-level `Sales Agent` tab (between Hampers and Blog).
- **ProductDetail** hamper split: renamed "Buy & Become Partner" → "Buy & Become Sales Agent". Copy now says "Commission depends entirely on your sales — no fixed income" instead of "with referral rewards".
- **UserShell** and other pages: "Partner" wording swapped to "Sales Agent" globally.
- **IncomeStructureCard** (8-level ladder) hidden on both user dashboard and admin overview — the fixed-income table is no longer surfaced anywhere in the UI (backend rewards engine untouched).

### Lead capture (public → admin)
- New public endpoint `POST /api/leads/sales-agent` (no auth). Body: `{name, phone, city?, notes?, source?}`. Stores to `leads` collection with `type: "sales-agent"`, `status: "new"`.
- New admin endpoints: `GET /api/admin/leads?status=…`, `PUT /api/admin/leads/{id}`, `DELETE /api/admin/leads/{id}`.
- **New admin page** `/admin/leads` (`AdminLeads.jsx`): filters by status (new/contacted/qualified/converted/rejected), one-click WhatsApp (opens `wa.me/91…`), one-click "mark converted", delete, and inline status dropdown. Added to AdminShell sidebar as "Agent Leads".

### Commission settings (admin-controlled, no fixed income)
- New fields on `SiteSettings`:
  - `agent_commission_percent` (default 5.0) — % the sales agent earns on their own qualifying orders.
  - `agent_downline_commission_percent` (default 2.0) — % on downline sales.
- New Admin Settings card "Sales Agent Commission" with two number inputs and save button. Values are read by whatever payout logic wants to consume them (the referral rewards engine can be gradually migrated to this % model later).
- `GET /api/site/settings` now returns defaults for meta_pixel, active_payment_gateway, cod_disabled, agent commissions so the admin UI never sees `undefined/None`.

### Deferred to next iteration
- **Full blog CMS in admin** (add/edit/delete blogs with rich editor) — not built yet; existing `/admin/blogs` endpoints already exist but need a proper UI.
- **Product page visual overhaul** (make regular product page more engaging with related products, review section, image gallery) — hamper page already has a nice split; regular products still show a bare Add-to-Cart layout.
- **Live commission engine hook** — the new `agent_commission_percent` settings are stored but the payout pipeline still uses the legacy `LEVEL_COMMISSIONS[]` list from mlm_engine.py. Migrating the payout logic to the % model requires touching every paid-order handler.



### COD toggle in admin settings
- New checkbox in the Payment Gateway card (AdminSettings): `Accept Cash on Delivery` (test-id `cod-toggle-checkbox`). Unchecking sets `cod_disabled: true` on the site record and stops accepting COD for both guest and partner checkouts.
- Backend already reads `cod_disabled` from `SiteSettings`; `GET /site/payment-provider` now reflects the toggle immediately (`cod_active` field).

### Guest order SMS
- New module `/app/backend/sms_utils.py` with `send_sms(db, phone, message, purpose, metadata)` and `build_guest_order_sms(...)` helper.
- Wired into `POST /orders/guest` — every guest order fires a friendly SMS ("Hi Ritu! Your EverGro eMart order #A0B1FDF8 for EverGro Premium Hamper (₹10498) is confirmed. Delivery in 5 business days. Thank you!").
- Delivery is **MOCKED** today — the module logs to the backend logger AND persists a `sms_log` MongoDB record so admins can audit every message. To plug in a real provider, add `SMS_PROVIDER=twilio` (or msg91/textlocal) env plus credentials and replace the `_deliver` function.
- New admin endpoint `GET /admin/sms-log?phone=…&limit=…` for auditing.

### Admin guest-orders filter
- `GET /admin/orders` now accepts `?guest=all|guest|partner`. Default `all`. `partner` filter matches `is_guest: false` OR missing (legacy orders).
- `AdminOrders.jsx` UI: new buyer-type filter row (`buyer-filter-all|partner|guest`), and every guest row shows a red `GUEST` badge next to the buyer name; buyer meta shows phone instead of user_code for guest orders.



### Public frontend fully de-MLM'd (again)
- Register page: removed "additional MLM positions" tip and the "One mobile = one account" line. New title "Become a Partner". New subtitle "Step 1: Fill details · Step 2: Pay ₹9,999 Premium Hamper to activate your partner dashboard."
- About page, LegalPage (refund), AdminSettings, AdminPayments — all "MLM …" tokens rewritten to "referral rewards / rewards program / kit activation" wording.
- Cart page: dropped the "Joining Kit required" gate. Every user can add every product to cart. Empty-cart CTA now always says "Shop Now" and routes to `/products`.
- Product Detail: removed the "must-buy-kit-first" toast/redirect. All shoppers can add non-hamper products to cart directly.
- Backend `POST /cart/add`: removed the 403 "must-purchase-₹9,999" gate. The only remaining rule is that an already-activated partner cannot re-buy the joining hamper.

### Purchase split on the hamper product page
- On any `is_hamper=true` product, the CTA area now shows two branded cards:
  1. **Become an EverGro eMart Partner** → routes to `/register` (or `/purchase-kit` if already logged in). Standard activation → partner dashboard flow.
  2. **Buy as a Customer** → routes to new `/guest-checkout/:productId`.
- Only regular (non-hamper) products keep the classic `Add to Cart / Buy Now` pair.

### Guest checkout
- New page `/guest-checkout/:productId` (`/app/frontend/src/pages/GuestCheckout.jsx`) — no login required. Collects name, mobile, email (optional), address, city, state, pincode, size/color (if applicable), qty, and payment method. Renders a live order summary. Shows a big confirmation card with order id after successful placement.
- New backend endpoint `POST /api/orders/guest` (public, no auth). Creates an order with `is_guest: true`, `user_id: null`, and skips ALL partner activation / referral tree / rewards logic. Validates stock, computes GST from product config, respects `cod_disabled` and `active_payment_gateway` flags.
- COD is enabled by default. `GET /api/site/payment-provider` now returns `{cod_active, online_active}`. New `cod_disabled` flag added to `SiteSettings` for admin override.

### Files added/changed this iteration
- Added: `/app/frontend/src/pages/GuestCheckout.jsx`
- Backend: `/app/backend/server.py` (guest order endpoint, payment provider expansion, cart-gate removal), `/app/backend/models.py` (SiteSettings.cod_disabled)
- Frontend: `App.js` (new route), `ProductDetail.jsx` (hamper split), `Cart.jsx` (gate removed), `Register.jsx`, `JoinNow.jsx`, `About.jsx`, `LegalPage.jsx`, `AdminSettings.jsx`, `AdminPayments.jsx` (MLM copy sweep)



### Product model + admin
- `Product.sizes: List[str]` and `Product.colors: List[str]` added to `models.py`.
- Admin Products page has a "Fashion / Variant Options" card (only shown when the product is NOT a hamper) with comma-separated Sizes and Colors inputs. Values persist via existing `PUT /admin/products/{id}` (accepts arbitrary payload).
- Product detail (`/products/:id`) renders pill-shaped Size buttons and Color swatches (auto-detects hex vs name). Add-to-Cart is **blocked** until size + color are picked when the product exposes those variants.
- Cart backend: `CartAdd` schema now accepts `size` and `color`. Cart rows are keyed on `(product_id, size, color)` so different variants can coexist in the cart.

### Rewards ladder / Income Structure Card
- New endpoint `GET /api/mlm/income-structure` (auth-only): returns `joining_amount` (auto-pulled from the live kit product price), `max_direct_referrals`, `min_direct_paid_for_income`, `levels[]` (per_member × 6^n members) and `total_potential`.
- Shared React component `/app/frontend/src/components/IncomeStructureCard.jsx` renders the table, "Max Potential" pill, and a "no income guarantee" footnote.
- Wired into **user Dashboard** (`<IncomeStructureCard variant="user"/>`) and **Admin Overview** (`<IncomeStructureCard variant="admin"/>`).
- Everything is data-driven — when admin edits `mlm.level_commissions` or bumps the kit price, both dashboards update automatically.

### Editable hamper contents
- Already fully in place: `AdminProducts.jsx` has a Contents editor (tags input) that mutates `product.contents[]`. `ProductDetail.jsx` renders that same array under the "Contains:" heading, so any admin edit is instantly visible to shoppers on the product page. No further backend work needed.



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
