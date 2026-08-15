import { useState } from "react";
import { toast } from "sonner";
import { FileImage, Share2, Copy, MessageCircle } from "lucide-react";
import {
  INCOME_LEVELS,
  TOTAL_POTENTIAL,
  TOTAL_POTENTIAL_WORDS,
  KIT_PRICE,
  MAX_DIRECT_REFS,
  MIN_PAID_DIRECTS_FOR_INCOME,
  COMPENSATION_INFOGRAPHIC_URL,
} from "@/lib/plan-theme";

export default function CompensationPlan() {
  const [busy, setBusy] = useState(false);

  const downloadImage = async () => {
    try {
      setBusy(true);
      const res = await fetch(COMPENSATION_INFOGRAPHIC_URL);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "EverGro-eMart-8-Level-Plan.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Plan image downloaded");
    } catch (e) {
      // Fallback: open in new tab so user can right-click save
      window.open(COMPENSATION_INFOGRAPHIC_URL, "_blank");
    } finally {
      setBusy(false);
    }
  };

  const shareWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = encodeURIComponent(
      `🌱 EverGro eMart — 8-Level Income Plan\n\nOne-time ₹7,499 purchase → earn from 8 levels.\nTotal potential: ₹19,20,99,600\n\nView plan: ${url}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const copyLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for browsers without clipboard API or in non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Plan link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16" data-testid="compensation-plan-page">
      <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">8-Level Income Structure</div>
      <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 leading-tight">
        Total Earning Potential<br/>
        <span className="text-[#84CC16]">₹{TOTAL_POTENTIAL.toLocaleString('en-IN')}</span>
      </h1>
      <p className="text-base md:text-lg text-[#334155] mb-6 max-w-3xl">
        One-time ₹{KIT_PRICE.toLocaleString('en-IN')} purchasing kit. Every downline member&apos;s ₹7,499 purchase generates a fixed commission at each of 8 levels. Income starts when your {MIN_PAID_DIRECTS_FOR_INCOME}rd direct referral pays.
      </p>

      {/* Share / Download row */}
      <div className="card-soft p-4 md:p-5 mb-8 bg-gradient-to-r from-[#ECFCCB] via-white to-[#ECFCCB]" data-testid="plan-share-toolbar">
        <div className="flex items-center gap-3 mb-3">
          <Share2 className="w-5 h-5 text-[#65A30D]"/>
          <div className="font-display font-bold text-[#064E3B]">Share this plan</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadImage} disabled={busy} className="btn-primary text-sm disabled:opacity-60" data-testid="download-image-btn">
            <FileImage className="w-4 h-4"/> Download Plan Image
          </button>
          <button onClick={shareWhatsApp} className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold text-sm rounded-full px-4 py-2 inline-flex items-center gap-2" data-testid="share-whatsapp-btn">
            <MessageCircle className="w-4 h-4"/> Share on WhatsApp
          </button>
          <button onClick={copyLink} className="bg-white border border-[#E2E8F0] hover:border-[#84CC16] text-[#064E3B] font-semibold text-sm rounded-full px-4 py-2 inline-flex items-center gap-2" data-testid="copy-link-btn">
            <Copy className="w-4 h-4"/> Copy Link
          </button>
        </div>
      </div>

      {/* Infographic (from user's design). Fully downloadable / shareable. */}
      <div className="card-soft overflow-hidden mb-10" data-testid="plan-infographic">
        <img
          src={COMPENSATION_INFOGRAPHIC_URL}
          alt="EverGro eMart 8-Level Income Plan Infographic"
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="card-soft p-5" data-testid="plan-stat-joining">
          <div className="text-xs uppercase text-[#65A30D] font-semibold">Purchasing Kit</div>
          <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-1">₹{KIT_PRICE.toLocaleString('en-IN')}</div>
          <div className="text-xs text-[#64748B] mt-1">One-time · unlocks lifetime income</div>
        </div>
        <div className="card-soft p-5" data-testid="plan-stat-max-refs">
          <div className="text-xs uppercase text-[#65A30D] font-semibold">Max Direct Referrals</div>
          <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-1">{MAX_DIRECT_REFS}</div>
          <div className="text-xs text-[#64748B] mt-1">Per member, per layer</div>
        </div>
        <div className="card-soft p-5" data-testid="plan-stat-min-refs">
          <div className="text-xs uppercase text-[#65A30D] font-semibold">Income Starts After</div>
          <div className="font-numbers text-3xl font-bold text-[#064E3B] mt-1">{MIN_PAID_DIRECTS_FOR_INCOME} Paid Refs</div>
          <div className="text-xs text-[#64748B] mt-1">Your {MIN_PAID_DIRECTS_FOR_INCOME}rd direct member pays ₹7,499</div>
        </div>
      </div>

      <div className="card-soft overflow-hidden" data-testid="plan-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#064E3B] text-white">
              <tr>
                <th className="text-left p-4">Level</th>
                <th className="text-right p-4">Per Member (₹)</th>
                <th className="text-right p-4 hidden sm:table-cell">Members in Team (max)</th>
                <th className="text-right p-4">Total Income (₹)</th>
              </tr>
            </thead>
            <tbody className="font-numbers">
              {INCOME_LEVELS.map((s) => (
                <tr key={s.l} className="border-b border-[#E2E8F0]" data-testid={`plan-row-${s.l}`}>
                  <td className="p-4">
                    <span
                      className="inline-flex items-center justify-center min-w-[70px] px-3 py-1 rounded-full text-white font-bold text-xs"
                      style={{ backgroundColor: s.color }}
                    >
                      Level {s.l}
                    </span>
                  </td>
                  <td className="p-4 text-right">₹{s.per.toLocaleString('en-IN')}</td>
                  <td className="p-4 text-right hidden sm:table-cell">{s.members.toLocaleString('en-IN')}</td>
                  <td className="p-4 text-right font-bold text-lg" style={{ color: s.color }}>₹{s.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
              <tr className="bg-[#ECFCCB]">
                <td colSpan={3} className="p-4 font-display font-bold text-[#064E3B] text-lg">Total Earning Potential per Cycle</td>
                <td className="p-4 text-right font-bold text-2xl text-[#064E3B]">₹{TOTAL_POTENTIAL.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs md:text-sm text-[#64748B] mt-6" data-testid="plan-disclaimer">
        {TOTAL_POTENTIAL_WORDS}. Calculated on 6 members per level (theoretical maximum). Actual income depends on your team&apos;s growth and their ₹7,499 purchases. Withdrawals require KYC approval and minimum {MIN_PAID_DIRECTS_FOR_INCOME} paid direct referrals.
      </p>
    </div>
  );
}
