import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TicketPercent, Save, X, Calendar, Users } from "lucide-react";
import api from "@/lib/api";

const blank = {
  code: "", description: "", discount_percent: 10, discount_amount: 0,
  min_order: 0, max_discount: 0, usage_limit: 0, expires_at: "", is_active: true,
};

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/coupons").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit.code.trim()) return toast.error("Code is required");
    setBusy(true);
    try {
      const payload = { ...edit };
      // Convert local datetime to ISO string
      if (payload.expires_at && !payload.expires_at.endsWith("Z")) {
        try { payload.expires_at = new Date(payload.expires_at).toISOString(); } catch { /* ignore */ }
      }
      if (edit.id) await api.put(`/admin/coupons/${edit.id}`, payload);
      else await api.post("/admin/coupons", payload);
      toast.success("Promo code saved");
      setEdit(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id, code) => {
    if (!window.confirm(`Delete promo code "${code}"?`)) return;
    await api.delete(`/admin/coupons/${id}`);
    toast.success("Deleted");
    load();
  };

  const toISOInput = (v) => {
    if (!v) return "";
    try { return new Date(v).toISOString().slice(0, 16); } catch { return ""; }
  };

  return (
    <div className="space-y-6" data-testid="admin-coupons-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#064E3B]">Promo Codes</h1>
          <p className="text-sm text-[#64748B]">Create discount codes with expiry and usage limits. Customers apply them at checkout.</p>
        </div>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="add-coupon-btn"><Plus className="w-4 h-4"/>New Code</button>
      </div>

      {items.length === 0 && (
        <div className="card-soft p-12 text-center">
          <TicketPercent className="w-14 h-14 text-[#84CC16] mx-auto mb-3"/>
          <div className="font-display font-bold text-lg text-[#064E3B]">No promo codes yet</div>
          <div className="text-sm text-[#64748B] mb-4">Create your first coupon (e.g. WELCOME10 for 10% off).</div>
          <button onClick={() => setEdit({ ...blank })} className="btn-primary mx-auto"><Plus className="w-4 h-4"/>Create first code</button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => {
          const expired = c.expires_at && new Date(c.expires_at) < new Date();
          const used = c.usage_limit && c.used_count >= c.usage_limit;
          return (
            <div key={c.id} className="card-soft p-4 relative overflow-hidden" data-testid={`coupon-card-${c.code}`}>
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#84CC16]/10 rounded-full blur-xl"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="inline-flex items-center gap-1 bg-[#064E3B] text-[#84CC16] font-mono font-black px-3 py-1.5 rounded-full text-sm tracking-wider">
                    <TicketPercent className="w-3 h-3"/> {c.code}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${c.is_active && !expired && !used ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                      {!c.is_active ? "Off" : expired ? "Expired" : used ? "Used up" : "Active"}
                    </span>
                  </div>
                </div>
                <div className="text-2xl font-display font-black text-[#064E3B]">
                  {c.discount_percent ? `${c.discount_percent}% OFF` : `₹${c.discount_amount} OFF`}
                </div>
                {c.description && <div className="text-xs text-[#334155] mt-1 line-clamp-2">{c.description}</div>}
                <div className="text-xs text-[#64748B] mt-2 space-y-0.5">
                  {c.min_order > 0 && <div>Min order: <span className="font-numbers font-semibold">₹{c.min_order}</span></div>}
                  {c.max_discount > 0 && <div>Max discount: <span className="font-numbers font-semibold">₹{c.max_discount}</span></div>}
                  {c.usage_limit > 0 && <div className="flex items-center gap-1"><Users className="w-3 h-3"/> Used: {c.used_count}/{c.usage_limit}</div>}
                  {c.expires_at && <div className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Expires {new Date(c.expires_at).toLocaleDateString()}</div>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEdit({ ...c, expires_at: toISOInput(c.expires_at) })} className="text-xs bg-[#ECFCCB] text-[#065F46] rounded-full px-3 py-1.5 hover:bg-[#D9F99D] flex-1 justify-center inline-flex items-center gap-1" data-testid={`edit-coupon-${c.code}`}><Pencil className="w-3 h-3"/> Edit</button>
                  <button onClick={() => del(c.id, c.code)} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-1.5 hover:bg-red-100" data-testid={`del-coupon-${c.code}`}><Trash2 className="w-3 h-3"/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="coupon-edit-modal">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xl text-[#064E3B]">{edit.id ? "Edit" : "New"} Promo Code</h3>
              <button onClick={() => setEdit(null)} className="text-[#94A3B8] hover:text-[#334155]"><X className="w-5 h-5"/></button>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Code</label>
              <input className="input-soft mt-1 font-mono uppercase" placeholder="e.g. WELCOME10" value={edit.code} onChange={(e) => setEdit({...edit, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")})} data-testid="coupon-code-input"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Description</label>
              <input className="input-soft mt-1" placeholder="First order discount for new customers" value={edit.description} onChange={(e) => setEdit({...edit, description: e.target.value})}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Discount %</label>
                <input type="number" min="0" max="100" className="input-soft mt-1" value={edit.discount_percent} onChange={(e) => setEdit({...edit, discount_percent: +e.target.value, discount_amount: 0})} data-testid="coupon-percent-input"/>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">OR Flat ₹ off</label>
                <input type="number" min="0" className="input-soft mt-1" value={edit.discount_amount} onChange={(e) => setEdit({...edit, discount_amount: +e.target.value, discount_percent: 0})} data-testid="coupon-amount-input"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Min Order (₹)</label>
                <input type="number" min="0" className="input-soft mt-1" value={edit.min_order} onChange={(e) => setEdit({...edit, min_order: +e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Max Discount (₹)</label>
                <input type="number" min="0" className="input-soft mt-1" value={edit.max_discount} onChange={(e) => setEdit({...edit, max_discount: +e.target.value})}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Usage Limit <span className="text-xs text-[#94A3B8]">(0 = unlimited)</span></label>
                <input type="number" min="0" className="input-soft mt-1" value={edit.usage_limit} onChange={(e) => setEdit({...edit, usage_limit: +e.target.value})} data-testid="coupon-limit-input"/>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Expires</label>
                <input type="datetime-local" className="input-soft mt-1" value={edit.expires_at} onChange={(e) => setEdit({...edit, expires_at: e.target.value})} data-testid="coupon-expires-input"/>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({...edit, is_active: e.target.checked})} className="accent-[#84CC16]" data-testid="coupon-active-toggle"/>
              <span className="text-sm font-semibold text-[#064E3B]">Active</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-coupon-btn">
                {busy ? "Saving…" : <><Save className="w-4 h-4"/>Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
