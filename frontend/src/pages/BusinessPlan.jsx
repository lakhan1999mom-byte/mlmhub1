import { Link } from "react-router-dom";
import { ShoppingBag, Share2, Users, Coins, ShieldCheck, Infinity, Wallet, TrendingUp, ChevronRight, Download } from "lucide-react";
import {
  INCOME_LEVELS,
  TOTAL_POTENTIAL,
  TOTAL_POTENTIAL_WORDS,
  KIT_PRICE,
  MAX_DIRECT_REFS,
  MIN_PAID_DIRECTS_FOR_INCOME,
  COMPENSATION_INFOGRAPHIC_URL,
} from "@/lib/plan-theme";

export default function BusinessPlan() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16" data-testid="business-plan-page">
      {/* Hero — matches infographic top banner */}
      <div className="bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#064E3B] text-white rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-10"/>
        <div className="relative">
          <div className="font-display text-3xl md:text-5xl font-black tracking-tight mb-2">
            EVERGRO <span className="text-[#FBBF24]">E-MART</span>
          </div>
          <div className="text-xs md:text-sm uppercase tracking-widest text-white/70 mb-6">
            Online Multi-Level Marketing Platform
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="bp-pillars">
            {[
              { icon: ShoppingBag, label: "SHOP ONLINE" },
              { icon: Share2, label: "SHARE & REFER" },
              { icon: Users, label: "BUILD TEAM" },
              { icon: Coins, label: "EARN CONTINUOUSLY" },
            ].map((p) => (
              <div key={p.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
                <p.icon className="w-5 h-5 md:w-6 md:h-6 text-[#84CC16]"/>
                <div className="text-xs md:text-sm font-bold">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Overview — 4-step visual flow */}
      <section className="card-soft p-6 md:p-8 mb-8" data-testid="bp-overview">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-1">Plan Overview</div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#064E3B]">4 Simple Steps to Continuous Income</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: 1, icon: "🛒", title: "Purchase", sub: `₹${KIT_PRICE.toLocaleString('en-IN')}`, note: "One-Time" },
            { n: 2, icon: "🔗", title: "Get Referral Code", sub: "Unique ID", note: "Yours forever" },
            { n: 3, icon: "👥", title: `Refer Max ${MAX_DIRECT_REFS}`, sub: "Direct Members", note: "Your team" },
            { n: 4, icon: "🌱", title: "Team Refers Too", sub: `${MAX_DIRECT_REFS} each`, note: "Earn continuously" },
          ].map((s, i) => (
            <div key={s.n} className="relative">
              <div className="text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#84CC16] text-[#064E3B] font-bold flex items-center justify-center text-2xl md:text-3xl mx-auto mb-3">
                  {s.icon}
                </div>
                <div className="font-display font-bold text-sm md:text-base text-[#064E3B]">{s.title}</div>
                <div className="font-numbers text-xs md:text-sm text-[#65A30D] font-semibold mt-0.5">{s.sub}</div>
                <div className="text-[10px] md:text-xs text-[#64748B] mt-0.5">{s.note}</div>
              </div>
              {i < 3 && <ChevronRight className="hidden md:block absolute top-6 -right-2 w-5 h-5 text-[#84CC16]"/>}
            </div>
          ))}
        </div>
        <div className="bg-[#FBBF24] text-[#064E3B] rounded-xl p-3 md:p-4 text-center font-semibold text-sm mt-6" data-testid="bp-max-refs-banner">
          ⚠ Maximum {MAX_DIRECT_REFS} direct referrals allowed — each member can add up to {MAX_DIRECT_REFS} direct members.
        </div>
      </section>

      {/* How It Works — bullet list matching infographic */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card-soft p-6 md:col-span-1" data-testid="bp-how-it-works">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-3">How It Works</div>
          <ol className="space-y-4 text-sm text-[#334155]">
            {[
              `Purchase products worth ₹${KIT_PRICE.toLocaleString('en-IN')} (one time)`,
              "Get your unique referral code",
              `Share your code & add max ${MAX_DIRECT_REFS} direct members`,
              `Your team also adds ${MAX_DIRECT_REFS} each`,
              "Earn from 8-level income continuously",
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#ECFCCB] text-[#65A30D] font-bold flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 p-4 bg-[#ECFCCB] rounded-xl border border-[#D9F99D]">
            <div className="flex items-center gap-2 text-[#064E3B] font-bold text-sm mb-1">
              <ShieldCheck className="w-4 h-4 text-[#65A30D]"/>
              100% Transparent Plan
            </div>
            <div className="text-xs text-[#334155]">No monthly fees · No hidden charges</div>
          </div>
        </div>

        {/* Income Table */}
        <div className="md:col-span-2 card-soft overflow-hidden" data-testid="bp-income-table">
          <div className="bg-[#064E3B] text-white px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="font-display font-bold text-base md:text-lg">8-Level Income Structure</div>
            <div className="text-xs md:text-sm opacity-70">Income calculated on {MAX_DIRECT_REFS} members</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[#64748B] text-xs uppercase tracking-wider border-b border-[#E2E8F0]">
                  <th className="px-3 md:px-4 py-3">Level</th>
                  <th className="px-3 md:px-4 py-3 text-right">Per Member (₹)</th>
                  <th className="px-3 md:px-4 py-3 text-right hidden sm:table-cell">Team Max</th>
                  <th className="px-3 md:px-4 py-3 text-right">Total Income (₹)</th>
                </tr>
              </thead>
              <tbody className="font-numbers">
                {INCOME_LEVELS.map((r) => (
                  <tr key={r.l} className="border-b border-[#E2E8F0] hover:bg-[#FAFAF9] transition-colors" data-testid={`bp-level-${r.l}`}>
                    <td className="px-3 md:px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[64px] px-3 py-1 rounded-full text-white font-bold text-xs" style={{ backgroundColor: r.color }}>
                        Level {r.l}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-3 text-right font-semibold">₹{r.per.toLocaleString('en-IN')}</td>
                    <td className="px-3 md:px-4 py-3 text-right hidden sm:table-cell text-[#64748B]">{r.members.toLocaleString('en-IN')}</td>
                    <td className="px-3 md:px-4 py-3 text-right font-bold" style={{ color: r.color }}>
                      ₹{r.total.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:p-4 border-t border-[#E2E8F0] bg-[#FAFAF9] text-xs text-[#64748B]">
            Note: Team calculation is based on {MAX_DIRECT_REFS} members per level (theoretical maximum).
          </div>
        </div>
      </div>

      {/* Total Potential + Lifetime badge */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2 bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-[#064E3B] rounded-2xl p-6 md:p-8" data-testid="bp-total-potential">
          <div className="text-xs uppercase tracking-widest font-bold opacity-80">Total Earning Potential</div>
          <div className="text-xs opacity-70 mb-2">on complete {MAX_DIRECT_REFS}-member chain across 8 levels</div>
          <div className="font-numbers text-4xl md:text-6xl font-black leading-tight">₹{TOTAL_POTENTIAL.toLocaleString('en-IN')}</div>
          <div className="text-xs md:text-sm mt-2 opacity-80">{TOTAL_POTENTIAL_WORDS}</div>
        </div>
        <div className="bg-[#FBBF24] text-[#064E3B] rounded-2xl p-6 flex flex-col items-center justify-center text-center" data-testid="bp-lifetime-badge">
          <TrendingUp className="w-10 h-10 mb-2"/>
          <div className="font-display font-bold text-lg">Lifetime Income</div>
          <div className="font-display font-bold text-lg">Opportunity</div>
          <div className="text-xs mt-1 opacity-80">No monthly fees</div>
        </div>
      </div>

      {/* Terms + Feature strip matching infographic footer */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="card-soft p-5 md:p-6" data-testid="bp-terms">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-3">Terms & Conditions</div>
          <ul className="space-y-2 text-sm text-[#334155]">
            <li className="flex gap-2"><span className="text-[#65A30D]">✓</span> Above income is calculated on {MAX_DIRECT_REFS} members per level.</li>
            <li className="flex gap-2"><span className="text-[#65A30D]">✓</span> Your income starts once <strong>{MIN_PAID_DIRECTS_FOR_INCOME} direct members</strong> make the ₹{KIT_PRICE.toLocaleString('en-IN')} purchase.</li>
            <li className="flex gap-2"><span className="text-[#65A30D]">✓</span> Actual earnings depend on team growth and each member completing the ₹{KIT_PRICE.toLocaleString('en-IN')} purchase.</li>
            <li className="flex gap-2"><span className="text-[#65A30D]">✓</span> Withdrawal requires KYC approval + minimum {MIN_PAID_DIRECTS_FOR_INCOME} paid direct referrals + ₹100 minimum balance.</li>
          </ul>
        </div>
        <div className="card-soft p-5 md:p-6" data-testid="bp-features">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-3">Why EverGro Works</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Infinity, label: "Lifetime Income" },
              { icon: Wallet, label: "No Monthly Maintenance" },
              { icon: TrendingUp, label: "Unlimited Potential" },
              { icon: ShieldCheck, label: "100% Legal & Trusted" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 p-3 bg-[#FAFAF9] rounded-xl">
                <f.icon className="w-4 h-4 text-[#65A30D] flex-shrink-0"/>
                <div className="text-xs font-semibold text-[#064E3B]">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA row */}
      <div className="text-center card-soft p-6 md:p-8 bg-[#ECFCCB]">
        <div className="font-display text-2xl md:text-3xl font-bold text-[#064E3B] mb-2">
          Shop Today, Earn Tomorrow, Build a Better Future.
        </div>
        <div className="text-sm text-[#334155] mb-5">Join thousands earning through the EverGro 8-Level Plan.</div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/register" className="btn-primary" data-testid="bp-cta-join">
            Get Started — ₹{KIT_PRICE.toLocaleString('en-IN')}
          </Link>
          <Link to="/compensation-plan" className="btn-outline" data-testid="bp-cta-plan">
            <Download className="w-4 h-4"/> Download Plan Infographic
          </Link>
          <a href={COMPENSATION_INFOGRAPHIC_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-[#65A30D] font-semibold flex items-center gap-1 self-center">
            View Infographic →
          </a>
        </div>
      </div>
    </div>
  );
}
