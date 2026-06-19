import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

const LOGO = "https://customer-assets.emergentagent.com/job_9e593e72-d371-4332-879b-9b25914b11c9/artifacts/xiy5qq2i_ChatGPT_Image_Jun_18__2026__06_43_19_PM-removebg-preview.png";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [multiAccounts, setMultiAccounts] = useState(null); // null | [accounts]

  const handlePwLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(identifier, password);
      toast.success(`Welcome back, ${u.name}!`);
      const target = loc.state?.from?.pathname || (u.role === "user" ? "/dashboard" : "/admin");
      nav(target);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  const sendOtp = async () => {
    if (!phone) return toast.error("Enter phone number");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/otp/send", { phone });
      setOtpSent(true);
      setDevOtp(data.dev_otp || "");
      toast.success(`OTP sent! ${data.dev_otp ? "Dev OTP: " + data.dev_otp : ""}`);
    } catch (err) {
      toast.error("Failed to send OTP");
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone, otp });
      if (data.new_user) {
        toast.info("Phone verified. Please complete registration.");
        nav(`/register?phone=${phone}`);
      } else if (data.multiple) {
        // Multiple accounts — show picker
        setMultiAccounts(data.accounts);
        toast.info(`Found ${data.accounts.length} accounts on this number. Pick one.`);
      } else {
        localStorage.setItem("evergro_token", data.token);
        window.location.href = data.user.role === "user" ? "/dashboard" : "/admin";
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const pickAccount = async (user_code) => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/otp/pick-account", { phone, user_code });
      localStorage.setItem("evergro_token", data.token);
      window.location.href = data.user.role === "user" ? "/dashboard" : "/admin";
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#064E3B] text-white p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-5"/>
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#84CC16]/20 rounded-full blur-3xl"/>
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#FBBF24]/20 rounded-full blur-3xl"/>
        <div className="relative max-w-md">
          <img src={LOGO} alt="EverGro" className="h-20 mb-8 bg-black/30 rounded-2xl p-3"/>
          <h1 className="font-display text-5xl font-bold mb-4">Welcome Back to <span className="text-[#84CC16]">Wealth</span></h1>
          <p className="text-white/80 leading-relaxed">Login to access your dashboard, network tree, wallet, and earn through our 8-stage MLM plan.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="bg-[#064E3B] rounded-xl p-1.5"><img src={LOGO} alt="EverGro" className="h-8"/></div>
            <div className="font-display font-bold text-[#064E3B]">EverGro eMart</div>
          </Link>
          <h2 className="font-display text-3xl font-bold text-[#064E3B] mb-2">Login</h2>
          <p className="text-[#64748B] mb-6">Welcome back, member!</p>

          <div className="flex gap-2 mb-6 bg-[#F1F5F9] p-1 rounded-full" data-testid="login-tabs">
            <button onClick={() => setTab("password")} className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${tab === "password" ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`} data-testid="login-tab-password">Email/Phone</button>
            <button onClick={() => setTab("otp")} className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${tab === "otp" ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`} data-testid="login-tab-otp">OTP</button>
          </div>

          {tab === "password" && (
            <form onSubmit={handlePwLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#064E3B]">Email or Phone</label>
                <input data-testid="login-identifier-input" className="input-soft mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or 9999999999" required/>
              </div>
              <div>
                <label className="text-sm font-medium text-[#064E3B]">Password</label>
                <input data-testid="login-password-input" type="password" className="input-soft mt-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required/>
              </div>
              <button disabled={busy} type="submit" className="btn-primary w-full justify-center" data-testid="login-submit-btn">{busy ? "Logging in…" : "Login"}</button>
              <div className="text-center text-sm text-[#64748B]">
                Don't have an account? <Link to="/register" className="text-[#84CC16] font-semibold">Register</Link>
              </div>
            </form>
          )}

          {tab === "otp" && !multiAccounts && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#064E3B]">Mobile Number</label>
                <input data-testid="otp-phone-input" className="input-soft mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" disabled={otpSent}/>
              </div>
              {!otpSent ? (
                <button disabled={busy} onClick={sendOtp} className="btn-primary w-full justify-center" data-testid="send-otp-btn">{busy ? "Sending…" : "Send OTP"}</button>
              ) : (
                <>
                  {devOtp && <div className="text-xs bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-lg p-3" data-testid="dev-otp-display">DEV MODE — Your OTP: <b>{devOtp}</b></div>}
                  <div>
                    <label className="text-sm font-medium text-[#064E3B]">Enter 6-digit OTP</label>
                    <input data-testid="otp-code-input" className="input-soft mt-1 font-numbers tracking-widest text-center" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="------"/>
                  </div>
                  <button disabled={busy} onClick={verifyOtp} className="btn-primary w-full justify-center" data-testid="verify-otp-btn">{busy ? "Verifying…" : "Verify & Continue"}</button>
                </>
              )}
              <div className="text-center text-sm text-[#64748B]">
                New to EverGro? <Link to="/register" className="text-[#84CC16] font-semibold">Join Free</Link>
              </div>
            </div>
          )}

          {tab === "otp" && multiAccounts && (
            <div className="space-y-3" data-testid="multi-account-picker">
              <div className="text-sm font-semibold text-[#064E3B]">Multiple accounts found on {phone}:</div>
              <div className="text-xs text-[#64748B] mb-2">Pick which account you want to login to.</div>
              {multiAccounts.map((a) => (
                <button key={a.user_code} onClick={() => pickAccount(a.user_code)} disabled={busy} className="w-full text-left card-soft p-4 hover:border-[#84CC16] transition-colors flex items-center justify-between" data-testid={`pick-account-${a.user_code}`}>
                  <div>
                    <div className="font-semibold text-[#064E3B]">{a.name}</div>
                    <div className="text-xs text-[#64748B] font-numbers">{a.user_code} · {a.email}</div>
                  </div>
                  <span className="text-[#84CC16] font-bold">›</span>
                </button>
              ))}
              <button onClick={() => { setMultiAccounts(null); setOtpSent(false); setOtp(""); }} className="btn-outline w-full justify-center text-sm">Cancel</button>
            </div>
          )}

          <div className="mt-8 p-4 bg-[#ECFCCB] rounded-xl text-xs text-[#064E3B]" data-testid="demo-credentials-box">
            <div className="font-semibold mb-1">Demo Credentials:</div>
            <div>Super Admin → admin@evergroemart.com / Admin@123</div>
            <div>Sub Admin → subadmin@evergroemart.com / SubAdmin@123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
