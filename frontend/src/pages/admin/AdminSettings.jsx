import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AllSizesTable } from "@/components/ImageSizeGuide";

export default function AdminSettings() {
  const { user } = useAuth();
  const [site, setSite] = useState(null);
  const [mlm, setMlm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/admin/settings").then(({ data }) => { setSite(data.site); setMlm(data.mlm); }); }, []);
  if (!site || !mlm) return <div className="p-8 text-center">Loading…</div>;
  if (user?.role !== "super_admin") return <div className="card-soft p-12 text-center">Only Super Admin can access settings</div>;

  const saveSite = async () => {
    setBusy(true);
    try { await api.put("/admin/settings/site", site); toast.success("Site saved"); }
    catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };
  const saveMlm = async () => {
    setBusy(true);
    try { await api.put("/admin/settings/mlm", mlm); toast.success("Rewards settings saved"); }
    catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const upd = (k) => (e) => setSite({ ...site, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const updMlm = (k) => (e) => setMlm({ ...mlm, [k]: +e.target.value });

  return (
    <div className="space-y-6" data-testid="admin-settings-page">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <AllSizesTable/>

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">Site</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Site Name" v={site.site_name} on={upd("site_name")}/>
          <Input label="Tagline" v={site.tagline} on={upd("tagline")}/>
          <Input label="Phone" v={site.phone} on={upd("phone")}/>
          <Input label="Email" v={site.email} on={upd("email")}/>
          <Input label="WhatsApp" v={site.whatsapp} on={upd("whatsapp")}/>
          <Input label="Address" v={site.address} on={upd("address")}/>
          <Input label="Facebook" v={site.facebook} on={upd("facebook")}/>
          <Input label="Instagram" v={site.instagram} on={upd("instagram")}/>
          <Input label="YouTube" v={site.youtube} on={upd("youtube")}/>
          <Input label="Logo URL" v={site.logo_url} on={upd("logo_url")}/>
        </div>
        <Input label="Notification Bar Text" v={site.notification_bar_text} on={upd("notification_bar_text")}/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={site.notification_bar_enabled} onChange={upd("notification_bar_enabled")}/> Show notification bar</label>
        <button onClick={saveSite} disabled={busy} className="btn-primary" data-testid="save-site-settings">Save Site Settings</button>
      </div>

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">Delivery & GST</h3>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-[#FEE2E2] border border-[#DC2626]/30 rounded-xl">
          <input
            type="checkbox"
            checked={site.delivery_charge_enabled !== false}
            onChange={(e) => setSite({...site, delivery_charge_enabled: e.target.checked})}
            className="accent-[#DC2626] w-4 h-4"
            data-testid="delivery-charge-enabled-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#7F1D1D]">Charge delivery fee to customers</div>
            <div className="text-xs text-[#991B1B]">When OFF, all orders get FREE shipping regardless of amount.</div>
          </div>
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input label="Delivery Charge (₹)" type="number" v={site.delivery_charge} on={(e) => setSite({...site, delivery_charge: +e.target.value})} testid="delivery-charge"/>
          <Input label="Free Shipping Above (₹)" type="number" v={site.free_shipping_threshold} on={(e) => setSite({...site, free_shipping_threshold: +e.target.value})} testid="free-shipping-threshold"/>
          <Input label="GST %" type="number" v={site.gst_percent} on={(e) => setSite({...site, gst_percent: +e.target.value})} testid="gst-percent"/>
        </div>
      </div>

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">Terms & Conditions</h3>
        <p className="text-xs text-[#64748B]">HTML supported. Current version: <b>{site.terms_version || "1.0"}</b></p>
        <Input label="Version" v={site.terms_version || "1.0"} on={upd("terms_version")}/>
        <div>
          <label className="text-sm font-semibold">Content (HTML)</label>
          <textarea className="input-soft mt-1 min-h-[300px] font-mono text-xs" value={site.terms_content || ""} onChange={upd("terms_content")} data-testid="terms-content-editor"/>
        </div>
      </div>

      {/* META PIXEL */}
      <div className="card-soft p-6 space-y-3" data-testid="admin-meta-pixel-card">
        <h3 className="font-display font-bold text-lg">Meta Pixel (Facebook)</h3>
        <p className="text-xs text-[#64748B]">Paste your Facebook Pixel ID OR a custom pixel script below. Saving overwrites the previously injected code. Delete either field's content and Save to remove tracking entirely.</p>
        <Input label="Meta Pixel ID (recommended)" v={site.meta_pixel_id || ""} on={upd("meta_pixel_id")} testid="meta-pixel-id-input"/>
        <div>
          <label className="text-sm font-semibold">Custom Pixel Script (optional — overrides ID)</label>
          <textarea
            className="input-soft mt-1 min-h-[160px] font-mono text-xs"
            value={site.meta_pixel_code || ""}
            onChange={upd("meta_pixel_code")}
            placeholder="!function(...){...}(); fbq('init','000000');"
            data-testid="meta-pixel-code-editor"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveSite} disabled={busy} className="btn-primary" data-testid="save-meta-pixel">Save Meta Pixel</button>
          <button
            onClick={() => {
              setSite({...site, meta_pixel_id: "", meta_pixel_code: ""});
              setTimeout(saveSite, 50);
            }}
            className="btn-outline"
            data-testid="clear-meta-pixel"
          >
            Delete Old Code
          </button>
        </div>
      </div>

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">Razorpay (Currently MOCK)</h3>
        <Input label="Razorpay Key ID" v={site.razorpay_key_id || ""} on={upd("razorpay_key_id")} testid="razorpay-key-id"/>
        <Input label="Razorpay Key Secret" v={site.razorpay_key_secret || ""} on={upd("razorpay_key_secret")} testid="razorpay-key-secret"/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!site.razorpay_enabled} onChange={upd("razorpay_enabled")}/> Enable Razorpay live</label>
      </div>

      {/* PAYMENT GATEWAY MASTER SWITCH */}
      <div className="card-soft p-6 space-y-3 border-2 border-[#FCA5A5]" data-testid="admin-payment-gateway-card">
        <h3 className="font-display font-bold text-lg">Payment Gateway (Master Switch)</h3>
        <p className="text-xs text-[#64748B]">Nothing accepts payments until you enable a gateway here. Customers see a "Payment gateway not configured" screen when this is <b>None</b>.</p>
        <div>
          <label className="text-sm font-semibold">Active gateway</label>
          <select
            className="input-soft mt-1"
            value={site.active_payment_gateway || "none"}
            onChange={(e) => setSite({...site, active_payment_gateway: e.target.value})}
            data-testid="active-payment-gateway-select"
          >
            <option value="none">None — online payments disabled</option>
            <option value="uropay">UroPay (QR + UTR)</option>
            <option value="razorpay">Razorpay (Cards / UPI / Netbanking)</option>
            <option value="manual">Manual (Bank transfer / offline)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer" data-testid="cod-toggle-label">
          <input
            type="checkbox"
            checked={!site.cod_disabled}
            onChange={(e) => setSite({...site, cod_disabled: !e.target.checked})}
            data-testid="cod-toggle-checkbox"
          />
          <span>Accept <b>Cash on Delivery</b> (COD) — enabled by default. Uncheck to force customers into online payment.</span>
        </label>
        <button onClick={saveSite} disabled={busy} className="btn-primary" data-testid="save-payment-gateway">Save Payment Settings</button>
      </div>

      {/* SALES-AGENT COMMISSION */}
      <div className="card-soft p-6 space-y-3" data-testid="admin-agent-commission-card">
        <h3 className="font-display font-bold text-lg">Sales Agent Commission</h3>
        <p className="text-xs text-[#64748B]">Percentage of every qualifying paid order that a sales agent (and their downline) earns. Commission depends entirely on sales — no fixed income is committed.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-[#7F1D1D]">Agent own-sale commission (%)</label>
            <input type="number" step="0.1" min="0" max="100" className="input-soft mt-1" value={site.agent_commission_percent ?? 5} onChange={(e) => setSite({...site, agent_commission_percent: Number(e.target.value)})} data-testid="agent-commission-input"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#7F1D1D]">Downline commission (%)</label>
            <input type="number" step="0.1" min="0" max="100" className="input-soft mt-1" value={site.agent_downline_commission_percent ?? 2} onChange={(e) => setSite({...site, agent_downline_commission_percent: Number(e.target.value)})} data-testid="agent-downline-commission-input"/>
          </div>
        </div>
        <button onClick={saveSite} disabled={busy} className="btn-primary" data-testid="save-agent-commission">Save Commission</button>
      </div>

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">Rewards Settings</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Total Stages" type="number" v={mlm.stages_total} on={updMlm("stages_total")}/>
          <Input label="Referrals per Stage" type="number" v={mlm.referrals_per_stage} on={updMlm("referrals_per_stage")}/>
          <Input label="Joining Amount" type="number" v={mlm.joining_amount} on={updMlm("joining_amount")}/>
        </div>
        <button onClick={saveMlm} disabled={busy} className="btn-primary" data-testid="save-mlm-settings">Save Rewards Settings</button>
      </div>

      <SelfPasswordCard/>

      <DangerZoneCard/>
    </div>
  );
}

function SelfPasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 6) return toast.error("New password must be at least 6 characters");
    if (next !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to update"); }
    finally { setBusy(false); }
  };

  return (
    <div className="card-soft p-6 space-y-3" data-testid="admin-self-password-card">
      <h3 className="font-display font-bold text-lg">Change my password</h3>
      <p className="text-xs text-[#64748B]">Sign yourself in again after saving.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <Input label="Current password" type="password" v={current} on={(e) => setCurrent(e.target.value)} testid="admin-cur-pw"/>
        <Input label="New password (min 6)" type="password" v={next} on={(e) => setNext(e.target.value)} testid="admin-new-pw"/>
        <Input label="Confirm new password" type="password" v={confirm} on={(e) => setConfirm(e.target.value)} testid="admin-confirm-pw"/>
      </div>
      <button onClick={submit} disabled={busy} className="btn-primary" data-testid="admin-change-my-password">Update password</button>
    </div>
  );
}

function DangerZoneCard() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const nuke = async () => {
    if (confirmText !== "RESET") return toast.error("Type RESET (in caps) to confirm");
    setBusy(true);
    try {
      const { data } = await api.post("/admin/fresh-start", { confirm: "RESET" });
      setLastResult(data);
      toast.success("Fresh start complete");
      setOpen(false); setConfirmText("");
    } catch (e) { toast.error(e?.response?.data?.detail || "Fresh start failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="card-soft p-6 space-y-3 border-2 border-red-200 bg-gradient-to-br from-red-50 to-white" data-testid="admin-danger-zone">
      <h3 className="font-display font-bold text-lg text-red-700">⚠ Danger Zone — Fresh Start</h3>
      <p className="text-sm text-red-800">Hard-deletes every non-admin user + their orders, referral businesses, withdrawals, KYC, notifications and transactions. Admin accounts, products, categories, coupons, settings and site content are preserved. There is no undo.</p>
      {lastResult && (
        <div className="rounded-xl bg-white border border-red-200 p-3 text-xs text-red-800 font-mono" data-testid="fresh-start-result">
          Last run: {JSON.stringify(lastResult.stats)}
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full px-5 py-2 text-sm" data-testid="admin-fresh-start-open">
          Reset production data…
        </button>
      ) : (
        <div className="rounded-2xl bg-white border border-red-300 p-4 space-y-3">
          <div className="text-sm text-red-800">Type <b className="font-mono">RESET</b> (in capital letters) to confirm.</div>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="input-soft font-mono border-red-300" placeholder="RESET" data-testid="admin-fresh-start-confirm-input"/>
          <div className="flex gap-2">
            <button onClick={() => { setOpen(false); setConfirmText(""); }} className="btn-outline text-sm">Cancel</button>
            <button onClick={nuke} disabled={busy || confirmText !== "RESET"} className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold rounded-full px-4 py-2 text-sm" data-testid="admin-fresh-start-confirm">
              {busy ? "Wiping…" : "Wipe everything"}
            </button>
          </div>
        </div>
      )}
      <div className="pt-3 border-t border-red-100">
        <h4 className="font-display font-bold text-red-700 text-sm">Refresh FAQ copy</h4>
        <p className="text-xs text-red-800/80 mb-2">Overwrites the public FAQs with the current master text (fixes stale ₹2,999 / 3-stages copy in production).</p>
        <RefreshFaqsButton/>
      </div>
    </div>
  );
}

function RefreshFaqsButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/refresh-faqs");
      toast.success(`${data.count} FAQs refreshed`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <button onClick={run} disabled={busy} className="bg-white border border-red-300 hover:border-red-500 text-red-700 font-semibold rounded-full px-4 py-1.5 text-xs" data-testid="admin-refresh-faqs-btn">
      {busy ? "Refreshing…" : "Refresh FAQs now"}
    </button>
  );
}

function Input({ label, v, on, type = "text", testid }) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <input className="input-soft mt-1" type={type} value={v || ""} onChange={on} data-testid={testid}/>
    </div>
  );
}
