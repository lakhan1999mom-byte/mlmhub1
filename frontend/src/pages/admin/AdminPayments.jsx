import { useEffect, useState } from "react";
import { CreditCard, Info, Zap, ShieldCheck } from "lucide-react";
import api from "@/lib/api";

/** Admin — Payment Gateway status.
 * IMBPay is the ONLY provider. Its API token is set via server .env (IMBPAY_TOKEN),
 * not editable from the admin UI to avoid accidentally shipping a bad key to production.
 * Contact the dev team to rotate. */
export default function AdminPayments() {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    api.get("/admin/payment-config").then(({ data }) => setCfg(data)).catch(() => setCfg({}));
  }, []);

  if (!cfg) return <div className="p-10 text-center text-[#64748B]">Loading…</div>;
  const isLive = !!cfg.imbpay_active;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="admin-payments-page">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#064E3B]">Payment Gateway</h1>
        <p className="text-sm text-[#64748B]">IMBPay is the only supported provider. All payments are real — no test/mock mode.</p>
      </div>

      <div className={`card-soft p-6 flex items-center gap-4 ${isLive ? "border-[#84CC16] bg-[#ECFCCB]/40" : "border-red-200 bg-red-50/40"}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isLive ? "bg-[#84CC16]" : "bg-red-500"}`}>
          <Zap className="w-6 h-6 text-white"/>
        </div>
        <div className="flex-1">
          <div className="font-display font-black text-[#064E3B] text-lg">
            {isLive ? "LIVE — Real payments captured via IMBPay" : "NOT CONFIGURED — Set IMBPAY_TOKEN in backend .env"}
          </div>
          <div className="text-xs text-[#64748B]" data-testid="imbpay-status-text">
            {isLive ? `Token ends in ${(cfg.imbpay_token_masked || "").slice(-4)} · Base: ${cfg.imbpay_base_url}` : "Contact dev team to configure the merchant API token."}
          </div>
        </div>
      </div>

      <div className="card-soft p-6" data-testid="pg-imbpay-config">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#65A30D]"/>
            <div className="font-display font-bold text-[#064E3B]">IMBPay v2 Configuration</div>
          </div>
          <div className={`text-xs font-semibold px-3 py-1 rounded-full ${isLive ? "bg-[#ECFCCB] text-[#65A30D]" : "bg-red-100 text-red-700"}`} data-testid="imb-status-badge">
            {isLive ? "✓ Live" : "Not configured"}
          </div>
        </div>

        <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-xs text-[#1E40AF] flex gap-2 mb-4">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <div>
            The IMBPay merchant token is loaded from <code className="font-mono">backend/.env</code> (<span className="font-mono">IMBPAY_TOKEN</span>). Rotating the key requires a redeploy. Endpoint used: <span className="font-mono">POST {cfg.imbpay_base_url}/v2/create-order</span>.
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">Provider</div>
            <div className="font-display font-bold text-[#064E3B]">IMBPay</div>
          </div>
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">API Token</div>
            <div className="font-mono text-sm text-[#064E3B]">{cfg.imbpay_token_masked || "—"}</div>
          </div>
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">Base URL</div>
            <div className="font-mono text-sm text-[#064E3B] break-all">{cfg.imbpay_base_url}</div>
          </div>
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">Mode</div>
            <div className="font-display font-bold text-[#064E3B]">Production · Real payments</div>
          </div>
        </div>
      </div>

      <div className="card-soft p-6 bg-gradient-to-br from-[#ECFCCB]/50 to-white">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-[#65A30D]"/>
          <div className="font-display font-bold text-[#064E3B]">How the flow works</div>
        </div>
        <ol className="text-xs text-[#64748B] space-y-1 list-decimal list-inside">
          <li>User places an order → backend creates it and calls <span className="font-mono">/v2/create-order</span>.</li>
          <li>Backend returns the IMBPay hosted <span className="font-mono">payment_url</span>. Frontend redirects the user there.</li>
          <li>User pays via UPI (PhonePe / GPay / Paytm / BHIM) on the IMBPay page.</li>
          <li>IMBPay redirects to <span className="font-mono">/orders/&lt;id&gt;?imbpay=1</span>. Frontend calls <span className="font-mono">/payments/imbpay/verify</span> → backend confirms via <span className="font-mono">/v2/check-order-status</span>.</li>
          <li>Order is marked paid, stock decremented, MLM commissions distributed (if joining kit).</li>
        </ol>
      </div>
    </div>
  );
}
