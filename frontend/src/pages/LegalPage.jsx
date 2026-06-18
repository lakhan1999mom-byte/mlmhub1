import { useParams } from "react-router-dom";

const content = {
  privacy: { title: "Privacy Policy", body: "We collect minimum data required (name, email, phone, KYC) to operate the platform. We never sell your data. All payments are processed via Razorpay using bank-grade encryption. KYC documents are stored securely on Cloudinary." },
  terms: { title: "Terms & Conditions", body: "By using EverGro eMart you agree to: (1) Provide accurate information, (2) Complete KYC for withdrawals, (3) Not abuse referral system with fake accounts, (4) Accept stage progression rules — 3 referrals per stage, commission on stages 1,3,5,7,8." },
  refund: { title: "Refund Policy", body: "Unused hampers can be returned within 7 days in original packaging. Joining hamper purchases that trigger MLM activation cannot be refunded after stage progression. Refunds are credited to original payment method within 7 business days." },
  shipping: { title: "Shipping Policy", body: "Free shipping on orders above ₹999. Standard delivery within 3-7 business days across India. Tracking number provided once shipped. Cash on delivery is not currently available." },
};

export default function LegalPage() {
  const { type } = useParams();
  const c = content[type] || content.privacy;
  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid={`legal-${type}`}>
      <h1 className="font-display text-4xl font-bold mb-6">{c.title}</h1>
      <p className="text-[#334155] leading-relaxed text-lg">{c.body}</p>
      <div className="mt-8 text-sm text-[#64748B]">Last updated: {new Date().toLocaleDateString()}</div>
    </div>
  );
}
