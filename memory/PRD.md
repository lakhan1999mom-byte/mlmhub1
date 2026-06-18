# EverGro eMart — Product Requirements

## Original Problem
Build a production-ready MLM E-Commerce Platform "EverGro eMart" with Landing Website, User Panel, Sub Admin Panel, and Super Admin Panel. Users buy hampers, get referral links, build downline networks across 8 stages (3 referrals per stage), earn commissions, withdraw earnings.

## Tech Stack
- React (CRA + craco) + Tailwind + Shadcn UI components
- FastAPI + Motor (async MongoDB)
- Cloudinary for image/PDF uploads (real creds)
- Razorpay in MOCK mode (admin can switch to live)
- JWT auth + Dev OTP system (logs OTP to backend + returns in API response)

## What's Been Implemented (2026-02)
- Landing site: Hero, hampers showcase, 8-stage MLM plan, products grid, testimonials, FAQ, CTA, footer
- Public pages: About, Business Plan, Compensation Plan, Income Calculator, Products, Hampers, Product Detail, Blog, Blog Detail, FAQ, Contact, Career, Legal (privacy/terms/refund/shipping)
- Auth: Register with referral code, Login (email/phone+password & OTP), JWT
- User Panel: Dashboard, Network tree, Wallet, Withdrawals, KYC (Cloudinary uploads), Orders, Profile, Notifications, Referral (QR code + share), Support tickets
- Cart + Checkout + MOCK Razorpay payment + cashback credit
- MLM Engine: 8 stages, 3 refs/stage, auto progression, commission credit on stages 1/3/5/7/8, cycle reset
- Admin Panel: Dashboard (KPIs + charts), Users (search + role/active toggle), Products (CRUD + image upload), Orders (status + tracking), Withdrawals (approve/reject/paid/hold), KYC review, Tickets reply, Settings (site + Razorpay + MLM), Broadcast notifications
- Sub-admin permissions enforced
- WhatsApp floating button
- Notification bar

## Deferred / Phase 2
- Real Firebase phone OTP (currently dev mode)
- WhatsApp/SMS/Email actual delivery
- PDF/Excel/CSV report exports
- Live chat
- Leaderboard advanced
- Live Razorpay integration (admin can paste keys, but verify_signature not enforced)
- Sitemap generator, dynamic page builder
- Mobile apps (Android/iOS)

## Test Credentials
See /app/memory/test_credentials.md
