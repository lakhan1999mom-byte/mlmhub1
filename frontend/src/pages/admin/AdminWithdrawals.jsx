import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminWithdrawals() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const load = () => api.get(`/admin/withdrawals${filter ? `?status=${filter}` : ""}`).then(({ data }) => setItems(data));
  useEffect(() => { load(); }, [filter]);

  const update = async (w, status) => {
    const note = window.prompt("Note (optional):", "");
    await api.put(`/admin/withdrawals/${w.id}`, { status, admin_note: note });
    toast.success("Updated");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-withdrawals-page">
      <h1 className="font-display text-3xl font-bold">Withdrawals</h1>
      <div className="flex gap-2 overflow-x-auto">
        {["","pending","approved","paid","rejected","hold"].map((s) => (
          <button key={s||"all"} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${filter === s ? "bg-[#84CC16] text-[#064E3B]" : "bg-white border border-[#E2E8F0]"}`}>{s || "All"}</button>
        ))}
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase"><tr>
            <th className="p-3">Code</th><th>User</th><th>Amount</th><th>Method</th><th>Details</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} className="border-t border-[#F1F5F9]" data-testid={`wd-row-${w.withdrawal_code}`}>
                <td className="p-3 font-numbers">{w.withdrawal_code}</td>
                <td className="p-3"><div className="font-semibold">{w.user_name}</div><div className="text-xs font-numbers">{w.user_code}</div></td>
                <td className="p-3 font-numbers font-bold">₹{w.amount}</td>
                <td className="p-3 capitalize">{w.method}</td>
                <td className="p-3 text-xs">{w.method === "upi" ? w.upi_id : `${w.bank_name} · ${w.account_number}`}</td>
                <td className="p-3"><span className={`badge-pill capitalize ${["approved","paid"].includes(w.status) ? "bg-[#ECFCCB] text-[#065F46]" : w.status === "rejected" ? "bg-red-100 text-red-700" : "bg-[#FEF3C7] text-[#92400E]"}`}>{w.status}</span></td>
                <td className="p-3 flex gap-1 flex-wrap">
                  {w.status === "pending" && (
                    <>
                      <button onClick={() => update(w, "approved")} className="text-xs bg-[#84CC16] text-[#064E3B] rounded-full px-3 py-1 font-semibold" data-testid={`approve-${w.withdrawal_code}`}>Approve</button>
                      <button onClick={() => update(w, "rejected")} className="text-xs bg-red-100 text-red-700 rounded-full px-3 py-1 font-semibold" data-testid={`reject-${w.withdrawal_code}`}>Reject</button>
                      <button onClick={() => update(w, "hold")} className="text-xs bg-[#FEF3C7] text-[#92400E] rounded-full px-3 py-1 font-semibold">Hold</button>
                    </>
                  )}
                  {w.status === "approved" && (
                    <button onClick={() => update(w, "paid")} className="text-xs bg-[#064E3B] text-white rounded-full px-3 py-1 font-semibold">Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
