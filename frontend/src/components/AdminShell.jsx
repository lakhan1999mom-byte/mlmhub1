import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Package, ShoppingBag, Send, FileCheck, MessageSquare, Settings, Megaphone, LogOut, Images, Film, ScrollText, Warehouse, Calculator, Award, MessageCircle, FolderTree, TicketPercent, Wallet, Search, Command, FileText } from "lucide-react";
import AdminSearchPalette from "@/components/AdminSearchPalette";

const items = [
  { to: "/admin", icon: LayoutDashboard, label: "Overview", perm: "*" },
  { to: "/admin/accounts", icon: Calculator, label: "Accounts", perm: "*" },
  { to: "/admin/users", icon: Users, label: "Users", perm: "users" },
  { to: "/admin/products", icon: Package, label: "Products", perm: "products" },
  { to: "/admin/categories", icon: FolderTree, label: "Categories", perm: "products" },
  { to: "/admin/inventory", icon: Warehouse, label: "Inventory", perm: "products" },
  { to: "/admin/orders", icon: ShoppingBag, label: "Orders", perm: "orders" },
  { to: "/admin/leads", icon: Users, label: "Agent Leads", perm: "*" },
  { to: "/admin/blogs", icon: FileText, label: "Blog Posts", perm: "*" },
  { to: "/admin/coupons", icon: TicketPercent, label: "Promo Codes", perm: "*" },
  { to: "/admin/charges", icon: Wallet, label: "Charges (GST · Delivery)", perm: "*" },
  { to: "/admin/withdrawals", icon: Send, label: "Withdrawals", perm: "withdrawals" },
  { to: "/admin/kyc", icon: FileCheck, label: "KYC", perm: "kyc" },
  { to: "/admin/tickets", icon: MessageSquare, label: "Tickets", perm: "tickets" },
  { to: "/admin/broadcast", icon: Megaphone, label: "Broadcast", perm: "notifications" },
  { to: "/admin/sliders", icon: Images, label: "Sliders", perm: "*" },
  { to: "/admin/reels", icon: Film, label: "Reels", perm: "*" },
  { to: "/admin/brands", icon: Award, label: "Brand Logos", perm: "*" },
  { to: "/admin/testimonials", icon: MessageCircle, label: "Testimonials", perm: "*" },
  { to: "/admin/payments", icon: LayoutDashboard, label: "Payment Gateway", perm: "*" },
  { to: "/admin/audit-logs", icon: ScrollText, label: "Audit Logs", perm: "*" },
  { to: "/admin/settings", icon: Settings, label: "Settings", perm: "*" },
];

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isSuper = user?.role === "super_admin";
  const perms = user?.permissions || [];
  const visible = items.filter(it => isSuper || it.perm === "*" || perms.includes(it.perm) || perms.includes("*"));

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#FEF2F2] text-[#7F1D1D]" data-admin-theme="light-red">
      <AdminSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 w-64 h-screen bg-white border-r border-[#FECACA] p-6 overflow-y-auto" data-testid="admin-sidebar">
        <div className="mb-8">
          <div className="font-display font-black text-2xl leading-tight tracking-tight text-[#7F1D1D]">
            EverGro <span className="text-[#DC2626]">eMart</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[#DC2626] mt-1 inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse"/>{isSuper ? "Super Admin" : "Sub Admin"}</div>
        </div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-4 flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] hover:border-[#DC2626] text-[#B91C1C] hover:text-[#7F1D1D] text-xs transition-all"
          data-testid="admin-global-search-btn"
        >
          <Search className="w-3.5 h-3.5"/>
          <span className="flex-1 text-left">Search users, businesses…</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-white border border-[#FECACA] rounded px-1 py-0.5"><Command className="w-2.5 h-2.5"/>K</span>
        </button>
        <nav className="space-y-1 flex-1">
          {visible.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/admin"}
              data-testid={`admin-nav-${it.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-[#DC2626] text-white shadow-lg shadow-[#DC2626]/20" : "text-[#7F1D1D] hover:bg-[#FEE2E2]"
                }`
              }
            >
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#FECACA] pt-4">
          <div className="px-3 mb-3">
            <div className="font-display font-semibold text-sm text-[#7F1D1D]">{user?.name}</div>
            <div className="text-xs text-[#B91C1C] font-numbers">{user?.user_code}</div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#DC2626] hover:bg-[#FEE2E2]" data-testid="admin-logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="lg:hidden bg-white border-b border-[#FECACA] text-[#7F1D1D] px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-black text-lg">
            EverGro <span className="text-[#DC2626]">eMart</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest text-[#DC2626]">{isSuper ? "Super" : "Sub"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaletteOpen(true)} className="text-[#7F1D1D] hover:text-[#DC2626]" data-testid="admin-global-search-mobile-btn"><Search className="w-5 h-5"/></button>
            <button onClick={() => { logout(); navigate("/"); }} className="text-[#DC2626]"><LogOut className="w-5 h-5"/></button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {visible.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === "/admin"}
              className={({isActive}) => `flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition ${isActive ? "bg-[#DC2626] text-white" : "bg-[#FEE2E2] text-[#7F1D1D]"}`}>
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="lg:ml-64 p-6 lg:p-10 admin-dark-scope">
        <Outlet />
      </main>
    </div>
  );
}
