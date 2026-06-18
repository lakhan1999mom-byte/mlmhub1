import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import api from "@/lib/api";
import { ArrowRight, Star, Users, Wallet, Sparkles, ShieldCheck, Truck, Award, ChevronRight, Play, Quote, CheckCircle2, TrendingUp, Gift } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";
const HAMPER_IMG = "https://images.unsplash.com/photo-1508899203029-1c9eb493c9bd?w=800";

export default function Landing() {
  const { site } = useOutletContext() || {};
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [hampers, setHampers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get("/products?is_hamper=false").then(r => setProducts(r.data.slice(0, 8))),
      api.get("/products?is_hamper=true").then(r => setHampers(r.data)),
      api.get("/site/testimonials").then(r => setTestimonials(r.data)),
      api.get("/site/faqs").then(r => setFaqs(r.data)),
      api.get("/site/banners").then(r => setBanners(r.data)),
    ]).catch(() => {});
  }, []);

  return (
    <div data-testid="landing-page">
      {/* HERO */}
      <section className="relative bg-hero-glow">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-full text-xs font-semibold text-[#92400E]" data-testid="hero-badge">
              <Sparkles className="w-3.5 h-3.5"/> India's Most Trusted MLM Hamper Platform
            </div>
            <h1 className="font-display text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[#064E3B]" data-testid="hero-title">
              Grow Your <span className="text-[#84CC16]">Network</span>,<br/>
              Multiply Your <span className="text-[#FBBF24]">Wealth</span>
            </h1>
            <p className="text-lg text-[#334155] leading-relaxed max-w-xl">
              Buy premium hampers, share your referral link, and earn through 8 transparent stages. {site?.tagline || "Real products. Real commissions. Real wealth."}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/register" className="btn-primary text-base px-7" data-testid="hero-cta-join">
                Start Earning Today <ArrowRight className="w-4 h-4"/>
              </Link>
              <Link to="/calculator" className="btn-outline text-base" data-testid="hero-cta-calculator">
                <TrendingUp className="w-4 h-4"/> Calculate Earnings
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-8 pt-6">
              <Stat number="50,000+" label="Active Members"/>
              <Stat number="₹12 Cr+" label="Commissions Paid"/>
              <Stat number="8" label="Earning Stages"/>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative">
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-[#FBBF24]/30 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -right-4 w-40 h-40 bg-[#84CC16]/30 rounded-full blur-3xl" />
              <img src={HERO_IMG} alt="Happy family" className="relative rounded-3xl shadow-2xl w-full"/>
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-float" data-testid="hero-floating-card">
                <div className="bg-[#84CC16] rounded-full w-10 h-10 flex items-center justify-center"><Wallet className="w-5 h-5 text-[#064E3B]"/></div>
                <div>
                  <div className="text-xs text-[#64748B]">This month payout</div>
                  <div className="font-numbers text-xl font-bold text-[#064E3B]">₹2,45,890</div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-[#064E3B] text-white p-3 rounded-2xl shadow-xl flex items-center gap-2 animate-float" style={{animationDelay: "1.5s"}}>
                <Users className="w-4 h-4 text-[#84CC16]"/>
                <span className="text-xs font-semibold">+247 joined today</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-[#E2E8F0] bg-white py-6">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <Trust icon={ShieldCheck} title="Secure Payments" sub="256-bit SSL"/>
          <Trust icon={Truck} title="Free Shipping" sub="Orders above ₹999"/>
          <Trust icon={Award} title="Premium Quality" sub="Hand-picked items"/>
          <Trust icon={Sparkles} title="Daily Payouts" sub="Auto wallet credit"/>
        </div>
      </section>

      {/* HAMPERS */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Joining Packages</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">Choose Your <span className="text-[#84CC16]">Starter Hamper</span></h2>
          </div>
          <Link to="/hampers" className="hidden md:flex items-center text-sm font-semibold text-[#064E3B] hover:gap-2 transition-all" data-testid="hampers-view-all">
            View all <ChevronRight className="w-4 h-4"/>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {hampers.map((h, i) => (
            <Link to={`/products/${h.id}`} key={h.id} className="group" data-testid={`hamper-card-${h.hamper_tier?.toLowerCase()}`}>
              <div className="card-soft overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-300">
                <div className="relative aspect-square bg-gradient-to-br from-[#ECFCCB] to-[#FEF3C7] overflow-hidden">
                  <img src={h.images?.[0]} alt={h.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-110 transition-transform duration-500"/>
                  <div className="absolute top-3 left-3 badge-pill bg-[#064E3B] text-white">{h.hamper_tier}</div>
                  {h.badges?.includes("bestseller") && <div className="absolute top-3 right-3 badge-pill bg-[#FBBF24] text-[#064E3B]">Bestseller</div>}
                </div>
                <div className="p-5">
                  <div className="font-display font-semibold text-lg text-[#064E3B] mb-1">{h.name}</div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-numbers text-2xl font-bold text-[#064E3B]">₹{h.price.toLocaleString()}</span>
                    <span className="text-sm text-[#94A3B8] line-through font-numbers">₹{h.mrp.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-[#65A30D] font-semibold flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5"/> Activates MLM stages
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 8-STAGE PLAN */}
      <section className="bg-[#064E3B] text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#84CC16] mb-2">8-Stage MLM Plan</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-white">Earn at Every Stage You Complete</h2>
            <p className="text-white/70 mt-4 max-w-2xl mx-auto">3 referrals per stage. Stages 1, 3, 5, 7 and 8 pay commissions. Auto-cycle on completion.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {s: 1, c: 500, p: true},
              {s: 2, c: 0, p: false},
              {s: 3, c: 1500, p: true},
              {s: 4, c: 0, p: false},
              {s: 5, c: 5000, p: true},
              {s: 6, c: 0, p: false},
              {s: 7, c: 15000, p: true},
              {s: 8, c: 50000, p: true, cycle: true},
            ].map((st) => (
              <div key={st.s} className={`rounded-2xl p-5 border ${st.p ? "bg-gradient-to-br from-[#84CC16] to-[#65A30D] border-[#84CC16] text-[#064E3B]" : "bg-white/5 border-white/10"}`} data-testid={`stage-card-${st.s}`}>
                <div className={`text-xs uppercase tracking-widest font-semibold ${st.p ? "text-[#064E3B]/70" : "text-white/60"}`}>Stage {st.s}</div>
                <div className={`font-numbers text-3xl font-bold mt-2 ${st.p ? "text-[#064E3B]" : "text-white"}`}>
                  {st.c > 0 ? `₹${st.c.toLocaleString()}` : "—"}
                </div>
                <div className={`text-xs mt-2 ${st.p ? "text-[#064E3B]/80" : "text-white/60"}`}>
                  {st.cycle ? "Cycle Reward" : st.c > 0 ? "Commission" : "Build phase"}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/compensation-plan" className="inline-flex items-center gap-2 text-[#84CC16] hover:text-[#FBBF24] font-semibold" data-testid="plan-learn-more">
              Learn the full compensation plan <ArrowRight className="w-4 h-4"/>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Premium Picks</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">Featured <span className="text-[#FBBF24]">Products</span></h2>
          </div>
          <Link to="/products" className="hidden md:flex items-center text-sm font-semibold text-[#064E3B] hover:gap-2 transition-all">
            Shop all <ChevronRight className="w-4 h-4"/>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p}/>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-[#ECFCCB] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Real Stories</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">What Our Members Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.id} className="card-soft p-6" data-testid={`testimonial-${t.id}`}>
                <Quote className="w-8 h-8 text-[#84CC16] mb-3"/>
                <p className="text-[#334155] leading-relaxed mb-4">"{t.message}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full"/>
                  <div>
                    <div className="font-semibold text-[#064E3B] text-sm">{t.name}</div>
                    <div className="text-xs text-[#65A30D]">{t.role}</div>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(t.rating)].map((_, i) => (<Star key={i} className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]"/>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 max-w-4xl mx-auto px-6" data-testid="landing-faq-section">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Frequently Asked</div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold">Questions, Answered</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <button key={f.id} onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full text-left card-soft p-5 hover:border-[#84CC16] transition-colors" data-testid={`faq-${i}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[#064E3B]">{f.question}</div>
                <ChevronRight className={`w-4 h-4 text-[#65A30D] transition-transform ${openFaq === i ? "rotate-90" : ""}`}/>
              </div>
              {openFaq === i && <p className="text-[#334155] mt-3 leading-relaxed">{f.answer}</p>}
            </button>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="card-soft p-10 lg:p-16 bg-gradient-to-br from-[#84CC16] via-[#65A30D] to-[#064E3B] text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 dot-bg opacity-10"/>
          <div className="relative">
            <h2 className="font-display text-4xl lg:text-5xl font-bold mb-4">Your Wealth Journey Starts Today</h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">Join 50,000+ members building consistent monthly income with EverGro eMart.</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#064E3B] font-bold px-8 py-4 rounded-full text-lg transition-all hover:-translate-y-1 hover:shadow-2xl" data-testid="landing-final-cta">
              <Gift className="w-5 h-5"/> Get Started — ₹2,999
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ number, label }) {
  return (
    <div>
      <div className="font-numbers text-3xl font-bold text-[#064E3B]">{number}</div>
      <div className="text-xs uppercase tracking-widest text-[#65A30D] mt-1">{label}</div>
    </div>
  );
}

function Trust({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-[#ECFCCB] rounded-xl p-2.5"><Icon className="w-5 h-5 text-[#65A30D]"/></div>
      <div>
        <div className="font-semibold text-[#064E3B] text-sm">{title}</div>
        <div className="text-xs text-[#64748B]">{sub}</div>
      </div>
    </div>
  );
}

export function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.id}`} className="group block" data-testid={`product-card-${product.id}`}>
      <div className="card-soft overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all">
        <div className="relative aspect-square bg-[#FAFAF9] overflow-hidden">
          <img src={product.images?.[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
          {product.badges?.[0] && (
            <div className="absolute top-3 left-3 badge-pill bg-[#84CC16] text-[#064E3B] uppercase">{product.badges[0]}</div>
          )}
        </div>
        <div className="p-4">
          <div className="font-semibold text-[#064E3B] text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{product.name}</div>
          <div className="flex items-center gap-1 text-xs text-[#94A3B8] mb-2">
            <Star className="w-3 h-3 fill-[#FBBF24] text-[#FBBF24]"/> {product.rating} · {product.review_count} reviews
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-numbers text-lg font-bold text-[#064E3B]">₹{product.price}</span>
            {product.mrp > product.price && <span className="text-xs text-[#94A3B8] line-through">₹{product.mrp}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
