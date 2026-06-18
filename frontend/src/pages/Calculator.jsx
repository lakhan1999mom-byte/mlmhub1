import { useState, useMemo } from "react";
import { Calculator as CalcIcon } from "lucide-react";

export default function Calculator() {
  const [refsPerMonth, setRefsPerMonth] = useState(3);
  const [months, setMonths] = useState(6);

  const result = useMemo(() => {
    // Simple simulation: each stage requires 3 refs, commissions [500,0,1500,0,5000,0,15000,50000]
    const comms = [500, 0, 1500, 0, 5000, 0, 15000, 50000];
    let totalRefs = refsPerMonth * months;
    let stage = 1;
    let earnings = 0;
    let stagesCompleted = 0;
    while (totalRefs >= 3 && stage <= 8) {
      totalRefs -= 3;
      earnings += comms[stage - 1] || 0;
      stagesCompleted++;
      stage++;
    }
    return { earnings, stagesCompleted };
  }, [refsPerMonth, months]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-16" data-testid="calculator-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Earnings Estimator</div>
      <h1 className="font-display text-5xl font-bold mb-4">Income Calculator</h1>
      <p className="text-lg text-[#334155] mb-10">See how much you can earn based on your referral pace.</p>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="card-soft p-8 space-y-8">
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">Referrals per Month</label>
            <input type="range" min="1" max="20" value={refsPerMonth} onChange={(e) => setRefsPerMonth(+e.target.value)} className="w-full mt-3 accent-[#84CC16]" data-testid="calc-refs-slider"/>
            <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-2">{refsPerMonth}</div>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#064E3B]">Time Horizon (Months)</label>
            <input type="range" min="1" max="24" value={months} onChange={(e) => setMonths(+e.target.value)} className="w-full mt-3 accent-[#FBBF24]" data-testid="calc-months-slider"/>
            <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-2">{months}</div>
          </div>
        </div>

        <div className="card-soft p-8 bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-[#064E3B]">
          <CalcIcon className="w-10 h-10 mb-4"/>
          <div className="text-xs uppercase tracking-widest font-semibold opacity-80">Projected Earnings</div>
          <div className="font-numbers text-6xl font-bold mt-2" data-testid="calc-result-amount">₹{result.earnings.toLocaleString()}</div>
          <div className="mt-4 pt-4 border-t border-[#064E3B]/20">
            <div className="text-sm">Stages Completed: <span className="font-bold font-numbers">{result.stagesCompleted}</span></div>
            <div className="text-sm">Total Referrals: <span className="font-bold font-numbers">{refsPerMonth * months}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
