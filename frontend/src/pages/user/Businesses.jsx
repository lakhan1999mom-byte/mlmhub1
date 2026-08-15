import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Briefcase, Copy, Share2, TrendingUp, Users, Sparkles, X, Save, ChevronRight, Trash2, Lock } from "lucide-react";
import api from "@/lib/api";

/**
 * Multi Referral Business — user's dashboard for owning multiple positions.
 * Each business has its own referral_code, its own network, its own earnings ledger.
 * Wallet is unified at the account level but stats are per-business.
 */
export default function Businesses() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/mlm/businesses");
      setList(data.businesses || []);
    } catch (err) {
      toast.error("Failed to load businesses");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const copy = (v) => { navigator.clipboard.writeText(v); toast.success("Copied!"); };

  const payKit = async (businessId, code) => {
    try {
      const { data } = await api.post(`/mlm/businesses/${businessId}/pay-kit`);
      toast.success(`Redirecting to kit payment (₹${data.amount})`);
      nav(`/checkout/direct/${data.order_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to start kit payment");
    }
  };

  return (
    <div className="space-y-6" data-testid="businesses-page">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-black text-[#064E3B]">Your Referral Businesses</h1>
          <p className="text-sm text-[#64748B]">Each business has its own referral code, downline & reports. Wallet is unified across all.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary shadow-md" data-testid="create-business-btn">
          <Plus className="w-4 h-4"/> Create Referral Business
        </button>
      </div>

      {loading && <div className="text-center py-12 text-[#64748B]">Loading…</div>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {list.map((b, idx) => (
          <motion.div
            key={b.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
            className={`card-soft p-5 hover:-translate-y-1 hover:shadow-xl transition-all relative overflow-hidden ${b.is_active ? "border-[#84CC16]/40" : "border-[#FDE68A]"}`}
            data-testid={`business-card-${b.business_code}`}
          >
            {b.is_primary && (
              <div className="absolute top-3 right-3 badge-pill bg-[#064E3B] text-[#84CC16] text-[10px]">
                <Sparkles className="w-3 h-3"/> PRIMARY
              </div>
            )}
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${b.is_active ? "bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-white" : "bg-[#FEF3C7] text-[#92400E]"}`}>
              <Briefcase className="w-5 h-5"/>
            </div>
            <div className="font-display font-black text-lg text-[#064E3B]">{b.name}</div>
            <div className="text-xs text-[#94A3B8] font-mono">{b.business_code}</div>
            <div className="mt-3">
              <div className="text-[10px] uppercase font-bold text-[#94A3B8]">Referral code</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="font-mono font-black text-[#065F46] text-base bg-[#ECFCCB] px-3 py-1 rounded-full">{b.referral_code || "—"}</div>
                {b.referral_code && (
                  <button onClick={() => copy(b.referral_code)} className="text-[#65A30D] hover:text-[#4D7C0F]" data-testid={`copy-refcode-${b.business_code}`} title="Copy code">
                    <Copy className="w-4 h-4"/>
                  </button>
                )}
                {b.referral_code && (
                  <button onClick={() => copy(`${window.location.origin}/join-now?ref=${b.referral_code}`)} className="text-[#65A30D] hover:text-[#4D7C0F]" title="Copy invite link" data-testid={`copy-invitelink-${b.business_code}`}>
                    <Share2 className="w-4 h-4"/>
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <Stat label="Members" value={b.total_members} icon={<Users className="w-3 h-3"/>}/>
              <Stat label="Active" value={b.active_members}/>
              <Stat label="Today" value={b.today_joins}/>
            </div>
            <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <div className="text-xs text-[#64748B]">
                Earnings: <span className="font-numbers font-bold text-[#064E3B]">₹{Number(b.total_earnings || 0).toFixed(0)}</span>
              </div>
              <span className={`badge-pill ${b.is_active ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{b.is_active ? "✓ Active" : "Pending kit"}</span>
            </div>
            {!b.is_active && (
              <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border border-[#F59E0B]/30 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-[#92400E] tracking-widest">Activation required</div>
                  <div className="text-xs text-[#78350F] font-medium truncate">Pay the ₹7,499 starter kit to unlock this referral code.</div>
                </div>
                <button
                  onClick={() => payKit(b.id, b.business_code)}
                  className="btn-primary text-xs shrink-0"
                  data-testid={`pay-kit-${b.business_code}`}
                >
                  <Lock className="w-3 h-3"/> Pay Now
                </button>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Link to={`/dashboard/businesses/${b.id}`} className="btn-outline flex-1 justify-center text-xs" data-testid={`view-business-${b.business_code}`}>
                <TrendingUp className="w-3 h-3"/> View
                <ChevronRight className="w-3 h-3"/>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {creating && (
          <CreateBusinessModal onClose={() => setCreating(false)} onCreated={(businessId, orderId) => { setCreating(false); nav(`/checkout/direct/${orderId}`); load(); }}/>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-xl bg-[#FAFAF9] p-2">
      <div className="text-lg font-numbers font-black text-[#064E3B]">{value ?? 0}</div>
      <div className="text-[9px] uppercase text-[#94A3B8] font-bold tracking-wider inline-flex items-center gap-0.5">{icon} {label}</div>
    </div>
  );
}

function CreateBusinessModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState("ADMIN001");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!refCode.trim()) return toast.error("Enter a sponsor referral code");
    setBusy(true);
    try {
      const { data } = await api.post("/mlm/businesses/create", { name: name.trim(), referral_code: refCode.trim().toUpperCase() });
      toast.success(`Business created! Complete the ₹${data.amount} kit payment to activate.`);
      onCreated(data.business.id, data.order_id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create business");
    } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-3xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} data-testid="create-business-modal">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase font-bold text-[#94A3B8] tracking-wider">New Referral Business</div>
            <h3 className="font-display font-black text-2xl text-[#064E3B]">Add another business</h3>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#334155]"><X className="w-5 h-5"/></button>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-[#ECFCCB] to-[#D9F99D] p-4 mb-4 border border-[#84CC16]/30">
          <div className="text-sm text-[#065F46]">
            <b>How it works:</b> Enter any sponsor's referral code (not your own). We'll create a pending business and open an order for the ₹7,499 starter kit. Once you pay, your new referral code goes live and starts earning.
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-[#94A3B8] tracking-wider">Business label (optional)</label>
            <input className="input-soft mt-1" placeholder="e.g. Delhi Team" value={name} onChange={(e) => setName(e.target.value)} data-testid="business-name-input"/>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[#94A3B8] tracking-wider">Sponsor referral code</label>
            <input className="input-soft mt-1 font-mono uppercase" placeholder="e.g. ADMIN001" value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} data-testid="business-sponsor-input"/>
            <div className="text-[10px] text-[#94A3B8] mt-1">Default is <b className="text-[#065F46] font-mono">ADMIN001</b> (company). You can change it to any valid referral code — but not your own.</div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="submit-create-business-btn">
            {busy ? "Creating…" : <><Save className="w-4 h-4"/>Create & Pay ₹7,499</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
