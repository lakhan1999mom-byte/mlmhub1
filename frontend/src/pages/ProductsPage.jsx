import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Lock } from "lucide-react";
import { ProductCard } from "@/pages/Landing";

export default function ProductsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("is_hamper", "false");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    api.get(`/products?${params}`).then(({ data }) => setItems(data)).catch(() => {});
  }, [q, category]);

  const cats = ["", "groceries", "snacks", "beverages", "wellness"];
  const showJoinGate = user && !user.is_joining_paid;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="products-page">
      <h1 className="font-display text-4xl font-bold mb-6">All Products</h1>

      {showJoinGate && (
        <div className="mb-6 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex items-start gap-3" data-testid="products-join-gate">
          <Lock className="w-5 h-5 text-[#92400E] flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-[#92400E] flex-1">
            <div className="font-semibold mb-0.5">Unlock the full store</div>
            You can browse products, but adding to cart is locked until you complete your ₹7,200 Joining Kit.
          </div>
          <Link to="/hampers" className="btn-primary text-xs whitespace-nowrap" data-testid="products-view-kit-btn">View Joining Kit</Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-8">
        <input className="input-soft max-w-xs" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="products-search"/>
        <div className="flex gap-2 overflow-x-auto">
          {cats.map((c) => (
            <button key={c || "all"} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${category === c ? "bg-[#84CC16] text-[#064E3B]" : "bg-white border border-[#E2E8F0] text-[#334155]"}`} data-testid={`cat-${c || "all"}`}>
              {c || "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((p) => <ProductCard key={p.id} product={p}/>)}
      </div>
      {items.length === 0 && <div className="text-center text-[#64748B] py-12">No products found</div>}
    </div>
  );
}
