import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";

const fallback = {
  privacy: { title: "Privacy Policy", body: "We collect minimum data required (name, email, phone, KYC) to operate the platform. We never sell your data." },
  refund: { title: "Refund Policy", body: "Joining hamper purchases that have triggered kit activation cannot be refunded. Non-joining regular purchases can be returned within 7 days in original packaging." },
  shipping: { title: "Shipping Policy", body: "Free shipping on orders above threshold (admin-configurable). Delivery in 3-7 business days across India." },
};

export default function LegalPage() {
  const { type } = useParams();
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (type === "terms") {
      api.get("/site/terms").then(({ data }) => setTerms(data.content)).catch(() => {});
    }
  }, [type]);

  if (type === "terms") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12" data-testid="legal-terms">
        <div className="prose prose-lg max-w-none text-[#334155]" dangerouslySetInnerHTML={{ __html: terms || "<p>Loading…</p>" }}/>
      </div>
    );
  }

  const c = fallback[type] || fallback.privacy;
  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid={`legal-${type}`}>
      <h1 className="font-display text-4xl font-bold mb-6">{c.title}</h1>
      <p className="text-[#334155] leading-relaxed text-lg">{c.body}</p>
      <div className="mt-8 text-sm text-[#64748B]">Last updated: {new Date().toLocaleDateString()}</div>
    </div>
  );
}
