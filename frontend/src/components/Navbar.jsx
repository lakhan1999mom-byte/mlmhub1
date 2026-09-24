import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Bell, Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import api from "@/lib/api";

export default function Navbar({ siteSettings }) {
  const { user, logout } = useAuth();
  const { cart } = useCart() || {};
  const [mobile, setMobile] = useState(false);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api.get("/notifications").then(({ data }) => setUnread(data.filter((n) => !n.read).length)).catch(() => {});
  }, [user]);

  const items = [
    { to: "/", label: "Home" },
    { to: "/products", label: "Shop" },
    { to: "/hampers", label: "Hampers" },
    { to: "/sales-agent", label: "Sales Agent" },
    { to: "/blog", label: "Blog" },
    { to: "/about", label: "About" },
  ];

  return (
    <>
      {siteSettings?.notification_bar_enabled && siteSettings?.notification_bar_text && (
        <div className="bg-[#7F1D1D] text-white text-sm py-2 px-4 text-center" data-testid="notification-bar">
          {siteSettings.notification_bar_text}
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#FEE2E2]" data-testid="navbar">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 flex items-center justify-between h-20">
          <Link to="/" className="flex items-center" data-testid="navbar-logo-link">
            <div className="flex flex-col leading-none">
              <span className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#7F1D1D]" data-testid="navbar-brand-name">
                EverGro <span className="text-[#DC2626]">eMart</span>
              </span>
              <span className="hidden sm:block text-[10px] tracking-[0.2em] text-[#DC2626] uppercase font-semibold mt-1">
                Premium Products · Home Delivered
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                data-testid={`nav-link-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="px-4 py-2 rounded-full text-sm font-medium text-[#334155] hover:bg-[#FEE2E2] hover:text-[#7F1D1D] transition-all"
              >
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <>
                <button
                  onClick={() => navigate("/notifications")}
                  className="relative p-2 rounded-full hover:bg-[#FEE2E2] transition-colors"
                  data-testid="navbar-notification-btn"
                >
                  <Bell className="w-5 h-5 text-[#7F1D1D]" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => navigate("/cart")}
                  className="relative p-2 rounded-full hover:bg-[#FEE2E2] transition-colors"
                  data-testid="navbar-cart-btn"
                >
                  <ShoppingCart className="w-5 h-5 text-[#7F1D1D]" />
                  {cart?.items?.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                      {cart.items.length}
                    </span>
                  )}
                </button>
              </>
            )}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link to={user.role === "user" ? "/dashboard" : "/admin"} className="btn-primary" data-testid="navbar-dashboard-link">
                  <User className="w-4 h-4" /> My Account
                </Link>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login" className="btn-outline" data-testid="navbar-login-link">Login</Link>
                <Link to="/register" className="btn-primary" data-testid="navbar-register-link">Sign Up</Link>
              </div>
            )}
            <button className="lg:hidden p-2" onClick={() => setMobile(!mobile)} data-testid="mobile-menu-btn">
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobile && (
          <div className="lg:hidden bg-white border-t border-[#FEE2E2] px-4 py-4 space-y-1">
            {items.map((it) => (
              <Link key={it.to} to={it.to} onClick={() => setMobile(false)}
                    className="block px-4 py-3 rounded-xl text-[#334155] hover:bg-[#FEE2E2]"
                    data-testid={`mobile-nav-${it.label.toLowerCase()}`}>
                {it.label}
              </Link>
            ))}
            {!user && (
              <div className="flex gap-2 pt-3">
                <Link to="/login" className="btn-outline flex-1 justify-center" onClick={() => setMobile(false)}>Login</Link>
                <Link to="/register" className="btn-primary flex-1 justify-center" onClick={() => setMobile(false)}>Sign Up</Link>
              </div>
            )}
            {user && (
              <div className="pt-3 flex flex-col gap-2">
                <Link to={user.role === "user" ? "/dashboard" : "/admin"} className="btn-primary justify-center" onClick={() => setMobile(false)}>My Account</Link>
                <button className="btn-outline justify-center" onClick={() => { logout(); setMobile(false); navigate("/"); }}>
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
