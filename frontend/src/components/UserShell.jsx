import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Users, Wallet as WalletIcon, Send, FileCheck, Package, User, Bell, Share2, LifeBuoy, LogOut, ShoppingBag } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_9e593e72-d371-4332-879b-9b25914b11c9/artifacts/xiy5qq2i_ChatGPT_Image_Jun_18__2026__06_43_19_PM-removebg-preview.png";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/network", icon: Users, label: "Network" },
  { to: "/referral", icon: Share2, label: "Referral" },
  { to: "/wallet", icon: WalletIcon, label: "Wallet" },
  { to: "/withdrawals", icon: Send, label: "Withdraw" },
  { to: "/orders", icon: ShoppingBag, label: "Orders" },
  { to: "/kyc", icon: FileCheck, label: "KYC" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/support", icon: LifeBuoy, label: "Support" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function UserShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 w-64 h-screen bg-white border-r border-[#E2E8F0] p-6" data-testid="user-sidebar">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-[#064E3B] rounded-xl p-1.5">
            <img src={LOGO} alt="EverGro" className="h-8 w-auto" />
          </div>
          <div>
            <div className="font-display font-bold text-[#064E3B] text-sm leading-tight">EverGro</div>
            <div className="text-[10px] uppercase tracking-widest text-[#65A30D]">Member Panel</div>
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={`sidebar-${it.label.toLowerCase()}-link`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-[#84CC16] text-[#064E3B]" : "text-[#334155] hover:bg-[#ECFCCB] hover:text-[#064E3B]"
                }`
              }
            >
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#E2E8F0] pt-4">
          <div className="px-3 mb-3">
            <div className="font-display font-semibold text-sm text-[#064E3B]">{user?.name}</div>
            <div className="text-xs text-[#64748B] font-numbers">{user?.user_code}</div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#EF4444] hover:bg-red-50" data-testid="sidebar-logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar with horizontal scroll */}
      <div className="lg:hidden bg-white border-b border-[#E2E8F0] px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-[#064E3B] rounded-lg p-1">
              <img src={LOGO} alt="EverGro" className="h-6 w-auto" />
            </div>
            <div className="font-display font-bold text-[#064E3B]">EverGro</div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="text-[#EF4444]"><LogOut className="w-5 h-5"/></button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to}
              className={({isActive}) => `flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition ${isActive ? "bg-[#84CC16] text-[#064E3B]" : "bg-[#F1F5F9] text-[#334155]"}`}>
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="lg:ml-64 p-6 lg:p-10 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
