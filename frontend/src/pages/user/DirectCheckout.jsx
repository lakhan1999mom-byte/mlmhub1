import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, ArrowRight, Info, Clock, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Kit checkout — uses UroPay's embed button (fixed ₹9,999).
 * After payment the customer is redirected to the site home. The admin then
 * verifies the deposit inside the UroPay dashboard and clicks "Mark Kit Paid"
 * in the admin panel to activate the customer. */
export default function DirectCheckout() {
  const { orderId } = useParams();
  const { user, refresh } = useAuth();
  const [order, setOrder] = useState(null);
  const [gateway, setGateway] = useState(null);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data)).catch(() => toast.error("Order not found"));
    api.get("/site/payment-provider").then(({ data }) => setGateway(data)).catch(() => setGateway({ active: false }));
  }, [orderId]);

  // Inject the UroPay embed script once — only when UroPay is the active gateway
  useEffect(() => {
    if (!gateway?.uropay_active) return;
    const id = "uropay-embed-script";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "https://cdn.uropay.me/uropay-embed.min.js";
    s.async = true;
    document.body.appendChild(s);
  }, [gateway?.uropay_active]);

  // Poll the auth endpoint every 8s so if the admin marks the kit paid, the UI catches it
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const { data } = await api.get(`/orders/${orderId}`);
        setOrder(data);
        if (data.payment_status === "paid") { refresh(); }
      } catch { /* ignore */ }
    }, 8000);
    return () => clearInterval(t);
  }, [orderId, refresh]);

  if (!order) return <div className="p-12 text-center text-[#64748B]">Loading order…</div>;

  const isPaid = order.payment_status === "paid";

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="direct-checkout-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-gradient-to-br from-[#7F1D1D] to-[#991B1B] text-white p-6">
        <div className="flex items-center gap-2 text-[#DC2626] text-xs uppercase font-bold tracking-widest"><Sparkles className="w-4 h-4"/> Activate your business</div>
        <div className="font-display font-black text-3xl mt-1">Pay the Welcome Kit</div>
        <div className="text-sm text-white/70 mt-1">One-time ₹9,999 — unlocks your referral code and rewards engine.</div>
      </motion.div>

      <div className="card-soft p-5 space-y-2 text-sm">
        <div className="flex justify-between"><span>Order</span><span className="font-mono font-semibold" data-testid="checkout-order-code">{order.order_code}</span></div>
        {order.items?.map((i) => (
          <div key={i.product_id} className="flex justify-between"><span>{i.name}</span><span>₹{i.line_total}</span></div>
        ))}
        <div className="border-t pt-2 flex justify-between font-black text-xl text-[#7F1D1D]"><span>Total</span><span>₹9,999</span></div>
      </div>

      {isPaid ? (
        <div className="card-soft p-6 text-center space-y-3 bg-gradient-to-br from-[#FEE2E2]/60 to-white border-[#DC2626]" data-testid="kit-paid-card">
          <div className="w-14 h-14 rounded-full bg-[#DC2626] text-white flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8"/></div>
          <div className="font-display font-black text-xl text-[#7F1D1D]">Kit activated!</div>
          <div className="text-xs text-[#64748B]">Your referral link is live. You can now share it with friends.</div>
          <Link to="/dashboard/businesses" className="btn-primary inline-flex text-sm">Open dashboard <ArrowRight className="w-4 h-4"/></Link>
        </div>
      ) : !gateway?.active ? (
        <div className="card-soft p-6 text-center space-y-3 border-2 border-[#FCA5A5]" data-testid="payment-not-configured-card">
          <div className="w-14 h-14 rounded-full bg-[#DC2626] text-white flex items-center justify-center mx-auto"><Info className="w-7 h-7"/></div>
          <div className="font-display font-black text-xl text-[#7F1D1D]">Payment gateway not configured</div>
          <div className="text-sm text-[#334155] max-w-md mx-auto">
            Our payments partner is being set up right now. Please check back shortly, or contact support to reserve your kit.
          </div>
        </div>
      ) : gateway?.uropay_active ? (
        <>
          <div className="card-soft p-6 text-center space-y-4" data-testid="uropay-embed-card">
            <div className="text-xs uppercase font-bold tracking-widest text-[#B91C1C]">Step 1 · Pay via UPI</div>
            <p className="text-sm text-[#7F1D1D]">Tap the button below to pay <b>₹9,999</b> via any UPI app (PhonePe · GPay · Paytm · BHIM · your bank).</p>
            <div className="flex justify-center pt-2" data-testid="uropay-embed-container">
              <a
                href="#uropay-pay"
                onClick={(e) => e.preventDefault()}
                className="uropay-btn"
                data-uropay-api-key="NZQ86PNMF1TQDGCI"
                data-uropay-button-id="ROMEO348794"
                data-uropay-environment="LIVE"
                data-uropay-amount="9999"
                data-uropay-success-redirect-url={`${window.location.origin}/checkout/direct/${orderId}?paid=1`}
                data-uropay-failure-redirect-url={`${window.location.origin}/hampers`}
                data-testid="uropay-embed-button"
              >Buy Now for ₹9999</a>
            </div>
            <div className="text-[10px] text-[#94A3B8]">Powered by UroPay · UPI direct-to-bank · Zero processing fee</div>
          </div>

          <div className="card-soft p-4 flex gap-3 bg-amber-50/60 border-amber-200" data-testid="post-payment-note">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
            <div className="text-xs text-amber-900">
              <div className="font-display font-bold text-sm mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> After paying</div>
              You&apos;ll be redirected back here. Please <b>screenshot your UPI success page</b> and share it with EverGro support on WhatsApp/email — our admin will match the deposit and activate your kit within a few minutes. This page will auto-refresh once you&apos;re activated.
            </div>
          </div>
        </>
      ) : (
        <div className="card-soft p-6 text-center space-y-3 border-2 border-[#FCA5A5]" data-testid="payment-not-configured-card">
          <div className="w-14 h-14 rounded-full bg-[#DC2626] text-white flex items-center justify-center mx-auto"><Info className="w-7 h-7"/></div>
          <div className="font-display font-black text-xl text-[#7F1D1D]">Payment gateway not configured</div>
          <div className="text-sm text-[#334155] max-w-md mx-auto">
            The current gateway is not yet ready. Please check back shortly.
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-[#64748B]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#B91C1C]"/> Secure UPI · Direct-to-bank · 100% real payment
      </div>
    </div>
  );
}
