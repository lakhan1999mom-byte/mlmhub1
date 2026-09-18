import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Star, ShoppingCart, Zap, CheckCircle2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => setP(data));
  }, [id]);

  if (!p) return <div className="p-12 text-center">Loading…</div>;

  const handleAdd = async () => {
    if (!user) { nav("/login"); return; }
    if (p.sizes?.length > 0 && !selectedSize) return toast.error("Please pick a size");
    if (p.colors?.length > 0 && !selectedColor) return toast.error("Please pick a color");
    const res = await addItem(p.id, qty, { size: selectedSize, color: selectedColor });
    if (res?.ok) toast.success("Added to cart");
  };
  const handleBuy = async () => {
    if (!user) { nav("/login"); return; }
    if (!user.is_joining_paid && !p.is_hamper) {
      toast.error("Buy the ₹9,999 Joining Kit first.");
      nav("/hampers");
      return;
    }
    if (user.is_joining_paid && p.is_hamper) {
      toast.info("You've already activated your account.");
      return;
    }
    const res = await addItem(p.id, qty);
    if (res?.ok) nav("/cart");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="product-detail-page">
      <div className="grid lg:grid-cols-2 gap-12">
        <div>
          <div className="aspect-square bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <img src={p.images?.[activeImg]} alt={p.name} className="w-full h-full object-contain"/>
          </div>
          {p.images?.length > 1 && (
            <div className="flex gap-2 mt-4">
              {p.images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${activeImg === i ? "border-[#DC2626]" : "border-[#E2E8F0]"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {p.badges?.map((b) => <span key={b} className="badge-pill bg-[#DC2626] text-[#7F1D1D] uppercase mr-2 mb-2 inline-block">{b}</span>)}
          <h1 className="font-display text-4xl font-bold mt-2 mb-3">{p.name}</h1>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < Math.round(p.rating) ? "fill-[#DC2626] text-[#DC2626]" : "text-[#E2E8F0]"}`}/>))}
            </div>
            <span className="text-sm text-[#64748B] font-numbers">{p.rating} · {p.review_count} reviews</span>
          </div>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-numbers text-4xl font-bold text-[#7F1D1D]">₹{p.price.toLocaleString()}</span>
            {p.mrp > p.price && <span className="text-lg text-[#94A3B8] line-through font-numbers">₹{p.mrp.toLocaleString()}</span>}
            {p.mrp > p.price && <span className="badge-pill bg-[#FEF2F2] text-[#7F1D1D]">Save ₹{(p.mrp - p.price).toLocaleString()}</span>}
          </div>
          <p className="text-[#334155] leading-relaxed mb-6">{p.description}</p>
          {p.contents?.length > 0 && (
            <div className="mb-6">
              <div className="font-semibold text-[#7F1D1D] mb-2">Contains:</div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {p.contents.map((c) => (
                  <li key={c} className="text-sm text-[#334155] flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#DC2626] mt-0.5"/>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Fashion variant pickers */}
          {p.sizes?.length > 0 && (
            <div className="mb-4" data-testid="size-picker-group">
              <div className="text-sm font-semibold text-[#7F1D1D] mb-2">Size {selectedSize && <span className="text-[#B91C1C] font-normal">· {selectedSize}</span>}</div>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`min-w-[44px] h-10 rounded-full border-2 font-semibold text-sm transition ${
                      selectedSize === s
                        ? "border-[#DC2626] bg-[#DC2626] text-white"
                        : "border-[#FECACA] bg-white text-[#7F1D1D] hover:border-[#DC2626]"
                    }`}
                    data-testid={`size-option-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {p.colors?.length > 0 && (
            <div className="mb-6" data-testid="color-picker-group">
              <div className="text-sm font-semibold text-[#7F1D1D] mb-2">Color {selectedColor && <span className="text-[#B91C1C] font-normal">· {selectedColor}</span>}</div>
              <div className="flex flex-wrap gap-2">
                {p.colors.map((c) => {
                  const isHex = /^#[0-9A-Fa-f]{3,8}$/.test(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`inline-flex items-center gap-2 px-3 h-10 rounded-full border-2 font-semibold text-sm transition ${
                        selectedColor === c
                          ? "border-[#DC2626] ring-2 ring-[#DC2626]/30"
                          : "border-[#FECACA] hover:border-[#DC2626]"
                      } bg-white text-[#7F1D1D]`}
                      data-testid={`color-option-${c}`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-[#FECACA]"
                        style={{ background: isHex ? c : c.toLowerCase() }}
                      />
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center bg-white border border-[#E2E8F0] rounded-full">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-2 text-[#7F1D1D] font-bold" data-testid="qty-decr">−</button>
              <span className="px-4 font-numbers font-semibold" data-testid="qty-value">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-4 py-2 text-[#7F1D1D] font-bold" data-testid="qty-incr">+</button>
            </div>
            <div className="text-sm text-[#B91C1C] font-semibold">In stock: {p.stock}</div>
          </div>

          {p.is_hamper ? (
            /* Hamper split: partner path (register + activate) OR guest path (no login) */
            <div className="space-y-3" data-testid="hamper-purchase-options">
              <div className="rounded-2xl border-2 border-[#DC2626] bg-[#FEF2F2] p-4">
                <div className="font-display font-bold text-[#7F1D1D] mb-1">Become an EverGro eMart Partner</div>
                <div className="text-xs text-[#64748B] mb-3">Register once, activate with the hamper, and unlock your partner dashboard with referral rewards.</div>
                <Link to={user ? "/purchase-kit" : "/register"} className="btn-primary w-full justify-center" data-testid="hamper-buy-as-partner">
                  <Zap className="w-4 h-4"/> Buy &amp; Become Partner
                </Link>
              </div>
              <div className="rounded-2xl border border-[#FECACA] bg-white p-4">
                <div className="font-display font-bold text-[#7F1D1D] mb-1">Buy as a Customer</div>
                <div className="text-xs text-[#64748B] mb-3">Just place an order — no sign-up, no dashboard. Cash-on-delivery available.</div>
                <Link to={`/guest-checkout/${p.id}`} className="btn-outline w-full justify-center" data-testid="hamper-buy-as-guest">
                  <ShoppingCart className="w-4 h-4"/> Buy as Customer
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={handleAdd} className="btn-outline flex-1 justify-center" data-testid="add-to-cart-btn"><ShoppingCart className="w-4 h-4"/>Add to Cart</button>
              <button onClick={handleBuy} className="btn-primary flex-1 justify-center" data-testid="buy-now-btn"><Zap className="w-4 h-4"/>Buy Now</button>
            </div>
          )}
        </div>
      </div>

      {p.reviews?.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold mb-4">Customer Reviews</h2>
          <div className="space-y-3">
            {p.reviews.map((r) => (
              <div key={r.id} className="card-soft p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-[#7F1D1D]">{r.user_name}</div>
                  <div className="flex gap-0.5">{[...Array(r.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-[#DC2626] text-[#DC2626]"/>)}</div>
                </div>
                <p className="text-[#334155] text-sm">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
