export default function About() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16" data-testid="about-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Who We Are</div>
      <h1 className="font-display text-5xl font-bold mb-6">About EverGro eMart</h1>
      <p className="text-lg text-[#334155] leading-relaxed mb-6">
        EverGro eMart is India's most transparent MLM-based hamper-selling platform. We curate premium grocery hampers and reward our members through an 8-stage compensation plan with timely payouts and clear rules.
      </p>
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <div className="card-soft p-6">
          <div className="text-3xl font-numbers font-bold text-[#84CC16]">50K+</div>
          <div className="text-sm text-[#334155] mt-1">Active members across India</div>
        </div>
        <div className="card-soft p-6">
          <div className="text-3xl font-numbers font-bold text-[#FBBF24]">₹12Cr+</div>
          <div className="text-sm text-[#334155] mt-1">Paid out in commissions</div>
        </div>
        <div className="card-soft p-6">
          <div className="text-3xl font-numbers font-bold text-[#064E3B]">99.8%</div>
          <div className="text-sm text-[#334155] mt-1">On-time delivery rate</div>
        </div>
      </div>
      <div className="mt-12 card-soft p-8">
        <h2 className="font-display text-2xl font-bold mb-3">Our Mission</h2>
        <p className="text-[#334155] leading-relaxed">
          To create wealth opportunities for ordinary Indians through premium product purchases and a fair, transparent MLM compensation structure.
        </p>
      </div>
    </div>
  );
}
