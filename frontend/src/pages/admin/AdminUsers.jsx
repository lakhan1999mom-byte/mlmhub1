import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Gift, Trash2, GitBranch, Users as UsersIcon, Pencil, X } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState({}); // {id: true}
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const { user: adminUser } = useAuth();
  const isSuper = adminUser?.role === "super_admin";
  const load = () => api.get(`/admin/users?q=${encodeURIComponent(q)}&limit=200`).then(({ data }) => setItems(data.items));
  useEffect(() => { load(); setSelected({}); }, [q]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allChecked = items.length > 0 && items.every((u) => selected[u.id]);
  const toggleAll = () => {
    if (allChecked) setSelected({});
    else {
      const next = {};
      items.forEach((u) => { if (u.role === "user") next[u.id] = true; });
      setSelected(next);
    }
  };

  const toggle = async (u, field, val) => {
    await api.put(`/admin/users/${u.id}`, { [field]: val });
    toast.success("Updated");
    load();
  };

  const markKitPaid = async (u) => {
    if (!confirm(`Grant kit access to ${u.name} WITHOUT payment? Activates referral code + pays L1 rewards to sponsor.`)) return;
    try {
      const { data } = await api.post(`/admin/users/${u.id}/mark-kit-paid`);
      toast.success(data.already_paid ? "Already active" : `${u.user_code} activated`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const deleteUser = async (u, cascade) => {
    const label = cascade
      ? `DELETE ${u.name} (${u.user_code}) AND EVERY MEMBER IN THEIR REFERRAL BRANCH (recursive)? There is no undo.`
      : `DELETE ${u.name} (${u.user_code}) and every trace of them? Their referrals will remain (orphaned). There is no undo.`;
    if (!confirm(label)) return;
    try {
      const { data } = await api.delete(`/admin/users/${u.id}${cascade ? "?cascade=true" : ""}`);
      toast.success(`${u.user_code} deleted (${data?.stats?.users_deleted || 1} users)`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const bulkDelete = async (cascade) => {
    if (selectedIds.length === 0) return toast.error("Select at least one user");
    const label = cascade
      ? `Bulk delete ${selectedIds.length} users AND their entire referral branches? No undo.`
      : `Bulk delete ${selectedIds.length} users? No undo.`;
    if (!confirm(label)) return;
    try {
      const { data } = await api.post(`/admin/users/bulk-delete`, { user_ids: selectedIds, cascade });
      const okCount = (data.results || []).filter((r) => r.ok).length;
      toast.success(`Deleted ${okCount} / ${selectedIds.length}`);
      setSelected({});
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="text-sm text-[#64748B]">Search by name, username, phone, email, code, or referral code. Tick rows for bulk actions.</p>
        </div>
        <input className="input-soft max-w-sm" placeholder="Search name / phone / email / code / ref…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-users-search"/>
      </div>

      {/* Bulk actions bar */}
      {isSuper && selectedIds.length > 0 && (
        <div className="card-soft p-3 sm:p-4 flex flex-wrap items-center gap-2 bg-[#FEF2F2] border-[#DC2626]/30" data-testid="admin-bulk-bar">
          <div className="text-sm font-semibold text-[#7F1D1D] mr-2"><UsersIcon className="w-4 h-4 inline mr-1"/> {selectedIds.length} selected</div>
          <button onClick={() => setShowBulkEdit(true)} className="text-xs font-semibold text-[#7F1D1D] bg-white hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-1.5 inline-flex items-center gap-1" data-testid="bulk-edit-btn">
            <Pencil className="w-3 h-3"/> Bulk Replace
          </button>
          <button onClick={() => bulkDelete(false)} className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 inline-flex items-center gap-1" data-testid="bulk-delete-btn">
            <Trash2 className="w-3 h-3"/> Bulk Delete
          </button>
          <button onClick={() => bulkDelete(true)} className="text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg px-3 py-1.5 inline-flex items-center gap-1" data-testid="bulk-delete-cascade-btn">
            <GitBranch className="w-3 h-3"/> Bulk Delete + Whole Branch
          </button>
          <button onClick={() => setSelected({})} className="text-xs text-[#B91C1C] ml-auto hover:underline">Clear selection</button>
        </div>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#FEF2F2] text-left text-xs uppercase">
            <tr>
              {isSuper && (
                <th className="p-3 w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} data-testid="bulk-select-all"/>
                </th>
              )}
              <th className="p-3">Code</th><th>Name</th><th>Phone</th><th>Ref</th><th>Stage</th><th>Team</th><th>Rewards</th><th>KYC</th><th>Status</th><th>Role</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-[#FEE2E2]" data-testid={`admin-user-${u.user_code}`}>
                {isSuper && (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      disabled={u.role !== "user"}
                      checked={!!selected[u.id]}
                      onChange={(e) => setSelected({...selected, [u.id]: e.target.checked})}
                      data-testid={`row-select-${u.user_code}`}
                    />
                  </td>
                )}
                <td className="p-3 font-numbers font-semibold">{u.user_code}</td>
                <td className="p-3">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-[#64748B]">{u.email}</div>
                </td>
                <td className="p-3">{u.phone}</td>
                <td className="p-3 font-mono text-xs text-[#991B1B]">{u.referral_code || "—"}</td>
                <td className="p-3 font-numbers">
                  <input type="number" min="1" max="8" defaultValue={u.current_stage} onBlur={(e) => {
                    const v = parseInt(e.target.value); if (v !== u.current_stage) toggle(u, 'current_stage', v);
                  }} className="w-14 text-center border border-[#FECACA] rounded-lg px-1 py-1 text-xs" data-testid={`stage-${u.user_code}`}/>
                </td>
                <td className="p-3 font-numbers">{u.team_size}</td>
                <td className="p-3 font-numbers">₹{u.total_earnings}</td>
                <td className="p-3"><span className="badge-pill capitalize bg-[#FEE2E2] text-[#991B1B]">{u.kyc_status}</span></td>
                <td className="p-3">
                  <button onClick={() => toggle(u, "is_active", !u.is_active)} className={`badge-pill ${u.is_active ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-red-100 text-red-700"}`} data-testid={`toggle-active-${u.user_code}`}>
                    {u.is_active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="p-3">
                  <select className="text-xs border border-[#FECACA] rounded-lg px-2 py-1" value={u.role} onChange={(e) => toggle(u, "role", e.target.value)} data-testid={`role-${u.user_code}`}>
                    <option value="user">User</option>
                    <option value="sub_admin">Sub Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link to={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#991B1B] hover:text-[#7F1D1D] bg-[#FEE2E2] hover:bg-[#FECACA] px-2 py-1 rounded-lg" data-testid={`view-user-${u.user_code}`}>
                      <Eye className="w-3 h-3"/> View
                    </Link>
                    {isSuper && !u.is_joining_paid && (
                      <button onClick={() => markKitPaid(u)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2 py-1 rounded-lg" data-testid={`grant-kit-${u.user_code}`}>
                        <Gift className="w-3 h-3"/> Grant
                      </button>
                    )}
                    {isSuper && u.role === "user" && (
                      <>
                        <button onClick={() => deleteUser(u, false)} title="Delete only this user" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg" data-testid={`delete-user-${u.user_code}`}>
                          <Trash2 className="w-3 h-3"/>
                        </button>
                        <button onClick={() => deleteUser(u, true)} title="Delete user + entire branch" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 px-2 py-1 rounded-lg" data-testid={`delete-branch-${u.user_code}`}>
                          <GitBranch className="w-3 h-3"/>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={isSuper ? 12 : 11} className="p-12 text-center text-[#64748B]">No users found</td></tr>}
          </tbody>
        </table>
      </div>

      {showBulkEdit && (
        <BulkEditModal
          selectedIds={selectedIds}
          onClose={() => setShowBulkEdit(false)}
          onDone={() => { setShowBulkEdit(false); setSelected({}); load(); }}
        />
      )}
    </div>
  );
}

function BulkEditModal({ selectedIds, onClose, onDone }) {
  const [field, setField] = useState("is_active");
  const [value, setValue] = useState("true");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    let parsed = value;
    if (field === "is_active" || field === "is_joining_paid" || field === "income_active") parsed = value === "true";
    else if (field === "current_stage" || field === "wallet_balance") parsed = Number(value);
    setBusy(true);
    try {
      const { data } = await api.post("/admin/users/bulk-update", {
        user_ids: selectedIds,
        updates: { [field]: parsed },
      });
      toast.success(`Updated ${data.modified} of ${data.matched}`);
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="bulk-edit-modal">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-[#7F1D1D]">Bulk Replace — {selectedIds.length} users</h3>
          <button onClick={onClose} className="text-[#7F1D1D] hover:text-[#DC2626]"><X className="w-5 h-5"/></button>
        </div>
        <div>
          <label className="text-sm font-semibold">Field to replace</label>
          <select value={field} onChange={(e) => { setField(e.target.value); setValue(""); }} className="input-soft mt-1" data-testid="bulk-field-select">
            <option value="is_active">Status (active/disabled)</option>
            <option value="is_joining_paid">Kit paid (yes/no)</option>
            <option value="income_active">Rewards active (yes/no)</option>
            <option value="current_stage">Current stage (1-8)</option>
            <option value="wallet_balance">Wallet balance (₹)</option>
            <option value="role">Role</option>
            <option value="kyc_status">KYC status</option>
            <option value="sponsor_id">Sponsor code</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold">New value</label>
          {(field === "is_active" || field === "is_joining_paid" || field === "income_active") ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="input-soft mt-1" data-testid="bulk-value-input">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : field === "role" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="input-soft mt-1" data-testid="bulk-value-input">
              <option value="user">user</option>
              <option value="sub_admin">sub_admin</option>
              <option value="super_admin">super_admin</option>
            </select>
          ) : field === "kyc_status" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="input-soft mt-1" data-testid="bulk-value-input">
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="not_submitted">not_submitted</option>
            </select>
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value)} className="input-soft mt-1" data-testid="bulk-value-input" placeholder="Type new value"/>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-outline text-sm">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-primary text-sm" data-testid="bulk-edit-submit">
            {busy ? "Replacing…" : "Replace"}
          </button>
        </div>
      </div>
    </div>
  );
}
