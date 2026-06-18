export default function CompensationPlan() {
  const stages = [
    { s: 1, c: 500, p: true, refs: 3 },
    { s: 2, c: 0, p: false, refs: 3 },
    { s: 3, c: 1500, p: true, refs: 3 },
    { s: 4, c: 0, p: false, refs: 3 },
    { s: 5, c: 5000, p: true, refs: 3 },
    { s: 6, c: 0, p: false, refs: 3 },
    { s: 7, c: 15000, p: true, refs: 3 },
    { s: 8, c: 50000, p: true, refs: 3, cycle: true },
  ];
  const total = stages.reduce((a, b) => a + b.c, 0);
  return (
    <div className="max-w-5xl mx-auto px-6 py-16" data-testid="compensation-plan-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Compensation</div>
      <h1 className="font-display text-5xl font-bold mb-6">Earn Up to ₹{total.toLocaleString()} Per Cycle</h1>
      <p className="text-lg text-[#334155] mb-12 max-w-3xl">Our 8-stage compensation plan rewards both effort and consistency. Here's exactly how much you earn at each stage.</p>

      <div className="overflow-hidden card-soft">
        <table className="w-full">
          <thead className="bg-[#064E3B] text-white">
            <tr>
              <th className="text-left p-4">Stage</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Referrals Required</th>
              <th className="text-right p-4">Commission</th>
            </tr>
          </thead>
          <tbody className="font-numbers">
            {stages.map((s) => (
              <tr key={s.s} className="border-b border-[#E2E8F0]">
                <td className="p-4 font-bold">Stage {s.s}</td>
                <td className="p-4">
                  <span className={`badge-pill ${s.p ? "bg-[#84CC16] text-[#064E3B]" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                    {s.cycle ? "Cycle Reward" : s.p ? "Commission" : "Build Phase"}
                  </span>
                </td>
                <td className="p-4">{s.refs} direct</td>
                <td className="p-4 text-right font-bold text-lg">{s.c > 0 ? `₹${s.c.toLocaleString()}` : "—"}</td>
              </tr>
            ))}
            <tr className="bg-[#ECFCCB]">
              <td colSpan={3} className="p-4 font-display font-bold text-[#064E3B] text-lg">Total Per Cycle</td>
              <td className="p-4 text-right font-bold text-2xl text-[#064E3B] font-numbers">₹{total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm text-[#64748B] mt-6">
        * Commissions credited to your wallet upon stage completion (3 active referrals). Withdrawals require approved KYC. Stages 2, 4, 6 are "build" stages — focus on team growth.
      </p>
    </div>
  );
}
