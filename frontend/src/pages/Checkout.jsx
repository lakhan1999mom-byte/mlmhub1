import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Lock, Sparkles, MapPin, Tag, Truck, Info } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

export default function Checkout() {
  const { cart, delivery, fetchCart, clearCart } = useCart();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [payMethod, setPayMethod] = useState("gateway");
  const [addr, setAddr] = useState({
    full_name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    api.get("/site/payment-provider").then(({ data }) => setGateway(data)).catch(() => setGateway({}));
  }, []);

  const items = cart?.items || [];
  const hasHamper = items.some((it) => it.product?.is_hamper);
  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= delivery.free_shipping_threshold ? 0 : (delivery.delivery_charge || 0);
  const gst = (delivery.gst_percent || 0) > 0 ? subtotal * (delivery.gst_percent / 100) : 0;
  // Extra admin-configured charges
  const extraCharges = (delivery.extra_charges || []).map((c) => ({
    label: c.label,
    amount: c.type === "percent" ? (subtotal * (c.value || 0)) / 100 : (c.value || 0),
  }));
  const extrasTotal = extraCharges.reduce((s, c) => s + c.amount, 0);
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_percent) {
      discount = (subtotal * appliedCoupon.discount_percent) / 100;
      if (appliedCoupon.max_discount) discount = Math.min(discount, appliedCoupon.max_discount);
    } else if (appliedCoupon.discount_amount) {
      discount = appliedCoupon.discount_amount;
    }
  }
  const total = subtotal + gst + shipping + extrasTotal - discount;

  const applyCoupon = async () => {
    try {
      const { data } = await api.get(`/coupons/validate/${coupon}`);
      if (subtotal < data.min_order) {
        toast.error(`Min order ₹${data.min_order} for this coupon`);
        return;
      }
      setAppliedCoupon(data);
      toast.success("Coupon applied!");
    } catch {
      toast.error("Invalid coupon");
    }
  };

  const startPayment = async (orderId) => {
    // For the cart flow, hand off to the same UroPay QR + UTR screen used for kit checkout.
    // We navigate to the direct checkout page which polls & finalises.
    nav(`/checkout/direct/${orderId}`);
  };

  const placeOrder = async () => {
    if (!addr.line1 || !addr.city || !addr.pincode) {
      toast.error("Please complete address");
      return;
    }
    // Hamper (sales-agent activation) always requires online prepayment
    const method = hasHamper ? "gateway" : payMethod;
    if (method === "gateway" && !gateway?.online_active) {
      toast.error("Online payment gateway is not configured yet. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      const itemsPayload = items.map((it) => ({ product_id: it.product.id, quantity: it.quantity, size: it.size || null, color: it.color || null }));
      const { data: createRes } = await api.post("/orders/create", {
        items: itemsPayload,
        address: addr,
        coupon_code: appliedCoupon?.code || null,
        payment_method: method,
      });
      if (method === "cod") {
        await clearCart();
        toast.success("Order placed! Pay when it arrives.");
        nav(`/orders/${createRes.order.id}`);
      } else {
        await startPayment(createRes.order.id);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  // Real UroPay only — no mock anywhere.

  return (
    <div className="max-w-6xl mx-auto px-6 py-12" data-testid="checkout-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-[#FEE2E2] flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#B91C1C]"/>
          </div>
          <div>
            <h1 className="font-display text-4xl font-black text-[#7F1D1D] leading-none">Secure Checkout</h1>
            <p className="text-sm text-[#64748B] mt-1">256-bit encrypted · UroPay UPI · Direct-to-bank</p>
          </div>
        </div>
      </motion.div>

      {items.length === 0 ? (
        <div className="card-soft p-12 text-center mt-8">
          <div className="text-6xl mb-4">🛒</div>
          <div className="font-display text-2xl font-bold text-[#7F1D1D] mb-2">Your cart is empty</div>
          <button onClick={() => nav("/products")} className="btn-primary mt-4">Continue Shopping</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }} className="card-soft p-6" data-testid="checkout-address-card">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-[#B91C1C]"/>
                <h3 className="font-display font-bold text-lg text-[#7F1D1D]">Shipping Address</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-soft" placeholder="Full Name" value={addr.full_name} onChange={(e) => setAddr({ ...addr, full_name: e.target.value })} data-testid="checkout-name"/>
                <input className="input-soft" placeholder="Phone" value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} data-testid="checkout-phone"/>
                <input className="input-soft col-span-2" placeholder="Address Line" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} data-testid="checkout-address"/>
                <input className="input-soft" placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} data-testid="checkout-city"/>
                <input className="input-soft" placeholder="State" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} data-testid="checkout-state"/>
                <input className="input-soft" placeholder="Pincode" value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} data-testid="checkout-pincode"/>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="card-soft p-6">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-5 h-5 text-[#B91C1C]"/>
                <h3 className="font-display font-bold text-lg text-[#7F1D1D]">Have a coupon?</h3>
              </div>
              <div className="flex gap-2">
                <input className="input-soft flex-1 uppercase" placeholder="Try: WELCOME10" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} data-testid="checkout-coupon-input"/>
                <button onClick={applyCoupon} className="btn-outline" data-testid="checkout-apply-coupon">Apply</button>
              </div>
              {appliedCoupon && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 flex items-center gap-2 text-sm bg-[#FEE2E2] text-[#991B1B] rounded-lg p-2 border border-[#DC2626]/40">
                  <CheckCircle2 className="w-4 h-4"/> <span className="font-semibold">{appliedCoupon.code}</span> — you save ₹{discount.toFixed(0)}
                </motion.div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="card-soft p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#B91C1C]"/>
                  <h3 className="font-display font-bold text-lg text-[#7F1D1D]">Payment Method</h3>
                </div>
                {gateway?.online_active && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-[#FEE2E2] text-[#991B1B] px-2 py-1 rounded-full" data-testid="uropay-live-badge">Live</span>
                )}
              </div>

              {hasHamper && (
                <div className="mb-3 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#7F1D1D] flex items-start gap-2" data-testid="hamper-prepay-note">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]"/>
                  <span>Your cart contains the <b>Sales Agent hamper</b>. Activation requires <b>online prepayment</b> — Cash on Delivery is not available for it.</span>
                </div>
              )}

              <div className="space-y-2">
                {!hasHamper && gateway?.cod_active && (
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${payMethod === "cod" ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#FECACA] hover:border-[#DC2626]"}`} data-testid="pay-cod-option">
                    <input type="radio" name="pm" value="cod" checked={payMethod === "cod"} onChange={() => setPayMethod("cod")} className="mt-1"/>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-[#7F1D1D] flex items-center gap-2"><Truck className="w-4 h-4"/> Cash on Delivery</div>
                      <div className="text-xs text-[#64748B]">Pay in cash when the order reaches you. No advance charges.</div>
                    </div>
                  </label>
                )}
                {gateway?.online_active && (
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${(hasHamper || payMethod === "gateway") ? "border-[#DC2626] bg-[#FEE2E2]" : "border-[#FECACA] hover:border-[#DC2626]"}`} data-testid="pay-online-option">
                    <input type="radio" name="pm" value="gateway" checked={hasHamper || payMethod === "gateway"} onChange={() => setPayMethod("gateway")} disabled={hasHamper} className="mt-1"/>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-[#991B1B] border border-[#FECACA]">UPI</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-[#991B1B]">Pay Online — {gateway.provider === "uropay" ? "UroPay UPI" : gateway.provider === "razorpay" ? "Razorpay" : "Bank transfer"}</div>
                        <div className="text-xs text-[#991B1B]">Scan QR · PhonePe / GPay / Paytm · Direct-to-bank</div>
                      </div>
                    </div>
                  </label>
                )}
                {!gateway?.online_active && !gateway?.cod_active && (
                  <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#7F1D1D] flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-[#B91C1C]"/> No payment method is currently active. Please check back shortly.
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-soft p-6 h-fit space-y-3 sticky top-24">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#DC2626]"/>
              <h3 className="font-display font-bold text-lg text-[#7F1D1D]">Order Summary</h3>
            </div>
            <div className="space-y-2 font-numbers text-sm">
              {items.map((it) => (
                <div key={it.product.id} className="flex justify-between text-[#334155]">
                  <span className="truncate mr-2">{it.product.name} × {it.quantity}</span>
                  <span>₹{(it.product.price * it.quantity).toFixed(0)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
              {gst > 0 && <div className="flex justify-between"><span>GST ({delivery.gst_percent}%)</span><span>₹{gst.toFixed(0)}</span></div>}
              <div className="flex justify-between"><span>Shipping</span><span className={shipping ? "" : "text-[#B91C1C] font-semibold"}>{shipping ? `₹${shipping}` : "FREE"}</span></div>
              {extraCharges.map((c) => (
                <div key={c.label} className="flex justify-between text-[#334155]"><span>{c.label}</span><span>₹{c.amount.toFixed(0)}</span></div>
              ))}
              {discount > 0 && <div className="flex justify-between text-[#B91C1C]"><span>Coupon</span><span>−₹{discount.toFixed(0)}</span></div>}
              <div className="border-t pt-3 flex justify-between font-black text-xl text-[#7F1D1D]"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
            </div>
            <button onClick={placeOrder} disabled={busy} className="btn-primary w-full justify-center text-base" data-testid="place-order-btn">
              {busy ? "Processing…" : (!hasHamper && payMethod === "cod") ? (
                <>
                  <Truck className="w-4 h-4 mr-2"/> Place COD Order · Pay ₹{total.toFixed(0)} on Delivery
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2"/> Pay ₹{total.toFixed(0)} Securely
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-[#94A3B8] flex items-center justify-center gap-1"><Lock className="w-3 h-3"/>Encrypted & PCI-DSS Compliant</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
