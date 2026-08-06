import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Users, Package, ShoppingBag, Send, FileCheck, MessageSquare, Settings, Megaphone, LogOut, Images, Film, ScrollText, Warehouse, Calculator, Award, MessageCircle, FolderTree, TicketPercent, Wallet } from "lucide-react";

const items = [
  { to: "/admin", icon: LayoutDashboard, label: "Overview", perm: "*" },
  { to: "/admin/accounts", icon: Calculator, label: "Accounts", perm: "*" },
  { to: "/admin/users", icon: Users, label: "Users", perm: "users" },
  { to: "/admin/products", icon: Package, label: "Products", perm: "products" },
  { to: "/admin/categories", icon: FolderTree, label: "Categories", perm: "products" },
  { to: "/admin/inventory", icon: Warehouse, label: "Inventory", perm: "products" },
  { to: "/admin/orders", icon: ShoppingBag, label: "Orders", perm: "orders" },
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
  const isSuper = user?.role === "super_admin";
  const perms = user?.permissions || [];
  const visible = items.filter(it => isSuper || it.perm === "*" || perms.includes(it.perm) || perms.includes("*"));

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 w-64 h-screen bg-[#064E3B] text-white p-6 overflow-y-auto" data-testid="admin-sidebar">
        <div className="mb-8">
          <div className="font-display font-black text-2xl leading-tight">
            EverGro <span className="text-[#84CC16]">eMart</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[#84CC16] mt-1">{isSuper ? "Super Admin" : "Sub Admin"}</div>
        </div>
        <nav className="space-y-1 flex-1">
          {visible.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/admin"}
              data-testid={`admin-nav-${it.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-[#84CC16] text-[#064E3B]" : "text-white/80 hover:bg-white/10"
                }`
              }
            >
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4">
          <div className="px-3 mb-3">
            <div className="font-display font-semibold text-sm">{user?.name}</div>
            <div className="text-xs text-white/60 font-numbers">{user?.user_code}</div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#FBBF24] hover:bg-white/10" data-testid="admin-logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="lg:hidden bg-[#064E3B] text-white px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-black text-lg">
            EverGro <span className="text-[#84CC16]">eMart</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest text-[#84CC16]">{isSuper ? "Super" : "Sub"}</span>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="text-[#FBBF24]"><LogOut className="w-5 h-5"/></button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {visible.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === "/admin"}
              className={({isActive}) => `flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition ${isActive ? "bg-[#84CC16] text-[#064E3B]" : "bg-white/10 text-white"}`}>
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="lg:ml-64 p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}
