import { useEffect, useState } from "react";
import { CreditCard, Info, Zap, ShieldCheck } from "lucide-react";
import api from "@/lib/api";

/** Admin — Payment Gateway status. UroPay is the ONLY provider. Keys live in backend .env. */
export default function AdminPayments() {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    api.get("/admin/payment-config").then(({ data }) => setCfg(data)).catch(() => setCfg({}));
  }, []);

  if (!cfg) return <div className="p-10 text-center text-[#64748B]">Loading…</div>;
  const isLive = !!cfg.uropay_active;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="admin-payments-page">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#7F1D1D]">Payment Gateway</h1>
        <p className="text-sm text-[#64748B]">UroPay is the only supported provider. All payments are real — no test/mock mode.</p>
      </div>

      <div className={`card-soft p-6 flex items-center gap-4 ${isLive ? "border-[#DC2626] bg-[#FEE2E2]/40" : "border-red-200 bg-red-50/40"}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isLive ? "bg-[#DC2626]" : "bg-red-500"}`}>
          <Zap className="w-6 h-6 text-white"/>
        </div>
        <div className="flex-1">
          <div className="font-display font-black text-[#7F1D1D] text-lg">
            {isLive ? "LIVE — Real UPI payments captured via UroPay" : "NOT CONFIGURED — Set UROPAY_API_KEY & UROPAY_API_SECRET in backend .env"}
          </div>
          <div className="text-xs text-[#64748B]" data-testid="uropay-status-text">
            {isLive
              ? `Key ends in ${(cfg.uropay_key_masked || "").slice(-4)} · Base: ${cfg.uropay_api_url}`
              : "Log in to your UroPay dashboard → API Keys → Regenerate, then update the backend .env and restart."}
          </div>
        </div>
      </div>

      <div className="card-soft p-6" data-testid="pg-uropay-config">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#B91C1C]"/>
            <div className="font-display font-bold text-[#7F1D1D]">UroPay Configuration</div>
          </div>
          <div className={`text-xs font-semibold px-3 py-1 rounded-full ${isLive ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-red-100 text-red-700"}`} data-testid="up-status-badge">
            {isLive ? "✓ Live" : "Not configured"}
          </div>
        </div>

        <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-xs text-[#7F1D1D] flex gap-2 mb-4">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <div>
            UroPay uses a QR + UTR self-serve UPI flow. Keys load from <code className="font-mono">backend/.env</code> (<span className="font-mono">UROPAY_API_KEY</span>, <span className="font-mono">UROPAY_API_SECRET</span>). Auth is <span className="font-mono">Authorization: Bearer sha512(secret)</span>. Rotating keys requires a redeploy. Endpoint: <span className="font-mono">POST {cfg.uropay_api_url}/order/generate</span>.
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">Provider</div>
            <div className="font-display font-bold text-[#7F1D1D]">UroPay</div>
          </div>
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">API Key</div>
            <div className="font-mono text-sm text-[#7F1D1D]">{cfg.uropay_key_masked || "—"}</div>
          </div>
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">API Secret</div>
            <div className="font-mono text-sm text-[#7F1D1D]">{cfg.uropay_secret_masked || "—"}</div>
          </div>
          <div className="rounded-2xl bg-[#FAFAF9] border border-[#E2E8F0] p-3">
            <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">Base URL</div>
            <div className="font-mono text-sm text-[#7F1D1D] break-all">{cfg.uropay_api_url}</div>
          </div>
        </div>
      </div>

      <div className="card-soft p-6 bg-gradient-to-br from-[#FEE2E2]/50 to-white">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-[#B91C1C]"/>
          <div className="font-display font-bold text-[#7F1D1D]">How the flow works</div>
        </div>
        <ol className="text-xs text-[#64748B] space-y-1 list-decimal list-inside">
          <li>Customer places an order → backend calls UroPay <span className="font-mono">/order/generate</span>.</li>
          <li>UroPay returns a QR code + <span className="font-mono">upi://</span> deep-link. Frontend shows both.</li>
          <li>Customer scans QR (or taps link on mobile) → pays via any UPI app.</li>
          <li>Customer enters the 12-digit UPI Reference Number (UTR) shown in their UPI app.</li>
          <li>Frontend calls <span className="font-mono">/payments/uropay/submit-utr</span> → backend calls UroPay <span className="font-mono">PATCH /order/update</span>.</li>
          <li>UroPay Companion App on your admin phone reads the incoming SMS → hits <span className="font-mono">POST /webhooks/uropay</span> on our server. Frontend polls <span className="font-mono">/payments/uropay/verify</span> as a fallback.</li>
          <li>Order flips to paid, stock decrements, MLM commissions distribute (if joining kit).</li>
        </ol>
      </div>

      <div className="card-soft p-6 bg-amber-50/60 border-amber-200">
        <div className="font-display font-bold text-amber-900 text-sm">📱 UroPay Companion App required</div>
        <p className="text-xs text-amber-800 mt-1">Install the UroPay Companion Android app on the phone that receives your UPI credit SMS. It reads the SMS and pushes the payment confirmation to UroPay. Without it, orders stay in <span className="font-mono">UTR_SUBMITTED</span> state until the manual review queue processes them.</p>
      </div>
    </div>
  );
}
