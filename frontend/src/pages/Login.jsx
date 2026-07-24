import { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { Eye, EyeOff, Lock, ChevronRight } from "lucide-react";
import { sendFirebaseOtp, toIndianE164 } from "@/lib/firebase";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [tab, setTab] = useState("password"); // password | otp
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStage, setOtpStage] = useState("idle"); // idle | sent | verifying
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [multiAccounts, setMultiAccounts] = useState(null);
  const confirmationRef = useRef(null); // Firebase ConfirmationResult

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
    if (!phone || phone.replace(/\D/g, "").length < 10) return toast.error("Enter valid 10-digit mobile");
    setBusy(true);
    try {
      // Try Firebase Phone Auth first (real SMS to real phones)
      try {
        const conf = await sendFirebaseOtp(toIndianE164(phone));
        confirmationRef.current = conf;
        setOtpStage("sent");
        setDevOtp("");
        toast.success("OTP sent via SMS. Check your phone.");
      } catch (fbErr) {
        // Firebase failed (billing / domain not authorized) — fallback to dev OTP
        console.warn("Firebase OTP failed, falling back to dev OTP:", fbErr?.message);
        const { data } = await api.post("/auth/otp/send", { phone });
        setOtpStage("sent");
        setDevOtp(data.dev_otp || "");
        toast.success(data.dev_otp ? `Dev OTP: ${data.dev_otp}` : "OTP sent!");
      }
    } catch (err) {
      toast.error("Failed to send OTP");
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      if (confirmationRef.current) {
        // Firebase flow: confirm code → get idToken → send to backend
        const cred = await confirmationRef.current.confirm(otp);
        const idToken = await cred.user.getIdToken();
        const { data } = await api.post("/auth/firebase-verify", { id_token: idToken });
        if (data.needs_registration) {
          toast.info("Phone verified. Please complete registration.");
          nav(`/register?phone=${phone}`);
          return;
        }
        if (data.multiple) {
          setMultiAccounts(data.accounts);
          toast.info(`${data.accounts.length} accounts on this number. Pick one.`);
          return;
        }
        localStorage.setItem("evergro_token", data.token);
        window.location.href = data.user.role === "user" ? "/dashboard" : "/admin";
      } else {
        // Dev-OTP fallback flow
        const { data } = await api.post("/auth/otp/verify", { phone, otp });
        if (data.new_user) {
          toast.info("Phone verified. Please complete registration.");
          nav(`/register?phone=${phone}`);
        } else if (data.multiple) {
          setMultiAccounts(data.accounts);
          toast.info(`Found ${data.accounts.length} accounts on this number.`);
        } else {
          localStorage.setItem("evergro_token", data.token);
          window.location.href = data.user.role === "user" ? "/dashboard" : "/admin";
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const pickAccount = async (user_code) => {
    setBusy(true);
    try {
      let data;
      if (confirmationRef.current) {
        // Firebase-authenticated picker — resend idToken with user_code
        const idToken = await confirmationRef.current.user.getIdToken();
        ({ data } = await api.post("/auth/firebase-verify", { id_token: idToken, user_code }));
      } else {
        ({ data } = await api.post("/auth/otp/pick-account", { phone, user_code }));
      }
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
          <div className="font-display text-5xl font-black tracking-tight mb-8 bg-black/20 rounded-2xl px-4 py-3 inline-block">
            EverGro <span className="text-[#84CC16]">eMart</span>
          </div>
          <h1 className="font-display text-5xl font-bold mb-4">Welcome Back to <span className="text-[#84CC16]">Wealth</span></h1>
          <p className="text-white/80 leading-relaxed">Login to access your dashboard, 8-level network tree, wallet and withdrawals.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center mb-8">
            <div className="font-display font-black text-2xl tracking-tight text-[#064E3B]">
              EverGro <span className="text-[#84CC16]">eMart</span>
            </div>
          </Link>
          <h2 className="font-display text-3xl font-bold text-[#064E3B] mb-2">Login</h2>
          <p className="text-[#64748B] mb-6">Welcome back, member!</p>

          <div className="flex gap-2 mb-6 bg-[#F1F5F9] p-1 rounded-full" data-testid="login-tabs">
            <button onClick={() => setTab("password")} className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${tab === "password" ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`} data-testid="login-tab-password">Password</button>
            <button onClick={() => setTab("otp")} className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${tab === "otp" ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`} data-testid="login-tab-otp">OTP (SMS)</button>
          </div>

          {tab === "password" && (
            <form onSubmit={handlePwLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#064E3B]">Email or Phone</label>
                <input data-testid="login-identifier-input" className="input-soft mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or 9999999999" required autoComplete="username"/>
              </div>
              <div>
                <label className="text-sm font-medium text-[#064E3B]">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
                  <input
                    data-testid="login-password-input"
                    type={showPw ? "text" : "password"}
                    className="input-soft pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#064E3B] p-1"
                    data-testid="toggle-password-visibility"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              <button disabled={busy} type="submit" className="btn-primary w-full justify-center" data-testid="login-submit-btn">
                {busy ? "Logging in…" : "Login"}
              </button>
              <div className="text-center text-sm text-[#64748B]">
                Don't have an account? <Link to="/register" className="text-[#84CC16] font-semibold">Register</Link>
              </div>
            </form>
          )}

          {tab === "otp" && !multiAccounts && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#064E3B]">Mobile Number</label>
                <input
                  data-testid="otp-phone-input"
                  className="input-soft mt-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  disabled={otpStage !== "idle"}
                />
                <p className="text-[10px] text-[#65A30D] mt-1 font-medium">
                  Real SMS via Firebase (if delivery fails, dev OTP is shown below).
                </p>
              </div>
              {otpStage === "idle" ? (
                <button disabled={busy} onClick={sendOtp} className="btn-primary w-full justify-center" data-testid="send-otp-btn">
                  {busy ? "Sending…" : "Send OTP"}
                </button>
              ) : (
                <>
                  {devOtp && (
                    <div className="text-xs bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-lg p-3" data-testid="dev-otp-display">
                      DEV MODE — Your OTP: <b>{devOtp}</b>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-[#064E3B]">Enter 6-digit OTP</label>
                    <input
                      data-testid="otp-code-input"
                      className="input-soft mt-1 font-numbers tracking-widest text-center"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      placeholder="------"
                      inputMode="numeric"
                    />
                  </div>
                  <button disabled={busy} onClick={verifyOtp} className="btn-primary w-full justify-center" data-testid="verify-otp-btn">
                    {busy ? "Verifying…" : "Verify & Continue"}
                  </button>
                  <button
                    onClick={() => { setOtpStage("idle"); setOtp(""); setDevOtp(""); confirmationRef.current = null; }}
                    className="text-sm text-[#65A30D] font-semibold w-full text-center"
                    data-testid="change-phone-btn"
                  >
                    ← Change number
                  </button>
                </>
              )}
              <div className="text-center text-sm text-[#64748B]">
                New to EverGro? <Link to="/register" className="text-[#84CC16] font-semibold">Join Free</Link>
              </div>
            </div>
          )}

          {multiAccounts && (
            <div className="space-y-3" data-testid="multi-account-picker">
              <div className="text-sm font-semibold text-[#064E3B]">Multiple accounts found on {phone}:</div>
              <div className="text-xs text-[#64748B] mb-2">Pick which position you want to login to.</div>
              {multiAccounts.map((a) => (
                <button
                  key={a.user_code}
                  onClick={() => pickAccount(a.user_code)}
                  disabled={busy}
                  className="w-full text-left card-soft p-4 hover:border-[#84CC16] transition-colors flex items-center justify-between"
                  data-testid={`pick-account-${a.user_code}`}
                >
                  <div>
                    <div className="font-semibold text-[#064E3B]">{a.name}</div>
                    <div className="text-xs text-[#64748B] font-numbers">{a.user_code} · {a.email}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#84CC16]"/>
                </button>
              ))}
              <button onClick={() => { setMultiAccounts(null); setOtpStage("idle"); setOtp(""); confirmationRef.current = null; }} className="btn-outline w-full justify-center text-sm">
                Cancel
              </button>
            </div>
          )}

          {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
          <div id="firebase-recaptcha"/>
        </div>
      </div>
    </div>
  );
}
