import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Info, Check, X } from "lucide-react";
import api from "@/lib/api";

export default function AdminPayments() {
  const [cfg, setCfg] = useState({
    provider: "easebuzz",
    cashfree_app_id: "",
    cashfree_secret_key: "",
    cashfree_env: "sandbox",
    cashfree_active: false,
    easebuzz_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/payment-config");
      setCfg({
        provider: data.provider || "easebuzz",
        cashfree_app_id: data.cashfree_app_id || "",
        cashfree_secret_key: "",  // never populated back
        cashfree_env: data.cashfree_env || "sandbox",
        cashfree_active: !!data.cashfree_active,
        easebuzz_active: data.easebuzz_active !== false,
      });
      setMasked({ cashfree_secret: data.cashfree_secret_masked });
    } catch { /* ignore load error */ }
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...cfg };
      if (!payload.cashfree_secret_key) delete payload.cashfree_secret_key;  // don't overwrite with blank
      await api.post("/admin/payment-config", payload);
      toast.success("Payment config saved. Changes are live immediately.");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save");
    } finally { setBusy(false); }
  };

  const isCashfreeReady = cfg.cashfree_app_id && (cfg.cashfree_secret_key || masked.cashfree_secret);

  return (
    <div className="space-y-6 max-w-3xl" data-testid="admin-payments-page">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#064E3B]">Payment Gateway</h1>
        <p className="text-sm text-[#64748B]">Enter merchant keys and activate. Changes go live instantly — no redeploy needed.</p>
      </div>

      {/* Active Provider Selector */}
      <div className="card-soft p-6" data-testid="pg-provider-selector">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-[#65A30D]"/>
          <div className="font-display font-bold text-[#064E3B]">Active Payment Provider</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "cashfree", label: "Cashfree", tag: "Recommended", disabled: !isCashfreeReady },
            { key: "easebuzz", label: "Easebuzz", tag: "Live" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => !p.disabled && setCfg({ ...cfg, provider: p.key })}
              disabled={p.disabled}
              className={`p-4 rounded-2xl border-2 text-left transition ${cfg.provider === p.key ? "border-[#84CC16] bg-[#ECFCCB]" : "border-[#E2E8F0] bg-white"} ${p.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              data-testid={`pg-provider-${p.key}`}
            >
              <div className="font-display font-bold text-[#064E3B] flex items-center gap-2">
                {p.label}
                <span className="text-[10px] bg-[#84CC16] text-[#064E3B] px-2 py-0.5 rounded-full font-bold">{p.tag}</span>
              </div>
              <div className="text-xs text-[#64748B] mt-1">
                {cfg.provider === p.key ? "✓ Currently active" : (p.disabled ? "Configure keys first" : "Click to activate")}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cashfree Config */}
      <div className="card-soft p-6" data-testid="pg-cashfree-config">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display font-bold text-[#064E3B]">Cashfree Configuration</div>
          <div className={`text-xs font-semibold px-3 py-1 rounded-full ${isCashfreeReady ? "bg-[#ECFCCB] text-[#65A30D]" : "bg-[#FEF3C7] text-[#92400E]"}`} data-testid="cf-status-badge">
            {isCashfreeReady ? "✓ Ready" : "Not configured"}
          </div>
        </div>
        <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-xs text-[#1E40AF] flex gap-2 mb-4">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <div>
            Get your keys from <a href="https://merchant.cashfree.com/merchants/pg/developers/api-keys" target="_blank" rel="noreferrer noopener" className="underline font-semibold">Cashfree Dashboard → Developers → API Keys</a>. Toggle Sandbox first to test, then flip to Production.
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">App ID (Client ID)</label>
            <input
              className="input-soft mt-1 font-mono"
              value={cfg.cashfree_app_id}
              onChange={(e) => setCfg({ ...cfg, cashfree_app_id: e.target.value.trim() })}
              placeholder="e.g. CF12345_TEST"
              data-testid="cf-app-id-input"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">Secret Key</label>
            <input
              className="input-soft mt-1 font-mono"
              type="password"
              value={cfg.cashfree_secret_key}
              onChange={(e) => setCfg({ ...cfg, cashfree_secret_key: e.target.value.trim() })}
              placeholder={masked.cashfree_secret || "cfsk_..."}
              data-testid="cf-secret-input"
            />
            {masked.cashfree_secret && (
              <p className="text-[10px] text-[#65A30D] mt-1">
                ✓ Current secret ends in <span className="font-mono">{masked.cashfree_secret.slice(-4)}</span> — leave blank to keep it, paste a new one to replace.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-[#064E3B]">Environment:</label>
            <div className="inline-flex bg-[#F1F5F9] p-1 rounded-full">
              {["sandbox", "prod"].map((env) => (
                <button
                  key={env}
                  onClick={() => setCfg({ ...cfg, cashfree_env: env })}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold ${cfg.cashfree_env === env ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`}
                  data-testid={`cf-env-${env}`}
                >
                  {env === "prod" ? "🟢 Production" : "🧪 Sandbox"}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.cashfree_active}
              onChange={(e) => setCfg({ ...cfg, cashfree_active: e.target.checked })}
              className="accent-[#84CC16]"
              data-testid="cf-active-toggle"
            />
            <span className="font-semibold text-[#064E3B]">Activate Cashfree</span>
            <span className="text-xs text-[#64748B]">— required for the gateway to actually accept payments</span>
          </label>
        </div>
      </div>

      {/* Easebuzz status (env-driven, read-only for now) */}
      <div className="card-soft p-6" data-testid="pg-easebuzz-config">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-bold text-[#064E3B]">Easebuzz (Legacy)</div>
          <div className="text-xs text-[#65A30D] bg-[#ECFCCB] px-3 py-1 rounded-full font-semibold flex items-center gap-1">
            <Check className="w-3 h-3"/> Configured via env vars
          </div>
        </div>
        <p className="text-xs text-[#64748B]">
          Easebuzz keys (Merchant Key + Salt) are loaded from server .env variables. Kept as a fallback provider — switch back if Cashfree has issues.
        </p>
      </div>

      <div className="flex justify-end sticky bottom-0 bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-[#E2E8F0]">
        <button
          onClick={save}
          disabled={busy}
          className="btn-primary"
          data-testid="pg-save-btn"
        >
          {busy ? "Saving…" : "Save & Activate"}
        </button>
      </div>
    </div>
  );
}
