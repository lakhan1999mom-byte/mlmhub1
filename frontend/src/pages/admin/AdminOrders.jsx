import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, X, Truck, Save, Plus, ExternalLink } from "lucide-react";
import api from "@/lib/api";

const STATUSES = [
  { key: "placed", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function AdminOrders() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState(null); // full order object for tracking modal

  const load = () => api.get(`/admin/orders${filter ? `?status=${filter}` : ""}`).then(({ data }) => setItems(data.items));
  useEffect(() => { load(); }, [filter]);

  const quickUpdate = async (o, status) => {
    try {
      await api.put(`/admin/orders/${o.id}`, { status, note: `Status updated to ${status}` });
      toast.success("Order updated");
      load();
    } catch { toast.error("Update failed"); }
  };

  return (
    <div className="space-y-6" data-testid="admin-orders-page">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#064E3B]">Orders</h1>
          <p className="text-sm text-[#64748B]">Update tracking status, add courier details, and post live updates for customers.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {["", ...STATUSES.map((s) => s.key)].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize whitespace-nowrap ${filter === s ? "bg-[#84CC16] text-[#064E3B]" : "bg-white border border-[#E2E8F0]"}`} data-testid={`filter-${s || "all"}`}>
            {s ? STATUSES.find((x) => x.key === s)?.label : "All"}
          </button>
        ))}
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase"><tr>
            <th className="p-3">Code</th><th>User</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Tracking</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAF9]">
                <td className="p-3 font-numbers font-semibold text-[#064E3B]">{o.order_code}</td>
                <td className="p-3">
                  <div className="font-semibold text-[#064E3B]">{o.user_name}</div>
                  <div className="text-xs font-numbers text-[#94A3B8]">{o.user_code}</div>
                </td>
                <td className="p-3">{o.items?.length}</td>
                <td className="p-3 font-numbers font-bold">₹{o.total}</td>
                <td className="p-3">
                  <span className={`badge-pill ${o.payment_status === "paid" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{o.payment_status}</span>
                </td>
                <td className="p-3">
                  <select className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs" value={o.status} onChange={(e) => quickUpdate(o, e.target.value)} data-testid={`order-status-${o.order_code}`}>
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  {o.tracking_no ? (
                    <div className="flex items-center gap-1">
                      <div className="text-xs font-mono text-[#065F46]">{o.tracking_no}</div>
                      {o.courier_name && <div className="text-[10px] text-[#94A3B8]">({o.courier_name})</div>}
                    </div>
                  ) : (
                    <span className="text-xs text-[#94A3B8] italic">not shipped</span>
                  )}
                </td>
                <td className="p-3">
                  <button onClick={() => setEdit(o)} className="text-xs bg-[#ECFCCB] text-[#065F46] rounded-full px-3 py-1.5 hover:bg-[#D9F99D] inline-flex items-center gap-1" data-testid={`edit-tracking-${o.order_code}`}>
                    <Truck className="w-3 h-3"/> Tracking
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="p-12 text-center text-[#64748B]">
            <Package className="w-12 h-12 mx-auto mb-2 text-[#84CC16]"/>
            <div>No orders in this filter</div>
          </div>
        )}
      </div>

      {edit && <TrackingModal order={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }}/>}
    </div>
  );
}

function TrackingModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    status: order.status,
    tracking_no: order.tracking_no || "",
    courier_name: order.courier_name || "",
    tracking_url: order.tracking_url || "",
    note: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/orders/${order.id}`, form);
      toast.success("Tracking updated · customer notified");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const history = order.tracking_history || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="tracking-modal">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-display font-black text-xl text-[#064E3B]">Update Tracking</h3>
            <div className="text-xs text-[#64748B] font-numbers">{order.order_code} · {order.user_name}</div>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#334155]" data-testid="tracking-modal-close"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">Set Status</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setForm({ ...form, status: s.key })}
                  className={`px-3 py-2 rounded-full text-xs font-semibold border ${form.status === s.key ? "bg-[#84CC16] text-[#064E3B] border-[#65A30D]" : "bg-white border-[#E2E8F0] text-[#64748B]"}`}
                  data-testid={`status-btn-${s.key}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Courier</label>
              <input className="input-soft mt-1" placeholder="Delhivery, Bluedart…" value={form.courier_name} onChange={(e) => setForm({ ...form, courier_name: e.target.value })} data-testid="courier-name-input"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Tracking Number</label>
              <input className="input-soft mt-1 font-mono" placeholder="AWB123456789" value={form.tracking_no} onChange={(e) => setForm({ ...form, tracking_no: e.target.value })} data-testid="tracking-no-input"/>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">Tracking URL <span className="text-xs text-[#94A3B8]">(optional — customer clicks to track on courier site)</span></label>
            <input className="input-soft mt-1" placeholder="https://delhivery.com/track/…" value={form.tracking_url} onChange={(e) => setForm({ ...form, tracking_url: e.target.value })}/>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">Update Note <span className="text-xs text-[#94A3B8]">(shown on customer&apos;s timeline)</span></label>
            <textarea className="input-soft mt-1 min-h-[80px]" placeholder='e.g. "Package handed to courier — expected delivery by Friday."' value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid="tracking-note-input"/>
          </div>

          {/* History timeline */}
          {history.length > 0 && (
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="font-semibold text-[#064E3B]">History</div>
                <span className="text-xs text-[#94A3B8]">{history.length} update{history.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {history.slice().reverse().map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-[#84CC16] mt-2 flex-shrink-0"/>
                    <div className="flex-1">
                      <div className="font-semibold text-[#064E3B]">{h.label || h.status}</div>
                      {h.note && <div className="text-xs text-[#334155]">{h.note}</div>}
                      <div className="text-[10px] text-[#94A3B8] font-numbers">{new Date(h.at).toLocaleString()}{h.by ? ` · ${h.by}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#E2E8F0] flex gap-2 bg-[#F8FAFC] sticky bottom-0">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-tracking-btn">
            {busy ? "Saving…" : <><Save className="w-4 h-4"/>Save & Notify</>}
          </button>
        </div>
      </div>
    </div>
  );
}
