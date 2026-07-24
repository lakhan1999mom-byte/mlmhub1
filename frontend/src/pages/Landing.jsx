import { useEffect, useState, useRef } from "react";
import { Link, useOutletContext } from "react-router-dom";
import api from "@/lib/api";
import { ArrowRight, Star, Users, Wallet, Sparkles, ShieldCheck, Award, ChevronRight, ChevronLeft, Quote, TrendingUp, Gift } from "lucide-react";
import HeroSlider from "@/components/HeroSlider";
import ReelsRow from "@/components/ReelsRow";
import { INCOME_LEVELS, TOTAL_POTENTIAL_WORDS } from "@/lib/plan-theme";

const HERO_IMG = "https://images.unsplash.com/photo-1753354868431-a5317771a3ea?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

export default function Landing() {
  const { site } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [hampers, setHampers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [openFaq, setOpenFaq] = useState(0);
  const [sliderTop, setSliderTop] = useState([]);
  const [sliderMid, setSliderMid] = useState([]);
  const [reels, setReels] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/products?is_hamper=false").then(r => setProducts(r.data.slice(0, 8))),
      api.get("/products?is_hamper=true").then(r => setHampers(r.data)),
      api.get("/site/testimonials").then(r => setTestimonials(r.data)),
      api.get("/site/faqs").then(r => setFaqs(r.data)),
      api.get("/site/brands").then(r => setBrands(r.data)),
      api.get("/sliders?location=landing_top").then(r => setSliderTop(r.data)),
      api.get("/sliders?location=landing_mid").then(r => setSliderMid(r.data)),
      api.get("/reels?location=landing").then(r => setReels(r.data)),
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
              <Stat number="8" label="Income Levels"/>
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
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-3 gap-6">
          <Trust icon={ShieldCheck} title="Secure Payments" sub="256-bit SSL"/>
          <Trust icon={Award} title="Premium Quality" sub="Hand-picked items"/>
          <Trust icon={Sparkles} title="Daily Payouts" sub="Auto wallet credit"/>
        </div>
      </section>

      {/* PROMO SLIDER #1 (admin controlled) */}
      {sliderTop.length > 0 && (
        <section className="pt-12 max-w-7xl mx-auto px-6">
          <HeroSlider slides={sliderTop} testid="landing-slider-top"/>
        </section>
      )}

      {/* REELS — Vertical Videos for engagement */}
      {reels.length > 0 && <ReelsRow reels={reels} title="Watch Member Stories & Demos" testid="landing-reels"/>}

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

      {/* 8-LEVEL INCOME PLAN */}
      <section className="bg-[#064E3B] text-white py-16 lg:py-20" data-testid="landing-plan-section">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#84CC16] mb-2">8-Level Income Plan</div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white">Earn Continuously From 8 Levels</h2>
            <p className="text-white/70 mt-3 max-w-2xl mx-auto text-sm md:text-base">
              One-time ₹7,200 purchase • Refer up to 6 direct members • Earn from every downline level.
            </p>
          </div>

          {/* Plan Overview flow — 4 steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" data-testid="plan-overview-flow">
            {[
              { n: 1, title: "Purchase Kit", sub: "₹7,200 One-Time", icon: "🛒" },
              { n: 2, title: "Get Referral Code", sub: "Your unique ID", icon: "🔗" },
              { n: 3, title: "Refer 6 Direct", sub: "Max 6 per member", icon: "👥" },
              { n: 4, title: "Team Refers Too", sub: "Earn continuously", icon: "🌱" },
            ].map((s) => (
              <div key={s.n} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 text-center" data-testid={`plan-step-${s.n}`}>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#84CC16] text-[#064E3B] font-bold flex items-center justify-center text-2xl mx-auto mb-3">
                  {s.icon}
                </div>
                <div className="font-display font-bold text-sm md:text-base text-white">{s.title}</div>
                <div className="text-xs text-white/60 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Highlight banner */}
          <div className="bg-[#FBBF24] text-[#064E3B] rounded-xl p-3 md:p-4 text-center font-semibold text-sm md:text-base mb-8 max-w-3xl mx-auto" data-testid="plan-max-refs-banner">
            ⚠ Maximum 6 direct referrals per member — each member can add up to 6 direct members
          </div>

          {/* 8-Level Income Structure Table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden" data-testid="plan-income-table">
            <div className="bg-[#84CC16] text-[#064E3B] px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="font-display font-bold text-base md:text-lg">8-Level Income Structure</div>
              <div className="text-xs md:text-sm font-semibold opacity-80">Income calculated on 6 members per level</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-numbers text-sm md:text-base">
                <thead>
                  <tr className="text-white/60 text-xs uppercase tracking-wider border-b border-white/10">
                    <th className="px-3 md:px-6 py-3">Level</th>
                    <th className="px-3 md:px-6 py-3 text-right">Per Member Income</th>
                    <th className="px-3 md:px-6 py-3 text-right hidden sm:table-cell">Total Members</th>
                    <th className="px-3 md:px-6 py-3 text-right">Total Income</th>
                  </tr>
                </thead>
                <tbody>
                  {INCOME_LEVELS.map((r) => (
                    <tr key={r.l} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors" data-testid={`plan-level-${r.l}`}>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm md:text-base"
                            style={{ backgroundColor: r.color }}
                          >
                            {r.l}
                          </span>
                          <span className="text-white/70 text-xs uppercase hidden md:inline">Level</span>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right text-white font-semibold">₹{r.per.toLocaleString("en-IN")}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right text-white/80 hidden sm:table-cell">{r.members.toLocaleString("en-IN")}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right font-bold" style={{ color: r.color }}>
                        ₹{r.total.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 md:px-6 py-3 text-xs text-white/50 border-t border-white/5">
              Note: Team calculation is based on 6 members per level (theoretical maximum).
            </div>
          </div>

          {/* Total Potential */}
          <div className="mt-8 grid md:grid-cols-3 gap-4 items-stretch">
            <div className="md:col-span-2 bg-gradient-to-br from-[#84CC16] to-[#65A30D] rounded-2xl p-6 md:p-8 text-[#064E3B]" data-testid="plan-total-potential">
              <div className="text-xs uppercase tracking-widest font-bold opacity-80">Total Earning Potential</div>
              <div className="text-xs opacity-70 mb-2">on complete 6-member chain across 8 levels</div>
              <div className="font-numbers text-3xl md:text-5xl font-black leading-tight">₹19,20,99,600</div>
              <div className="text-xs md:text-sm mt-2 opacity-80">{TOTAL_POTENTIAL_WORDS}</div>
            </div>
            <div className="bg-[#FBBF24] text-[#064E3B] rounded-2xl p-6 flex flex-col items-center justify-center text-center" data-testid="plan-lifetime-badge">
              <div className="text-4xl mb-2">🏆</div>
              <div className="font-display font-bold text-lg">Lifetime Income Opportunity</div>
              <div className="text-xs mt-1 opacity-80">No monthly fees · 100% transparent</div>
            </div>
          </div>

          {/* Terms & Rules footer */}
          <div className="mt-8 bg-white/[0.03] border border-white/10 rounded-2xl p-5 md:p-6" data-testid="plan-terms">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#84CC16] mb-3">Terms & Conditions</div>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex gap-2"><span className="text-[#84CC16]">✓</span> The above income is calculated on the basis of 6 members per level.</li>
              <li className="flex gap-2"><span className="text-[#84CC16]">✓</span> Your income will start from the time <strong className="text-[#FBBF24]">3 of your direct members</strong> make the ₹7,200 purchase.</li>
              <li className="flex gap-2"><span className="text-[#84CC16]">✓</span> No monthly fees, no hidden charges — 100% transparent plan.</li>
              <li className="flex gap-2"><span className="text-[#84CC16]">✓</span> Unlimited income potential with lifetime opportunity.</li>
            </ul>
          </div>

          <div className="text-center mt-8">
            <Link
              to="/compensation-plan"
              className="inline-flex items-center gap-2 text-[#84CC16] hover:text-[#FBBF24] font-semibold"
              data-testid="plan-learn-more"
            >
              View full compensation plan <ArrowRight className="w-4 h-4"/>
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

      {/* PROMO SLIDER #2 (admin controlled) */}
      {sliderMid.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <HeroSlider slides={sliderMid} testid="landing-slider-mid"/>
        </section>
      )}

      {/* PARTNER BRANDS SLIDER — admin controlled */}
      {brands.length > 0 && (
        <section className="py-12 bg-white border-y border-[#E2E8F0]" data-testid="landing-brand-slider">
          <div className="max-w-7xl mx-auto px-6 text-center mb-8">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Delivering premium brands</div>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-[#064E3B]">We deliver these brand products under our line</h3>
          </div>
          <div className="overflow-hidden relative">
            <div className="flex gap-12 animate-marquee whitespace-nowrap items-center">
              {[...brands, ...brands].map((b, i) => (
                <div key={`${b.id}-${i}`} className="inline-flex flex-col items-center justify-center min-w-[140px] px-4" data-testid={`brand-logo-${b.id}`}>
                  <img src={b.logo_url} alt={b.name} className="max-h-16 max-w-[120px] object-contain grayscale hover:grayscale-0 transition-all duration-300"/>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS — slider with all seeded ~20 */}
      <section className="bg-[#ECFCCB] py-20" data-testid="landing-testimonials">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Real Stories</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">What Our Members Say</h2>
          </div>
          <TestimonialSlider testimonials={testimonials}/>
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
    </div>
  );
}

function TestimonialSlider({ testimonials }) {
  const [idx, setIdx] = useState(0);
  const perPage = 3;
  const trackRef = useRef(null);

  useEffect(() => {
    if (!testimonials || testimonials.length <= perPage) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % Math.max(1, testimonials.length - perPage + 1));
    }, 4500);
    return () => clearInterval(t);
  }, [testimonials]);

  if (!testimonials || testimonials.length === 0) return null;

  const maxIdx = Math.max(0, testimonials.length - perPage);
  const clampedIdx = Math.min(idx, maxIdx);

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex transition-transform duration-500 ease-out gap-6"
          style={{ transform: `translateX(-${clampedIdx * (100 / perPage)}%)` }}
        >
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="card-soft p-6 flex-shrink-0 w-full md:w-[calc((100%-3rem)/3)]"
              data-testid={`testimonial-${t.id}`}
            >
              <Quote className="w-8 h-8 text-[#84CC16] mb-3"/>
              <p className="text-[#334155] leading-relaxed mb-4 line-clamp-4">"{t.message}"</p>
              <div className="flex items-center gap-3">
                <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full"/>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#064E3B] text-sm truncate">{t.name}</div>
                  <div className="text-xs text-[#65A30D]">{t.role}</div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(t.rating)].map((_, i) => (<Star key={i} className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]"/>))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {testimonials.length > perPage && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="w-9 h-9 rounded-full bg-white border border-[#E2E8F0] hover:border-[#84CC16] flex items-center justify-center"
            data-testid="testimonial-prev"
          >
            <ChevronLeft className="w-4 h-4 text-[#064E3B]"/>
          </button>
          <div className="text-xs text-[#64748B] font-numbers">
            {clampedIdx + 1} / {maxIdx + 1}
          </div>
          <button
            onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))}
            className="w-9 h-9 rounded-full bg-white border border-[#E2E8F0] hover:border-[#84CC16] flex items-center justify-center"
            data-testid="testimonial-next"
          >
            <ChevronRight className="w-4 h-4 text-[#064E3B]"/>
          </button>
        </div>
      )}
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
