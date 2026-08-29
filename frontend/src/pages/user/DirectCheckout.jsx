import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, Copy, QrCode, Smartphone, CheckCircle2, Clock, Loader2 } from "lucide-react";
import api from "@/lib/api";

/** Direct checkout for a pre-created order — UroPay QR + UTR flow.
 * 1. Initiate → get uroPayOrderId + qrCode + upiString
 * 2. User pays via any UPI app (scan QR or tap link)
 * 3. User enters the 12-digit UTR → we submit to UroPay
 * 4. Poll /verify every 5s until COMPLETED or 3 minutes elapse
 */
export default function DirectCheckout() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [pay, setPay] = useState(null); // {upi_string, qr_code, uro_pay_order_id, amount_in_rupees}
  const [step, setStep] = useState("review"); // review | paying | submitted | done
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(({ data }) => {
      setOrder(data);
      if (data.payment_status === "paid") setStep("done");
    }).catch(() => toast.error("Order not found"));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId]);

  const initiate = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/uropay/initiate", { order_id: orderId });
      setPay(data); setStep("paying");
      startPolling();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start payment");
    } finally { setBusy(false); }
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    const start = Date.now();
    pollRef.current = setInterval(async () => {
      // Stop after 3 minutes to preserve battery
      if (Date.now() - start > 3 * 60_000) { clearInterval(pollRef.current); return; }
      try {
        const { data } = await api.post("/payments/uropay/verify", { order_id: orderId });
        if (data.paid) {
          clearInterval(pollRef.current);
          setStep("done");
          toast.success("Payment confirmed! Your business is now active.");
          setTimeout(() => nav("/dashboard/businesses"), 1600);
        }
      } catch { /* keep polling on transient errors */ }
    }, 5000);
  };

  const submitUtr = async () => {
    const cleaned = utr.replace(/\D/g, "");
    if (cleaned.length < 6) return toast.error("Please enter the 12-digit UPI reference number from your payment app");
    setBusy(true);
    try {
      await api.post("/payments/uropay/submit-utr", { order_id: orderId, utr: cleaned });
      setStep("submitted");
      toast.success("UTR submitted — waiting for confirmation…");
      startPolling();
    } catch (e) { toast.error(e?.response?.data?.detail || "UTR submission failed"); }
    finally { setBusy(false); }
  };

  const copy = (v) => { navigator.clipboard.writeText(v); toast.success("Copied!"); };

  if (!order) return <div className="p-12 text-center text-[#64748B]">Loading order…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="direct-checkout-page">
      <div className="rounded-3xl bg-gradient-to-br from-[#064E3B] to-[#065F46] text-white p-6">
        <div className="flex items-center gap-2 text-[#84CC16] text-xs uppercase font-bold tracking-widest"><Sparkles className="w-4 h-4"/> Activate your business</div>
        <div className="font-display font-black text-3xl mt-1">Pay the Kit</div>
        <div className="text-sm text-white/70 mt-1">One-time ₹{order.total} — unlocks your new referral code and starts your business.</div>
      </div>

      <div className="card-soft p-5 space-y-2 text-sm">
        <div className="flex justify-between"><span>Order</span><span className="font-mono font-semibold">{order.order_code}</span></div>
        {order.items?.map((i) => (
          <div key={i.product_id} className="flex justify-between"><span>{i.name}</span><span>₹{i.line_total}</span></div>
        ))}
        <div className="border-t pt-2 flex justify-between font-black text-xl text-[#064E3B]"><span>Total</span><span>₹{order.total}</span></div>
      </div>

      {step === "review" && (
        <button onClick={initiate} disabled={busy || order.payment_status === "paid"} className="btn-primary w-full justify-center text-lg py-3" data-testid="direct-pay-btn">
          {order.payment_status === "paid" ? "✓ Already paid" : busy ? "Generating QR…" : <><QrCode className="w-5 h-5"/> Pay ₹{order.total} via UPI</>}
        </button>
      )}

      {step === "paying" && pay && (
        <div className="card-soft p-5 space-y-4" data-testid="uropay-qr-step">
          <div className="text-center">
            <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-[#65A30D] bg-[#ECFCCB] px-2 py-1 rounded-full"><Clock className="w-3 h-3"/> Awaiting your payment</div>
            <h3 className="font-display font-black text-xl text-[#064E3B] mt-2">Step 1 · Pay ₹{order.total}</h3>
            <p className="text-xs text-[#64748B] mt-1">Scan the QR with any UPI app or tap the button on mobile.</p>
          </div>
          <div className="flex justify-center">
            <img src={pay.qr_code} alt="UPI QR" className="w-64 h-64 rounded-2xl border-4 border-[#84CC16] shadow-lg" data-testid="uropay-qr-img"/>
          </div>
          {isMobile && (
            <a href={pay.upi_string} className="btn-primary w-full justify-center" data-testid="uropay-upi-intent">
              <Smartphone className="w-4 h-4"/> Open any UPI app
            </a>
          )}
          <div className="flex items-center justify-between text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl p-2">
            <span className="font-mono truncate mr-2">{pay.uro_pay_order_id}</span>
            <button onClick={() => copy(pay.upi_string)} className="inline-flex items-center gap-1 font-semibold text-[#065F46]" data-testid="uropay-copy-upi"><Copy className="w-3 h-3"/> Copy UPI link</button>
          </div>

          <div className="border-t border-[#F1F5F9] pt-4 space-y-2">
            <h4 className="font-display font-bold text-[#064E3B]">Step 2 · Enter your UPI reference number</h4>
            <p className="text-xs text-[#64748B]">After paying, open your UPI app → tap the transaction → copy the 12-digit UPI Reference Number (also called UTR).</p>
            <input
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 20))}
              placeholder="e.g. 421234567890"
              inputMode="numeric"
              className="input-soft font-mono tracking-widest text-center text-lg"
              data-testid="uropay-utr-input"
            />
            <button onClick={submitUtr} disabled={busy || utr.length < 6} className="btn-primary w-full justify-center" data-testid="uropay-submit-utr">
              {busy ? "Submitting…" : <><CheckCircle2 className="w-4 h-4"/> I&apos;ve paid — Confirm</>}
            </button>
          </div>
        </div>
      )}

      {step === "submitted" && (
        <div className="card-soft p-6 text-center space-y-3" data-testid="uropay-waiting">
          <Loader2 className="w-10 h-10 text-[#65A30D] mx-auto animate-spin"/>
          <div className="font-display font-black text-xl text-[#064E3B]">Confirming your payment…</div>
          <div className="text-xs text-[#64748B]">This usually takes under 30 seconds. Keep this page open — we&apos;ll auto-activate your business the moment UroPay confirms the transaction.</div>
        </div>
      )}

      {step === "done" && (
        <div className="card-soft p-6 text-center space-y-3 bg-gradient-to-br from-[#ECFCCB]/60 to-white border-[#84CC16]" data-testid="uropay-done">
          <div className="w-14 h-14 rounded-full bg-[#84CC16] text-white flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8"/></div>
          <div className="font-display font-black text-xl text-[#064E3B]">Payment successful!</div>
          <div className="text-xs text-[#64748B]">Your business is now active. Redirecting to your dashboard…</div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-[#64748B]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#65A30D]"/> Powered by UroPay · UPI direct-to-bank · Zero processing fee
      </div>
    </div>
  );
}
