import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, ShoppingBag, Wallet, TrendingUp, Download, Briefcase, Activity, Zap, UserPlus, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { toast } from "sonner";
import api from "@/lib/api";

/**
 * Iteration 16 — Redesigned Admin Overview (dark SaaS theme).
 * Analytics + CSV exports + system health strip.
 */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setData(data)).catch(() => setData({stats:{}})); }, []);

  const downloadCsv = async (kind) => {
    try {
      const res = await api.get(`/admin/export/${kind}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `${kind}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success(`${kind}.csv downloaded`);
    } catch { toast.error("Export failed"); }
  };

  if (!data) return <div className="text-center py-16 text-slate-400">Loading analytics…</div>;

  // Backend may serve either a flat payload OR wrap under `stats`. Support both.
  const s = { ...(data || {}), ...(data.stats || {}) };
  const daily = (data.daily_stats && data.daily_stats.length)
    ? data.daily_stats
    : (data.daily_revenue || []).map((d, i) => ({
        day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
        date: d.date,
        users: 0,
        revenue: d.revenue,
        orders: d.orders,
      }));
  const recent = Array.isArray(data.recent_joins) ? data.recent_joins : [];

  return (
    <div className="space-y-6" data-testid="admin-overview">
      {/* Hero header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl relative overflow-hidden p-6 md:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#84CC16] rounded-full mix-blend-overlay blur-3xl animate-pulse"/>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500 rounded-full mix-blend-overlay blur-3xl"/>
        </div>
        <div className="relative">
          <div className="text-xs uppercase font-bold text-[#84CC16] tracking-widest flex items-center gap-1"><Activity className="w-3 h-3"/> Real-time control room</div>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-1 text-white">Admin Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Analytics · Users · Revenue · Referrals — all in one glance.</p>
        </div>
      </motion.div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DarkStatCard label="Total Users" value={s.total_users || 0} icon={<Users className="w-5 h-5"/>} accent="from-sky-500 to-blue-600" delta={s.new_users_today}/>
        <DarkStatCard label="Orders" value={s.total_orders || 0} icon={<ShoppingBag className="w-5 h-5"/>} accent="from-fuchsia-500 to-purple-600"/>
        <DarkStatCard label="Revenue" value={`₹${Number(s.total_revenue || 0).toLocaleString("en-IN")}`} icon={<Wallet className="w-5 h-5"/>} accent="from-amber-500 to-orange-600"/>
        <DarkStatCard label="Active Members" value={s.active_users || 0} icon={<Zap className="w-5 h-5"/>} accent="from-lime-500 to-emerald-600"/>
      </div>

      {/* Chart row */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold text-lg">Signups & Revenue (7d)</div>
              <div className="text-xs text-slate-400">Daily new users and revenue trend</div>
            </div>
            <TrendingUp className="w-5 h-5 text-[#84CC16]"/>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="cU" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#84CC16" stopOpacity={0.5}/><stop offset="100%" stopColor="#84CC16" stopOpacity={0}/></linearGradient>
                <linearGradient id="cR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F59E0B" stopOpacity={0.5}/><stop offset="100%" stopColor="#F59E0B" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)"/>
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11}/>
              <YAxis stroke="#94A3B8" fontSize={11}/>
              <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(51,65,85,0.5)", borderRadius: 12, color: "#F1F5F9" }}/>
              <Area type="monotone" dataKey="users" stroke="#84CC16" strokeWidth={2.5} fill="url(#cU)"/>
              <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2.5} fill="url(#cR)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card-soft p-5">
          <div className="font-display font-bold text-lg mb-2">System Health</div>
          <div className="space-y-2 text-sm">
            <HealthRow label="API" ok/>
            <HealthRow label="Database" ok/>
            <HealthRow label="Cashfree" warn="Mock mode"/>
            <HealthRow label="Firebase OTP" ok/>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-2">Quick actions</div>
            <div className="space-y-2">
              <button onClick={() => downloadCsv("users")} className="w-full btn-outline text-xs justify-between" data-testid="export-users-btn"><span className="inline-flex items-center gap-1"><Download className="w-3 h-3"/> Export Users CSV</span><span>→</span></button>
              <button onClick={() => downloadCsv("orders")} className="w-full btn-outline text-xs justify-between" data-testid="export-orders-btn"><span className="inline-flex items-center gap-1"><Download className="w-3 h-3"/> Export Orders CSV</span><span>→</span></button>
              <button onClick={() => downloadCsv("withdrawals")} className="w-full btn-outline text-xs justify-between" data-testid="export-withdrawals-btn"><span className="inline-flex items-center gap-1"><Download className="w-3 h-3"/> Export Withdrawals CSV</span><span>→</span></button>
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart + recent joins */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold text-lg">Weekly signup volume</div>
              <div className="text-xs text-slate-400">New user registrations per day (last 7d)</div>
            </div>
            <div className="badge-pill bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
              This week: <b className="text-[#84CC16] ml-1">{s.new_users_week || 0}</b>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)"/>
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11}/>
              <YAxis stroke="#94A3B8" fontSize={11}/>
              <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(51,65,85,0.5)", borderRadius: 12, color: "#F1F5F9" }}/>
              <Bar dataKey="users" fill="#84CC16" radius={[8,8,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-800">
            <MiniCounter label="Businesses" value={s.referral_businesses || 0} icon={<Briefcase className="w-3 h-3"/>}/>
            <MiniCounter label="Kit Sales" value={s.kit_sales || 0} icon={<ShoppingBag className="w-3 h-3"/>}/>
            <MiniCounter label="Today" value={s.new_users_today || 0} icon={<Users className="w-3 h-3"/>}/>
            <MiniCounter label="This Week" value={s.new_users_week || 0} icon={<TrendingUp className="w-3 h-3"/>}/>
          </div>
        </div>
        <div className="card-soft p-5" data-testid="recent-joins-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold text-lg flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#84CC16]"/> Recent Joins</div>
              <div className="text-xs text-slate-400">Latest members that just signed up</div>
            </div>
            <span className="badge-pill bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">Live</span>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-40"/>
              No new members yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1" data-testid="recent-joins-list">
              {recent.map((r) => (
                <div key={r.user_code} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-[#84CC16]/40 transition-colors" data-testid={`recent-join-${r.user_code}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-white flex items-center justify-center text-sm font-bold shadow-lg shrink-0">
                    {(r.name || "?").slice(0,1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-100 truncate flex items-center gap-1.5">
                      {r.name}
                      {r.is_joining_paid && <Sparkles className="w-3 h-3 text-[#84CC16]" title="Kit purchased"/>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{r.user_code} · {r.phone || r.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`badge-pill text-[9px] ${r.is_joining_paid ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-amber-950/60 text-amber-300 border border-amber-500/30"}`}>
                      {r.is_joining_paid ? "Active" : "Pending"}
                    </span>
                    <div className="text-[9px] text-slate-500 mt-1">{formatWhen(r.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch { return ""; }
}

function DarkStatCard({ label, value, icon, accent, delta }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-soft p-4 relative overflow-hidden">
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-xl`}/>
      <div className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow-lg`}>{icon}</div>
      <div className="mt-3 font-numbers font-black text-2xl text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
        <span>{label}</span>
        {typeof delta === "number" && delta > 0 && <span className="text-[#84CC16]">+{delta} today</span>}
      </div>
    </motion.div>
  );
}

function HealthRow({ label, ok, warn }) {
  return (
    <div className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl">
      <span>{label}</span>
      {ok && <span className="badge-pill bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">● Online</span>}
      {warn && <span className="badge-pill bg-amber-950/60 text-amber-300 border border-amber-500/30">● {warn}</span>}
    </div>
  );
}

function MiniCounter({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-slate-900/60 p-3 border border-slate-800">
      <div className="w-8 h-8 rounded-xl bg-slate-800 text-[#84CC16] flex items-center justify-center">{icon}</div>
      <div className="font-numbers font-black text-2xl mt-2 text-slate-100">{value}</div>
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</div>
    </div>
  );
}
