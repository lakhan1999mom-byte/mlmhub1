import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, Wallet, Percent, IndianRupee, ToggleRight, ToggleLeft } from "lucide-react";
import api from "@/lib/api";

/**
 * Admin → Charges. Central control for every extra fee that customers pay.
 * Toggles: Delivery, GST, plus a free-form list of extras (handling, packing, service, insurance, etc.)
 */
export default function AdminCharges() {
  const [site, setSite] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/admin/settings/site");
    setSite({
      delivery_charge: data.delivery_charge ?? 49,
      delivery_charge_enabled: data.delivery_charge_enabled ?? true,
      free_shipping_threshold: data.free_shipping_threshold ?? 999,
      gst_percent: data.gst_percent ?? 5,
      gst_enabled: data.gst_enabled ?? true,
      extra_charges: data.extra_charges || [],
    });
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/settings/site", site);
      toast.success("Charges configuration saved — takes effect on next order");
      await load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const addExtra = () => setSite({
    ...site,
    extra_charges: [...(site.extra_charges || []), {
      key: `charge_${Date.now()}`, label: "New Charge", type: "flat", value: 0, enabled: true,
    }],
  });

  const updateExtra = (idx, patch) => {
    const arr = [...(site.extra_charges || [])];
    arr[idx] = { ...arr[idx], ...patch };
    setSite({ ...site, extra_charges: arr });
  };

  const removeExtra = (idx) => {
    const arr = (site.extra_charges || []).filter((_, i) => i !== idx);
    setSite({ ...site, extra_charges: arr });
  };

  if (!site) return <div className="p-12 text-center text-[#64748B]">Loading…</div>;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="admin-charges-page">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#064E3B]">Order Charges</h1>
        <p className="text-sm text-[#64748B]">Turn any charge ON or OFF, and add unlimited custom charges (packing, handling, service, insurance…).</p>
      </div>

      {/* GST Toggle */}
      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${site.gst_enabled ? "bg-[#DBEAFE] text-[#1E40AF]" : "bg-[#F1F5F9] text-[#94A3B8]"}`}>
              <Percent className="w-5 h-5"/>
            </div>
            <div>
              <div className="font-display font-bold text-[#064E3B]">GST</div>
              <div className="text-xs text-[#64748B]">Applied on each product line as a percentage.</div>
            </div>
          </div>
          <ToggleSwitch on={site.gst_enabled} onChange={(v) => setSite({ ...site, gst_enabled: v })} testid="gst-enabled-toggle"/>
        </div>
        {site.gst_enabled && (
          <div className="ml-14">
            <label className="text-xs font-bold uppercase text-[#94A3B8] tracking-wider">Default GST %</label>
            <input
              type="number" min={0} max={28}
              className="input-soft mt-1 font-numbers max-w-[120px]"
              value={site.gst_percent}
              onChange={(e) => setSite({ ...site, gst_percent: +e.target.value })}
              data-testid="gst-percent-input"
            />
          </div>
        )}
      </div>

      {/* Delivery Toggle */}
      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${site.delivery_charge_enabled ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F1F5F9] text-[#94A3B8]"}`}>
              <IndianRupee className="w-5 h-5"/>
            </div>
            <div>
              <div className="font-display font-bold text-[#064E3B]">Delivery Charge</div>
              <div className="text-xs text-[#64748B]">Flat fee charged when order total is below the free-shipping threshold.</div>
            </div>
          </div>
          <ToggleSwitch on={site.delivery_charge_enabled} onChange={(v) => setSite({ ...site, delivery_charge_enabled: v })} testid="delivery-enabled-toggle"/>
        </div>
        {site.delivery_charge_enabled && (
          <div className="ml-14 grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-xs font-bold uppercase text-[#94A3B8] tracking-wider">Charge (₹)</label>
              <input type="number" min={0} className="input-soft mt-1 font-numbers" value={site.delivery_charge} onChange={(e) => setSite({ ...site, delivery_charge: +e.target.value })} data-testid="delivery-charge-input"/>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[#94A3B8] tracking-wider">FREE above (₹)</label>
              <input type="number" min={0} className="input-soft mt-1 font-numbers" value={site.free_shipping_threshold} onChange={(e) => setSite({ ...site, free_shipping_threshold: +e.target.value })}/>
            </div>
          </div>
        )}
      </div>

      {/* Extra charges list */}
      <div className="card-soft p-5" data-testid="extra-charges-section">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#ECFCCB] flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#65A30D]"/>
            </div>
            <div>
              <div className="font-display font-bold text-[#064E3B]">Extra Charges</div>
              <div className="text-xs text-[#64748B]">Packing, handling, service, insurance, etc. Toggle any one off to skip it.</div>
            </div>
          </div>
          <button onClick={addExtra} className="btn-outline text-sm" data-testid="add-extra-charge-btn"><Plus className="w-4 h-4"/>Add</button>
        </div>

        {(!site.extra_charges || site.extra_charges.length === 0) && (
          <div className="text-center py-8 text-sm text-[#94A3B8] border-2 border-dashed border-[#E2E8F0] rounded-2xl">
            No extra charges yet. Click <b>Add</b> to create one.
          </div>
        )}

        <div className="space-y-3">
          {(site.extra_charges || []).map((c, i) => (
            <div key={c.key || i} className="grid grid-cols-12 gap-2 items-end bg-[#FAFAF9] rounded-2xl p-3" data-testid={`extra-charge-${i}`}>
              <div className="col-span-4">
                <label className="text-[10px] font-bold uppercase text-[#94A3B8] tracking-wider">Label</label>
                <input className="input-soft mt-1" value={c.label} onChange={(e) => updateExtra(i, { label: e.target.value })} placeholder="e.g. Packing Fee" data-testid={`extra-label-${i}`}/>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] font-bold uppercase text-[#94A3B8] tracking-wider">Type</label>
                <select className="input-soft mt-1" value={c.type} onChange={(e) => updateExtra(i, { type: e.target.value })} data-testid={`extra-type-${i}`}>
                  <option value="flat">Flat ₹</option>
                  <option value="percent">Percent %</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase text-[#94A3B8] tracking-wider">Value</label>
                <input type="number" min={0} className="input-soft mt-1 font-numbers" value={c.value} onChange={(e) => updateExtra(i, { value: +e.target.value })} data-testid={`extra-value-${i}`}/>
              </div>
              <div className="col-span-2 flex justify-center">
                <ToggleSwitch on={c.enabled} onChange={(v) => updateExtra(i, { enabled: v })} testid={`extra-toggle-${i}`}/>
              </div>
              <div className="col-span-1 flex justify-end">
                <button onClick={() => removeExtra(i)} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center" data-testid={`extra-remove-${i}`}>
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end sticky bottom-4 z-10">
        <button onClick={save} disabled={busy} className="btn-primary shadow-lg" data-testid="save-charges-btn">
          {busy ? "Saving…" : <><Save className="w-4 h-4"/> Save all changes</>}
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({ on, onChange, testid }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1 font-semibold text-sm ${on ? "text-[#65A30D]" : "text-[#94A3B8]"}`}
      data-testid={testid}
    >
      {on ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}
      {on ? "ON" : "OFF"}
    </button>
  );
}
