import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Gift, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const { user: adminUser } = useAuth();
  const isSuper = adminUser?.role === "super_admin";
  const load = () => api.get(`/admin/users?q=${encodeURIComponent(q)}`).then(({ data }) => setItems(data.items));
  useEffect(() => { load(); }, [q]);

  const toggle = async (u, field, val) => {
    await api.put(`/admin/users/${u.id}`, { [field]: val });
    toast.success("Updated");
    load();
  };

  const markKitPaid = async (u) => {
    if (!confirm(`Grant kit access to ${u.name} WITHOUT payment? Activates referral code + pays L1 commissions to sponsor.`)) return;
    try {
      const { data } = await api.post(`/admin/users/${u.id}/mark-kit-paid`);
      toast.success(data.already_paid ? "Already active" : `${u.user_code} activated`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const deleteUser = async (u) => {
    if (!confirm(`DELETE ${u.name} (${u.user_code}) and every trace of them? Same phone/email/username will be able to sign up again immediately. There is no undo.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success(`${u.user_code} deleted`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="text-sm text-[#64748B]">Search by name, username, phone, email, code, or referral code.</p>
        </div>
        <input className="input-soft max-w-sm" placeholder="Search name / phone / email / code / ref…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-users-search"/>
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase">
            <tr>
              <th className="p-3">Code</th><th>Name</th><th>Phone</th><th>Ref</th><th>Stage</th><th>Team</th><th>Earnings</th><th>KYC</th><th>Status</th><th>Role</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-[#F1F5F9]" data-testid={`admin-user-${u.user_code}`}>
                <td className="p-3 font-numbers font-semibold">{u.user_code}</td>
                <td className="p-3">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-[#64748B]">{u.email}</div>
                </td>
                <td className="p-3">{u.phone}</td>
                <td className="p-3 font-mono text-xs text-[#065F46]">{u.referral_code || "—"}</td>
                <td className="p-3 font-numbers">
                  <input type="number" min="1" max="8" defaultValue={u.current_stage} onBlur={(e) => {
                    const v = parseInt(e.target.value); if (v !== u.current_stage) toggle(u, 'current_stage', v);
                  }} className="w-14 text-center border border-[#E2E8F0] rounded-lg px-1 py-1 text-xs" data-testid={`stage-${u.user_code}`}/>
                </td>
                <td className="p-3 font-numbers">{u.team_size}</td>
                <td className="p-3 font-numbers">₹{u.total_earnings}</td>
                <td className="p-3"><span className="badge-pill capitalize bg-[#ECFCCB] text-[#065F46]">{u.kyc_status}</span></td>
                <td className="p-3">
                  <button onClick={() => toggle(u, "is_active", !u.is_active)} className={`badge-pill ${u.is_active ? "bg-[#ECFCCB] text-[#065F46]" : "bg-red-100 text-red-700"}`} data-testid={`toggle-active-${u.user_code}`}>
                    {u.is_active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="p-3">
                  <select className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1" value={u.role} onChange={(e) => toggle(u, "role", e.target.value)} data-testid={`role-${u.user_code}`}>
                    <option value="user">User</option>
                    <option value="sub_admin">Sub Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link to={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#065F46] hover:text-[#064E3B] bg-[#ECFCCB] hover:bg-[#D9F99D] px-2 py-1 rounded-lg" data-testid={`view-user-${u.user_code}`}>
                      <Eye className="w-3 h-3"/> View
                    </Link>
                    {isSuper && !u.is_joining_paid && (
                      <button onClick={() => markKitPaid(u)} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg" data-testid={`grant-kit-${u.user_code}`}>
                        <Gift className="w-3 h-3"/> Grant
                      </button>
                    )}
                    {isSuper && u.role === "user" && (
                      <button onClick={() => deleteUser(u)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg" data-testid={`delete-user-${u.user_code}`}>
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={11} className="p-12 text-center text-[#64748B]">No users found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
