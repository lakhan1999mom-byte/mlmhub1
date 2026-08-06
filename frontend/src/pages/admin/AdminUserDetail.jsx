import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { ArrowLeft, Shield, Mail, Phone, User, Briefcase, ShoppingBag, Wallet, Users, Clock, Globe, Monitor, Smartphone, Tablet, Activity, TrendingUp } from "lucide-react";

/** Admin — Deep dive into a single user (profile, businesses, login history, activity). */
export default function AdminUserDetail() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loginHist, setLoginHist] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/users/${userId}`),
      api.get(`/admin/users/${userId}/login-history?limit=50`),
      api.get(`/admin/users/${userId}/activity?limit=100`),
    ]).then(([d, l, a]) => {
      setData(d.data); setLoginHist(l.data.items || []); setActivity(a.data.items || []);
    }).catch(() => toast.error("Failed to load user"))
    .finally(() => setLoading(false));
  }, [userId]);

  const toggleActive = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const { data: updated } = await api.put(`/admin/users/${userId}`, { is_active: !data.user.is_active });
      setData({ ...data, user: updated });
      toast.success(updated.is_active ? "Account activated" : "Account disabled");
    } catch { toast.error("Update failed"); } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-16 text-slate-400">Loading user…</div>;
  if (!data) return <div className="text-center py-16 text-slate-400">User not found.</div>;

  const u = data.user;
  const c = data.counters;

  return (
    <div className="space-y-6" data-testid="admin-user-detail-page">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100"><ArrowLeft className="w-4 h-4"/> Back to users</Link>

      {/* Hero */}
      <div className="rounded-3xl relative overflow-hidden p-6 md:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#84CC16] rounded-full mix-blend-overlay blur-3xl"/>
        </div>
        <div className="relative flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-slate-950 flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
            {(u.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase font-bold text-[#84CC16] tracking-widest flex items-center gap-1">
              <Shield className="w-3 h-3"/> {u.role} · Stage {u.current_stage || 1}
            </div>
            <div className="font-display font-black text-3xl mt-1 text-white truncate">{u.name}</div>
            <div className="text-xs text-slate-400 font-mono mt-1">{u.user_code} · @{u.username || "—"}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500"/> {u.phone || "—"}</span>
              <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500"/> {u.email || "—"}</span>
              <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500"/> Sponsor: {u.sponsor_id || "—"}</span>
              <span className="inline-flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-slate-500"/> Ref: <b className="text-[#84CC16] font-mono">{u.referral_code || "—"}</b></span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <span className={`badge-pill text-xs ${u.is_joining_paid ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-amber-950/60 text-amber-300 border border-amber-500/30"}`}>
              {u.is_joining_paid ? "Kit Paid" : "Kit Pending"}
            </span>
            <span className={`badge-pill text-xs ${u.is_active ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-rose-950/60 text-rose-300 border border-rose-500/30"}`}>
              {u.is_active ? "Active" : "Disabled"}
            </span>
            <button onClick={toggleActive} disabled={saving} className="btn-outline text-xs" data-testid="admin-toggle-user-active">
              {u.is_active ? "Disable" : "Activate"}
            </button>
          </div>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Orders" value={c.orders_total} sub={`${c.orders_paid} paid`} icon={<ShoppingBag className="w-4 h-4"/>}/>
        <MiniStat label="Direct Refs" value={c.direct_referrals} icon={<Users className="w-4 h-4"/>}/>
        <MiniStat label="Businesses" value={c.additional_businesses + 1} sub="incl. primary" icon={<Briefcase className="w-4 h-4"/>}/>
        <MiniStat label="Withdrawals" value={c.withdrawals_total} icon={<Wallet className="w-4 h-4"/>}/>
        <MiniStat label="Wallet ₹" value={Number(u.wallet_balance || 0).toLocaleString("en-IN")} sub={`Earned ₹${Number(u.total_earnings || 0).toLocaleString("en-IN")}`} icon={<TrendingUp className="w-4 h-4"/>}/>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        {[
          { id: "overview", label: "Overview", icon: <Briefcase className="w-3.5 h-3.5"/> },
          { id: "logins", label: `Login History (${loginHist.length})`, icon: <Globe className="w-3.5 h-3.5"/> },
          { id: "activity", label: `Activity Log (${activity.length})`, icon: <Activity className="w-3.5 h-3.5"/> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${tab === t.id ? "border-[#84CC16] text-[#84CC16]" : "border-transparent text-slate-400 hover:text-slate-200"}`}
            data-testid={`admin-user-tab-${t.id}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="card-soft p-5" data-testid="admin-user-overview">
          <div className="font-display font-bold text-lg mb-3 text-slate-100">Referral Businesses ({data.referral_businesses.length})</div>
          {data.referral_businesses.length === 0 && <div className="text-center py-6 text-sm text-slate-500">No additional businesses.</div>}
          <div className="grid md:grid-cols-2 gap-3">
            {data.referral_businesses.map((b) => (
              <div key={b.id} className="rounded-2xl bg-slate-900/60 p-3 border border-slate-800" data-testid={`admin-user-biz-${b.business_code}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">{b.name}</div>
                  <span className={`badge-pill text-[10px] ${b.is_active ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-amber-950/60 text-amber-300 border border-amber-500/30"}`}>{b.is_active ? "Active" : "Pending"}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">{b.business_code} · Ref {b.referral_code} · Sponsor {b.sponsor_referral_code}</div>
                <div className="text-[10px] text-slate-500 mt-1">Created {new Date(b.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "logins" && (
        <div className="card-soft p-0 overflow-hidden" data-testid="admin-user-login-history">
          {loginHist.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No login history yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-[10px] uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Browser · OS</th>
                </tr>
              </thead>
              <tbody>
                {loginHist.map((l) => (
                  <tr key={l.id} className="border-t border-slate-800/70">
                    <td className="p-3 whitespace-nowrap text-slate-300 text-xs"><Clock className="inline w-3 h-3 mr-1 text-slate-500"/>{new Date(l.at).toLocaleString("en-IN")}</td>
                    <td className="p-3"><span className="badge-pill text-[10px] bg-slate-800 text-slate-300 border border-slate-700">{l.method || "—"}</span></td>
                    <td className="p-3 font-mono text-xs text-slate-300">{l.ip || "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                        <DeviceIcon kind={l.device?.kind}/> {l.device?.kind || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-400">{l.device?.browser} · {l.device?.os}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="card-soft p-0 overflow-hidden" data-testid="admin-user-activity-log">
          {activity.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-[10px] uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((l) => (
                  <tr key={l.id} className="border-t border-slate-800/70">
                    <td className="p-3 whitespace-nowrap text-slate-300 text-xs">{new Date(l.created_at).toLocaleString("en-IN")}</td>
                    <td className="p-3"><span className="badge-pill text-[10px] bg-slate-800 text-[#84CC16] border border-slate-700">{l.event}</span></td>
                    <td className="p-3 text-xs text-slate-300 font-mono">{l.target_label || l.target_id || "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-400">{l.ip || "—"}</td>
                    <td className="p-3 text-[11px] text-slate-500 max-w-[280px] truncate">{l.metadata && Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, icon }) {
  return (
    <div className="card-soft p-3">
      <div className="w-8 h-8 rounded-xl bg-slate-800 text-[#84CC16] flex items-center justify-center">{icon}</div>
      <div className="font-numbers font-black text-2xl text-slate-100 mt-2">{value}</div>
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{label}</div>
      {sub && <div className="text-[9px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function DeviceIcon({ kind }) {
  if (kind === "Mobile") return <Smartphone className="w-3.5 h-3.5 text-[#84CC16]"/>;
  if (kind === "Tablet") return <Tablet className="w-3.5 h-3.5 text-[#84CC16]"/>;
  return <Monitor className="w-3.5 h-3.5 text-[#84CC16]"/>;
}
