import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import "@/App.css";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// pages
import Landing from "@/pages/Landing";
import About from "@/pages/About";
import ProductsPage from "@/pages/ProductsPage";
import HampersPage from "@/pages/HampersPage";
import ProductDetail from "@/pages/ProductDetail";
import Blog from "@/pages/Blog";
import BlogDetail from "@/pages/BlogDetail";
import FAQPage from "@/pages/FAQPage";
import Contact from "@/pages/Contact";
import Career from "@/pages/Career";
import LegalPage from "@/pages/LegalPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import GuestCheckout from "@/pages/GuestCheckout";
import SalesAgent from "@/pages/SalesAgent";

import UserShell from "@/components/UserShell";
import Dashboard from "@/pages/user/Dashboard";
import Network from "@/pages/user/Network";
import Wallet from "@/pages/user/Wallet";
import Withdrawals from "@/pages/user/Withdrawals";
import KycPage from "@/pages/user/KycPage";
import Orders from "@/pages/user/Orders";
import OrderDetail from "@/pages/user/OrderDetail";
import Businesses from "@/pages/user/Businesses";
import BusinessDetail from "@/pages/user/BusinessDetail";
import DirectCheckout from "@/pages/user/DirectCheckout";
import Profile from "@/pages/user/Profile";
import NotificationsPage from "@/pages/user/NotificationsPage";
import Referral from "@/pages/user/Referral";
import Support from "@/pages/user/Support";

import AdminShell from "@/components/AdminShell";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminUserDetail from "@/pages/admin/AdminUserDetail";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminKyc from "@/pages/admin/AdminKyc";
import AdminTickets from "@/pages/admin/AdminTickets";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminBroadcast from "@/pages/admin/AdminBroadcast";
import AdminSliders from "@/pages/admin/AdminSliders";
import AdminReels from "@/pages/admin/AdminReels";
import AdminAuditLogs from "@/pages/admin/AdminAuditLogs";
import AdminInventory from "@/pages/admin/AdminInventory";
import AdminAccounts from "@/pages/admin/AdminAccounts";
import AdminBrands from "@/pages/admin/AdminBrands";
import AdminTestimonials from "@/pages/admin/AdminTestimonials";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminCharges from "@/pages/admin/AdminCharges";
import JoinNow from "@/pages/JoinNow";
import PurchaseKitPage from "@/pages/PurchaseKitPage";

function PublicLayout() {
  const [site, setSite] = useState(null);
  useEffect(() => {
    api.get("/site/settings").then(({ data }) => setSite(data)).catch(() => {});
  }, []);

  // Meta Pixel injection — clears old script/noscript first, then re-injects when settings change.
  useEffect(() => {
    if (!site) return;
    // Remove old pixel nodes
    document.querySelectorAll('script[data-meta-pixel="1"], noscript[data-meta-pixel="1"]').forEach((n) => n.remove());
    const pid = (site.meta_pixel_id || "").trim();
    const custom = (site.meta_pixel_code || "").trim();
    if (pid) {
      const s = document.createElement("script");
      s.setAttribute("data-meta-pixel", "1");
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pid}');fbq('track','PageView');`;
      document.head.appendChild(s);
      const ns = document.createElement("noscript");
      ns.setAttribute("data-meta-pixel", "1");
      ns.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pid}&ev=PageView&noscript=1"/>`;
      document.head.appendChild(ns);
    } else if (custom) {
      // Free-form custom pixel/tracking code (admin-controlled). Wrapped so we can wipe later.
      const wrapper = document.createElement("script");
      wrapper.setAttribute("data-meta-pixel", "1");
      wrapper.innerHTML = custom.replace(/<\/?script[^>]*>/gi, "");
      document.head.appendChild(wrapper);
    }
  }, [site?.meta_pixel_id, site?.meta_pixel_code]);

  return (
    <>
      <Navbar siteSettings={site} />
      <Outlet context={{ site }} />
      <Footer site={site} />
    </>
  );
}

function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-10 text-center text-[#7F1D1D]">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && !role.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

/**
 * Gate that redirects non-paid users to /hampers.
 * Applied to income-related pages (dashboard, network, wallet, referral, businesses).
 * Admins bypass the check entirely.
 */
function RequireJoined({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-[#7F1D1D]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "super_admin" || user.role === "sub_admin") return children;
  if (!user.is_joining_paid) return <Navigate to="/hampers" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<About />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/hampers" element={<HampersPage />} />
              <Route path="/sales-agent" element={<SalesAgent />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogDetail />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/career" element={<Career />} />
              <Route path="/legal/:type" element={<LegalPage />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/guest-checkout/:productId" element={<GuestCheckout />} />
              <Route path="/purchase-kit" element={<PurchaseKitPage />} />
              <Route path="/checkout" element={<RequireAuth role={["user","sub_admin","super_admin"]}><Checkout /></RequireAuth>} />
            </Route>

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/join-now" element={<JoinNow />} />

            <Route element={<RequireAuth role={["user","sub_admin","super_admin"]}><UserShell /></RequireAuth>}>
              <Route path="/dashboard" element={<RequireJoined><Dashboard /></RequireJoined>} />
              <Route path="/network" element={<RequireJoined><Network /></RequireJoined>} />
              <Route path="/wallet" element={<RequireJoined><Wallet /></RequireJoined>} />
              <Route path="/withdrawals" element={<RequireJoined><Withdrawals /></RequireJoined>} />
              <Route path="/kyc" element={<KycPage />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/dashboard/businesses" element={<RequireJoined><Businesses /></RequireJoined>} />
              <Route path="/dashboard/businesses/:id" element={<RequireJoined><BusinessDetail /></RequireJoined>} />
              <Route path="/checkout/direct/:orderId" element={<DirectCheckout />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/referral" element={<RequireJoined><Referral /></RequireJoined>} />
              <Route path="/support" element={<Support />} />
            </Route>

            <Route element={<RequireAuth role={["sub_admin","super_admin"]}><AdminShell /></RequireAuth>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/leads" element={<AdminLeads />} />
              <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
              <Route path="/admin/kyc" element={<AdminKyc />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/broadcast" element={<AdminBroadcast />} />
              <Route path="/admin/sliders" element={<AdminSliders />} />
              <Route path="/admin/reels" element={<AdminReels />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/inventory" element={<AdminInventory />} />
              <Route path="/admin/accounts" element={<AdminAccounts />} />
              <Route path="/admin/brands" element={<AdminBrands />} />
              <Route path="/admin/testimonials" element={<AdminTestimonials />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/coupons" element={<AdminCoupons />} />
              <Route path="/admin/charges" element={<AdminCharges />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
