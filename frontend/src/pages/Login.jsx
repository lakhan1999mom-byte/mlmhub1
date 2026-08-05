import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, ChevronRight, User, Mail, Phone, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { sendFirebaseOtp, toIndianE164 } from "@/lib/firebase";

/**
 * 3-tab login flow (Iteration 13):
 *   • MOBILE / EMAIL tab
 *       1. User enters mobile or email.
 *       2. Call /auth/identifier-lookup.
 *          - single account → show password field → /auth/login-with-code
 *          - multiple accounts → OTP flow → account picker → password field → /auth/login-with-code
 *   • USERNAME tab (fast path — usernames are globally unique)
 *       1. User enters username + password → /auth/login directly.
 */
export default function Login() {
  const { login: authLogin, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const qp = new URLSearchParams(loc.search);
  const preFillPhone = qp.get("phone") || "";
  const preFillEmail = qp.get("email") || "";

  const initialTab = preFillPhone ? "mobile" : preFillEmail ? "email" : "mobile";
  const [tab, setTab] = useState(initialTab);

  // Universal
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Identifier flow (mobile / email)
  const [identifier, setIdentifier] = useState(preFillPhone || preFillEmail);
  // stage: 'input' → 'password' (single) | 'otp' → 'picker' → 'password' (multi)
  const [stage, setStage] = useState("input");
  const [selectedAccount, setSelectedAccount] = useState(null); // {user_code, name, username, ...}
  const [accountsList, setAccountsList] = useState(null);

  // OTP
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const confirmationRef = useRef(null);

  // Username tab
  const [username, setUsername] = useState("");

  useEffect(() => {
    // reset the flow when tab changes
    setStage("input");
    setSelectedAccount(null);
    setAccountsList(null);
    setOtp("");
    setDevOtp("");
    setPassword("");
    confirmationRef.current = null;
  }, [tab]);

  const goHome = (u) => {
    const target = loc.state?.from?.pathname || (u.role === "user" ? "/dashboard" : "/admin");
    nav(target);
  };

  // ============ MOBILE / EMAIL FLOW ============
  const submitIdentifier = async () => {
    const val = identifier.trim();
    if (!val) return toast.error("Enter your mobile or email");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/identifier-lookup", { identifier: val });
      if (data.single) {
        setSelectedAccount({ user_code: data.user_code, name: data.name, username: data.username });
        setStage("password");
      } else if (data.multiple) {
        // Send OTP to the phone linked (email accounts on multi are always on same phone)
        const phoneForOtp = data.phone || (tab === "mobile" ? val : "");
        if (!phoneForOtp) {
          toast.error("Multiple accounts found but no phone on record — contact support");
          return;
        }
        await sendOtpToPhone(phoneForOtp);
        setStage("otp");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No account found");
    } finally { setBusy(false); }
  };

  const sendOtpToPhone = async (phone) => {
    try {
      const conf = await sendFirebaseOtp(toIndianE164(phone));
      confirmationRef.current = conf;
      setDevOtp("");
      toast.success("OTP sent to your mobile");
    } catch {
      const { data } = await api.post("/auth/otp/send", { phone });
      setDevOtp(data.dev_otp || "");
      toast.success(data.dev_otp ? `OTP sent (${data.dev_otp})` : "OTP sent to your mobile");
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) return toast.error("Enter OTP");
    setBusy(true);
    try {
      // For multi flow — always fetch accounts on the phone
      const phone = tab === "mobile" ? identifier.trim() : (accountsList?.[0]?.phone || "");
      if (confirmationRef.current) {
        await confirmationRef.current.confirm(otp);
      } else {
        await api.post("/auth/otp/verify", { phone, otp });
      }
      const { data: accs } = await api.get(`/auth/accounts-by-phone?phone=${encodeURIComponent(phone || identifier.trim())}`);
      // if user entered an EMAIL that matches multiple, filter to those matching that email
      const filtered = tab === "email"
        ? accs.filter((a) => a.email === identifier.trim())
        : accs;
      if (filtered.length === 1) {
        setSelectedAccount(filtered[0]);
        setStage("password");
      } else {
        setAccountsList(filtered);
        setStage("picker");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const submitPassword = async () => {
    if (!password) return toast.error("Enter password");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/login-with-code", {
        user_code: selectedAccount.user_code,
        password,
      });
      localStorage.setItem("evergro_token", data.token);
      await refresh();
      toast.success(`Welcome back, ${data.user.name}!`);
      goHome(data.user);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Wrong password");
    } finally { setBusy(false); }
  };

  // ============ USERNAME FAST PATH ============
  const submitUsernameLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return toast.error("Enter username and password");
    setBusy(true);
    try {
      const u = await authLogin(username.trim().toLowerCase(), password);
      toast.success(`Welcome back, ${u.name}!`);
      goHome(u);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Wrong username or password");
    } finally { setBusy(false); }
  };

  const resetFlow = () => {
    setStage("input");
    setSelectedAccount(null);
    setAccountsList(null);
    setOtp("");
    setDevOtp("");
    setPassword("");
    confirmationRef.current = null;
  };

  const tabs = [
    { id: "mobile", label: "Mobile", icon: Phone },
    { id: "email", label: "Email", icon: Mail },
    { id: "username", label: "Username", icon: User },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-white to-[#ECFCCB]/40 px-4 py-10" data-testid="login-page">
      <div id="recaptcha-container"/>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-md card-soft p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#ECFCCB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#65A30D]"/>
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-[#064E3B] leading-tight">Welcome back</h1>
            <p className="text-xs text-[#64748B]">Sign in with mobile, email, or username</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-[#F1F5F9] p-1 rounded-full w-full mb-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-sm font-semibold transition-colors ${tab === t.id ? "bg-white text-[#064E3B] shadow-sm" : "text-[#64748B]"}`}
                data-testid={`login-tab-${t.id}`}
              >
                <Icon className="w-3.5 h-3.5"/> {t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* ==================== USERNAME TAB (fast) ==================== */}
          {tab === "username" && (
            <motion.form key="user-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={submitUsernameLogin} className="space-y-3" data-testid="username-login-form">
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Username</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
                  <input
                    className="input-soft pl-10 lowercase"
                    placeholder="e.g. yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    data-testid="login-username-input"
                    autoComplete="username"
                  />
                </div>
                <p className="text-[10px] text-[#65A30D] mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3"/> Usernames are unique — fastest way to sign in.</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
                  <input
                    type={showPw ? "text" : "password"}
                    className="input-soft pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="login-password-input"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" aria-label="Toggle password visibility">
                    {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full justify-center" data-testid="login-submit-btn">
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="text-[#64748B] hover:text-[#065F46]" data-testid="forgot-password-link">Forgot password?</Link>
                <Link to="/join-now" className="text-[#84CC16] font-semibold">Create account →</Link>
              </div>
            </motion.form>
          )}

          {/* ==================== MOBILE / EMAIL TABS ==================== */}
          {(tab === "mobile" || tab === "email") && stage === "input" && (
            <motion.div key={`ident-${tab}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3" data-testid={`${tab}-input-stage`}>
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">{tab === "mobile" ? "Mobile Number" : "Email Address"}</label>
                <div className="relative mt-1">
                  {tab === "mobile" ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/> : <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>}
                  <input
                    className={`input-soft pl-10 ${tab === "mobile" ? "font-numbers" : ""}`}
                    placeholder={tab === "mobile" ? "10-digit mobile" : "you@example.com"}
                    value={identifier}
                    onChange={(e) => setIdentifier(tab === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitIdentifier()}
                    data-testid={`login-${tab}-input`}
                    inputMode={tab === "mobile" ? "numeric" : "email"}
                  />
                </div>
              </div>
              <button onClick={submitIdentifier} disabled={busy} className="btn-primary w-full justify-center" data-testid="login-continue-btn">
                {busy ? "Checking…" : "Continue"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="text-[#64748B] hover:text-[#065F46]" data-testid="forgot-password-link">Forgot password?</Link>
                <Link to="/join-now" className="text-[#84CC16] font-semibold">Create account →</Link>
              </div>
            </motion.div>
          )}

          {/* OTP stage (multi-account) */}
          {(tab === "mobile" || tab === "email") && stage === "otp" && (
            <motion.div key="otp-stage" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3" data-testid="otp-stage">
              <div className="rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#065F46] text-white p-4">
                <div className="text-xs uppercase tracking-widest text-[#84CC16] font-bold mb-1">Multiple accounts</div>
                <div className="font-display font-black text-lg">Verify OTP to continue</div>
                <div className="text-xs text-white/70">Sent to your registered mobile.</div>
              </div>
              {devOtp && (
                <div className="text-xs bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-lg p-3" data-testid="dev-otp-display">
                  Preview — Your OTP: <b>{devOtp}</b>
                </div>
              )}
              <input
                className="input-soft font-numbers tracking-widest text-center text-xl"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                maxLength={6}
                data-testid="otp-code-input"
              />
              <button onClick={verifyOtp} disabled={busy || otp.length < 4} className="btn-primary w-full justify-center" data-testid="verify-otp-btn">
                {busy ? "Verifying…" : "Verify OTP"}
              </button>
              <button onClick={resetFlow} className="text-sm text-[#64748B] hover:text-[#065F46] w-full text-center" data-testid="cancel-otp-btn">
                <ArrowLeft className="w-3 h-3 inline"/> Change {tab === "mobile" ? "number" : "email"}
              </button>
            </motion.div>
          )}

          {/* Picker stage */}
          {(tab === "mobile" || tab === "email") && stage === "picker" && accountsList && (
            <motion.div key="picker-stage" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3" data-testid="multi-account-picker">
              <div className="rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#065F46] text-white p-4">
                <div className="text-xs uppercase tracking-widest text-[#84CC16] font-bold mb-1">Pick an account</div>
                <div className="font-display font-black text-lg">{accountsList.length} accounts on this number</div>
              </div>
              {accountsList.map((a) => (
                <button
                  key={a.user_code}
                  onClick={() => { setSelectedAccount(a); setStage("password"); }}
                  className="w-full text-left card-soft p-4 hover:border-[#84CC16] hover:-translate-y-0.5 transition-all flex items-center justify-between group"
                  data-testid={`pick-account-${a.user_code}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#84CC16] to-[#65A30D] flex items-center justify-center text-white font-black">
                      {(a.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-[#064E3B]">{a.name}</div>
                      {a.username && <div className="text-xs text-[#65A30D] font-semibold">@{a.username}</div>}
                      <div className="text-[10px] text-[#94A3B8] font-numbers">{a.user_code} · {a.is_joining_paid ? "✓ Active" : "Pending"}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#84CC16] group-hover:translate-x-1 transition-transform"/>
                </button>
              ))}
              <button onClick={resetFlow} className="text-sm text-[#64748B] hover:text-[#065F46] w-full text-center" data-testid="cancel-picker-btn">
                <ArrowLeft className="w-3 h-3 inline"/> Use a different {tab === "mobile" ? "number" : "email"}
              </button>
            </motion.div>
          )}

          {/* Password stage (after single-account lookup OR after picker) */}
          {(tab === "mobile" || tab === "email") && stage === "password" && selectedAccount && (
            <motion.div key="pw-stage" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3" data-testid="password-stage">
              <div className="card-soft p-4 flex items-center gap-3 bg-[#ECFCCB]/40 border-[#84CC16]/30">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#84CC16] to-[#65A30D] flex items-center justify-center text-white font-black">
                  {(selectedAccount.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[#064E3B]">{selectedAccount.name}</div>
                  {selectedAccount.username && <div className="text-xs text-[#65A30D] font-semibold">@{selectedAccount.username}</div>}
                  <div className="text-[10px] text-[#94A3B8] font-numbers">{selectedAccount.user_code}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
                  <input
                    type={showPw ? "text" : "password"}
                    className="input-soft pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                    data-testid="login-password-input"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                    {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              <button onClick={submitPassword} disabled={busy || !password} className="btn-primary w-full justify-center" data-testid="login-submit-btn">
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="text-[#64748B] hover:text-[#065F46]" data-testid="forgot-password-link">Forgot password?</Link>
                <button onClick={resetFlow} className="text-[#84CC16] font-semibold" data-testid="use-diff-account-btn">
                  Use a different account
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center text-sm text-[#64748B] mt-6 pt-4 border-t border-[#E2E8F0]">
          Don&apos;t have an account? <Link to="/join-now" className="text-[#84CC16] font-semibold">Join Free</Link>
        </div>
      </motion.div>
    </div>
  );
}
