import { useEffect, useState, useRef } from "react";
import { Link, useOutletContext } from "react-router-dom";
import api from "@/lib/api";
import { ArrowRight, Star, ShoppingBag, Sparkles, ShieldCheck, Award, ChevronRight, ChevronLeft, Quote, Truck, Gift } from "lucide-react";
import HeroSlider from "@/components/HeroSlider";
import ReelsRow from "@/components/ReelsRow";

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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-full text-xs font-semibold text-[#7F1D1D]" data-testid="hero-badge">
              <Sparkles className="w-3.5 h-3.5"/> Premium Everyday Essentials · Home Delivered
            </div>
            <h1 className="font-display text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[#7F1D1D]" data-testid="hero-title">
              Shop Premium <span className="text-[#DC2626]">Hampers</span>,<br/>
              Delivered To Your <span className="text-[#DC2626]">Door</span>
            </h1>
            <p className="text-lg text-[#334155] leading-relaxed max-w-xl">
              Hand-picked gifting hampers and daily essentials from India's most loved brands. {site?.tagline || "Quality you can taste. Value you can feel."}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/products" className="btn-primary text-base px-7" data-testid="hero-cta-shop">
                Shop Now <ArrowRight className="w-4 h-4"/>
              </Link>
              <Link to="/hampers" className="btn-outline text-base" data-testid="hero-cta-hampers">
                <Gift className="w-4 h-4"/> Explore Hampers
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-8 pt-6">
              <Stat number="50,000+" label="Happy Customers"/>
              <Stat number="4.8★" label="Average Rating"/>
              <Stat number="24×7" label="Support"/>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative">
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-[#DC2626]/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -right-4 w-40 h-40 bg-[#DC2626]/20 rounded-full blur-3xl" />
              <img src={HERO_IMG} alt="Premium hamper" className="relative rounded-3xl shadow-2xl w-full"/>
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-float" data-testid="hero-floating-card">
                <div className="bg-[#DC2626] rounded-full w-10 h-10 flex items-center justify-center"><Truck className="w-5 h-5 text-white"/></div>
                <div>
                  <div className="text-xs text-[#64748B]">Free shipping above</div>
                  <div className="font-numbers text-xl font-bold text-[#7F1D1D]">₹999</div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-[#7F1D1D] text-white p-3 rounded-2xl shadow-xl flex items-center gap-2 animate-float" style={{animationDelay: "1.5s"}}>
                <ShoppingBag className="w-4 h-4 text-[#FCA5A5]"/>
                <span className="text-xs font-semibold">Fresh arrivals daily</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-[#FEE2E2] bg-white py-6">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-3 gap-6">
          <Trust icon={ShieldCheck} title="Secure Payments" sub="256-bit SSL"/>
          <Trust icon={Award} title="Premium Quality" sub="Hand-picked items"/>
          <Trust icon={Truck} title="Fast Delivery" sub="Pan-India shipping"/>
        </div>
      </section>

      {/* PROMO SLIDER #1 (admin controlled) */}
      {sliderTop.length > 0 && (
        <section className="pt-12 max-w-7xl mx-auto px-6">
          <HeroSlider slides={sliderTop} testid="landing-slider-top"/>
        </section>
      )}

      {/* REELS */}
      {reels.length > 0 && <ReelsRow reels={reels} title="Watch Our Product Stories" testid="landing-reels"/>}

      {/* HAMPERS */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Curated Bundles</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">Choose Your <span className="text-[#DC2626]">Starter Hamper</span></h2>
          </div>
          <Link to="/hampers" className="hidden md:flex items-center text-sm font-semibold text-[#7F1D1D] hover:gap-2 transition-all" data-testid="hampers-view-all">
            View all <ChevronRight className="w-4 h-4"/>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {hampers.map((h) => (
            <Link to={`/products/${h.id}`} key={h.id} className="group" data-testid={`hamper-card-${h.hamper_tier?.toLowerCase()}`}>
              <div className="card-soft overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-300">
                <div className="relative aspect-square bg-gradient-to-br from-[#FEE2E2] to-[#FEF2F2] overflow-hidden">
                  <img src={h.images?.[0]} alt={h.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-110 transition-transform duration-500"/>
                  <div className="absolute top-3 left-3 badge-pill bg-[#7F1D1D] text-white">{h.hamper_tier}</div>
                  {h.badges?.includes("bestseller") && <div className="absolute top-3 right-3 badge-pill bg-[#DC2626] text-white">Bestseller</div>}
                </div>
                <div className="p-5">
                  <div className="font-display font-semibold text-lg text-[#7F1D1D] mb-1">{h.name}</div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-numbers text-2xl font-bold text-[#7F1D1D]">₹{h.price.toLocaleString()}</span>
                    <span className="text-sm text-[#94A3B8] line-through font-numbers">₹{h.mrp.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-[#B91C1C] font-semibold flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5"/> Premium curated bundle
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Premium Picks</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">Featured <span className="text-[#DC2626]">Products</span></h2>
          </div>
          <Link to="/products" className="hidden md:flex items-center text-sm font-semibold text-[#7F1D1D] hover:gap-2 transition-all">
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
        <section className="py-12 bg-white border-y border-[#FEE2E2]" data-testid="landing-brand-slider">
          <div className="max-w-7xl mx-auto px-6 text-center mb-8">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Delivering premium brands</div>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-[#7F1D1D]">We deliver these brand products under our line</h3>
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

      {/* TESTIMONIALS */}
      <section className="bg-[#FEE2E2] py-20" data-testid="landing-testimonials">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Real Stories</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold">What Our Customers Say</h2>
          </div>
          <TestimonialSlider testimonials={testimonials}/>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 max-w-4xl mx-auto px-6" data-testid="landing-faq-section">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Frequently Asked</div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold">Questions, Answered</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <button key={f.id} onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full text-left card-soft p-5 hover:border-[#DC2626] transition-colors" data-testid={`faq-${i}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[#7F1D1D]">{f.question}</div>
                <ChevronRight className={`w-4 h-4 text-[#DC2626] transition-transform ${openFaq === i ? "rotate-90" : ""}`}/>
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
              <Quote className="w-8 h-8 text-[#DC2626] mb-3"/>
              <p className="text-[#334155] leading-relaxed mb-4 line-clamp-4">"{t.message}"</p>
              <div className="flex items-center gap-3">
                <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full"/>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#7F1D1D] text-sm truncate">{t.name}</div>
                  <div className="text-xs text-[#B91C1C]">{t.role}</div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(t.rating)].map((_, i) => (<Star key={i} className="w-3.5 h-3.5 fill-[#DC2626] text-[#DC2626]"/>))}
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
            className="w-9 h-9 rounded-full bg-white border border-[#FECACA] hover:border-[#DC2626] flex items-center justify-center"
            data-testid="testimonial-prev"
          >
            <ChevronLeft className="w-4 h-4 text-[#7F1D1D]"/>
          </button>
          <div className="text-xs text-[#64748B] font-numbers">
            {clampedIdx + 1} / {maxIdx + 1}
          </div>
          <button
            onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))}
            className="w-9 h-9 rounded-full bg-white border border-[#FECACA] hover:border-[#DC2626] flex items-center justify-center"
            data-testid="testimonial-next"
          >
            <ChevronRight className="w-4 h-4 text-[#7F1D1D]"/>
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ number, label }) {
  return (
    <div>
      <div className="font-numbers text-3xl font-bold text-[#7F1D1D]">{number}</div>
      <div className="text-xs uppercase tracking-widest text-[#B91C1C] mt-1">{label}</div>
    </div>
  );
}

function Trust({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-[#FEE2E2] rounded-xl p-2.5"><Icon className="w-5 h-5 text-[#DC2626]"/></div>
      <div>
        <div className="font-semibold text-[#7F1D1D] text-sm">{title}</div>
        <div className="text-xs text-[#64748B]">{sub}</div>
      </div>
    </div>
  );
}

export function ProductCard({ product }) {
  const discount = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return (
    <Link to={`/products/${product.id}`} className="group block" data-testid={`product-card-${product.id}`}>
      <div className="card-soft overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 relative">
        <div className="relative aspect-square bg-gradient-to-br from-white to-[#FEE2E2]/30 overflow-hidden">
          <img src={product.images?.[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
          {product.badges?.[0] && (
            <div className="absolute top-3 left-3 badge-pill bg-[#DC2626] text-white uppercase animate-pulse">{product.badges[0]}</div>
          )}
          {discount > 0 && (
            <div className="absolute top-3 right-3 bg-[#7F1D1D] text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">
              -{discount}%
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <span className="text-xs text-white font-bold tracking-wide">Quick view →</span>
          </div>
        </div>
        <div className="p-4">
          <div className="font-semibold text-[#7F1D1D] text-sm line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-[#DC2626] transition-colors">{product.name}</div>
          <div className="flex items-center gap-1 text-xs text-[#94A3B8] mb-2">
            <Star className="w-3 h-3 fill-[#DC2626] text-[#DC2626]"/> {product.rating} · {product.review_count} reviews
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-numbers text-lg font-bold text-[#7F1D1D]">₹{product.price}</span>
            {product.mrp > product.price && <span className="text-xs text-[#94A3B8] line-through">₹{product.mrp}</span>}
            {discount > 0 && <span className="text-xs text-[#B91C1C] font-bold ml-auto">Save ₹{product.mrp - product.price}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
