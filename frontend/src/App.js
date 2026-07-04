import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import "@/App.css";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppFab from "@/components/WhatsAppFab";

// pages
import Landing from "@/pages/Landing";
import About from "@/pages/About";
import BusinessPlan from "@/pages/BusinessPlan";
import CompensationPlan from "@/pages/CompensationPlan";
import Calculator from "@/pages/Calculator";
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
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";

import UserShell from "@/components/UserShell";
import Dashboard from "@/pages/user/Dashboard";
import Network from "@/pages/user/Network";
import Wallet from "@/pages/user/Wallet";
import Withdrawals from "@/pages/user/Withdrawals";
import KycPage from "@/pages/user/KycPage";
import Orders from "@/pages/user/Orders";
import Profile from "@/pages/user/Profile";
import NotificationsPage from "@/pages/user/NotificationsPage";
import Referral from "@/pages/user/Referral";
import Support from "@/pages/user/Support";

import AdminShell from "@/components/AdminShell";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
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

function PublicLayout() {
  const [site, setSite] = useState(null);
  useEffect(() => {
    api.get("/site/settings").then(({ data }) => setSite(data)).catch(() => {});
  }, []);
  return (
    <>
      <Navbar siteSettings={site} />
      <Outlet context={{ site }} />
      <Footer site={site} />
      <WhatsAppFab phone={site?.whatsapp} />
    </>
  );
}

function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-10 text-center text-[#064E3B]">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && !role.includes(user.role)) return <Navigate to="/" replace />;
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
              <Route path="/business-plan" element={<BusinessPlan />} />
              <Route path="/compensation-plan" element={<CompensationPlan />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/hampers" element={<HampersPage />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogDetail />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/career" element={<Career />} />
              <Route path="/legal/:type" element={<LegalPage />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<RequireAuth role={["user","sub_admin","super_admin"]}><Checkout /></RequireAuth>} />
            </Route>

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<RequireAuth role={["user","sub_admin","super_admin"]}><UserShell /></RequireAuth>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/network" element={<Network />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/withdrawals" element={<Withdrawals />} />
              <Route path="/kyc" element={<KycPage />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/support" element={<Support />} />
            </Route>

            <Route element={<RequireAuth role={["sub_admin","super_admin"]}><AdminShell /></RequireAuth>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
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
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
