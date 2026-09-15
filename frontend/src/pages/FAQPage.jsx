import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ChevronRight } from "lucide-react";

export default function FAQPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(0);
  useEffect(() => { api.get("/site/faqs").then(({ data }) => setItems(data)); }, []);
  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="faq-page">
      <h1 className="font-display text-5xl font-bold mb-8">FAQ</h1>
      <div className="space-y-3">
        {items.map((f, i) => (
          <button key={f.id} onClick={() => setOpen(open === i ? -1 : i)} className="w-full text-left card-soft p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold text-[#7F1D1D]">{f.question}</div>
              <ChevronRight className={`w-4 h-4 transition-transform ${open === i ? "rotate-90" : ""}`}/>
            </div>
            {open === i && <p className="text-[#334155] mt-3">{f.answer}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
