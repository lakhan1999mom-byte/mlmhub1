import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Truck, Wallet, Shield, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { KIT_PRICE } from "@/lib/plan-theme";

export default function PurchaseKitPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [content, setContent] = useState(null);
  const [product, setProduct] = useState(null);

  useEffect(() => {
    api.get("/site/purchase-kit-content").then(({ data }) => setContent(data)).catch(() => {});
    api.get("/products?is_hamper=true").then(({ data }) => setProduct((data || [])[0])).catch(() => {});
  }, []);

  const startPurchase = async () => {
    if (!user) { nav("/join-now"); return; }
    if (!product) return toast.error("Kit product not available");
    // Add to cart & jump to checkout
    try {
      await api.post("/cart/add", { product_id: product.id, quantity: 1 });
      nav("/checkout");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not add to cart");
    }
  };

  if (!content) return <div className="p-12 text-center text-[#64748B]">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-14" data-testid="purchase-kit-page">
      {/* Hero */}
      <div className="grid lg:grid-cols-2 gap-8 items-center mb-12">
        <div>
          <div className="inline-block bg-[#FBBF24] text-[#064E3B] text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
            The One Kit That Unlocks Everything
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-[#064E3B] leading-[1.1] mb-4" data-testid="pk-hero-title">
            {content.hero_title}
          </h1>
          <p className="text-lg text-[#334155] mb-6" data-testid="pk-hero-subtitle">
            {content.hero_subtitle}
          </p>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-numbers text-5xl md:text-6xl font-black text-[#064E3B]">₹{KIT_PRICE.toLocaleString('en-IN')}</span>
            <span className="text-lg text-[#94A3B8] line-through">₹8,999</span>
            <span className="bg-[#84CC16] text-[#064E3B] text-xs font-bold px-2 py-1 rounded-full">SAVE 20%</span>
          </div>
          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={startPurchase} className="btn-primary" data-testid="pk-cta-btn">
              {content.cta_text || `Order Kit — ₹${KIT_PRICE}`}
            </button>
            <button onClick={() => nav("/business-plan")} className="btn-outline" data-testid="pk-view-plan-btn">
              View Business Plan
            </button>
          </div>
          <div className="flex gap-4 text-xs text-[#64748B]">
            <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5"/> Fast delivery</span>
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5"/> Secure payment</span>
            <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5"/> Instant activation</span>
          </div>
        </div>
        <div className="relative animate-float">
          <div className="absolute -top-6 -right-4 z-10 bg-[#FBBF24] text-[#064E3B] font-bold px-4 py-2 rounded-full text-sm shadow-lg">
            🏆 {content.highlight_stat}
          </div>
          <img
            src={content.hero_image}
            alt={content.hero_title}
            className="rounded-3xl w-full aspect-square object-cover shadow-2xl"
            data-testid="pk-hero-image"
          />
          <div className="absolute -bottom-4 -left-4 bg-white p-4 rounded-2xl shadow-xl border border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => <img key={i} src={`https://i.pravatar.cc/32?img=${i}`} alt="" className="w-8 h-8 rounded-full border-2 border-white"/>)}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#064E3B]">50,000+ members</div>
                <div className="text-[10px] text-[#64748B]">joined this month</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <section className="mb-12" data-testid="pk-features-section">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">What's Inside</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#064E3B]">Everything you need, hand-picked.</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(content.features || []).map((f, i) => (
            <div
              key={i}
              className="card-soft p-5 hover:-translate-y-1 transition-transform"
              data-testid={`pk-feature-${i}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-4xl mb-2">{f.icon}</div>
              <div className="font-display font-bold text-[#064E3B]">{f.title}</div>
              <div className="text-xs text-[#64748B] mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mb-12 card-soft p-6 md:p-10 bg-gradient-to-br from-[#ECFCCB] via-white to-[#ECFCCB]" data-testid="pk-how-section">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">How It Works</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#064E3B]">From Kit to Continuous Income</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(content.how_it_works || []).map((s, i, arr) => (
            <div key={s.step} className="relative text-center" data-testid={`pk-step-${s.step}`}>
              <div className="w-16 h-16 rounded-full bg-[#064E3B] text-white font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                {s.step}
              </div>
              <div className="font-display font-bold text-[#064E3B] mb-1">{s.title}</div>
              <div className="text-xs text-[#64748B]">{s.desc}</div>
              {i < arr.length - 1 && <ChevronRight className="hidden lg:block absolute top-4 -right-3 w-6 h-6 text-[#84CC16]"/>}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="card-soft p-8 md:p-12 bg-gradient-to-r from-[#84CC16] to-[#65A30D] text-[#064E3B] text-center" data-testid="pk-bottom-cta">
        <Sparkles className="w-10 h-10 mx-auto mb-3"/>
        <h2 className="font-display text-3xl md:text-4xl font-black mb-2">One kit. One life-changing decision.</h2>
        <p className="mb-6 max-w-2xl mx-auto opacity-80">Join tens of thousands who've turned their ₹7,200 into consistent monthly income.</p>
        <button onClick={startPurchase} className="bg-[#064E3B] hover:bg-black text-white font-bold px-8 py-4 rounded-full text-lg" data-testid="pk-bottom-cta-btn">
          Get Started — ₹{KIT_PRICE.toLocaleString('en-IN')}
        </button>
      </section>
    </div>
  );
}
