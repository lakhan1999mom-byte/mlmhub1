import { useMemo, useState } from "react";
import { Calculator as CalcIcon, TrendingUp, Users, Target } from "lucide-react";
import {
  LEVEL_COLORS,
  INCOME_LEVELS,
  KIT_PRICE,
  MAX_DIRECT_REFS,
  MIN_PAID_DIRECTS_FOR_INCOME,
  TOTAL_POTENTIAL,
} from "@/lib/plan-theme";

/**
 * Compute earnings across 8 levels for a given number of direct referrals (1-6).
 * Assumes each downline member also fills their branch symmetrically with the same `directs` value.
 * Level n members = directs^n · Level n income = directs^n × per_member_income
 * (matches the infographic when directs = MAX_DIRECT_REFS.)
 */
function computeForward(directs) {
  const rows = [1200, 400, 50, 300, 50, 200, 50, 100].map((per, i) => {
    const l = i + 1;
    const members = Math.pow(directs, l);
    return { l, per, members, total: per * members, color: LEVEL_COLORS[l] };
  });
  const totalIncome = rows.reduce((s, r) => s + r.total, 0);
  return { rows, totalIncome };
}

/** Reverse: given a target income, find the minimum symmetric `directs` (1..6) whose totalIncome ≥ target. */
function computeReverse(target) {
  for (let d = 1; d <= MAX_DIRECT_REFS; d++) {
    const { totalIncome, rows } = computeForward(d);
    if (totalIncome >= target) {
      const teamSize = rows.reduce((s, r) => s + r.members, 0);
      return { directs: d, totalIncome, teamSize, rows, achievable: true };
    }
  }
  // Target > absolute max
  const max = computeForward(MAX_DIRECT_REFS);
  return { directs: MAX_DIRECT_REFS, totalIncome: max.totalIncome, teamSize: max.rows.reduce((s, r) => s + r.members, 0), rows: max.rows, achievable: false };
}

export default function Calculator() {
  const [mode, setMode] = useState("forward"); // forward | reverse
  const [directs, setDirects] = useState(MAX_DIRECT_REFS);
  const [target, setTarget] = useState(500000);

  const forward = useMemo(() => computeForward(directs), [directs]);
  const reverse = useMemo(() => computeReverse(target), [target]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16" data-testid="calculator-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Income Calculator</div>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-[#064E3B] mb-2">
        Calculate Your <span className="text-[#84CC16]">Earnings</span>
      </h1>
      <p className="text-[#334155] mb-8 max-w-2xl">
        Live 8-Level plan calculator based on the exact commission structure:
        L1=₹1,200 · L2=₹400 · L3=₹50 · L4=₹300 · L5=₹50 · L6=₹200 · L7=₹50 · L8=₹100.
      </p>

      {/* Mode toggle */}
      <div className="inline-flex gap-2 bg-[#F1F5F9] p-1 rounded-full mb-6" data-testid="calc-mode-toggle">
        <button
          onClick={() => setMode("forward")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition ${mode === "forward" ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`}
          data-testid="calc-mode-forward"
        >
          <Users className="w-4 h-4 inline mr-1"/> Refs → Income
        </button>
        <button
          onClick={() => setMode("reverse")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition ${mode === "reverse" ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`}
          data-testid="calc-mode-reverse"
        >
          <Target className="w-4 h-4 inline mr-1"/> Target → Team Size
        </button>
      </div>

      {mode === "forward" ? (
        <ForwardPanel directs={directs} setDirects={setDirects} result={forward}/>
      ) : (
        <ReversePanel target={target} setTarget={setTarget} result={reverse}/>
      )}

      <div className="mt-8 text-xs text-[#64748B]" data-testid="calc-disclaimer">
        * Calculations assume a symmetric downline where each member adds the same number of directs. Real-world earnings depend on your team's actual growth and each member completing the ₹{KIT_PRICE.toLocaleString('en-IN')} purchasing kit. Income activates only after your {MIN_PAID_DIRECTS_FOR_INCOME}rd direct member pays.
      </div>
    </div>
  );
}

function ForwardPanel({ directs, setDirects, result }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="calc-forward-panel">
      <div className="card-soft p-6 lg:col-span-1">
        <div className="flex items-center gap-2 mb-3">
          <CalcIcon className="w-5 h-5 text-[#65A30D]"/>
          <div className="font-display font-bold text-[#064E3B]">Inputs</div>
        </div>
        <label className="text-sm font-semibold text-[#064E3B]">Direct referrals per member</label>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="range"
            min={1}
            max={MAX_DIRECT_REFS}
            step={1}
            value={directs}
            onChange={(e) => setDirects(+e.target.value)}
            className="flex-1"
            data-testid="calc-directs-slider"
          />
          <span className="font-numbers text-3xl font-bold text-[#065F46] min-w-[3rem] text-center" data-testid="calc-directs-value">
            {directs}
          </span>
        </div>
        <div className="text-xs text-[#64748B] mt-1">1 to {MAX_DIRECT_REFS} members (max cap)</div>

        <div className="mt-6 p-4 bg-[#ECFCCB] rounded-xl border border-[#D9F99D]">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D]">Estimated Total Income</div>
          <div className="font-numbers text-3xl md:text-4xl font-black text-[#064E3B] mt-1" data-testid="calc-forward-total">
            ₹{result.totalIncome.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#334155] mt-1">
            Team size across 8 levels: <b>{result.rows.reduce((s, r) => s + r.members, 0).toLocaleString('en-IN')}</b>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]">
          <strong>Note:</strong> Income activates only after your {MIN_PAID_DIRECTS_FOR_INCOME}rd direct member completes the ₹{KIT_PRICE.toLocaleString('en-IN')} purchase.
        </div>
      </div>

      <div className="card-soft overflow-hidden lg:col-span-2" data-testid="calc-forward-table">
        <div className="bg-[#064E3B] text-white px-4 md:px-6 py-3 font-display font-bold">Breakdown by Level</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-numbers">
            <thead>
              <tr className="text-[#64748B] text-xs uppercase tracking-wider border-b border-[#E2E8F0]">
                <th className="px-3 md:px-4 py-3 text-left">Level</th>
                <th className="px-3 md:px-4 py-3 text-right">Per Member (₹)</th>
                <th className="px-3 md:px-4 py-3 text-right">Members</th>
                <th className="px-3 md:px-4 py-3 text-right">Level Income (₹)</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.l} className="border-b border-[#E2E8F0]" data-testid={`calc-row-${r.l}`}>
                  <td className="px-3 md:px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[64px] px-3 py-1 rounded-full text-white font-bold text-xs" style={{ backgroundColor: r.color }}>
                      Level {r.l}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">₹{r.per.toLocaleString('en-IN')}</td>
                  <td className="px-3 md:px-4 py-3 text-right text-[#334155]">{r.members.toLocaleString('en-IN')}</td>
                  <td className="px-3 md:px-4 py-3 text-right font-bold" style={{ color: r.color }}>
                    ₹{r.total.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#ECFCCB]">
                <td colSpan={3} className="px-3 md:px-4 py-3 font-display font-bold text-[#064E3B]">Total</td>
                <td className="px-3 md:px-4 py-3 text-right font-bold text-lg text-[#064E3B]">₹{result.totalIncome.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReversePanel({ target, setTarget, result }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="calc-reverse-panel">
      <div className="card-soft p-6 lg:col-span-1">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-[#65A30D]"/>
          <div className="font-display font-bold text-[#064E3B]">Your Income Goal</div>
        </div>
        <label className="text-sm font-semibold text-[#064E3B]">Target total income (₹)</label>
        <input
          type="number"
          className="input-soft mt-2 font-numbers text-xl"
          value={target}
          onChange={(e) => setTarget(Math.max(0, +e.target.value || 0))}
          min={0}
          step={10000}
          data-testid="calc-target-input"
        />
        <div className="text-xs text-[#64748B] mt-1">Try ₹1 lakh, ₹10 lakh, ₹1 crore…</div>

        <div className="mt-6 p-4 bg-[#ECFCCB] rounded-xl border border-[#D9F99D]">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D]">Required per-member referrals</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="font-numbers text-3xl md:text-4xl font-black text-[#064E3B]" data-testid="calc-reverse-directs">
              {result.directs}
            </div>
            <div className="text-sm text-[#334155]">direct refs each</div>
          </div>
          <div className="text-xs text-[#334155] mt-2">
            Estimated total team size: <b data-testid="calc-reverse-teamsize">{result.teamSize.toLocaleString('en-IN')}</b> members
          </div>
          <div className="text-xs text-[#334155] mt-1">
            Reachable income at this level: <b>₹{result.totalIncome.toLocaleString('en-IN')}</b>
          </div>
        </div>

        {!result.achievable && (
          <div className="mt-4 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]" data-testid="calc-reverse-max-warning">
            ⚠ Your target exceeds the plan's theoretical maximum of ₹{TOTAL_POTENTIAL.toLocaleString('en-IN')} on a full {MAX_DIRECT_REFS}-member chain.
          </div>
        )}
      </div>

      <div className="card-soft overflow-hidden lg:col-span-2">
        <div className="bg-[#064E3B] text-white px-4 md:px-6 py-3 font-display font-bold">Breakdown at {result.directs} refs / member</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-numbers">
            <thead>
              <tr className="text-[#64748B] text-xs uppercase tracking-wider border-b border-[#E2E8F0]">
                <th className="px-3 md:px-4 py-3 text-left">Level</th>
                <th className="px-3 md:px-4 py-3 text-right">Per Member (₹)</th>
                <th className="px-3 md:px-4 py-3 text-right">Members</th>
                <th className="px-3 md:px-4 py-3 text-right">Income (₹)</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.l} className="border-b border-[#E2E8F0]">
                  <td className="px-3 md:px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[64px] px-3 py-1 rounded-full text-white font-bold text-xs" style={{ backgroundColor: r.color }}>
                      Level {r.l}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">₹{r.per.toLocaleString('en-IN')}</td>
                  <td className="px-3 md:px-4 py-3 text-right text-[#334155]">{r.members.toLocaleString('en-IN')}</td>
                  <td className="px-3 md:px-4 py-3 text-right font-bold" style={{ color: r.color }}>₹{r.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
