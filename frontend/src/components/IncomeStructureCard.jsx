import { useEffect, useState } from "react";
import { TrendingUp, Info, Users } from "lucide-react";
import api from "@/lib/api";

/**
 * Reusable income/rewards ladder card. Shows the current 8-level structure
 * (from backend settings) with per-member payout, member count, and level total.
 * Renders on both user dashboard and admin overview.
 * Props: variant = "user" (default) | "admin"
 */
export default function IncomeStructureCard({ variant = "user" }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/mlm/income-structure").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) return null;
  const total = data.total_potential || 0;
  const kit = data.joining_amount || 0;

  return (
    <div className="card-soft p-5 md:p-6" data-testid={`income-structure-card-${variant}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-[#B91C1C] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5"/> Rewards Ladder
          </div>
          <div className="font-display font-black text-xl text-[#7F1D1D] mt-1">
            Referral Rewards — {data.levels?.length || 8} tiers · Based on ₹{kit.toLocaleString("en-IN")} hamper
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            Up to {data.max_direct_referrals} direct referrals · Rewards activate after {data.min_direct_paid_for_income} paid referrals
          </div>
        </div>
        <div className="bg-[#FEE2E2] border border-[#DC2626]/20 rounded-2xl px-4 py-3 text-right shrink-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#B91C1C]">Max Potential</div>
          <div className="font-numbers font-black text-2xl text-[#7F1D1D]">₹{total.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-[#B91C1C] text-[10px] uppercase tracking-widest border-b border-[#FEE2E2]">
              <th className="px-3 py-2 text-left">Level</th>
              <th className="px-3 py-2 text-right">Per Member</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell"><span className="inline-flex items-center gap-1"><Users className="w-3 h-3"/> Members</span></th>
              <th className="px-3 py-2 text-right">Level Total</th>
            </tr>
          </thead>
          <tbody>
            {(data.levels || []).map((row) => (
              <tr key={row.level} className="border-b border-[#FEF2F2]" data-testid={`income-row-l${row.level}`}>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DC2626] text-white font-bold text-xs">L{row.level}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-numbers font-semibold text-[#7F1D1D]">₹{row.per_member.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2.5 text-right font-numbers text-[#64748B] hidden sm:table-cell">{row.members.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2.5 text-right font-numbers font-bold text-[#B91C1C]">₹{row.total.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] px-3 py-2 text-[11px] text-[#7F1D1D]" data-testid="income-disclaimer">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B91C1C]"/>
        <span>
          Members-per-tier is the theoretical maximum (6<sup>n</sup>). Actual rewards depend on real paid referrals in your network. No income is guaranteed — please read the Terms & Conditions.
        </span>
      </div>
    </div>
  );
}
