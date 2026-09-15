import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Shield, Mail, Phone, User, Briefcase, ShoppingBag, Wallet, Users, Clock, Globe, Monitor, Smartphone, Tablet, Activity, TrendingUp, KeyRound, Coins, Network, Gift, Trash2 } from "lucide-react";

/** Admin — Deep dive into a single user (profile, businesses, login history, activity, commissions, downline). */
export default function AdminUserDetail() {
  const { userId } = useParams();
  const nav = useNavigate();
  const { user: adminUser } = useAuth();
  const isSuper = adminUser?.role === "super_admin";
  const [data, setData] = useState(null);
  const [loginHist, setLoginHist] = useState([]);
  const [activity, setActivity] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [downline, setDownline] = useState(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteCascade, setDeleteCascade] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/users/${userId}`),
      api.get(`/admin/users/${userId}/login-history?limit=50`),
      api.get(`/admin/users/${userId}/activity?limit=100`),
      api.get(`/admin/users/${userId}/commission-breakdown?limit=200`),
      api.get(`/admin/users/${userId}/downline-tree?max_depth=8`).catch(() => ({ data: null })),
    ]).then(([d, l, a, cb, dt]) => {
      setData(d.data); setLoginHist(l.data.items || []); setActivity(a.data.items || []); setBreakdown(cb.data); setDownline(dt.data);
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

  const resetPassword = async () => {
    if (newPw.length < 6) return toast.error("Password must be at least 6 characters");
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { new_password: newPw });
      toast.success("Password reset — share the new one with the user");
      setResetOpen(false); setNewPw("");
    } catch (e) { toast.error(e?.response?.data?.detail || "Reset failed"); }
  };

  const markKitPaid = async () => {
    if (!confirm("Grant kit access to this user WITHOUT taking payment? This activates their referral code and pays L1 commissions to their sponsor.")) return;
    try {
      const { data: res } = await api.post(`/admin/users/${userId}/mark-kit-paid`);
      if (res.already_paid) toast.info("Kit was already active");
      else toast.success("Kit activated — user can now share their referral code");
      // Refresh
      const { data: refreshed } = await api.get(`/admin/users/${userId}`);
      setData((d) => ({ ...(d || {}), user: refreshed.user, referral_businesses: refreshed.referral_businesses, counters: refreshed.counters }));
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to activate"); }
  };

  const deleteUser = async () => {
    if (deleteConfirm !== "DELETE") return toast.error("Type DELETE (in caps) to confirm");
    try {
      const { data } = await api.delete(`/admin/users/${userId}${deleteCascade ? "?cascade=true" : ""}`);
      const n = data?.stats?.users_deleted || 1;
      toast.success(deleteCascade ? `User + branch deleted (${n} users)` : "User deleted");
      nav("/admin/users");
    } catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
  };

  if (loading) return <div className="text-center py-16 text-[#B91C1C]">Loading user…</div>;
  if (!data) return <div className="text-center py-16 text-[#B91C1C]">User not found.</div>;

  const u = data.user;
  const c = data.counters;

  return (
    <div className="space-y-6" data-testid="admin-user-detail-page">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-[#B91C1C] hover:text-[#7F1D1D]"><ArrowLeft className="w-4 h-4"/> Back to users</Link>

      {/* Hero */}
      <div className="rounded-3xl relative overflow-hidden p-6 md:p-8 bg-gradient-to-br from-white via-[#FEF2F2] to-white border border-[#FECACA]">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#DC2626] rounded-full mix-blend-overlay blur-3xl"/>
        </div>
        <div className="relative flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-white flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
            {(u.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase font-bold text-[#DC2626] tracking-widest flex items-center gap-1">
              <Shield className="w-3 h-3"/> {u.role} · Stage {u.current_stage || 1}
            </div>
            <div className="font-display font-black text-3xl mt-1 text-white truncate">{u.name}</div>
            <div className="text-xs text-[#B91C1C] font-mono mt-1">{u.user_code} · @{u.username || "—"}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#7F1D1D]">
              <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#94A3B8]"/> {u.phone || "—"}</span>
              <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#94A3B8]"/> {u.email || "—"}</span>
              <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-[#94A3B8]"/> Sponsor: {u.sponsor_id || "—"}</span>
              <span className="inline-flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-[#94A3B8]"/> Ref: <b className="text-[#DC2626] font-mono">{u.referral_code || "—"}</b></span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <span className={`badge-pill text-xs ${u.is_joining_paid ? "bg-[#FEE2E2] text-[#B91C1C] border border-[#DC2626]/30" : "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30"}`}>
              {u.is_joining_paid ? "Kit Paid" : "Kit Pending"}
            </span>
            <span className={`badge-pill text-xs ${u.is_active ? "bg-[#FEE2E2] text-[#B91C1C] border border-[#DC2626]/30" : "bg-[#FEE2E2] text-rose-300 border border-[#DC2626]/30"}`}>
              {u.is_active ? "Active" : "Disabled"}
            </span>
            <button onClick={toggleActive} disabled={saving} className="btn-outline text-xs" data-testid="admin-toggle-user-active">
              {u.is_active ? "Disable" : "Activate"}
            </button>
            {isSuper && (
              <button onClick={() => setResetOpen(true)} className="btn-outline text-xs" data-testid="admin-reset-password-btn">
                <KeyRound className="w-3 h-3"/> Reset Password
              </button>
            )}
            {isSuper && !u.is_joining_paid && (
              <button onClick={markKitPaid} className="btn-primary text-xs" data-testid="admin-mark-kit-paid-btn">
                <Gift className="w-3 h-3"/> Mark Kit Paid
              </button>
            )}
            {isSuper && u.role === "user" && (
              <button onClick={() => setDeleteOpen(true)} className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-full px-3 py-1.5 inline-flex items-center gap-1" data-testid="admin-delete-user-btn">
                <Trash2 className="w-3 h-3"/> Delete User
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete user modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white border border-[#DC2626]/40 p-6" onClick={(e) => e.stopPropagation()} data-testid="admin-delete-user-modal">
            <div className="flex items-center gap-2 text-red-400 text-xs uppercase font-bold tracking-widest mb-2"><Trash2 className="w-3 h-3"/> Destructive Action</div>
            <h3 className="font-display font-black text-xl text-[#7F1D1D]">Delete {u.name}?</h3>
            <p className="text-xs text-[#B91C1C] mt-1">This will hard-delete the user AND every trace of them (orders, businesses, withdrawals, KYC, notifications, transactions, cart, audit logs). The same phone, email or username can be used to sign up again immediately. There is no undo.</p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="mt-4 w-full bg-[#FEE2E2] border border-[#DC2626]/40 rounded-2xl px-4 py-2.5 text-[#7F1D1D] placeholder:text-[#94A3B8] outline-none font-mono"
              data-testid="admin-delete-confirm-input"
            />
            <label className="flex items-center gap-2 mt-3 text-xs text-[#7F1D1D] bg-red-900/40 border border-[#DC2626]/40 rounded-xl px-3 py-2 cursor-pointer" data-testid="admin-delete-cascade-label">
              <input
                type="checkbox"
                checked={deleteCascade}
                onChange={(e) => setDeleteCascade(e.target.checked)}
                data-testid="admin-delete-cascade-toggle"
              />
              <span>Also delete <b>entire referral branch</b> (all downstream members recursively)</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }} className="btn-outline text-xs">Cancel</button>
              <button onClick={deleteUser} disabled={deleteConfirm !== "DELETE"} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-full px-4 py-2" data-testid="admin-delete-confirm-btn">
                {deleteCascade ? "Delete + Branch" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setResetOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white border border-[#FECACA] p-6" onClick={(e) => e.stopPropagation()} data-testid="admin-reset-password-modal">
            <div className="flex items-center gap-2 text-[#DC2626] text-xs uppercase font-bold tracking-widest mb-2"><KeyRound className="w-3 h-3"/> Super Admin Action</div>
            <h3 className="font-display font-black text-xl text-[#7F1D1D]">Reset password for {u.name}</h3>
            <p className="text-xs text-[#B91C1C] mt-1">Sets a new password immediately. Share the new password with the user — they can change it later themselves.</p>
            <input
              type="text"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="mt-4 w-full bg-[#FEE2E2] border border-[#FECACA] rounded-2xl px-4 py-2.5 text-[#7F1D1D] placeholder:text-[#94A3B8] outline-none focus:border-[#DC2626]"
              data-testid="admin-new-password-input"
            />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => setResetOpen(false)} className="btn-outline text-xs">Cancel</button>
              <button onClick={resetPassword} disabled={newPw.length < 6} className="btn-primary text-xs" data-testid="admin-confirm-reset-password">Set new password</button>
            </div>
          </div>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Orders" value={c.orders_total} sub={`${c.orders_paid} paid`} icon={<ShoppingBag className="w-4 h-4"/>}/>
        <MiniStat label="Direct Refs" value={c.direct_referrals} icon={<Users className="w-4 h-4"/>}/>
        <MiniStat label="Businesses" value={c.additional_businesses + 1} sub="incl. primary" icon={<Briefcase className="w-4 h-4"/>}/>
        <MiniStat label="Withdrawals" value={c.withdrawals_total} icon={<Wallet className="w-4 h-4"/>}/>
        <MiniStat label="Wallet ₹" value={Number(u.wallet_balance || 0).toLocaleString("en-IN")} sub={`Earned ₹${Number(u.total_earnings || 0).toLocaleString("en-IN")}`} icon={<TrendingUp className="w-4 h-4"/>}/>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#FECACA] overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: <Briefcase className="w-3.5 h-3.5"/> },
          { id: "downline", label: `Referral Tree (${downline?.totals?.members || 0})`, icon: <Network className="w-3.5 h-3.5"/> },
          { id: "commissions", label: `Commissions (₹${Number(breakdown?.totals?.credited || 0).toLocaleString("en-IN")})`, icon: <Coins className="w-3.5 h-3.5"/> },
          { id: "logins", label: `Login History (${loginHist.length})`, icon: <Globe className="w-3.5 h-3.5"/> },
          { id: "activity", label: `Activity Log (${activity.length})`, icon: <Activity className="w-3.5 h-3.5"/> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${tab === t.id ? "border-[#DC2626] text-[#DC2626]" : "border-transparent text-[#B91C1C] hover:text-[#7F1D1D]"}`}
            data-testid={`admin-user-tab-${t.id}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="card-soft p-5" data-testid="admin-user-overview">
          <div className="font-display font-bold text-lg mb-3 text-[#7F1D1D]">Referral Businesses ({data.referral_businesses.length})</div>
          {data.referral_businesses.length === 0 && <div className="text-center py-6 text-sm text-[#94A3B8]">No additional businesses.</div>}
          <div className="grid md:grid-cols-2 gap-3">
            {data.referral_businesses.map((b) => (
              <div key={b.id} className="rounded-2xl bg-[#FEF2F2] p-3 border border-[#FECACA]" data-testid={`admin-user-biz-${b.business_code}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[#7F1D1D]">{b.name}</div>
                  <span className={`badge-pill text-[10px] ${b.is_active ? "bg-[#FEE2E2] text-[#B91C1C] border border-[#DC2626]/30" : "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30"}`}>{b.is_active ? "Active" : "Pending"}</span>
                </div>
                <div className="text-[11px] font-mono text-[#B91C1C] mt-1">{b.business_code} · Ref {b.referral_code} · Sponsor {b.sponsor_referral_code}</div>
                <div className="text-[10px] text-[#94A3B8] mt-1">Created {new Date(b.created_at).toLocaleDateString("en-IN")}</div>
                {isSuper && !b.is_active && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Grant this business (${b.name}) access WITHOUT payment?`)) return;
                      try {
                        await api.post(`/admin/users/${userId}/mark-kit-paid`, { business_id: b.id });
                        toast.success(`${b.name} activated`);
                        const { data: refreshed } = await api.get(`/admin/users/${userId}`);
                        setData((d) => ({ ...(d || {}), referral_businesses: refreshed.referral_businesses }));
                      } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
                    }}
                    className="mt-2 text-[10px] font-semibold text-[#991B1B] bg-[#FEE2E2] hover:bg-[#FECACA] rounded-full px-2 py-1 inline-flex items-center gap-1"
                    data-testid={`admin-grant-biz-${b.business_code}`}
                  >
                    <Gift className="w-3 h-3"/> Grant free access
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "downline" && (
        <div className="space-y-4" data-testid="admin-user-downline-tree">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Total Downline" value={downline?.totals?.members || 0} icon={<Users className="w-4 h-4"/>}/>
            <MiniStat label="Paid Members" value={downline?.totals?.paid || 0} sub={`of ${downline?.totals?.members || 0}`} icon={<Shield className="w-4 h-4"/>}/>
            <MiniStat label="Levels Explored" value={downline?.totals?.levels || 0} sub="of 8 max" icon={<Network className="w-4 h-4"/>}/>
            <MiniStat label="Referral Code" value={downline?.root?.referral_code || "—"} sub={downline?.root?.user_code} icon={<Briefcase className="w-4 h-4"/>}/>
          </div>
          {(downline?.levels || []).every((lv) => lv.count === 0) ? (
            <div className="card-soft p-10 text-center">
              <Network className="w-8 h-8 text-[#94A3B8] mx-auto mb-2"/>
              <div className="font-display font-bold text-[#7F1D1D]">No downline yet</div>
              <div className="text-sm text-[#94A3B8]">Nobody has joined under {downline?.root?.name || "this user"}&apos;s referral code.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {(downline?.levels || []).map((lv) => (
                <LevelBlock key={lv.level} lv={lv}/>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "commissions" && (
        <div className="space-y-4" data-testid="admin-user-commissions">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Wallet ₹" value={Number(u.wallet_balance || 0).toLocaleString("en-IN")} icon={<Wallet className="w-4 h-4"/>}/>
            <MiniStat label="Total Earned ₹" value={Number(u.total_earnings || 0).toLocaleString("en-IN")} icon={<TrendingUp className="w-4 h-4"/>}/>
            <MiniStat label="Credited (all-time)" value={`₹${Number(breakdown?.totals?.credited || 0).toLocaleString("en-IN")}`} icon={<Coins className="w-4 h-4"/>}/>
            <MiniStat label="Held Entries" value={breakdown?.totals?.held_entries || 0} sub="need 3 paid direct refs" icon={<Shield className="w-4 h-4"/>}/>
          </div>
          <div className="card-soft p-5">
            <div className="font-display font-bold text-lg text-[#7F1D1D] mb-3">Earnings by Level</div>
            {(breakdown?.by_level || []).length === 0 ? (
              <div className="text-center py-6 text-sm text-[#94A3B8]">No commissions credited yet.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(breakdown?.by_level || []).map((lv) => (
                  <div key={lv.level} className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] p-3" data-testid={`commission-level-${lv.level}`}>
                    <div className="text-[10px] uppercase font-bold text-[#B91C1C] tracking-widest">Level {lv.level}</div>
                    <div className="font-numbers font-black text-2xl text-[#DC2626] mt-1">₹{Number(lv.credited).toLocaleString("en-IN")}</div>
                    <div className="text-[10px] text-[#94A3B8] mt-1">{lv.count} events{lv.held_count ? ` · ${lv.held_count} held` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card-soft p-0 overflow-hidden">
            <div className="p-4 border-b border-[#FECACA] font-display font-bold text-[#7F1D1D]">Recent transactions</div>
            {(breakdown?.recent || []).length === 0 ? (
              <div className="text-center py-8 text-sm text-[#94A3B8]">No transactions yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#FEF2F2] text-left text-[10px] uppercase tracking-widest text-[#B91C1C]">
                  <tr><th className="p-3">Time</th><th className="p-3">Category</th><th className="p-3">Level</th><th className="p-3 text-right">Amount</th><th className="p-3">Description</th></tr>
                </thead>
                <tbody>
                  {(breakdown?.recent || []).map((t) => (
                    <tr key={t.id} className="border-t border-[#FECACA]/70">
                      <td className="p-3 whitespace-nowrap text-xs text-[#7F1D1D]">{new Date(t.created_at).toLocaleString("en-IN")}</td>
                      <td className="p-3"><span className="badge-pill text-[10px] bg-[#FEE2E2] text-[#7F1D1D] border border-[#FECACA]">{t.category}</span></td>
                      <td className="p-3 text-xs text-[#B91C1C]">L{t.level || "—"}</td>
                      <td className={`p-3 text-right font-numbers font-bold ${t.category === "commission_held" ? "text-[#DC2626]" : "text-[#DC2626]"}`}>₹{Number(t.amount).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-xs text-[#B91C1C] truncate max-w-[300px]">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "logins" && (
        <div className="card-soft p-0 overflow-hidden" data-testid="admin-user-login-history">
          {loginHist.length === 0 ? (
            <div className="text-center py-10 text-[#94A3B8] text-sm">No login history yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-[10px] uppercase tracking-widest text-[#B91C1C]">
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
                  <tr key={l.id} className="border-t border-[#FECACA]/70">
                    <td className="p-3 whitespace-nowrap text-[#7F1D1D] text-xs"><Clock className="inline w-3 h-3 mr-1 text-[#94A3B8]"/>{new Date(l.at).toLocaleString("en-IN")}</td>
                    <td className="p-3"><span className="badge-pill text-[10px] bg-[#FEE2E2] text-[#7F1D1D] border border-[#FECACA]">{l.method || "—"}</span></td>
                    <td className="p-3 font-mono text-xs text-[#7F1D1D]">{l.ip || "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#7F1D1D]">
                        <DeviceIcon kind={l.device?.kind}/> {l.device?.kind || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[#B91C1C]">{l.device?.browser} · {l.device?.os}</td>
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
            <div className="text-center py-10 text-[#94A3B8] text-sm">No activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-[10px] uppercase tracking-widest text-[#B91C1C]">
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
                  <tr key={l.id} className="border-t border-[#FECACA]/70">
                    <td className="p-3 whitespace-nowrap text-[#7F1D1D] text-xs">{new Date(l.created_at).toLocaleString("en-IN")}</td>
                    <td className="p-3"><span className="badge-pill text-[10px] bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">{l.event}</span></td>
                    <td className="p-3 text-xs text-[#7F1D1D] font-mono">{l.target_label || l.target_id || "—"}</td>
                    <td className="p-3 font-mono text-xs text-[#B91C1C]">{l.ip || "—"}</td>
                    <td className="p-3 text-[11px] text-[#94A3B8] max-w-[280px] truncate">{l.metadata && Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : "—"}</td>
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
      <div className="w-8 h-8 rounded-xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">{icon}</div>
      <div className="font-numbers font-black text-2xl text-[#7F1D1D] mt-2">{value}</div>
      <div className="text-[10px] uppercase font-bold text-[#B91C1C] tracking-widest">{label}</div>
      {sub && <div className="text-[9px] text-[#94A3B8] mt-0.5">{sub}</div>}
    </div>
  );
}

function DeviceIcon({ kind }) {
  if (kind === "Mobile") return <Smartphone className="w-3.5 h-3.5 text-[#DC2626]"/>;
  if (kind === "Tablet") return <Tablet className="w-3.5 h-3.5 text-[#DC2626]"/>;
  return <Monitor className="w-3.5 h-3.5 text-[#DC2626]"/>;
}

function LevelBlock({ lv }) {
  const [expanded, setExpanded] = useState(lv.level <= 2);
  const paidPct = lv.count === 0 ? 0 : Math.round((lv.paid / lv.count) * 100);
  return (
    <div className="card-soft p-0 overflow-hidden" data-testid={`downline-level-${lv.level}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/40 transition-colors"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-white flex items-center justify-center font-black text-sm shadow-lg shrink-0">
          L{lv.level}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-display font-bold text-[#7F1D1D] flex items-center gap-2">
            Level {lv.level}
            <span className="badge-pill text-[10px] bg-[#FEE2E2] text-[#7F1D1D] border border-[#FECACA]">{lv.count} members</span>
            {lv.paid > 0 && <span className="badge-pill text-[10px] bg-[#FEE2E2] text-[#B91C1C] border border-[#DC2626]/30">{lv.paid} paid · {paidPct}%</span>}
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-0.5">Team earnings: ₹{Number(lv.earnings || 0).toLocaleString("en-IN")}</div>
        </div>
        <div className="text-[#94A3B8] text-xs shrink-0">{expanded ? "Hide" : "Show"} ▾</div>
      </button>
      {expanded && lv.count > 0 && (
        <div className="border-t border-[#FECACA]/70 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/40 text-left text-[10px] uppercase tracking-widest text-[#94A3B8]">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Ref Code</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Direct Refs</th>
                <th className="p-3 text-right">Earnings</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {lv.members.map((m, idx) => (
                <tr key={m.id} className="border-t border-[#FECACA]/40" data-testid={`downline-member-${lv.level}-${idx}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {(m.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[#7F1D1D] font-semibold truncate">{m.name}</div>
                        <div className="text-[10px] text-[#94A3B8] font-mono">{m.user_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-[#B91C1C] whitespace-nowrap">{m.phone || m.email || "—"}</td>
                  <td className="p-3 text-xs font-mono text-[#DC2626]">{m.referral_code || "—"}</td>
                  <td className="p-3 text-xs text-[#7F1D1D]">{m.current_stage || 1}</td>
                  <td className="p-3 text-xs text-[#7F1D1D]">{m.direct_referrals_count || 0}</td>
                  <td className="p-3 text-right font-numbers font-bold text-[#DC2626]">₹{Number(m.total_earnings || 0).toLocaleString("en-IN")}</td>
                  <td className="p-3">
                    <span className={`badge-pill text-[10px] ${m.is_joining_paid ? "bg-[#FEE2E2] text-[#B91C1C] border border-[#DC2626]/30" : "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30"}`}>{m.is_joining_paid ? "Paid" : "Pending"}</span>
                  </td>
                  <td className="p-3">
                    <Link to={`/admin/users/${m.id}`} className="text-[10px] text-[#DC2626] hover:underline">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
