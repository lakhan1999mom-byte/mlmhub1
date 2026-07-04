export default function CompensationPlan() {
  const levels = [
    { l: 1, per: 1200, count: 6, total: 7200, color: "bg-[#65A30D]" },
    { l: 2, per: 400, count: 36, total: 14400, color: "bg-[#0EA5E9]" },
    { l: 3, per: 50, count: 216, total: 10800, color: "bg-[#0891B2]" },
    { l: 4, per: 300, count: 1296, total: 388800, color: "bg-[#9333EA]" },
    { l: 5, per: 50, count: 7776, total: 388800, color: "bg-[#EA580C]" },
    { l: 6, per: 200, count: 46656, total: 9331200, color: "bg-[#DC2626]" },
    { l: 7, per: 50, count: 279936, total: 13996800, color: "bg-[#2563EB]" },
    { l: 8, per: 100, count: 1679616, total: 167961600, color: "bg-[#1D4ED8]" },
  ];
  const grandTotal = 203699600;

  return (
    <div className="max-w-6xl mx-auto px-6 py-16" data-testid="compensation-plan-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">8-Level Income Structure</div>
      <h1 className="font-display text-5xl font-bold mb-4">Total Earning Potential<br/><span className="text-[#84CC16]">₹{grandTotal.toLocaleString('en-IN')}</span></h1>
      <p className="text-lg text-[#334155] mb-6 max-w-3xl">One-time ₹7,200 joining kit purchase. Every downline member's ₹7,200 purchase generates a fixed commission at each of 8 levels. Income starts when your 3rd direct referral pays.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="card-soft p-5">
          <div className="text-xs uppercase text-[#65A30D] font-semibold">Joining Amount</div>
          <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-1">₹7,200</div>
          <div className="text-xs text-[#64748B] mt-1">One-time · unlocks lifetime income</div>
        </div>
        <div className="card-soft p-5">
          <div className="text-xs uppercase text-[#65A30D] font-semibold">Max Direct Referrals</div>
          <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-1">6</div>
          <div className="text-xs text-[#64748B] mt-1">Per member, per layer</div>
        </div>
        <div className="card-soft p-5">
          <div className="text-xs uppercase text-[#65A30D] font-semibold">Income Starts After</div>
          <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-1">3 Paid Refs</div>
          <div className="text-xs text-[#64748B] mt-1">Your 3rd direct member pays ₹7,200</div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#064E3B] text-white">
            <tr>
              <th className="text-left p-4">Level</th>
              <th className="text-right p-4">Per Member (₹)</th>
              <th className="text-right p-4">Members in Team (max)</th>
              <th className="text-right p-4">Total Income (₹)</th>
            </tr>
          </thead>
          <tbody className="font-numbers">
            {levels.map((s) => (
              <tr key={s.l} className="border-b border-[#E2E8F0]">
                <td className="p-4"><span className={`badge-pill ${s.color} text-white`}>Level {s.l}</span></td>
                <td className="p-4 text-right">₹{s.per.toLocaleString('en-IN')}</td>
                <td className="p-4 text-right">{s.count.toLocaleString('en-IN')}</td>
                <td className="p-4 text-right font-bold text-lg">₹{s.total.toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr className="bg-[#ECFCCB]">
              <td colSpan={3} className="p-4 font-display font-bold text-[#064E3B] text-lg">Total Earning Potential per Cycle</td>
              <td className="p-4 text-right font-bold text-2xl text-[#064E3B]">₹{grandTotal.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm text-[#64748B] mt-6">
        * Income is calculated on 6 members per level. Actual income depends on your team's growth and their ₹7,200 joining purchases. Withdrawals require KYC approval and minimum 3 paid direct referrals.
      </p>
    </div>
  );
}
