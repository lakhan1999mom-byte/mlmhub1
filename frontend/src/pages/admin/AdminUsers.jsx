import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const load = () => api.get(`/admin/users?q=${q}`).then(({ data }) => setItems(data.items));
  useEffect(() => { load(); }, [q]);

  const toggle = async (u, field, val) => {
    await api.put(`/admin/users/${u.id}`, { [field]: val });
    toast.success("Updated");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Users</h1>
        <input className="input-soft max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-users-search"/>
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase">
            <tr>
              <th className="p-3">Code</th><th>Name</th><th>Phone</th><th>Stage</th><th>Team</th><th>Earnings</th><th>KYC</th><th>Status</th><th>Actions</th>
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
                <td className="p-3 font-numbers">{u.current_stage}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
