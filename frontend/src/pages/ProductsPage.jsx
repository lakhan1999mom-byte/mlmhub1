import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ProductCard } from "@/pages/Landing";

export default function ProductsPage() {
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="products-page">
      <h1 className="font-display text-4xl font-bold mb-6">All Products</h1>
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
