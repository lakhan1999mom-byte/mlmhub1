import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Wallet as WalletIcon, Send, FileCheck, Package, User, Bell, Share2, LifeBuoy, LogOut, ShoppingBag, TrendingUp } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_9e593e72-d371-4332-879b-9b25914b11c9/artifacts/xiy5qq2i_ChatGPT_Image_Jun_18__2026__06_43_19_PM-removebg-preview.png";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/network", icon: Users, label: "My Referrals" },
  { to: "/referral", icon: Share2, label: "Invite & Earn" },
  { to: "/wallet", icon: WalletIcon, label: "Rewards Wallet" },
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
          <img src={LOGO} alt="EverGro" className="h-12 w-auto"/>
          <div>
            <div className="font-display font-bold text-[#7F1D1D] text-sm leading-tight">EverGro</div>
            <div className="text-[10px] uppercase tracking-widest text-[#B91C1C]">Member Panel</div>
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
                  isActive ? "bg-[#DC2626] text-[#7F1D1D]" : "text-[#334155] hover:bg-[#FEE2E2] hover:text-[#7F1D1D]"
                }`
              }
            >
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#E2E8F0] pt-4">
          <div className="px-3 mb-3">
            <div className="font-display font-semibold text-sm text-[#7F1D1D]">{user?.name}</div>
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
            <div className="bg-[#7F1D1D] rounded-lg p-1">
              <img src={LOGO} alt="EverGro" className="h-6 w-auto" />
            </div>
            <div className="font-display font-bold text-[#7F1D1D]">EverGro</div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }} className="text-[#EF4444]"><LogOut className="w-5 h-5"/></button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to}
              className={({isActive}) => `flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition ${isActive ? "bg-[#DC2626] text-[#7F1D1D]" : "bg-[#F1F5F9] text-[#334155]"}`}>
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="lg:ml-64 p-6 lg:p-10 max-w-6xl">
        <Outlet />
      </main>

      {/* Live earnings ticker + branding footer (only shown once logged in) */}
      <UserFooter/>
    </div>
  );
}

const TICKER_NAMES = [
  "Ritu Sharma", "Karan Mehta", "Anjali Verma", "Vikas Patel", "Neha Rao",
  "Rohit Singh", "Meera Iyer", "Amit Kumar", "Priya Desai", "Suresh Menon",
  "Kavita Rao", "Deepak Iyer", "Naveen Krishna", "Divya Prasad", "Rajesh Kumar",
];

function TickerLine() {
  const name = TICKER_NAMES[Math.floor(Math.random() * TICKER_NAMES.length)];
  const amount = (Math.floor(Math.random() * 45) + 5) / 10; // 0.5 – 5.0
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#7F1D1D]" data-testid="user-ticker-line">
      <TrendingUp className="w-4 h-4 text-[#DC2626]"/>
      <b>{name}</b> just earned <span className="font-numbers font-bold text-[#DC2626]">₹{amount.toFixed(1)} lakh</span> via EverGro
    </span>
  );
}

function UserFooter() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    // Rotate the ticker every 10 minutes as requested.
    const t = setInterval(() => setKey((k) => k + 1), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="lg:ml-64 border-t border-[#FEE2E2] bg-white mt-10" data-testid="user-dashboard-footer">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-4 flex flex-wrap items-center justify-between gap-3">
        <div key={key} className="animate-fadein"><TickerLine/></div>
        <div className="text-xs text-[#94A3B8]">
          EverGro eMart is controlled by <b className="text-[#7F1D1D]">PK and Son LLP</b>
        </div>
      </div>
    </footer>
  );
}
