import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { Check, X, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: params.get("phone") || "",
    password: "",
    referral_code: params.get("ref") || "",
  });
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, reason: "" });
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/site/terms").then(({ data }) => setTermsContent(data.content)).catch(() => {});
  }, []);

  // Live username availability check (debounced)
  useEffect(() => {
    const u = form.username.trim().toLowerCase();
    if (!u) { setUsernameStatus({ checking: false, available: null, reason: "" }); return; }
    setUsernameStatus({ checking: true, available: null, reason: "" });
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username?username=${encodeURIComponent(u)}`);
        setUsernameStatus({ checking: false, available: data.available, reason: data.reason });
      } catch {
        setUsernameStatus({ checking: false, available: null, reason: "" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username]);

  const submit = async (e) => {
    e.preventDefault();
    if (!termsAccepted) return toast.error("Please accept the Terms & Conditions");
    if (form.username && usernameStatus.available === false) {
      return toast.error(`Username: ${usernameStatus.reason}`);
    }
    setBusy(true);
    try {
      const u = await register({ ...form, terms_accepted: true });
      toast.success(`Welcome @${u.username || u.user_code}! Now pay ₹9,999 to activate.`);
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
          <Link to="/" className="flex items-center mb-8">
            <div className="font-display text-3xl font-black tracking-tight text-[#7F1D1D]">
              EverGro <span className="text-[#DC2626]">eMart</span>
            </div>
          </Link>
          <h2 className="font-display text-3xl font-bold text-[#7F1D1D] mb-2">Become a Partner</h2>
          <p className="text-[#64748B] mb-6">Step 1 of 2: Fill details · Step 2: Pay ₹9,999 Premium Hamper to activate your partner dashboard.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#7F1D1D]">Full Name</label>
              <input data-testid="register-name-input" className="input-soft mt-1" value={form.name} onChange={upd("name")} required/>
            </div>

            <div>
              <label className="text-sm font-medium text-[#7F1D1D]">Username</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">@</span>
                <input
                  data-testid="register-username-input"
                  className="input-soft pl-8 pr-10 lowercase"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })}
                  placeholder="yourname99"
                  required
                  minLength={3}
                  maxLength={30}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="username-status-icon">
                  {usernameStatus.checking && <Loader2 className="w-4 h-4 animate-spin text-[#94A3B8]"/>}
                  {!usernameStatus.checking && usernameStatus.available === true && <Check className="w-4 h-4 text-[#B91C1C]"/>}
                  {!usernameStatus.checking && usernameStatus.available === false && <X className="w-4 h-4 text-[#EF4444]"/>}
                </div>
              </div>
              {form.username && usernameStatus.reason && (
                <p className={`text-[10px] mt-1 font-medium ${usernameStatus.available ? "text-[#B91C1C]" : "text-[#EF4444]"}`} data-testid="username-status-msg">
                  {usernameStatus.available ? "✓ " : "✗ "}{usernameStatus.reason}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[#7F1D1D]">Email</label>
              <input data-testid="register-email-input" type="email" className="input-soft mt-1" value={form.email} onChange={upd("email")} required/>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7F1D1D]">Mobile</label>
              <input data-testid="register-phone-input" className="input-soft mt-1" value={form.phone} onChange={upd("phone")} required/>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7F1D1D]">Password</label>
              <div className="relative mt-1">
                <input
                  data-testid="register-password-input"
                  type={showPw ? "text" : "password"}
                  className="input-soft pr-10"
                  value={form.password}
                  onChange={upd("password")}
                  required minLength={6}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]" data-testid="register-toggle-pw">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7F1D1D]">Sponsor Referral Code (optional)</label>
              <input data-testid="register-referral-input" className="input-soft mt-1" value={form.referral_code} onChange={upd("referral_code")} placeholder="e.g. ADMIN001"/>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer p-3 bg-[#FEE2E2] rounded-xl border border-[#FECACA]">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#DC2626]" data-testid="terms-checkbox"/>
              <span className="text-[#7F1D1D]">
                I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-[#B91C1C] font-semibold underline" data-testid="view-terms-link">Terms & Conditions</button>.
              </span>
            </label>

            <button disabled={busy || !termsAccepted || (form.username && usernameStatus.available === false)} className="btn-primary w-full justify-center disabled:opacity-50" data-testid="register-submit-btn">
              {busy ? "Creating…" : "Create Account & Continue to Payment →"}
            </button>
          </form>
          <div className="text-center text-sm text-[#64748B] mt-6">
            Already have an account? <Link to="/login" className="text-[#DC2626] font-semibold">Login</Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#DC2626] via-[#B91C1C] to-[#7F1D1D] text-white p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-10"/>
        <div className="relative max-w-md">
          <div className="font-display text-5xl font-black tracking-tight mb-8">
            EverGro <span className="text-[#DC2626]">eMart</span>
          </div>
          <h1 className="font-display text-4xl font-bold mb-4">Shop · Save · Share · Earn</h1>
          <p className="text-lg text-white/90 mb-6">Join ₹9,999 → earn from 8 downline levels → potential ₹19.2 Cr per cycle.</p>
        </div>
      </div>

      {showTerms && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" data-testid="terms-modal">
            <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-center">
              <h3 className="font-display text-xl font-bold">Terms & Conditions</h3>
              <button onClick={() => setShowTerms(false)} className="text-[#64748B]"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-[#334155] whitespace-pre-wrap flex-1">{termsContent}</div>
            <div className="p-4 border-t border-[#E2E8F0]">
              <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }} className="btn-primary w-full justify-center" data-testid="terms-accept-btn">
                I Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
