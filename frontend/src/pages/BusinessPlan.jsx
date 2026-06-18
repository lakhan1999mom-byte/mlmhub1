import { CheckCircle2 } from "lucide-react";

export default function BusinessPlan() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16" data-testid="business-plan-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">How It Works</div>
      <h1 className="font-display text-5xl font-bold mb-6">The EverGro Business Plan</h1>
      <p className="text-lg text-[#334155] mb-12 max-w-3xl">A simple 4-step journey from buyer to earner. No hidden fees, no surprises.</p>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {[
          { n: 1, t: "Join with a Hamper", d: "Buy a Bronze/Silver/Gold/Platinum hamper starting ₹2,999. This activates your MLM account at Stage 1." },
          { n: 2, t: "Share Your Referral Link", d: "Get a unique referral code and QR. Share with friends, family, and on social media." },
          { n: 3, t: "Refer 3 People per Stage", d: "Each stage requires 3 active referrals. Once completed, you automatically advance to the next stage." },
          { n: 4, t: "Earn Commissions Automatically", d: "Stages 1, 3, 5, 7 and 8 pay direct commissions to your wallet. Stage 8 completes a full cycle and you re-enter Stage 1." },
        ].map((s) => (
          <div key={s.n} className="card-soft p-6">
            <div className="w-12 h-12 rounded-full bg-[#84CC16] flex items-center justify-center font-numbers text-2xl font-bold text-[#064E3B]">{s.n}</div>
            <h3 className="font-display text-xl font-bold mt-4 mb-2">{s.t}</h3>
            <p className="text-[#334155] leading-relaxed">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="card-soft p-8 bg-[#064E3B] text-white">
        <h2 className="font-display text-2xl font-bold mb-4">Why EverGro is Different</h2>
        <ul className="space-y-3 text-white/90">
          {["Real, premium products you actually use","Transparent 8-stage compensation","Timely commission payouts","KYC-verified withdrawals","No team purchase pressure"].map((p) => (
            <li key={p} className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-[#84CC16] mt-0.5"/> {p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
