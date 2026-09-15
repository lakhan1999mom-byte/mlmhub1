import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Gift, CheckCircle2, Briefcase, Info } from "lucide-react";

export default function HampersPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/products?is_hamper=true").then(({ data }) => setItems(data));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="hampers-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Premium Bundles</div>
      <h1 className="font-display text-5xl font-bold mb-4">Choose Your Hamper</h1>
      <p className="text-lg text-[#334155] mb-10 max-w-3xl">Hand-picked premium hampers loaded with quality groceries, wellness essentials and gifting extras. Every bundle is packed with love and delivered pan-India.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((h) => (
          <div key={h.id} className="card-soft overflow-hidden" data-testid={`hamper-${h.hamper_tier?.toLowerCase()}`}>
            <div className="relative aspect-square bg-gradient-to-br from-[#FEE2E2] to-[#FEF2F2]">
              <img src={h.images?.[0]} alt={h.name} className="w-full h-full object-cover"/>
              <div className="absolute top-3 left-3 badge-pill bg-[#7F1D1D] text-white text-xs">{h.hamper_tier}</div>
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl font-bold mb-2">{h.name}</h3>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-numbers text-3xl font-bold text-[#7F1D1D]">₹{h.price.toLocaleString()}</span>
                <span className="text-sm text-[#94A3B8] line-through font-numbers">₹{h.mrp.toLocaleString()}</span>
              </div>
              <ul className="space-y-1 mb-4">
                {(h.contents || []).slice(0, 4).map((c, i) => (
                  <li key={i} className="text-xs text-[#334155] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-[#DC2626] mt-0.5"/> {c}
                  </li>
                ))}
              </ul>
              <Link to={`/products/${h.id}`} className="btn-primary w-full justify-center text-sm" data-testid={`order-hamper-${h.id}`}>
                <Gift className="w-4 h-4"/> Order Now
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* SALES AGENT BLOCK (optional program - no income guarantee) */}
      <section className="mt-16 max-w-4xl mx-auto card-soft p-6 md:p-8 border-2 border-[#FCA5A5]" data-testid="sales-agent-block">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5"/>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-[#B91C1C] mb-1">Optional Program</div>
            <h3 className="font-display text-2xl font-bold text-[#7F1D1D]">Become a Sales Agent</h3>
          </div>
        </div>
        <p className="text-[#334155] leading-relaxed mb-4">
          If you wish to become a Sales Agent on your own accord, click below to sign up. Based on your verified sales — and subject to the company's Terms & Conditions — EverGro eMart will pay you a commission on qualifying orders.
        </p>
        <div className="rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] p-3 flex items-start gap-2 text-xs text-[#7F1D1D] mb-4" data-testid="sales-agent-disclaimer">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]"/>
          <span><b>No income guarantee.</b> Payouts depend entirely on the sales you personally generate. Signing up as an agent does not entitle you to any fixed income, salary or reward.</span>
        </div>
        <Link to="/register?agent=1" className="btn-primary" data-testid="become-agent-btn">
          <Briefcase className="w-4 h-4"/> Sign up as Agent
        </Link>
      </section>
    </div>
  );
}
