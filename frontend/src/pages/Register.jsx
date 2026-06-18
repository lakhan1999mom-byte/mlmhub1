import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

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
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register(form);
      toast.success(`Welcome ${u.name}! Your code is ${u.user_code}`);
      nav("/dashboard");
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
            <div className="bg-[#064E3B] rounded-xl p-1.5"><img src={LOGO} alt="EverGro" className="h-8"/></div>
            <div className="font-display font-bold text-[#064E3B]">EverGro eMart</div>
          </Link>
          <h2 className="font-display text-3xl font-bold text-[#064E3B] mb-2">Create Account</h2>
          <p className="text-[#64748B] mb-6">Join 50,000+ wealth builders.</p>
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
              <label className="text-sm font-medium text-[#064E3B]">Sponsor / Referral Code (optional)</label>
              <input data-testid="register-referral-input" className="input-soft mt-1" value={form.referral_code} onChange={upd("referral_code")} placeholder="e.g. ADMIN001"/>
            </div>
            <button disabled={busy} className="btn-primary w-full justify-center" data-testid="register-submit-btn">{busy ? "Creating…" : "Create Account"}</button>
          </form>
          <div className="text-center text-sm text-[#64748B] mt-6">
            Already have an account? <Link to="/login" className="text-[#84CC16] font-semibold">Login</Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#84CC16] via-[#65A30D] to-[#064E3B] text-white p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-10"/>
        <div className="relative max-w-md">
          <img src={LOGO} alt="EverGro" className="h-20 mb-8 bg-black/30 rounded-2xl p-3"/>
          <h1 className="font-display text-5xl font-bold mb-4">Your wealth journey begins now</h1>
          <ul className="space-y-3 text-white/90">
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> Premium hampers delivered to your door</li>
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> 8 transparent earning stages</li>
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> Auto wallet credit & instant withdrawals</li>
            <li className="flex items-start gap-2"><span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span> Referral QR & marketing tools</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
