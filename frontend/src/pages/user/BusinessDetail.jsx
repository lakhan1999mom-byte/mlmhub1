import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Share2, Users, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function BusinessDetail() {
  const { id } = useParams();
  const [biz, setBiz] = useState(null);
  const [network, setNetwork] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/mlm/businesses/${id}`),
      api.get(`/mlm/businesses/${id}/network`),
    ]).then(([b, n]) => { setBiz(b.data); setNetwork(n.data.members || []); }).finally(() => setLoading(false));
  }, [id]);

  const copy = (v) => { navigator.clipboard.writeText(v); toast.success("Copied!"); };

  if (loading) return <div className="p-12 text-center text-[#64748B]">Loading business…</div>;
  if (!biz) return <div className="p-12 text-center">Business not found. <Link to="/dashboard/businesses" className="text-[#65A30D] font-semibold">← Back</Link></div>;

  return (
    <div className="space-y-6" data-testid="business-detail-page">
      <Link to="/dashboard/businesses" className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#065F46]"><ArrowLeft className="w-4 h-4"/> All businesses</Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-gradient-to-br from-[#064E3B] to-[#065F46] text-white p-6">
        <div className="text-xs uppercase font-bold text-[#84CC16] tracking-widest">{biz.is_primary ? "Primary business" : "Referral business"}</div>
        <div className="font-display font-black text-3xl mt-1">{biz.name}</div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
            <span className="text-xs uppercase text-white/60 font-bold">Ref Code</span>
            <span className="font-mono font-black text-[#84CC16]">{biz.referral_code}</span>
            <button onClick={() => copy(biz.referral_code)} className="text-white/80 hover:text-white ml-1"><Copy className="w-4 h-4"/></button>
          </div>
          <button onClick={() => copy(`${window.location.origin}/join-now?ref=${biz.referral_code}`)} className="btn-outline text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
            <Share2 className="w-4 h-4"/> Copy invite link
          </button>
          <span className={`badge-pill ${biz.is_active ? "bg-[#84CC16] text-[#064E3B]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{biz.is_active ? "✓ Active" : "Pending kit payment"}</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Members" value={biz.total_members} icon={<Users className="w-5 h-5"/>} tone="bg-[#DBEAFE] text-[#1E40AF]"/>
        <MetricCard label="Active Members" value={biz.active_members} icon={<Sparkles className="w-5 h-5"/>} tone="bg-[#ECFCCB] text-[#065F46]"/>
        <MetricCard label="Today's Joins" value={biz.today_joins} icon={<Calendar className="w-5 h-5"/>} tone="bg-[#FEF3C7] text-[#92400E]"/>
        <MetricCard label="Earnings" value={`₹${Number(biz.total_earnings || 0).toFixed(0)}`} icon={<TrendingUp className="w-5 h-5"/>} tone="bg-[#FED7AA] text-[#9A3412]"/>
      </div>

      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display font-bold text-lg text-[#064E3B]">Your Downline</div>
            <div className="text-xs text-[#64748B]">Members who joined using this business's referral code.</div>
          </div>
          <div className="text-xs text-[#94A3B8] font-numbers">{network.length} shown</div>
        </div>
        {network.length === 0 && (
          <div className="text-center py-8 text-sm text-[#94A3B8]">No members yet — share your invite link to grow.</div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {network.map((m) => (
            <div key={m.id} className="p-3 bg-[#FAFAF9] rounded-2xl flex items-center gap-3" data-testid={`network-${m.user_code}`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-white font-black flex items-center justify-center">
                {(m.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#064E3B] truncate">{m.name}</div>
                <div className="text-[10px] text-[#94A3B8] font-mono">{m.user_code} · Stage {m.current_stage || 1}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${m.is_joining_paid ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{m.is_joining_paid ? "✓" : "pending"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, tone }) {
  return (
    <div className="card-soft p-4">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tone}`}>{icon}</div>
      <div className="font-numbers text-2xl font-black text-[#064E3B] mt-2">{value}</div>
      <div className="text-xs text-[#64748B] font-semibold">{label}</div>
    </div>
  );
}
