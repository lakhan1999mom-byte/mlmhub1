import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminOrders() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const load = () => api.get(`/admin/orders${filter ? `?status=${filter}` : ""}`).then(({ data }) => setItems(data.items));
  useEffect(() => { load(); }, [filter]);

  const update = async (o, status, tracking) => {
    await api.put(`/admin/orders/${o.id}`, { status, tracking_no: tracking });
    toast.success("Order updated");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-orders-page">
      <h1 className="font-display text-3xl font-bold">Orders</h1>
      <div className="flex gap-2 overflow-x-auto">
        {["", "placed", "confirmed", "shipped", "delivered", "cancelled"].map((s) => (
          <button key={s||"all"} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${filter === s ? "bg-[#84CC16] text-[#064E3B]" : "bg-white border border-[#E2E8F0]"}`}>{s || "All"}</button>
        ))}
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase"><tr>
            <th className="p-3">Code</th><th>User</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Tracking</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-[#F1F5F9]">
                <td className="p-3 font-numbers font-semibold">{o.order_code}</td>
                <td className="p-3"><div className="font-semibold">{o.user_name}</div><div className="text-xs font-numbers">{o.user_code}</div></td>
                <td className="p-3">{o.items?.length}</td>
                <td className="p-3 font-numbers">₹{o.total}</td>
                <td className="p-3"><span className={`badge-pill ${o.payment_status === "paid" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{o.payment_status}</span></td>
                <td className="p-3">
                  <select className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs" value={o.status} onChange={(e) => update(o, e.target.value, o.tracking_no)} data-testid={`order-status-${o.order_code}`}>
                    {["placed","confirmed","shipped","delivered","cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <input className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs w-28" placeholder="Tracking #" defaultValue={o.tracking_no || ""} onBlur={(e) => e.target.value !== (o.tracking_no || "") && update(o, o.status, e.target.value)} data-testid={`tracking-${o.order_code}`}/>
                </td>
                <td className="p-3 text-xs text-[#64748B]">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
