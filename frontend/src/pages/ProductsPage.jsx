import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Lock, Search, Star } from "lucide-react";
import { ProductCard } from "@/pages/Landing";

const CATEGORY_META = [
  { key: "", label: "All", icon: "🛒" },
  { key: "groceries", label: "Groceries", icon: "🌾" },
  { key: "snacks", label: "Snacks", icon: "🍪" },
  { key: "beverages", label: "Beverages", icon: "☕" },
  { key: "wellness", label: "Wellness", icon: "💚" },
  { key: "general", label: "General", icon: "📦" },
];

export default function ProductsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "";
  const [featured, setFeatured] = useState([]);

  const setCategory = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key) next.set("category", key); else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("is_hamper", "false");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    api.get(`/products?${params}`).then(({ data }) => setItems(data)).catch(() => {});
  }, [q, category]);

  useEffect(() => {
    // Featured/bestseller row (shown at top like Flipkart "New & Upcoming")
    api.get("/products?is_hamper=false").then(({ data }) => {
      const feat = data.filter((p) => (p.badges || []).some((b) => ["bestseller", "featured", "trending", "new"].includes(b)));
      setFeatured(feat.slice(0, 6));
    }).catch(() => {});
  }, []);

  const showJoinGate = user && !user.is_joining_paid;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8" data-testid="products-page">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-[#064E3B]">All Products</h1>
        <p className="text-sm text-[#64748B] mt-1">Browse premium groceries, snacks, wellness & more — hand-picked by EverGro.</p>
      </div>

      {showJoinGate && (
        <div className="mb-6 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex items-start gap-3" data-testid="products-join-gate">
          <Lock className="w-5 h-5 text-[#92400E] flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-[#92400E] flex-1">
            <div className="font-semibold mb-0.5">Unlock the full store</div>
            You can browse products, but adding to cart is locked until you complete your ₹7,499 Purchasing Kit.
          </div>
          <Link to="/hampers" className="btn-primary text-xs whitespace-nowrap" data-testid="products-view-kit-btn">View Purchasing Kit</Link>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
        <input
          className="input-soft pl-11"
          placeholder="Search for products, brands and more…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="products-search"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left sidebar categories (Flipkart-style) */}
        <aside className="col-span-3 md:col-span-2 sticky top-24 self-start" data-testid="category-sidebar">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-3 hidden md:block">All Categories</div>
          <div className="space-y-1">
            {CATEGORY_META.map((c) => (
              <button
                key={c.key || "all"}
                onClick={() => setCategory(c.key)}
                className={`w-full flex flex-col md:flex-row md:items-center gap-2 p-2 md:px-3 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all text-center md:text-left ${
                  category === c.key
                    ? "bg-[#84CC16] text-[#064E3B] shadow-sm"
                    : "text-[#334155] hover:bg-[#ECFCCB]"
                }`}
                data-testid={`cat-sidebar-${c.key || "all"}`}
              >
                <span className="text-xl md:text-lg">{c.icon}</span>
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Right content */}
        <div className="col-span-9 md:col-span-10 space-y-8">
          {/* Featured row */}
          {featured.length > 0 && !q && !category && (
            <section data-testid="featured-row">
              <h2 className="font-display text-xl font-bold text-[#064E3B] mb-4">New &amp; Upcoming Launches</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {featured.map((p) => (
                  <Link
                    key={p.id}
                    to={`/products/${p.id}`}
                    className="card-soft p-3 flex gap-3 items-center hover:-translate-y-1 transition-transform"
                    data-testid={`featured-product-${p.id}`}
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-[#FAFAF9] flex-shrink-0">
                      <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover"/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs bg-[#84CC16] text-[#064E3B] font-bold uppercase inline-block px-2 py-0.5 rounded mb-1">
                        {p.badges?.[0] || "New"}
                      </div>
                      <div className="text-sm font-semibold text-[#064E3B] truncate">{p.name}</div>
                      <div className="text-xs flex items-center gap-1 text-[#94A3B8]">
                        <Star className="w-3 h-3 fill-[#FBBF24] text-[#FBBF24]"/>
                        <span>{p.rating}</span>
                      </div>
                      <div className="font-numbers text-sm font-bold text-[#064E3B]">₹{p.price}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Main product grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-[#064E3B]">
                {category ? CATEGORY_META.find((c) => c.key === category)?.label : "All Products"}
                <span className="text-sm font-normal text-[#64748B] ml-2">({items.length})</span>
              </h2>
            </div>
            {items.length === 0 ? (
              <div className="card-soft p-12 text-center text-[#64748B]" data-testid="products-empty">
                No products found{q ? ` matching "${q}"` : ""}.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p}/>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
