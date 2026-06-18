import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

export default function Checkout() {
  const { cart, fetchCart } = useCart();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [addr, setAddr] = useState({
    full_name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  });

  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= 999 ? 0 : 49;
  const gst = subtotal * 0.05;
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_percent) {
      discount = (subtotal * appliedCoupon.discount_percent) / 100;
      if (appliedCoupon.max_discount) discount = Math.min(discount, appliedCoupon.max_discount);
    } else if (appliedCoupon.discount_amount) {
      discount = appliedCoupon.discount_amount;
    }
  }
  const total = subtotal + gst + shipping - discount;

  const applyCoupon = async () => {
    try {
      const { data } = await api.get(`/coupons/validate/${coupon}`);
      if (subtotal < data.min_order) {
        toast.error(`Min order ₹${data.min_order} for this coupon`);
        return;
      }
      setAppliedCoupon(data);
      toast.success(`Coupon applied!`);
    } catch (err) {
      toast.error("Invalid coupon");
    }
  };

  const placeOrder = async () => {
    if (!addr.line1 || !addr.city || !addr.pincode) {
      toast.error("Please complete address");
      return;
    }
    setBusy(true);
    try {
      const itemsPayload = items.map((it) => ({ product_id: it.product.id, quantity: it.quantity }));
      const { data: createRes } = await api.post("/orders/create", {
        items: itemsPayload,
        address: addr,
        coupon_code: appliedCoupon?.code || null,
        payment_method: "razorpay",
      });
      const order = createRes.order;
      toast.info("Processing payment (MOCK mode)…");
      // simulate Razorpay mock verification
      await new Promise((r) => setTimeout(r, 1200));
      const { data: verifyRes } = await api.post("/orders/verify-payment", {
        order_id: order.id,
        razorpay_payment_id: "pay_mock_" + Date.now(),
        razorpay_signature: "mock",
      });
      toast.success(`Order confirmed! Cashback ₹${verifyRes.cashback} credited.`);
      await fetchCart();
      await refresh();
      nav("/orders");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Checkout failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12" data-testid="checkout-page">
      <h1 className="font-display text-4xl font-bold mb-8">Checkout</h1>
      {items.length === 0 ? (
        <div className="card-soft p-8 text-center">Cart is empty</div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-soft p-6">
              <h3 className="font-display font-bold text-lg mb-4">Shipping Address</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-soft" placeholder="Full Name" value={addr.full_name} onChange={(e) => setAddr({...addr, full_name: e.target.value})} data-testid="checkout-name"/>
                <input className="input-soft" placeholder="Phone" value={addr.phone} onChange={(e) => setAddr({...addr, phone: e.target.value})} data-testid="checkout-phone"/>
                <input className="input-soft col-span-2" placeholder="Address Line" value={addr.line1} onChange={(e) => setAddr({...addr, line1: e.target.value})} data-testid="checkout-address"/>
                <input className="input-soft" placeholder="City" value={addr.city} onChange={(e) => setAddr({...addr, city: e.target.value})} data-testid="checkout-city"/>
                <input className="input-soft" placeholder="State" value={addr.state} onChange={(e) => setAddr({...addr, state: e.target.value})} data-testid="checkout-state"/>
                <input className="input-soft" placeholder="Pincode" value={addr.pincode} onChange={(e) => setAddr({...addr, pincode: e.target.value})} data-testid="checkout-pincode"/>
              </div>
            </div>

            <div className="card-soft p-6">
              <h3 className="font-display font-bold text-lg mb-4">Coupon</h3>
              <div className="flex gap-2">
                <input className="input-soft flex-1" placeholder="Try: WELCOME10" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} data-testid="checkout-coupon-input"/>
                <button onClick={applyCoupon} className="btn-outline" data-testid="checkout-apply-coupon">Apply</button>
              </div>
              {appliedCoupon && <div className="text-xs text-[#65A30D] mt-2 font-semibold">✓ {appliedCoupon.code} applied — save ₹{discount.toFixed(0)}</div>}
            </div>

            <div className="card-soft p-6">
              <h3 className="font-display font-bold text-lg mb-3">Payment Method</h3>
              <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4">
                <div className="font-semibold text-[#92400E] mb-1">Razorpay (MOCK Mode)</div>
                <div className="text-xs text-[#92400E]">Test payments auto-succeed. Admin can enable live keys in Settings.</div>
              </div>
            </div>
          </div>

          <div className="card-soft p-6 h-fit space-y-3">
            <h3 className="font-display font-bold text-lg">Summary</h3>
            <div className="space-y-2 font-numbers text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>GST</span><span>₹{gst.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{shipping ? `₹${shipping}` : "FREE"}</span></div>
              {discount > 0 && <div className="flex justify-between text-[#65A30D]"><span>Discount</span><span>−₹{discount.toFixed(0)}</span></div>}
              <div className="border-t pt-2 flex justify-between font-bold text-lg text-[#064E3B]"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
            </div>
            <button onClick={placeOrder} disabled={busy} className="btn-primary w-full justify-center" data-testid="place-order-btn">
              {busy ? "Processing…" : `Pay ₹${total.toFixed(0)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
