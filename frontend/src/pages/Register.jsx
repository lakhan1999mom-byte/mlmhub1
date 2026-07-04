import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

const LOGO = "https://customer-assets.emergentagent.com/job_9e593e72-d371-4332-879b-9b25914b11c9/artifacts/xiy5qq2i_ChatGPT_Image_Jun_18__2026__06_43_19_PM-removebg-preview.png";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: params.get("phone") || "",
    password: "",
    referral_code: params.get("ref") || "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/site/terms").then(({ data }) => setTermsContent(data.content)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("Please accept the Terms & Conditions to continue");
      return;
    }
    setBusy(true);
    try {
      const u = await register({ ...form, terms_accepted: true });
      toast.success(`Account ${u.user_code} created! Now pay ₹7,200 to activate.`);
      nav("/hampers");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <img src={LOGO} alt="EverGro" className="h-14"/>
            <div className="font-display font-bold text-[#064E3B]">EverGro eMart</div>
          </Link>
          <h2 className="font-display text-3xl font-bold text-[#064E3B] mb-2">Create Account</h2>
          <p className="text-[#64748B] mb-6">Step 1 of 2: Fill details · Step 2: Pay ₹7,200 Joining Kit to activate.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#064E3B]">Full Name</label>
              <input data-testid="register-name-input" className="input-soft mt-1" value={form.name} onChange={upd("name")} required/>
            </div>
            <div>
              <label className="text-sm font-medium text-[#064E3B]">Email</label>
              <input data-testid="register-email-input" type="email" className="input-soft mt-1" value={form.email} onChange={upd("email")} required/>
            </div>
            <div>
              <label className="text-sm font-medium text-[#064E3B]">Mobile</label>
              <input data-testid="register-phone-input" className="input-soft mt-1" value={form.phone} onChange={upd("phone")} required/>
            </div>
            <div>
              <label className="text-sm font-medium text-[#064E3B]">Password</label>
              <input data-testid="register-password-input" type="password" className="input-soft mt-1" value={form.password} onChange={upd("password")} required minLength={6}/>
            </div>
            <div>
              <label className="text-sm font-medium text-[#064E3B]">Sponsor Referral Code (optional)</label>
              <input data-testid="register-referral-input" className="input-soft mt-1" value={form.referral_code} onChange={upd("referral_code")} placeholder="e.g. ADMIN001"/>
              <p className="text-[10px] text-[#64748B] mt-1">If you don't use a referral code, you won't be linked to any sponsor.</p>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer p-3 bg-[#ECFCCB] rounded-xl border border-[#D9F99D]">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#84CC16]" data-testid="terms-checkbox"/>
              <span className="text-[#064E3B]">
                I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-[#65A30D] font-semibold underline" data-testid="view-terms-link">Terms & Conditions</button> including the Application-Based Referral Policy, 8-level income structure, and payment requirement.
              </span>
            </label>

            <button disabled={busy || !termsAccepted} className="btn-primary w-full justify-center disabled:opacity-50" data-testid="register-submit-btn">
              {busy ? "Creating…" : "Create Account & Continue to Payment →"}
            </button>
          </form>
          <div className="text-center text-sm text-[#64748B] mt-6">
            Already have an account? <Link to="/login" className="text-[#84CC16] font-semibold">Login</Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#84CC16] via-[#65A30D] to-[#064E3B] text-white p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-10"/>
        <div className="relative max-w-md">
          <img src={LOGO} alt="EverGro" className="h-24 mb-8"/>
          <h1 className="font-display text-5xl font-bold mb-4">Shop · Save · Share · Earn</h1>
          <p className="text-lg text-white/90 mb-6">Join ₹7,200 → earn from 8 downline levels → potential ₹20.36 Cr per cycle.</p>
          <ul className="space-y-3 text-white/90">
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> Level 1 pays ₹1,200 per direct member</li>
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> Income starts after 3 paid direct referrals</li>
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> Auto wallet credit, secure withdrawals</li>
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> 100% legal & transparent — no monthly fees</li>
          </ul>
        </div>
      </div>

      {showTerms && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} data-testid="terms-modal">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-xl text-[#064E3B]">Terms & Conditions</h3>
              <button onClick={() => setShowTerms(false)} className="text-[#64748B] hover:text-[#064E3B] text-2xl">×</button>
            </div>
            <div className="prose prose-sm text-[#334155]" dangerouslySetInnerHTML={{ __html: termsContent }}/>
            <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }} className="btn-primary w-full justify-center mt-4" data-testid="terms-accept-btn">I Accept</button>
          </div>
        </div>
      )}
    </div>
  );
}
