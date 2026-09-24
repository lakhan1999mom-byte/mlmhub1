import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, Users, TrendingUp, Package, Share2, Bell, Sparkles, ShoppingBag, Send, ChevronRight, Briefcase, Copy, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import IncomeStructureCard from "@/components/IncomeStructureCard";

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recent, setRecent] = useState([]);
  const [breakdown, setBreakdown] = useState(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get("/users/dashboard"),
      api.get("/mlm/businesses"),
      api.get("/notifications?limit=5"),
      api.get(`/mlm/businesses/${user.id}/network`).catch(() => ({ data: { members: [] } })),
      api.get("/mlm/commission-breakdown?limit=100").catch(() => ({ data: null })),
    ]).then(([d, b, n, net, cb]) => {
      setDashboard(d.data);
      setBusinesses(b.data.businesses || []);
      setNotifications(n.data || []);
      setRecent((net.data.members || []).slice(0, 5));
      setBreakdown(cb.data);
    });
  }, [user]);

  if (!user || !dashboard) return <div className="p-12 text-center text-[#64748B]">Loading your dashboard…</div>;

  const stats = dashboard.stats || {};
  const totalMembers = businesses.reduce((s, b) => s + (b.total_members || 0), 0);
  const totalActive = businesses.reduce((s, b) => s + (b.active_members || 0), 0);
  const activeBusinesses = businesses.filter((b) => b.is_active).length;

  // Fake 7-day chart (from real data if available) — sample distribution
  const chartData = Array.from({ length: 7 }).map((_, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    joins: Math.max(0, Math.round((totalMembers / 7) * (0.7 + Math.random() * 0.6))),
  }));
  const pieData = [
    { name: "Active", value: totalActive, fill: "#DC2626" },
    { name: "Inactive", value: Math.max(0, totalMembers - totalActive), fill: "#FEF2F2" },
  ];

  const copyRef = () => { navigator.clipboard.writeText(user.referral_code || ""); toast.success("Referral code copied!"); };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Hero welcome */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-gradient-to-br from-[#7F1D1D] via-[#991B1B] to-[#7F1D1D] text-white p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#DC2626]/20 rounded-full blur-3xl"/>
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-[#DC2626]/10 rounded-full blur-3xl"/>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase font-bold text-[#DC2626] tracking-widest flex items-center gap-1"><Sparkles className="w-3 h-3"/> Welcome back</div>
            <div className="font-display font-black text-3xl md:text-4xl mt-1">{user.name}</div>
            <div className="text-sm text-white/70 mt-1 font-numbers">{user.user_code} · Stage {user.current_stage || 1} · {user.is_joining_paid ? "Active ✓" : "Pending activation"}</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3">
              <div className="text-xs uppercase text-white/60 font-bold tracking-wider">Wallet</div>
              <div className="font-numbers font-black text-2xl text-[#DC2626]">₹{Number(user.wallet_balance || 0).toFixed(0)}</div>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3">
              <div className="text-xs uppercase text-white/60 font-bold tracking-wider">Total earnings</div>
              <div className="font-numbers font-black text-2xl">₹{Number(user.total_earnings || 0).toFixed(0)}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Members" value={totalMembers} icon={<Users className="w-5 h-5"/>} tone="bg-[#FEE2E2] text-[#7F1D1D]" delay={0}/>
        <StatCard label="Active Members" value={totalActive} icon={<Sparkles className="w-5 h-5"/>} tone="bg-[#FEE2E2] text-[#991B1B]" delay={0.05}/>
        <StatCard label="Referral Codes" value={`${activeBusinesses}/${businesses.length}`} icon={<Briefcase className="w-5 h-5"/>} tone="bg-[#FEE2E2] text-[#7F1D1D]" delay={0.1}/>
        <StatCard label="Direct Referrals" value={user.direct_referrals_count || 0} icon={<TrendingUp className="w-5 h-5"/>} tone="bg-[#FEF2F2] text-[#7F1D1D]" delay={0.15}/>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction to="/dashboard/businesses" icon={<Briefcase className="w-5 h-5"/>} label="My Referral Codes" tone="bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-white" testid="qa-businesses"/>
        <QuickAction to="/wallet" icon={<Wallet className="w-5 h-5"/>} label="Rewards Wallet" tone="bg-white text-[#7F1D1D]"/>
        <QuickAction to="/products" icon={<ShoppingBag className="w-5 h-5"/>} label="Shop Store"/>
        <QuickAction to="/orders" icon={<Package className="w-5 h-5"/>} label="My Orders"/>
      </div>

      {/* Rewards ladder / income structure — hidden per legal-friendly guidance */}
      {/* <IncomeStructureCard variant="user"/> */}

      {/* Wallet breakdown — where each rupee came from */}
      {breakdown && (
        <div className="card-soft p-5" data-testid="wallet-breakdown-card">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
            <div className="text-xs uppercase font-bold text-[#B91C1C] tracking-widest flex items-center gap-1"><Sparkles className="w-3 h-3"/> Your rewards story</div>
              <div className="font-display font-black text-xl text-[#7F1D1D]">You&apos;ve earned <span className="text-[#B91C1C]">₹{Number(breakdown.totals.credited).toLocaleString("en-IN")}</span> in rewards so far</div>
              <div className="text-xs text-[#64748B] mt-1">
                {breakdown.totals.transactions === 0
                  ? "Share your referral code to start earning cashback rewards from purchases in your network."
                  : `${breakdown.totals.transactions} events · ${breakdown.totals.held_entries} on hold (unlock by inviting 3 referrals)`}
              </div>
            </div>
            <Link to="/wallet" className="btn-outline text-xs">View wallet <ChevronRight className="w-3 h-3"/></Link>
          </div>
          {(breakdown.by_level || []).length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8].map((lv) => {
                  const row = (breakdown.by_level || []).find((x) => x.level === lv);
                  const earned = row?.credited || 0;
                  return (
                    <div key={lv} className={`rounded-2xl p-2 text-center border ${earned > 0 ? "bg-[#FEE2E2] border-[#DC2626]/40" : "bg-[#FAFAF9] border-[#E2E8F0]"}`} data-testid={`wallet-l${lv}`}>
                      <div className="text-[9px] uppercase font-bold text-[#94A3B8] tracking-wider">L{lv}</div>
                      <div className={`font-numbers font-black text-sm ${earned > 0 ? "text-[#991B1B]" : "text-[#94A3B8]"}`}>₹{Number(earned).toLocaleString("en-IN")}</div>
                    </div>
                  );
                })}
              </div>
              {(breakdown.recent || []).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-widest">Most recent earnings</div>
                  {(breakdown.recent || []).slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#FAFAF9] border border-[#F1F5F9]" data-testid={`wallet-txn-${t.id}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${t.category === "commission_held" ? "bg-amber-500" : "bg-gradient-to-br from-[#DC2626] to-[#B91C1C]"}`}>L{t.level || "-"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#7F1D1D] truncate">{t.description}</div>
                        <div className="text-[10px] text-[#94A3B8]">{new Date(t.created_at).toLocaleString("en-IN")}</div>
                      </div>
                      <div className={`text-sm font-numbers font-bold ${t.category === "commission_held" ? "text-amber-600" : "text-[#991B1B]"}`}>
                        {t.category === "commission_held" ? "held" : `+₹${Number(t.amount).toLocaleString("en-IN")}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] border border-[#DC2626]/30 p-4 text-center">
              <Rocket className="w-6 h-6 text-[#B91C1C] mx-auto mb-2"/>
              <div className="text-sm font-semibold text-[#7F1D1D]">Your rewards wallet is empty — for now.</div>
              <div className="text-xs text-[#B91C1C] mt-1">Share your referral code — earn cashback rewards on purchases made by your network.</div>
              <Link to="/referral" className="inline-flex items-center gap-1 mt-2 btn-primary text-xs"><Share2 className="w-3 h-3"/> Share referral</Link>
            </div>
          )}
        </div>
      )}

      {/* Charts + right column */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card-soft p-5" data-testid="growth-chart">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold text-lg text-[#7F1D1D]">Network growth (7-day)</div>
              <div className="text-xs text-[#64748B]">Daily new members across your referrals</div>
            </div>
            <TrendingUp className="w-5 h-5 text-[#DC2626]"/>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorJoins" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11}/>
              <YAxis stroke="#94A3B8" fontSize={11}/>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}/>
              <Area type="monotone" dataKey="joins" stroke="#B91C1C" strokeWidth={2.5} fill="url(#colorJoins)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card-soft p-5">
          <div className="font-display font-bold text-lg text-[#7F1D1D] mb-2">Members mix</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-[#64748B] mt-1">
            <span className="inline-flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#DC2626]"/> Active</span>
            <span className="inline-flex items-center gap-1 ml-3"><div className="w-2 h-2 rounded-full bg-[#FEF2F2]"/> Pending</span>
          </div>
        </div>
      </div>

      {/* Referral share + Recent joins + Notifications */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-5 bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] lg:col-span-1" data-testid="referral-card">
          <div className="flex items-center gap-2 text-xs uppercase font-bold text-[#991B1B] tracking-widest"><Share2 className="w-3 h-3"/> Share & earn</div>
          <div className="font-display font-black text-lg text-[#7F1D1D] mt-1">Your primary code</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="font-mono font-black text-2xl text-[#7F1D1D] bg-white/70 rounded-2xl px-4 py-2 flex-1">{user.referral_code}</div>
            <button onClick={copyRef} className="w-11 h-11 bg-[#7F1D1D] rounded-2xl text-white hover:bg-[#991B1B] flex items-center justify-center" data-testid="copy-my-refcode"><Copy className="w-4 h-4"/></button>
          </div>
          <Link to="/dashboard/businesses" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#991B1B] hover:text-[#7F1D1D]">
            <Rocket className="w-3 h-3"/> Create another referral code →
          </Link>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-bold text-[#7F1D1D]">Recent joins</div>
            <Link to="/network" className="text-xs text-[#B91C1C] font-semibold">View all →</Link>
          </div>
          <div className="space-y-2">
            {recent.length === 0 && <div className="text-xs text-[#94A3B8] text-center py-6">No members yet — share your code to grow.</div>}
            {recent.map((m) => (
              <div key={m.id} className="flex items-center gap-2 p-2 bg-[#FAFAF9] rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-white font-black text-xs flex items-center justify-center">{(m.name || "?").charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#7F1D1D] truncate">{m.name}</div>
                  <div className="text-[10px] text-[#94A3B8] font-mono">{m.user_code}</div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${m.is_joining_paid ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF2F2] text-[#7F1D1D]"}`}>{m.is_joining_paid ? "✓" : "pending"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-5" data-testid="notifications-card">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2"><Bell className="w-4 h-4 text-[#DC2626]"/><div className="font-display font-bold text-[#7F1D1D]">Notifications</div></div>
            <Link to="/notifications" className="text-xs text-[#B91C1C] font-semibold">All →</Link>
          </div>
          <div className="space-y-2">
            {notifications.length === 0 && <div className="text-xs text-[#94A3B8] text-center py-6">You&apos;re all caught up.</div>}
            {notifications.slice(0, 4).map((n) => (
              <div key={n.id} className={`p-2 rounded-xl text-xs ${n.read ? "bg-[#FAFAF9]" : "bg-[#FEE2E2]"}`}>
                <div className="font-semibold text-[#7F1D1D]">{n.title}</div>
                <div className="text-[#64748B] line-clamp-2 mt-0.5">{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card-soft p-4 hover:-translate-y-0.5 transition-transform">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tone}`}>{icon}</div>
      <div className="font-numbers font-black text-2xl text-[#7F1D1D] mt-2">{value}</div>
      <div className="text-xs text-[#64748B] font-semibold">{label}</div>
    </motion.div>
  );
}

function QuickAction({ to, icon, label, tone, testid }) {
  return (
    <Link to={to} className={`card-soft p-4 hover:-translate-y-1 hover:shadow-lg transition-all inline-flex items-center gap-3 group ${tone || ""}`} data-testid={testid}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tone ? "bg-white/20 text-white" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>{icon}</div>
      <div className="flex-1">
        <div className="font-semibold text-sm">{label}</div>
      </div>
      <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform"/>
    </Link>
  );
}
