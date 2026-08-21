import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Sparkles, ShieldCheck } from "lucide-react";
import api from "@/lib/api";

/** Direct checkout for a pre-created order (e.g. business kit order).
 * Uses IMBPay: creates a live order, redirects to the hosted payment_url. */
export default function DirectCheckout() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data)).catch(() => toast.error("Order not found"));
  }, [orderId]);

  // Auto-verify if we just came back from the IMBPay hosted page (?imbpay=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("imbpay")) return;
    (async () => {
      try {
        const { data } = await api.post("/payments/imbpay/verify", { order_id: orderId });
        if (data.paid) {
          toast.success("Payment successful! Order confirmed.");
          nav("/dashboard/businesses");
        } else {
          toast.warning(`Payment not confirmed yet — status: ${data.status || "PENDING"}. Try again if you completed it.`);
        }
      } catch (e) { toast.error(e?.response?.data?.detail || "Verification failed"); }
    })();
  }, [orderId, nav]);

  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/imbpay/initiate", { order_id: orderId });
      if (data.payment_url) {
        toast.info("Redirecting to IMBPay…", { duration: 1200 });
        window.location.href = data.payment_url;
      } else {
        toast.error("Payment URL missing from gateway response");
      }
    } catch (e) { toast.error(e?.response?.data?.detail || "Payment failed"); }
    finally { setBusy(false); }
  };

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
      <button onClick={pay} disabled={busy || order.payment_status === "paid"} className="btn-primary w-full justify-center text-lg py-3" data-testid="direct-pay-btn">
        {order.payment_status === "paid" ? "✓ Already paid" : busy ? "Redirecting…" : <><Lock className="w-4 h-4"/> Pay ₹{order.total} via IMBPay</>}
      </button>
      <div className="flex items-center justify-center gap-2 text-xs text-[#64748B]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#65A30D]"/> Powered by IMBPay · Instant UPI · No transaction fee
      </div>
    </div>
  );
}
