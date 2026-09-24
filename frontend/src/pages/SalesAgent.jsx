import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, CheckCircle2, Info, ShieldCheck, TrendingUp, Users, ArrowRight } from "lucide-react";
import api from "@/lib/api";

/**
 * Public "Become a Sales Agent" page. Highlights the optional agent program,
 * shows the ₹9,999 hamper CTA, and captures a lead via POST /api/leads/sales-agent.
 * Zero income-guarantee language — commission depends entirely on the agent's own sales.
 */
export default function SalesAgent() {
  const { site } = useOutletContext() || {};
  const [hamper, setHamper] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", city: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/products?is_hamper=true").then(({ data }) => setHamper(data?.[0])).catch(() => {});
  }, []);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return toast.error("Please share your name and mobile");
    setBusy(true);
    try {
      await api.post("/leads/sales-agent", { ...form, source: "sales-agent-page" });
      setDone(true);
      toast.success("Thanks! Our team will call you shortly.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to submit — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="sales-agent-page">
      {/* Hero */}
      <section className="relative bg-hero-glow">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-full text-xs font-semibold text-[#7F1D1D]">
              <Briefcase className="w-3.5 h-3.5"/> Optional Program
            </div>
            <h1 className="font-display text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-[#7F1D1D]">
              Become a <span className="text-[#DC2626]">Sales Agent</span> and earn a good side income
            </h1>
            <p className="text-lg text-[#334155] leading-relaxed max-w-xl">
              If you enjoy recommending quality products to friends and family, join our sales agent program.
              Every qualifying sale earns you a commission — no fixed salary, no guarantees, just honest earnings tied to your effort.
            </p>
            <div className="rounded-xl bg-white/70 backdrop-blur border border-[#FCA5A5] p-3 text-xs text-[#7F1D1D] flex items-start gap-2 max-w-xl" data-testid="agent-disclaimer">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]"/>
              <span>Commission is <b>totally dependent on your sales</b>. We are <b>NOT committing any type of fixed income</b>, salary or guaranteed reward.</span>
            </div>
            <div className="flex flex-wrap items-center gap-8 pt-2">
              <MiniStat icon={ShieldCheck} label="100% transparent"/>
              <MiniStat icon={TrendingUp} label="Commission on every qualifying order"/>
              <MiniStat icon={Users} label="You + your team's sales count"/>
            </div>
          </div>

          {/* Right column: lead form */}
          <div className="lg:col-span-5 lg:justify-self-end w-full max-w-md">
            {done ? (
              <div className="card-soft p-8 text-center space-y-3" data-testid="agent-form-thanks">
                <div className="w-14 h-14 rounded-full bg-[#DC2626] text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8"/>
                </div>
                <h3 className="font-display font-black text-xl text-[#7F1D1D]">Thanks {form.name.split(" ")[0]}!</h3>
                <p className="text-sm text-[#334155]">Our team will call you on <b>{form.phone}</b> within 24 hours to walk you through the program and next steps.</p>
                {hamper && (
                  <Link to={`/products/${hamper.id}`} className="btn-primary inline-flex text-sm">
                    Also view the hamper <ArrowRight className="w-4 h-4"/>
                  </Link>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="card-soft p-6 space-y-3" data-testid="agent-form">
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-[#B91C1C]">Interested?</div>
                  <h3 className="font-display font-black text-xl text-[#7F1D1D]">Request a call back</h3>
                  <p className="text-xs text-[#64748B] mt-1">Fill this 30-second form. Our team will contact you.</p>
                </div>
                <Field label="Full name" v={form.name} on={upd("name")} testid="agent-name" required/>
                <Field label="Mobile number" v={form.phone} on={upd("phone")} testid="agent-phone" required/>
                <Field label="City" v={form.city} on={upd("city")} testid="agent-city"/>
                <div>
                  <label className="text-xs font-semibold text-[#7F1D1D]">Anything you'd like us to know? <span className="text-[#94A3B8] font-normal">(optional)</span></label>
                  <textarea className="input-soft mt-1 min-h-[70px]" value={form.notes} onChange={upd("notes")} data-testid="agent-notes"/>
                </div>
                <button disabled={busy} className="btn-primary w-full justify-center" data-testid="agent-submit">
                  {busy ? "Sending…" : "Request Call Back"}
                </button>
                <div className="text-[10px] text-[#94A3B8] text-center">By submitting, you agree to be contacted by our sales team.</div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Hamper CTA */}
      {hamper && (
        <section className="max-w-7xl mx-auto px-6 py-12" data-testid="agent-hamper-block">
          <div className="grid md:grid-cols-2 gap-8 items-center card-soft p-6 md:p-10">
            <img src={hamper.images?.[0]} alt={hamper.name} className="rounded-2xl w-full h-72 object-cover"/>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Starter Pick</div>
              <h2 className="font-display text-3xl font-bold text-[#7F1D1D]">{hamper.name}</h2>
              <div className="flex items-baseline gap-2 my-3">
                <span className="font-numbers text-3xl font-bold text-[#7F1D1D]">₹{hamper.price.toLocaleString()}</span>
                <span className="text-sm text-[#94A3B8] line-through font-numbers">₹{hamper.mrp.toLocaleString()}</span>
              </div>
              <p className="text-sm text-[#334155] mb-4">Buy the EverGro Premium Hamper to activate your sales agent account and unlock the agent dashboard.</p>
              <Link to={`/products/${hamper.id}`} className="btn-primary" data-testid="agent-buy-hamper-btn">
                Buy this hamper &amp; become an agent <ArrowRight className="w-4 h-4"/>
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, v, on, testid, required }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#7F1D1D]">{label}{required && <span className="text-[#DC2626]"> *</span>}</label>
      <input className="input-soft mt-1" value={v} onChange={on} required={required} data-testid={testid}/>
    </div>
  );
}

function MiniStat({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#7F1D1D]">
      <div className="w-8 h-8 rounded-full bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]"><Icon className="w-4 h-4"/></div>
      <span className="font-semibold">{label}</span>
    </div>
  );
}
