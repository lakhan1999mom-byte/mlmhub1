import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Package, Truck, Info, ArrowRight } from "lucide-react";
import api from "@/lib/api";

/**
 * Guest checkout — no login required. Used when a shopper picks
 * "Buy as customer" on a hamper (or any product) product page.
 * Creates a normal e-commerce order via POST /api/orders/guest.
 * Never registers the shopper as a partner and never touches referral rewards.
 */
export default function GuestCheckout() {
  const { productId } = useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    address: "", city: "", state: "", pincode: "",
    quantity: 1, size: "", color: "",
    payment_method: "cod",
  });

  useEffect(() => {
    api.get(`/products/${productId}`).then(({ data }) => setProduct(data)).catch(() => toast.error("Product not found"));
    api.get("/site/payment-provider").then(({ data }) => {
      setGateway(data);
      if (!data.cod_active && data.online_active) setForm((f) => ({ ...f, payment_method: "online" }));
    }).catch(() => setGateway({ cod_active: true, online_active: false }));
  }, [productId]);

  const upd = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e.preventDefault();
    if (product?.sizes?.length > 0 && !form.size) return toast.error("Please pick a size");
    if (product?.colors?.length > 0 && !form.color) return toast.error("Please pick a color");
    setBusy(true);
    try {
      const { data } = await api.post("/orders/guest", {
        product_id: productId,
        quantity: form.quantity,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        size: form.size || null,
        color: form.color || null,
        payment_method: form.payment_method,
      });
      setConfirmedOrder(data.order);
      toast.success("Order placed! We'll deliver soon.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to place order");
    } finally { setBusy(false); }
  };

  if (!product) return <div className="max-w-2xl mx-auto p-12 text-center text-[#94A3B8]">Loading…</div>;

  if (confirmedOrder) {
    return (
      <div className="max-w-2xl mx-auto p-6 md:p-10" data-testid="guest-order-confirmed">
        <div className="card-soft p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#DC2626] text-white flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10"/>
          </div>
          <h2 className="font-display text-3xl font-bold text-[#7F1D1D]">Order Placed!</h2>
          <div className="text-sm text-[#334155]">
            Thank you, <b>{confirmedOrder.guest.name}</b>. Your order will be delivered to <b>{confirmedOrder.shipping_address.pincode}</b>.
          </div>
          <div className="inline-flex items-center gap-2 bg-[#FEE2E2] text-[#7F1D1D] rounded-xl px-4 py-2 font-numbers">
            <Package className="w-4 h-4"/> Order ID: <b>{confirmedOrder.id.slice(0, 8).toUpperCase()}</b>
          </div>
          <div className="text-2xl font-numbers font-black text-[#DC2626]">₹{confirmedOrder.total_amount.toLocaleString("en-IN")}</div>
          <div className="text-xs text-[#64748B]">Payment: {confirmedOrder.payment_method === "cod" ? "Cash on Delivery" : "Online"}</div>
          <Link to="/" className="btn-primary inline-flex text-sm">Back to home <ArrowRight className="w-4 h-4"/></Link>
        </div>
      </div>
    );
  }

  const unit = product.price || 0;
  const total = unit * form.quantity;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10" data-testid="guest-checkout-page">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[#7F1D1D] mb-2">Guest Checkout</h1>
      <p className="text-sm text-[#64748B] mb-6">No sign-up needed — just fill your address and pay. You'll receive an order-tracking SMS on the mobile you enter.</p>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="lg:col-span-2 card-soft p-6 space-y-4" data-testid="guest-form">
          <h3 className="font-display font-bold text-lg">Shipping details</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Full name" v={form.name} on={upd("name")} testid="guest-name" required/>
            <Field label="Mobile" v={form.phone} on={upd("phone")} testid="guest-phone" required/>
            <Field label="Email (optional)" v={form.email} on={upd("email")} testid="guest-email"/>
            <Field label="Pincode" v={form.pincode} on={upd("pincode")} testid="guest-pincode" required/>
            <Field label="City" v={form.city} on={upd("city")} testid="guest-city" required/>
            <Field label="State" v={form.state} on={upd("state")} testid="guest-state"/>
          </div>
          <Field label="Full address" v={form.address} on={upd("address")} testid="guest-address" required/>

          {product.sizes?.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-[#7F1D1D] mb-2">Size</div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s} type="button" onClick={() => setForm({ ...form, size: s })}
                    className={`min-w-[44px] h-10 rounded-full border-2 font-semibold text-sm transition ${form.size === s ? "border-[#DC2626] bg-[#DC2626] text-white" : "border-[#FECACA] bg-white text-[#7F1D1D] hover:border-[#DC2626]"}`}
                    data-testid={`guest-size-${s}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          {product.colors?.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-[#7F1D1D] mb-2">Color</div>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => {
                  const isHex = /^#[0-9A-Fa-f]{3,8}$/.test(c);
                  return (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`inline-flex items-center gap-2 px-3 h-10 rounded-full border-2 font-semibold text-sm transition ${form.color === c ? "border-[#DC2626] ring-2 ring-[#DC2626]/30" : "border-[#FECACA] hover:border-[#DC2626]"} bg-white text-[#7F1D1D]`}
                      data-testid={`guest-color-${c}`}
                    >
                      <span className="w-4 h-4 rounded-full border border-[#FECACA]" style={{ background: isHex ? c : c.toLowerCase() }}/>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-[#7F1D1D] mb-2">Quantity</div>
            <div className="inline-flex items-center border border-[#FECACA] rounded-full">
              <button type="button" onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })} className="px-3 py-1.5 text-lg" data-testid="guest-qty-minus">−</button>
              <span className="px-4 font-numbers font-semibold" data-testid="guest-qty">{form.quantity}</span>
              <button type="button" onClick={() => setForm({ ...form, quantity: form.quantity + 1 })} className="px-3 py-1.5 text-lg" data-testid="guest-qty-plus">+</button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#7F1D1D] mb-2">Payment method</div>
            <div className="space-y-2">
              {gateway?.cod_active && (
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${form.payment_method === "cod" ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#FECACA] hover:border-[#DC2626]"}`} data-testid="guest-pay-cod">
                  <input type="radio" name="pm" value="cod" checked={form.payment_method === "cod"} onChange={upd("payment_method")}/>
                  <div>
                    <div className="font-semibold text-[#7F1D1D] flex items-center gap-2"><Truck className="w-4 h-4"/> Cash on Delivery</div>
                    <div className="text-xs text-[#64748B]">Pay in cash when the order reaches you. No advance charges.</div>
                  </div>
                </label>
              )}
              {gateway?.online_active && (
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${form.payment_method === "online" ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#FECACA] hover:border-[#DC2626]"}`} data-testid="guest-pay-online">
                  <input type="radio" name="pm" value="online" checked={form.payment_method === "online"} onChange={upd("payment_method")}/>
                  <div>
                    <div className="font-semibold text-[#7F1D1D]">Pay Online ({gateway.provider === "uropay" ? "UPI · QR" : gateway.provider === "razorpay" ? "Cards · UPI · Netbanking" : "Bank transfer"})</div>
                    <div className="text-xs text-[#64748B]">Instant confirmation and faster shipping.</div>
                  </div>
                </label>
              )}
              {!gateway?.cod_active && !gateway?.online_active && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#7F1D1D] flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-[#B91C1C]"/> No payment method is currently active. Please check back shortly.
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={busy || (!gateway?.cod_active && !gateway?.online_active)} className="btn-primary w-full justify-center mt-3" data-testid="guest-submit">
            {busy ? "Placing order…" : `Place order · ₹${total.toLocaleString("en-IN")}`}
          </button>
        </form>

        <div className="card-soft p-5 self-start" data-testid="guest-order-summary">
          <h4 className="font-display font-bold mb-3">Order Summary</h4>
          <div className="flex items-start gap-3 mb-3">
            <img src={product.images?.[0]} alt={product.name} className="w-16 h-16 rounded-xl object-cover"/>
            <div className="min-w-0">
              <div className="font-semibold text-[#7F1D1D] text-sm line-clamp-2">{product.name}</div>
              <div className="text-xs text-[#64748B]">Qty {form.quantity} · ₹{unit.toLocaleString("en-IN")}</div>
            </div>
          </div>
          <div className="border-t border-[#FEE2E2] pt-3 space-y-1 text-sm">
            <Row label="Subtotal" v={`₹${total.toLocaleString("en-IN")}`}/>
            <Row label="Delivery" v="Free"/>
            <div className="flex items-center justify-between font-bold text-lg text-[#7F1D1D] pt-2 border-t border-[#FEE2E2]">
              <span>Total</span>
              <span className="font-numbers">₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, on, testid, required }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#7F1D1D]">{label}</label>
      <input className="input-soft mt-1" value={v} onChange={on} required={required} data-testid={testid}/>
    </div>
  );
}
function Row({ label, v }) {
  return <div className="flex items-center justify-between text-[#334155]"><span>{label}</span><span className="font-numbers">{v}</span></div>;
}
