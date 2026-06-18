import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => setP(data));
  }, [id]);

  if (!p) return <div className="p-12 text-center">Loading…</div>;

  const handleAdd = async () => {
    if (!user) { nav("/login"); return; }
    await addItem(p.id, qty);
    toast.success("Added to cart");
  };
  const handleBuy = async () => {
    if (!user) { nav("/login"); return; }
    await addItem(p.id, qty);
    nav("/cart");
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
                <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${activeImg === i ? "border-[#84CC16]" : "border-[#E2E8F0]"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {p.badges?.map((b) => <span key={b} className="badge-pill bg-[#84CC16] text-[#064E3B] uppercase mr-2 mb-2 inline-block">{b}</span>)}
          <h1 className="font-display text-4xl font-bold mt-2 mb-3">{p.name}</h1>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < Math.round(p.rating) ? "fill-[#FBBF24] text-[#FBBF24]" : "text-[#E2E8F0]"}`}/>))}
            </div>
            <span className="text-sm text-[#64748B] font-numbers">{p.rating} · {p.review_count} reviews</span>
          </div>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-numbers text-4xl font-bold text-[#064E3B]">₹{p.price.toLocaleString()}</span>
            {p.mrp > p.price && <span className="text-lg text-[#94A3B8] line-through font-numbers">₹{p.mrp.toLocaleString()}</span>}
            {p.mrp > p.price && <span className="badge-pill bg-[#FEF3C7] text-[#92400E]">Save ₹{(p.mrp - p.price).toLocaleString()}</span>}
          </div>
          <p className="text-[#334155] leading-relaxed mb-6">{p.description}</p>
          {p.contents?.length > 0 && (
            <div className="mb-6">
              <div className="font-semibold text-[#064E3B] mb-2">Contains:</div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {p.contents.map((c) => (
                  <li key={c} className="text-sm text-[#334155] flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#84CC16] mt-0.5"/>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center bg-white border border-[#E2E8F0] rounded-full">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-2 text-[#064E3B] font-bold" data-testid="qty-decr">−</button>
              <span className="px-4 font-numbers font-semibold" data-testid="qty-value">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-4 py-2 text-[#064E3B] font-bold" data-testid="qty-incr">+</button>
            </div>
            <div className="text-sm text-[#65A30D] font-semibold">In stock: {p.stock}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="btn-outline flex-1 justify-center" data-testid="add-to-cart-btn"><ShoppingCart className="w-4 h-4"/>Add to Cart</button>
            <button onClick={handleBuy} className="btn-primary flex-1 justify-center" data-testid="buy-now-btn"><Zap className="w-4 h-4"/>Buy Now</button>
          </div>
        </div>
      </div>

      {p.reviews?.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold mb-4">Customer Reviews</h2>
          <div className="space-y-3">
            {p.reviews.map((r) => (
              <div key={r.id} className="card-soft p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-[#064E3B]">{r.user_name}</div>
                  <div className="flex gap-0.5">{[...Array(r.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-[#FBBF24] text-[#FBBF24]"/>)}</div>
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
