import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Gift, CheckCircle2 } from "lucide-react";

export default function HampersPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/products?is_hamper=true").then(({ data }) => setItems(data));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="hampers-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Joining Packages</div>
      <h1 className="font-display text-5xl font-bold mb-4">Choose Your Hamper</h1>
      <p className="text-lg text-[#334155] mb-10 max-w-3xl">Every hamper activates your MLM account. Higher tiers unlock bigger team bonuses and faster cycle completion.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((h) => (
          <div key={h.id} className="card-soft overflow-hidden" data-testid={`hamper-${h.hamper_tier?.toLowerCase()}`}>
            <div className="relative aspect-square bg-gradient-to-br from-[#ECFCCB] to-[#FEF3C7]">
              <img src={h.images?.[0]} alt={h.name} className="w-full h-full object-cover"/>
              <div className="absolute top-3 left-3 badge-pill bg-[#064E3B] text-white text-xs">{h.hamper_tier}</div>
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl font-bold mb-2">{h.name}</h3>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-numbers text-3xl font-bold text-[#064E3B]">₹{h.price.toLocaleString()}</span>
                <span className="text-sm text-[#94A3B8] line-through font-numbers">₹{h.mrp.toLocaleString()}</span>
              </div>
              <ul className="space-y-1 mb-4">
                {(h.contents || []).slice(0, 4).map((c, i) => (
                  <li key={i} className="text-xs text-[#334155] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-[#84CC16] mt-0.5"/> {c}
                  </li>
                ))}
              </ul>
              <Link to={`/products/${h.id}`} className="btn-primary w-full justify-center text-sm">
                <Gift className="w-4 h-4"/> Order Now
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
