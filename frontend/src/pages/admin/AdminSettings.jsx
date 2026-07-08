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
    try { await api.put("/admin/settings/mlm", mlm); toast.success("MLM saved"); }
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

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">Razorpay (Currently MOCK)</h3>
        <Input label="Razorpay Key ID" v={site.razorpay_key_id || ""} on={upd("razorpay_key_id")} testid="razorpay-key-id"/>
        <Input label="Razorpay Key Secret" v={site.razorpay_key_secret || ""} on={upd("razorpay_key_secret")} testid="razorpay-key-secret"/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!site.razorpay_enabled} onChange={upd("razorpay_enabled")}/> Enable Razorpay live</label>
      </div>

      <div className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold text-lg">MLM Settings</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Total Stages" type="number" v={mlm.stages_total} on={updMlm("stages_total")}/>
          <Input label="Referrals per Stage" type="number" v={mlm.referrals_per_stage} on={updMlm("referrals_per_stage")}/>
          <Input label="Joining Amount" type="number" v={mlm.joining_amount} on={updMlm("joining_amount")}/>
        </div>
        <button onClick={saveMlm} disabled={busy} className="btn-primary" data-testid="save-mlm-settings">Save MLM Settings</button>
      </div>
    </div>
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
